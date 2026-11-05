import { expect, type Page } from "@playwright/test";
import { openDeskAction, test } from "./fixtures";

const FIRST_URL = "https://www.youtube.com/watch?v=jNQXAC9IVRw";
const SECOND_URL = "https://youtu.be/aqz-KE-bpKQ";
const MANUAL_STEPS = /Consultar link|Carregar prévia|Preparar trecho/u;
const ready = {
  duration: 8,
  error: null,
  filename: "Fonte.mp3",
  id: "auto-source",
  message: "Pronto",
  progress: 100,
  status: "ready",
};

test("o botão fica em loading até a onda terminar e entrega o editor focado", async ({
  page,
}) => {
  let waveformRequested = false;
  let finishDownload: () => void = () => undefined;
  const downloadGate = new Promise<void>((resolve) => {
    finishDownload = resolve;
  });
  let finishWaveform: () => void = () => undefined;
  const waveformGate = new Promise<void>((resolve) => {
    finishWaveform = resolve;
  });
  const processing = {
    ...ready,
    duration: null,
    filename: null,
    message: "Baixando áudio…",
    progress: 37,
    status: "downloading",
  };
  await page.route("**/api/youtube/metadata", (route) =>
    route.fulfill({
      json: { duration: 8, title: "Áudio para editar", url: FIRST_URL },
    })
  );
  await page.route("**/api/audio-jobs", (route) =>
    route.fulfill({ json: processing, status: 202 })
  );
  await page.route("**/api/audio-jobs/auto-source", async (route) => {
    if (route.request().method() === "DELETE") {
      await route.fulfill({ status: 204 });
      return;
    }
    await downloadGate;
    await route.fulfill({ json: ready });
  });
  await page.route("**/api/audio-jobs/auto-source/waveform", async (route) => {
    waveformRequested = true;
    await waveformGate;
    await route.fulfill({ json: { duration: 8, peaks: [0, 0.2, 0.7, 0] } });
  });
  await page.setViewportSize({ height: 600, width: 1366 });
  await openYouTube(page);
  await page.getByLabel("Link do YouTube").fill(FIRST_URL);
  const loading = page.getByRole("button", {
    exact: true,
    name: "Carregando áudio…",
  });
  await expect(loading).toBeDisabled({ timeout: 2500 });
  await expect(loading).toHaveAttribute("aria-busy", "true");
  await expect(
    page.getByRole("progressbar", { name: "Progresso do áudio" })
  ).toHaveAttribute("value", "37");
  await expect(page.getByLabel("Nome do áudio")).toHaveCount(0);
  await page.screenshot({ path: ".qa/audio-loading-progress.png" });
  finishDownload();
  await expect.poll(() => waveformRequested).toBe(true);
  await expect(loading).toBeDisabled();
  await expect(page.getByLabel("Nome do áudio")).toHaveCount(0);
  finishWaveform();
  await expect(
    page.getByRole("region", { exact: true, name: "Seleção do áudio" })
  ).toBeFocused();
  await expect(
    page.getByRole("img", { name: "Forma de onda do áudio" })
  ).toBeInViewport({ ratio: 1 });
  await expect(
    page.getByRole("button", { exact: true, name: "Adicionar à biblioteca" })
  ).toBeEnabled();
  await expect(loading).toHaveCount(0);
  await page.screenshot({ path: ".qa/audio-ready-handoff.png" });
  expect(await page.pageErrors()).toEqual([]);
});

async function openYouTube(page: Page) {
  await page.goto("/");
  await openDeskAction(page, "Importar áudios");
  await page
    .getByRole("button", { exact: true, name: "Importar do YouTube" })
    .click();
}

test("colar um link carrega a onda após debounce, sem etapas manuais", async ({
  page,
}) => {
  const consulted: string[] = [];
  const prepared: unknown[] = [];
  await page.route("**/api/youtube/metadata", (route) => {
    const { url } = route.request().postDataJSON();
    consulted.push(url);
    return route.fulfill({ json: { duration: 8, title: "Nova trilha", url } });
  });
  await page.route("**/api/audio-jobs", (route) => {
    prepared.push(route.request().postDataJSON());
    return route.fulfill({ json: ready, status: 202 });
  });
  await page.route("**/api/audio-jobs/auto-source/waveform", (route) =>
    route.fulfill({ json: { duration: 8, peaks: [0, 0.1, 0.7, 0.2, 0] } })
  );
  await page.route("**/api/audio-jobs/auto-source", (route) =>
    route.fulfill({ status: 204 })
  );
  await openYouTube(page);
  await page.clock.install();
  const link = page.getByLabel("Link do YouTube");
  await link.fill("https://www.youtube.com/watch?v=");
  await page.clock.runFor(800);
  expect(consulted).toEqual([]);
  await link.fill(FIRST_URL);
  await page.clock.runFor(400);
  expect(consulted).toEqual([]);
  await link.fill(SECOND_URL);
  await page.clock.runFor(800);
  await expect.poll(() => consulted, { timeout: 2000 }).toEqual([SECOND_URL]);
  await expect(
    page.getByRole("img", { name: "Forma de onda do áudio" })
  ).toBeVisible();
  expect(prepared).toEqual([
    expect.objectContaining({ purpose: "preview", url: SECOND_URL }),
  ]);
  await expect(
    page.getByRole("button", {
      name: MANUAL_STEPS,
    })
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { exact: true, name: "Adicionar à biblioteca" })
  ).toBeEnabled();
  expect(await page.pageErrors()).toEqual([]);
});

test("trocar o link descarta uma tarefa antiga que termina depois da nova", async ({
  page,
}) => {
  let releaseOld: () => void = () => undefined;
  const oldResponse = new Promise<void>((resolve) => {
    releaseOld = resolve;
  });
  let sourceRequests = 0;
  const removed: string[] = [];
  await page.route("**/api/youtube/metadata", (route) => {
    const { url } = route.request().postDataJSON();
    return route.fulfill({
      json: { duration: 8, title: url === FIRST_URL ? "Antiga" : "Nova", url },
    });
  });
  await page.route("**/api/audio-jobs", async (route) => {
    sourceRequests += 1;
    const old = route.request().postDataJSON().url === FIRST_URL;
    if (old) {
      await oldResponse;
    }
    await route.fulfill({
      json: { ...ready, id: old ? "old-source" : "new-source" },
      status: 202,
    });
  });
  await page.route("**/api/audio-jobs/*/waveform", (route) =>
    route.fulfill({ json: { duration: 8, peaks: [0, 0.5, 0] } })
  );
  await page.route("**/api/audio-jobs/*", (route) => {
    removed.push(route.request().url().split("/").at(-1) ?? "");
    return route.fulfill({ status: 204 });
  });
  await openYouTube(page);
  const link = page.getByLabel("Link do YouTube");
  await link.fill(FIRST_URL);
  await expect.poll(() => sourceRequests).toBe(1);
  await expect(link).toBeEditable();
  await link.fill(SECOND_URL);
  await expect(
    page.getByRole("img", { name: "Forma de onda do áudio" })
  ).toBeVisible();
  await expect(page.getByLabel("Nome do áudio")).toHaveValue("Nova");
  releaseOld();
  await expect.poll(() => removed).toContain("old-source");
  expect(sourceRequests).toBe(2);
  await expect(page.getByLabel("Nome do áudio")).toHaveValue("Nova");
  await page.getByRole("button", { exact: true, name: "Fechar" }).click();
  await expect.poll(() => removed).toContain("new-source");
  expect(await page.pageErrors()).toEqual([]);
});

test("fechar durante o debounce não inicia consulta nem download", async ({
  page,
}) => {
  let requests = 0;
  await page.route("**/api/youtube/metadata", (route) => {
    requests += 1;
    return route.fulfill({
      json: { duration: 8, title: "Fonte", url: FIRST_URL },
    });
  });
  await openYouTube(page);
  await page.clock.install();
  await page.getByLabel("Link do YouTube").fill(FIRST_URL);
  await page.getByRole("button", { exact: true, name: "Fechar" }).click();
  await page.clock.runFor(1500);
  expect(requests).toBe(0);
  expect(await page.pageErrors()).toEqual([]);
});

test("falha de consulta mostra o motivo e permite tentar novamente sem repetir sozinha", async ({
  page,
}) => {
  let attempts = 0;
  await page.route("**/api/youtube/metadata", (route) => {
    attempts += 1;
    return attempts === 1
      ? route.fulfill({
          json: { detail: "Não foi possível consultar este vídeo." },
          status: 503,
        })
      : route.fulfill({
          json: { duration: 8, title: "Fonte recuperada", url: FIRST_URL },
        });
  });
  await page.route("**/api/audio-jobs", (route) =>
    route.fulfill({ json: ready, status: 202 })
  );
  await page.route("**/api/audio-jobs/auto-source/waveform", (route) =>
    route.fulfill({ json: { duration: 8, peaks: [0, 0.3, 0] } })
  );
  await page.route("**/api/audio-jobs/auto-source", (route) =>
    route.fulfill({ status: 204 })
  );
  await openYouTube(page);
  await page.clock.install();
  await page.getByLabel("Link do YouTube").fill(FIRST_URL);
  await page.clock.runFor(800);
  await expect(page.getByRole("alert")).toContainText(
    "Não foi possível consultar este vídeo."
  );
  await page.clock.runFor(5000);
  expect(attempts).toBe(1);
  await page
    .getByRole("button", { exact: true, name: "Tentar novamente" })
    .click();
  await page.clock.runFor(800);
  await expect(
    page.getByRole("img", { name: "Forma de onda do áudio" })
  ).toBeVisible();
  expect(attempts).toBe(2);
  expect(await page.pageErrors()).toEqual([]);
});

for (const viewport of [
  { height: 600, width: 1366 },
  { height: 568, width: 320 },
]) {
  test(`a onda aparece sem rolar o formulário em ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.route("**/api/youtube/metadata", (route) =>
      route.fulfill({
        json: { duration: 138, title: "Forró de Primeira", url: FIRST_URL },
      })
    );
    await page.route("**/api/audio-jobs", (route) =>
      route.fulfill({ json: { ...ready, duration: 138 }, status: 202 })
    );
    await page.route("**/api/audio-jobs/auto-source/waveform", (route) =>
      route.fulfill({ json: { duration: 138, peaks: [0, 0.4, 0.8, 0.2, 0] } })
    );
    await openYouTube(page);
    await page.getByLabel("Link do YouTube").fill(FIRST_URL);
    const wave = page.getByRole("img", { name: "Forma de onda do áudio" });
    await expect(wave).toBeInViewport({ ratio: 1, timeout: 4000 });
    await expect(
      page.getByRole("button", { exact: true, name: "Adicionar à biblioteca" })
    ).toBeInViewport({ ratio: 1 });
    await page.screenshot({
      path: `.qa/waveform-visible-${viewport.width}.png`,
    });
    expect(await page.pageErrors()).toEqual([]);
  });
}
