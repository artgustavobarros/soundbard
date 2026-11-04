import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { wav } from "./fixtures";

const BACKUP_ERROR = /Backup|backup/u;
const FILE_EXTENSION = /\.[^.]+$/u;

function inOrder<T>(items: T[], action: (item: T) => Promise<void>) {
  return items.reduce(
    (previous, item) => previous.then(() => action(item)),
    Promise.resolve()
  );
}

test.beforeEach(({ page }) => {
  page.setDefaultTimeout(10_000);
});
test.afterEach(async ({ page }) => {
  expect(await page.pageErrors()).toEqual([]);
});

function manager(page: Page) {
  return page.getByRole("dialog", {
    exact: true,
    name: "Biblioteca e organização",
  });
}

async function openLibrary(page: Page) {
  await page.getByRole("button", { exact: true, name: "Biblioteca" }).click();
  await expect(manager(page)).toBeVisible();
}

async function importFiles(
  page: Page,
  kind: string,
  files: ReturnType<typeof wav>[]
) {
  await page
    .getByRole("button", { exact: true, name: "Importar áudios" })
    .click();
  await page
    .getByRole("button", { exact: true, name: "Arquivo de áudio" })
    .click();
  await page.getByLabel("Arquivos de áudio").setInputFiles(files);
  await page.getByLabel("Tipo do áudio").selectOption(kind);
  await page
    .getByRole("button", { exact: true, name: "Adicionar à biblioteca" })
    .click();
  await expect(page.locator(".editor[role=dialog]")).not.toBeVisible({
    timeout: 30_000,
  });
  await openLibrary(page);
}
async function createPlaylist(
  page: Page,
  name: string,
  sounds: string[],
  repeat = "off"
) {
  await page.getByRole("button", { exact: true, name: "Playlists" }).click();
  await page
    .getByRole("button", { exact: true, name: "Nova playlist" })
    .click();
  await page.getByLabel("Nome da playlist").fill(name);
  await inOrder(sounds, (sound) =>
    page.getByRole("checkbox", { exact: true, name: sound }).check()
  );
  await page.getByLabel("Repetição", { exact: true }).selectOption(repeat);
  await page.getByRole("button", { exact: true, name: "Salvar" }).click();
  await expect(page.locator(".editor[role=dialog]")).not.toBeVisible();
}
async function createScene(
  page: Page,
  name: string,
  playlist: string,
  layers: string[],
  effects: string[] = []
) {
  await page
    .getByRole("button", { exact: true, name: "Gerenciar cenas" })
    .click();
  await page.getByRole("button", { exact: true, name: "Criar cena" }).click();
  await page.getByLabel("Nome da cena").fill(name);
  await page.getByLabel("Playlist da cena").selectOption({ label: playlist });
  await inOrder([...layers, ...effects], (sound) =>
    page.getByRole("checkbox", { exact: true, name: sound }).check()
  );
  await page.getByRole("button", { exact: true, name: "Salvar" }).click();
  await expect(page.locator(".editor[role=dialog]")).not.toBeVisible();
}

test("uma música participa de duas playlists e a remoção de uma não altera a outra", async ({
  page,
}) => {
  await page.goto("/");
  await importFiles(page, "music", [wav("Viagem"), wav("Suspense", 330)]);
  await createPlaylist(page, "Exploração", ["Viagem", "Suspense"]);
  await createPlaylist(page, "Descanso", ["Viagem"]);
  await page.getByRole("button", { exact: true, name: "Exploração 2" }).click();
  await page
    .getByRole("button", { exact: true, name: "Remover Viagem da playlist" })
    .click();
  await expect(
    page.getByRole("button", { exact: true, name: "Tocar Viagem" })
  ).not.toBeVisible();
  await page.getByRole("button", { exact: true, name: "Descanso 1" }).click();
  await expect(
    page.getByRole("button", { exact: true, name: "Tocar Viagem" })
  ).toBeVisible();
  await page.getByRole("button", { exact: true, name: "Biblioteca" }).click();
  await expect(
    page.getByRole("button", { exact: true, name: "Tocar Viagem" })
  ).toBeVisible();
});

test("preserva áudio compartilhado, sobrepõe efeitos e salva ajustes de cena", async ({
  page,
}) => {
  await page.setViewportSize({ height: 1000, width: 1440 });
  await page.goto("/");
  await importFiles(page, "music", [wav("Trilha de teste", 220, 20)]);
  await importFiles(page, "ambience", [
    wav("Chuva de teste", 130, 20),
    wav("Vento de teste", 170, 20),
  ]);
  await importFiles(page, "effect", [wav("Espada de teste", 500, 20)]);
  await createPlaylist(page, "Jornada", ["Trilha de teste"], "all");
  await createScene(
    page,
    "Estrada",
    "Jornada",
    ["Chuva de teste"],
    ["Espada de teste"]
  );
  await createScene(
    page,
    "Floresta",
    "Jornada",
    ["Chuva de teste", "Vento de teste"],
    ["Espada de teste"]
  );
  await page
    .getByRole("button", { exact: true, name: "Ativar cena Estrada" })
    .click();
  await expect.poll(() => page.locator("audio").count()).toBe(2);
  const rain = page.locator('audio[data-role="layer"]').first();
  const rainUrl = await rain.getAttribute("src");
  const musicUrl = await page
    .locator('audio[data-role="music"]')
    .getAttribute("src");
  await page
    .getByRole("button", { exact: true, name: "Ativar cena Floresta" })
    .click();
  await expect.poll(() => page.locator("audio").count()).toBe(3);
  await expect(page.locator(`audio[src="${rainUrl}"]`)).toHaveCount(1);
  await expect(page.locator('audio[data-role="music"]')).toHaveAttribute(
    "src",
    musicUrl ?? ""
  );
  await page
    .getByRole("button", { exact: true, name: "Disparar Espada de teste" })
    .click({ clickCount: 2 });
  await expect
    .poll(() => page.locator('audio[data-role="effect"]').count())
    .toBe(2);
  const slider = page.getByRole("slider", {
    exact: true,
    name: "Volume de Chuva de teste",
  });
  await slider.focus();
  await slider.press("Home");
  await inOrder(Array.from({ length: 10 }), () => slider.press("ArrowRight"));
  await page.getByRole("button", { exact: true, name: "Salvar cena" }).click();
  await expect(
    page.locator('[data-sonner-toast][data-type="success"]').filter({
      hasText: "Configuração da cena salva.",
    })
  ).toBeVisible();
  await page
    .getByRole("button", { exact: true, name: "Ativar cena Estrada" })
    .click();
  await page
    .getByRole("button", { exact: true, name: "Ativar cena Floresta" })
    .click();
  await expect(slider).toHaveValue("0.1");
  await page.screenshot({ fullPage: true, path: ".qa/desktop.png" });
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    accessibility.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    )
  ).toEqual([]);
  await page.setViewportSize({ height: 844, width: 390 });
  await page.screenshot({ fullPage: true, path: ".qa/mobile.png" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBe(true);
  await page.getByRole("button", { exact: true, name: "Parar tudo" }).click();
  await expect(page.locator("audio")).toHaveCount(0);
});

test("importa 100 arquivos e reproduz 10 sons simultâneos reais", async ({
  page,
}) => {
  await page.goto("/");
  await importFiles(
    page,
    "ambience",
    Array.from({ length: 100 }, (_, index) =>
      wav(`Ambiente ${String(index).padStart(3, "0")}`, 100 + index, 2)
    )
  );
  await expect(
    manager(page).getByText("100 sons", { exact: true })
  ).toBeVisible();
  await inOrder(
    Array.from({ length: 10 }, (_, index) => index),
    (index) =>
      page
        .getByRole("button", {
          exact: true,
          name: `Tocar Ambiente ${String(index).padStart(3, "0")}`,
        })
        .click()
  );
  await expect(
    manager(page).getByText("10 sons tocando", { exact: true })
  ).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator("audio")
        .evaluateAll(
          (elements) =>
            elements.filter(
              (audio) =>
                audio instanceof HTMLMediaElement &&
                audio.currentTime > 0 &&
                !audio.paused
            ).length
        )
    )
    .toBe(10);
  await page.getByRole("button", { exact: true, name: "Parar tudo" }).click();
  await expect(page.locator("audio")).toHaveCount(0);
});

test("avança automaticamente a playlist e permite avanço manual ao repetir uma música", async ({
  page,
}) => {
  const first = wav("Primeira música", 230, 1);
  const second = wav("Segunda música", 340, 2);
  const firstId = createHash("sha256").update(first.buffer).digest("hex");
  const secondId = createHash("sha256").update(second.buffer).digest("hex");
  await page.goto("/");
  await importFiles(page, "music", [first, second]);
  await createPlaylist(page, "Sequência", [
    "Primeira música",
    "Segunda música",
  ]);
  await page.getByRole("button", { exact: true, name: "Tocar" }).click();
  await expect
    .poll(
      () =>
        page.locator('audio[data-role="music"]').getAttribute("data-sound-id"),
      { intervals: [50, 100, 250] }
    )
    .toBe(secondId);
  await expect.poll(() => page.locator("audio").count()).toBe(0);
  await page.getByLabel("Repetição da playlist").selectOption("one");
  await page.getByRole("button", { exact: true, name: "Tocar" }).click();
  await expect(page.locator('audio[data-role="music"]')).toHaveAttribute(
    "data-sound-id",
    firstId
  );
  await expect
    .poll(() =>
      page
        .locator('audio[data-role="music"]')
        .evaluate(
          (element) => element instanceof HTMLMediaElement && element.loop
        )
    )
    .toBe(true);
  await page.getByRole("button", { exact: true, name: "Mixagem" }).click();
  await page
    .getByRole("button", { exact: true, name: "Próxima música" })
    .click();
  await expect(page.locator('audio[data-role="music"]')).toHaveAttribute(
    "data-sound-id",
    secondId
  );
});

test("restaura backup em outro navegador e preserva dados ao cancelar ou receber arquivo inválido", async ({
  page,
  browser,
}) => {
  await page.goto("/");
  await importFiles(page, "music", [wav("Tema original")]);
  await createPlaylist(page, "Sessão", ["Tema original"]);
  await page.getByRole("slider", { exact: true, name: "Volume geral" }).focus();
  await page
    .getByRole("slider", { exact: true, name: "Volume geral" })
    .press("Home");
  await expect(
    page.getByRole("button", { exact: true, name: "Exportar backup" })
  ).toBeEnabled();
  const downloadEvent = page.waitForEvent("download");
  await page
    .getByRole("button", { exact: true, name: "Exportar backup" })
    .click();
  const download = await downloadEvent;
  const path = await download.path();
  expect(path).toBeTruthy();
  if (!path) {
    throw new Error("Backup não foi baixado.");
  }
  const context = await browser.newContext();
  const other = await context.newPage();
  try {
    await other.goto("http://127.0.0.1:3000/");
    await importFiles(other, "music", [wav("Biblioteca anterior", 440)]);
    await other.getByLabel("Arquivo de backup").setInputFiles(path);
    await expect(
      other.getByRole("heading", { name: "Substituir a biblioteca?" })
    ).toBeVisible();
    await other.getByRole("button", { exact: true, name: "Cancelar" }).click();
    await expect(
      manager(other).getByText("Biblioteca anterior", { exact: true })
    ).toBeVisible();
    await other.getByLabel("Arquivo de backup").setInputFiles({
      buffer: Buffer.from("inválido"),
      mimeType: "application/octet-stream",
      name: "invalido.soundbard",
    });
    await expect(
      other.locator('[data-sonner-toast][data-type="error"]')
    ).toContainText(BACKUP_ERROR);
    await expect(
      manager(other).getByText("Biblioteca anterior", { exact: true })
    ).toBeVisible();
    await other.getByLabel("Arquivo de backup").setInputFiles(path);
    await other
      .getByRole("button", { exact: true, name: "Substituir biblioteca" })
      .click();
    await expect(other.locator(".editor[role=dialog]")).not.toBeVisible();
    await expect(
      manager(other).getByText("Biblioteca anterior", { exact: true })
    ).not.toBeVisible();
    await expect(
      manager(other).getByText("Tema original", { exact: true })
    ).toBeVisible();
    await expect(
      other.getByRole("slider", { exact: true, name: "Volume geral" })
    ).toHaveValue("0");
    await other
      .getByRole("button", { exact: true, name: "Tocar Tema original" })
      .click();
    await expect
      .poll(() =>
        other
          .locator("audio")
          .evaluateAll((elements) =>
            elements.some(
              (audio) =>
                audio instanceof HTMLMediaElement &&
                audio.currentTime > 0 &&
                !audio.paused
            )
          )
      )
      .toBe(true);
    await other.getByRole("button", { exact: true, name: "Playlists" }).click();
    await expect(
      other.getByRole("heading", { exact: true, name: "Sessão" })
    ).toBeVisible();
  } finally {
    await context.close();
  }
});

test("decodifica e reproduz MP3 e OGG, e recusa um WAV inválido", async ({
  page,
}) => {
  await page.goto("/");
  const files = [
    {
      buffer: await readFile("e2e/audio/tone.mp3"),
      mimeType: "audio/mpeg",
      name: "Tom MP3.mp3",
    },
    {
      buffer: await readFile("e2e/audio/tone.ogg"),
      mimeType: "audio/ogg",
      name: "Tom OGG.ogg",
    },
  ];
  await importFiles(page, "music", files);
  await inOrder(files, async (file) => {
    const name = file.name.replace(FILE_EXTENSION, "");
    const id = createHash("sha256").update(file.buffer).digest("hex");
    await page
      .getByRole("button", { exact: true, name: `Tocar ${name}` })
      .click();
    await expect
      .poll(() =>
        page
          .locator(`audio[data-sound-id="${id}"]`)
          .evaluateAll((elements) =>
            elements.some(
              (audio) =>
                audio instanceof HTMLMediaElement &&
                audio.currentTime > 0.2 &&
                !audio.paused
            )
          )
      )
      .toBe(true);
  });
  await page
    .getByRole("button", { exact: true, name: "Importar áudios" })
    .click();
  await page
    .getByRole("button", { exact: true, name: "Arquivo de áudio" })
    .click();
  await page.getByLabel("Arquivos de áudio").setInputFiles({
    buffer: Buffer.from("sem áudio"),
    mimeType: "audio/wav",
    name: "corrompido.wav",
  });
  await expect(page.getByRole("alert")).toContainText(
    "Não foi possível decodificar"
  );
  await page.getByRole("button", { exact: true, name: "Fechar" }).click();
  await openLibrary(page);
  await expect(
    page.getByRole("button", { exact: true, name: "Tocar Tom MP3" })
  ).toBeVisible();
});

test("importa um áudio real, reproduz e mantém a biblioteca após reabrir", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { exact: true, name: "Importar áudios" })
    .click();
  await page
    .getByRole("button", { exact: true, name: "Arquivo de áudio" })
    .click();
  await page.getByLabel("Arquivos de áudio").setInputFiles(wav("Chuva"));
  await page.getByLabel("Tipo do áudio").selectOption("ambience");
  await page
    .getByRole("button", { exact: true, name: "Adicionar à biblioteca" })
    .click();
  await page.getByRole("button", { exact: true, name: "Biblioteca" }).click();
  await expect(manager(page).getByText("Chuva", { exact: true })).toBeVisible();
  await page.getByRole("button", { exact: true, name: "Tocar Chuva" }).click();
  await page.getByRole("button", { exact: true, name: "Tocar Chuva" }).focus();
  await expect(
    manager(page).getByText("1 som tocando", { exact: true })
  ).toBeVisible();
  await expect
    .poll(async () =>
      page
        .locator("audio")
        .evaluateAll((elements) =>
          elements.some(
            (audio) =>
              audio instanceof HTMLMediaElement &&
              audio.currentTime > 0.3 &&
              !audio.paused
          )
        )
    )
    .toBe(true);
  await expect(
    page.getByRole("button", { exact: true, name: "Tocar Chuva" })
  ).toBeFocused();
  await page.getByRole("button", { exact: true, name: "Pausar tudo" }).click();
  await expect
    .poll(() =>
      page
        .locator("audio")
        .evaluateAll((elements) =>
          elements.every(
            (audio) => audio instanceof HTMLMediaElement && audio.paused
          )
        )
    )
    .toBe(true);
  await page.getByRole("button", { exact: true, name: "Retomar tudo" }).click();
  await expect
    .poll(() =>
      page
        .locator("audio")
        .evaluateAll((elements) =>
          elements.some(
            (audio) => audio instanceof HTMLMediaElement && !audio.paused
          )
        )
    )
    .toBe(true);
  await page.reload();
  await page.getByRole("button", { exact: true, name: "Biblioteca" }).click();
  await expect(manager(page).getByText("Chuva", { exact: true })).toBeVisible();
});
