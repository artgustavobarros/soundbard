import { createHash } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { wav } from "./fixtures";

const MUSIC_NAME = /\bCaminhada noturna\b/u;
const RAIN_NAME = /\bChuva real\b/u;
const SECOND_MUSIC_NAME = /Percussão/u;
const PLAYLIST_NAME = /\bEstrada à noite\b/u;

async function importSound(
  page: Page,
  kind: string,
  file: ReturnType<typeof wav>
) {
  await page
    .getByRole("button", { exact: true, name: "Importar áudios" })
    .click();
  await page
    .getByRole("button", { exact: true, name: "Arquivo de áudio" })
    .click();
  await page.getByLabel("Arquivos de áudio").setInputFiles(file);
  await page.getByLabel("Tipo do áudio").selectOption(kind);
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

async function dismissNotifications(page: Page): Promise<void> {
  const notifications = page.locator("[data-sonner-toast]");
  const previousCount = await notifications.count();
  if (previousCount === 0) {
    return;
  }
  await page
    .locator('[data-sonner-toast][data-front="true"]')
    .getByRole("button", { exact: true, name: "Fechar aviso" })
    .click();
  await expect.poll(() => notifications.count()).toBeLessThan(previousCount);
  await dismissNotifications(page);
}

test.beforeEach(({ page }) => {
  page.setDefaultTimeout(10_000);
});

test.afterEach(async ({ page }) => {
  expect(await page.pageErrors()).toEqual([]);
});

test("a página principal usa a mesa MIDI e os pads controlam áudio real independentemente", async ({
  page,
}) => {
  await page.setViewportSize({ height: 900, width: 1440 });
  await page.goto("/");
  await expect(page.locator("[data-soundboard-desk]")).toBeVisible();
  await expect(
    page.getByText("Prévia visual · sem áudio", { exact: true })
  ).toHaveCount(0);
  const music = wav("Caminhada noturna", 220, 30);
  const rain = wav("Chuva real", 130, 30);
  const secondMusic = wav("Percussão", 330, 30);
  const musicId = createHash("sha256").update(music.buffer).digest("hex");
  const rainId = createHash("sha256").update(rain.buffer).digest("hex");
  await importSound(page, "music", music);
  await importSound(page, "ambience", rain);
  await importSound(page, "music", secondMusic);
  const musicPad = pad(page, MUSIC_NAME);
  const rainPad = pad(page, RAIN_NAME);
  await musicPad.click();
  await pad(page, SECOND_MUSIC_NAME).click();
  await rainPad.click();
  const musicAudio = page.locator(`audio[data-sound-id="${musicId}"]`);
  const rainAudio = page.locator(`audio[data-sound-id="${rainId}"]`);
  await expect
    .poll(() =>
      musicAudio.evaluate(
        (audio) =>
          audio instanceof HTMLAudioElement &&
          audio.currentTime > 0.2 &&
          !audio.paused
      )
    )
    .toBe(true);
  await expect
    .poll(() =>
      rainAudio.evaluate(
        (audio) =>
          audio instanceof HTMLAudioElement &&
          audio.currentTime > 0.2 &&
          !audio.paused
      )
    )
    .toBe(true);
  await expect(musicPad).toHaveAttribute("aria-pressed", "true");
  await expect(rainPad).toHaveAttribute("aria-pressed", "true");
  await musicPad.click();
  await expect
    .poll(() =>
      musicAudio.evaluate(
        (audio) => audio instanceof HTMLAudioElement && audio.paused
      )
    )
    .toBe(true);
  await expect
    .poll(() =>
      rainAudio.evaluate(
        (audio) => audio instanceof HTMLAudioElement && !audio.paused
      )
    )
    .toBe(true);
  await expect(musicPad).toContainText("Pausado");
  const otherId = createHash("sha256").update(secondMusic.buffer).digest("hex");
  await expect
    .poll(() =>
      page
        .locator(`audio[data-sound-id="${otherId}"]`)
        .evaluate(
          (audio) =>
            audio instanceof HTMLAudioElement &&
            !audio.paused &&
            audio.currentTime > 0
        )
    )
    .toBe(true);
  await musicPad.click();
  await expect
    .poll(() =>
      musicAudio.evaluate(
        (audio) => audio instanceof HTMLAudioElement && !audio.paused
      )
    )
    .toBe(true);
  await page
    .getByRole("button", { exact: true, name: "Controlar Caminhada noturna" })
    .click();
  await page.getByRole("button", { exact: true, name: "Parar pad" }).click();
  await expect(musicAudio).toHaveCount(0);
  await expect(rainAudio).toHaveCount(1);
  await page.screenshot({ path: ".qa/live-desk-desktop.png" });
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    accessibility.violations.filter(
      (violation) =>
        violation.impact === "critical" || violation.impact === "serious"
    )
  ).toEqual([]);
  await page.setViewportSize({ height: 844, width: 390 });
  await expect(
    page.getByRole("region", { exact: true, name: "Controles do pad" })
  ).toBeInViewport({ ratio: 1 });
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <= innerWidth &&
        document.documentElement.scrollHeight <= innerHeight
    )
  ).toBe(true);
  await page.screenshot({ path: ".qa/live-desk-mobile.png" });
  await dismissNotifications(page);
  await page.setViewportSize({ height: 320, width: 568 });
  await expect(
    page.getByRole("region", { exact: true, name: "Controles do pad" })
  ).toBeInViewport({ ratio: 1 });
  await expect
    .poll(async () => {
      const board = await musicPad.boundingBox();
      const controls = await page
        .getByRole("region", { exact: true, name: "Controles do pad" })
        .boundingBox();
      return Boolean(board && controls && board.y + board.height <= controls.y);
    })
    .toBe(true);
  await page.screenshot({ path: ".qa/live-desk-landscape.png" });
  await page.getByRole("button", { exact: true, name: "Parar tudo" }).click();
  await expect(page.locator("audio")).toHaveCount(0);
  await page.reload();
  await expect(pad(page, MUSIC_NAME)).toBeVisible();
  await expect(pad(page, RAIN_NAME)).toBeVisible();
});

test("salva e reabre um grupo de pads da biblioteca real", async ({ page }) => {
  await page.goto("/");
  await importSound(page, "music", wav("Caminhada noturna", 220, 30));
  await importSound(page, "ambience", wav("Chuva real", 130, 30));
  await page
    .getByRole("button", { exact: true, name: "Personalizado" })
    .click();
  await page
    .getByRole("menuitem", { exact: true, name: "Criar grupo de pads" })
    .click();
  await page.getByLabel("Nome do grupo").fill("Estrada chuvosa");
  await page
    .getByRole("checkbox", { exact: true, name: "Caminhada noturna" })
    .check();
  await page.getByRole("checkbox", { exact: true, name: "Chuva real" }).check();
  await page.getByRole("button", { exact: true, name: "Salvar grupo" }).click();
  await expect(
    page.getByRole("heading", { exact: true, name: "Estrada chuvosa" })
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { exact: true, name: "Personalizado" })
    .click();
  await page
    .getByRole("menuitemradio", { exact: true, name: "Estrada chuvosa" })
    .click();
  await expect(pad(page, MUSIC_NAME)).toBeVisible();
  await expect(pad(page, RAIN_NAME)).toBeVisible();
});

test("o pad de playlist troca faixas sem interromper o ambiente", async ({
  page,
}) => {
  await page.goto("/");
  const first = wav("Primeira trilha", 220, 30);
  const second = wav("Segunda trilha", 330, 30);
  const rain = wav("Chuva real", 130, 30);
  const firstId = createHash("sha256").update(first.buffer).digest("hex");
  const secondId = createHash("sha256").update(second.buffer).digest("hex");
  const rainId = createHash("sha256").update(rain.buffer).digest("hex");
  await importSound(page, "music", first);
  await importSound(page, "music", second);
  await importSound(page, "ambience", rain);
  await page
    .getByRole("button", { exact: true, name: "Nova playlist" })
    .click();
  await page.getByLabel("Nome da playlist").fill("Estrada à noite");
  await page
    .getByRole("checkbox", { exact: true, name: "Primeira trilha" })
    .check();
  await page
    .getByRole("checkbox", { exact: true, name: "Segunda trilha" })
    .check();
  await page.getByLabel("Repetição", { exact: true }).selectOption("all");
  await page.getByRole("button", { exact: true, name: "Salvar" }).click();
  await expect(page.locator(".editor[role=dialog]")).not.toBeVisible();
  await page
    .getByRole("button", { exact: true, name: "Voltar à mesa" })
    .click();
  await pad(page, RAIN_NAME).click();
  const playlist = pad(page, PLAYLIST_NAME);
  await playlist.click();
  await expect(page.locator('audio[data-role="music"]')).toHaveAttribute(
    "data-sound-id",
    firstId
  );
  const rainAudio = page.locator(`audio[data-sound-id="${rainId}"]`);
  const rainUrl = await rainAudio.getAttribute("src");
  await page
    .getByRole("button", { exact: true, name: "Próxima música" })
    .click();
  await expect(page.locator('audio[data-role="music"]')).toHaveAttribute(
    "data-sound-id",
    secondId
  );
  await expect(playlist).toContainText("Segunda trilha");
  await expect(rainAudio).toHaveAttribute("src", rainUrl ?? "");
  await playlist.click();
  await expect
    .poll(() =>
      page
        .locator('audio[data-role="music"]')
        .evaluate((audio) => audio instanceof HTMLAudioElement && audio.paused)
    )
    .toBe(true);
  await expect
    .poll(() =>
      rainAudio.evaluate(
        (audio) => audio instanceof HTMLAudioElement && !audio.paused
      )
    )
    .toBe(true);
  await playlist.click();
  await page.getByRole("button", { exact: true, name: "Parar pad" }).click();
  await expect(page.locator('audio[data-role="music"]')).toHaveCount(0);
  await expect(rainAudio).toHaveCount(1);
});

test("uma cena de Combate permanece na categoria correta após recarregar", async ({
  page,
}) => {
  await page.goto("/");
  await importSound(page, "effect", wav("Espada", 440, 4));
  await page.getByRole("button", { exact: true, name: "Biblioteca" }).click();
  await page
    .getByRole("button", { exact: true, name: "Gerenciar cenas" })
    .click();
  await page.getByRole("button", { exact: true, name: "Criar cena" }).click();
  await page.getByLabel("Nome da cena").fill("Batalha no bosque");
  await page.getByLabel("Tipo da cena").selectOption("combat");
  await page.getByRole("checkbox", { exact: true, name: "Espada" }).check();
  await page.getByRole("button", { exact: true, name: "Salvar" }).click();
  await expect(page.locator(".editor[role=dialog]")).not.toBeVisible();
  await page
    .getByRole("button", { exact: true, name: "Voltar à mesa" })
    .click();
  await page.reload();
  await page.getByRole("button", { exact: true, name: "Cenas" }).click();
  await page.getByRole("menuitem", { exact: true, name: "Combate" }).click();
  await page
    .getByRole("menuitemradio", { exact: true, name: "Batalha no bosque" })
    .click();
  await expect(
    page.getByRole("heading", { exact: true, name: "Batalha no bosque" })
  ).toBeVisible();
  await expect(
    page
      .getByRole("region", { exact: true, name: "Pads de Batalha no bosque" })
      .locator("button[aria-pressed]")
  ).toHaveCount(1);
  await expect(page.locator("audio")).toHaveCount(0);
});
