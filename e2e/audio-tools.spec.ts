import { readFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { wav } from "./fixtures";

const PREPARED_PAD = /Trilha recortada/u;
const ORIGINAL_PAD = /Áudio original/u;
const CLIPPED_PAD = /Trecho local/u;
const YOUTUBE_URL = "https://www.youtube.com/watch?v=jNQXAC9IVRw";
const jobId = "12345678-1234-1234-1234-123456789abc";
const clipId = "22345678-1234-1234-1234-123456789abc";

async function openYouTube(page: Page) {
  await page
    .getByRole("button", { exact: true, name: "Importar áudios" })
    .click();
  await page
    .getByRole("button", { exact: true, name: "Importar do YouTube" })
    .click();
  await expect(page.getByLabel("Link do YouTube")).toBeVisible();
}

async function importOriginal(page: Page) {
  await page
    .getByRole("button", { exact: true, name: "Importar áudios" })
    .click();
  await page
    .getByRole("button", { exact: true, name: "Arquivo de áudio" })
    .click();
  await page
    .getByLabel("Arquivos de áudio")
    .setInputFiles(wav("Áudio original", 220, 8));
  await page
    .getByRole("button", { exact: true, name: "Adicionar à biblioteca" })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
}

function pad(page: Page, name: RegExp) {
  return page
    .getByRole("button", { name })
    .and(page.locator("button[aria-pressed]"));
}

const queuedJob = {
  duration: null,
  error: null,
  filename: null,
  id: jobId,
  message: "Aguardando download",
  progress: 0,
  status: "queued",
};

async function metadataRoutes(page: Page) {
  await page.route("**/api/health", (route) =>
    route.fulfill({
      json: { ffmpeg: true, status: "ok", youtube: true },
    })
  );
  await page.route("**/api/youtube/metadata", (route) =>
    route.fulfill({
      json: { duration: 8, title: "Trilha de origem", url: YOUTUBE_URL },
    })
  );
}

async function configureYouTube(page: Page) {
  await page.getByLabel("Link do YouTube").fill(YOUTUBE_URL);
  await expect(
    page.getByRole("img", { exact: true, name: "Forma de onda do áudio" })
  ).toBeVisible();
  await page.getByLabel("Nome do áudio").fill("Trilha recortada");
  await page.getByLabel("Tipo do áudio").selectOption("ambience");
  await page.getByLabel("Início (segundos)").fill("1");
  await page.getByLabel("Fim (segundos)").fill("3");
}

test.beforeEach(({ page }) => {
  page.setDefaultTimeout(10_000);
});

test.afterEach(async ({ page }) => {
  expect(await page.pageErrors()).toEqual([]);
});

test("importa o áudio preparado por link com intervalo escolhido e o mantém nos pads", async ({
  page,
}) => {
  let sourceSubmitted: unknown = null;
  let submitted: unknown = null;
  let sourceRequests = 0;
  let polls = 0;
  const removed = new Set<string>();
  const audio = await readFile("e2e/audio/tone.mp3");
  const sourceAudio = await readFile("e2e/audio/preview-tone.mp3");
  await metadataRoutes(page);
  await page.route("**/api/audio-jobs", async (route) => {
    sourceSubmitted = route.request().postDataJSON();
    sourceRequests += 1;
    await route.fulfill({ json: queuedJob, status: 202 });
  });
  await page.route(`**/api/audio-jobs/${jobId}`, async (route) => {
    if (route.request().method() === "DELETE") {
      removed.add(jobId);
      await route.fulfill({ status: 204 });
      return;
    }
    await route.fulfill({
      json: {
        ...queuedJob,
        duration: 8,
        filename: "Prévia.mp3",
        message: "Prévia pronta",
        progress: 100,
        status: "ready",
      },
    });
  });
  await page.route(`**/api/audio-jobs/${jobId}/waveform`, (route) =>
    route.fulfill({
      json: { duration: 8, peaks: Array.from({ length: 1024 }, () => 0.125) },
    })
  );
  await page.route(`**/api/audio-jobs/${jobId}/file`, (route) =>
    route.fulfill({ body: sourceAudio, contentType: "audio/mpeg" })
  );
  await page.route(`**/api/audio-jobs/${jobId}/clips`, async (route) => {
    submitted = route.request().postDataJSON();
    await route.fulfill({ json: { ...queuedJob, id: clipId }, status: 202 });
  });
  await page.route(`**/api/audio-jobs/${clipId}`, async (route) => {
    if (route.request().method() === "DELETE") {
      removed.add(clipId);
      await route.fulfill({ status: 204 });
      return;
    }
    polls += 1;
    await route.fulfill({
      json:
        polls === 1
          ? {
              ...queuedJob,
              id: clipId,
              message: "Preparando trecho",
              progress: 80,
              status: "processing",
            }
          : {
              ...queuedJob,
              duration: 2,
              filename: "Trilha recortada.mp3",
              id: clipId,
              message: "Áudio pronto",
              progress: 100,
              status: "ready",
            },
    });
  });
  await page.route(`**/api/audio-jobs/${clipId}/file`, (route) =>
    route.fulfill({ body: audio, contentType: "audio/mpeg" })
  );
  await page.goto("/");
  await openYouTube(page);
  await configureYouTube(page);
  expect(sourceSubmitted).toMatchObject({
    end: null,
    purpose: "preview",
    start: 0,
    url: YOUTUBE_URL,
  });
  await page.getByLabel("Fim (segundos)").fill("4");
  await page.getByLabel("Fim (segundos)").fill("3");
  await expect(
    page.getByRole("button", { exact: true, name: "Adicionar à biblioteca" })
  ).toBeEnabled();
  await page
    .getByRole("button", { exact: true, name: "Adicionar à biblioteca" })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect(submitted).toMatchObject({
    end: 3,
    name: "Trilha recortada",
    start: 1,
  });
  await expect.poll(() => removed.has(jobId) && removed.has(clipId)).toBe(true);
  expect(sourceRequests).toBe(1);
  await expect(pad(page, PREPARED_PAD)).toContainText("Ambiente");
  await pad(page, PREPARED_PAD).click();
  await expect
    .poll(() =>
      page
        .locator("audio[data-sound-id]")
        .evaluateAll((elements) =>
          elements.some(
            (element) =>
              element instanceof HTMLAudioElement &&
              !element.paused &&
              element.currentTime > 0.2
          )
        )
    )
    .toBe(true);
  await page.reload();
  await expect(pad(page, PREPARED_PAD)).toBeVisible();
});

test("corta um arquivo local com FFmpeg e preserva o original na biblioteca", async ({
  page,
}) => {
  await page.goto("/");
  await importOriginal(page);
  await page
    .getByRole("button", { exact: true, name: "Controlar Áudio original" })
    .click();
  await page.getByRole("button", { exact: true, name: "Editar pad" }).click();
  await page.getByRole("button", { exact: true, name: "Cortar áudio" }).click();
  await expect(
    page.getByRole("img", { exact: true, name: "Forma de onda do áudio" })
  ).toBeVisible({ timeout: 30_000 });
  await page.getByLabel("Nome do áudio").fill("Trecho local");
  await page.getByLabel("Início (segundos)").fill("1");
  await page.getByLabel("Fim (segundos)").fill("3");
  await expect(
    page.getByRole("button", { exact: true, name: "Adicionar à biblioteca" })
  ).toBeEnabled({ timeout: 30_000 });
  await page
    .getByRole("button", { exact: true, name: "Adicionar à biblioteca" })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(pad(page, ORIGINAL_PAD)).toBeVisible();
  await expect(pad(page, CLIPPED_PAD)).toBeVisible();
  await pad(page, CLIPPED_PAD).click();
  await expect
    .poll(() =>
      page
        .locator("audio[data-sound-id]")
        .evaluateAll((elements) =>
          elements.some(
            (element) =>
              element instanceof HTMLAudioElement &&
              !element.paused &&
              element.currentTime > 0.1 &&
              element.duration > 1.8 &&
              element.duration < 2.3
          )
        )
    )
    .toBe(true);
  await page.reload();
  await pad(page, ORIGINAL_PAD).click();
  await expect
    .poll(() =>
      page
        .locator("audio[data-sound-id]")
        .evaluateAll((elements) =>
          elements.some(
            (element) =>
              element instanceof HTMLAudioElement &&
              !element.paused &&
              element.duration === 8
          )
        )
    )
    .toBe(true);
  await expect(pad(page, CLIPPED_PAD)).toBeVisible();
});

test("a indisponibilidade do backend permite fechar e continuar usando a biblioteca", async ({
  page,
}) => {
  await page.goto("/");
  await importOriginal(page);
  await page.route("**/api/**", (route) => route.abort("connectionrefused"));
  await openYouTube(page);
  await page.getByLabel("Link do YouTube").fill(YOUTUBE_URL);
  await expect(page.getByRole("alert")).toBeVisible();
  await page.getByRole("button", { exact: true, name: "Fechar" }).click();
  await expect(pad(page, ORIGINAL_PAD)).toBeVisible();
  await pad(page, ORIGINAL_PAD).click();
  await expect(page.locator("audio[data-sound-id]")).toHaveCount(1);
});

test("cancela uma preparação sem importar e mantém o diálogo utilizável no celular", async ({
  page,
}) => {
  let cancelled = false;
  await metadataRoutes(page);
  await page.route("**/api/audio-jobs", (route) =>
    route.fulfill({ json: queuedJob, status: 202 })
  );
  await page.route(`**/api/audio-jobs/${jobId}`, async (route) => {
    if (route.request().method() === "DELETE") {
      cancelled = true;
      await route.fulfill({ status: 204 });
      return;
    }
    await route.fulfill({
      json: {
        ...queuedJob,
        message: "Baixando áudio",
        progress: 20,
        status: "downloading",
      },
    });
  });
  await page.setViewportSize({ height: 568, width: 320 });
  await page.goto("/");
  await openYouTube(page);
  await page.getByLabel("Link do YouTube").fill(YOUTUBE_URL);
  const cancel = page.getByRole("button", {
    exact: true,
    name: "Cancelar tarefa",
  });
  await expect(cancel).toBeVisible();
  await expect(cancel).toBeInViewport({ ratio: 1 });
  await expect(
    page.getByRole("progressbar", { name: "Progresso do áudio" })
  ).toBeInViewport({ ratio: 1 });
  await expect(
    page.getByRole("progressbar", { name: "Progresso do áudio" })
  ).toHaveAttribute("value", "20");
  const violations = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    violations.violations.filter(
      (violation) =>
        violation.impact === "critical" || violation.impact === "serious"
    )
  ).toEqual([]);
  await page.screenshot({ path: ".qa/audio-tools-mobile.png" });
  await cancel.click();
  await expect.poll(() => cancelled).toBe(true);
  await expect(
    page.getByRole("button", { exact: true, name: "Tentar novamente" })
  ).toBeEnabled();
  await page.getByRole("button", { exact: true, name: "Fechar" }).click();
  await expect(page.locator("[data-soundboard-desk]")).toBeVisible();
  await expect(page.locator("audio[data-sound-id]")).toHaveCount(0);
});
