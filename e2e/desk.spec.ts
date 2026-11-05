import { createHash } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";
import { openDeskAction, test, wav } from "./fixtures";

const MUSIC_NAME = /\bCaminhada noturna\b/u;
const RAIN_NAME = /\bChuva real\b/u;
const SECOND_MUSIC_NAME = /Percussão/u;
const PLAYLIST_NAME = /\bEstrada à noite\b/u;
const TEST_MACHINE_GUN_NAME = /Metralhadora Teste/iu;

async function importSound(
  page: Page,
  kind: string,
  file: ReturnType<typeof wav>
) {
  await openDeskAction(page, "Importar áudios");
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

async function waitForNotificationsToClose(page: Page): Promise<void> {
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0, {
    timeout: 10_000,
  });
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
  await expect(musicAudio).toHaveCount(0);
  await expect
    .poll(() =>
      rainAudio.evaluate(
        (audio) => audio instanceof HTMLAudioElement && !audio.paused
      )
    )
    .toBe(true);
  await expect(musicPad).toHaveAttribute("aria-pressed", "false");
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
    .getByRole("button", { exact: true, name: "Editar Caminhada noturna" })
    .click();
  await expect(page.getByLabel("Nome do som")).toHaveValue("Caminhada noturna");
  await page.getByRole("button", { exact: true, name: "Cancelar" }).click();
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
  await waitForNotificationsToClose(page);
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
  await openDeskAction(page, "Parar tudo");
  await expect(page.locator("audio")).toHaveCount(0);
  await page.reload();
  await expect(pad(page, MUSIC_NAME)).toBeVisible();
  await expect(pad(page, RAIN_NAME)).toBeVisible();
});

test("salva e reabre um grupo de pads da biblioteca real", async ({ page }) => {
  await page.goto("/");
  await importSound(page, "music", wav("Caminhada noturna", 220, 30));
  await importSound(page, "ambience", wav("Chuva real", 130, 30));
  await openDeskAction(page, "Personalizado");
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
  await openDeskAction(page, "Personalizado");
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
  await openDeskAction(page, "Nova playlist");
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
  await expect(page.locator('audio[data-role="music"]')).toHaveCount(0);
  await expect
    .poll(() =>
      rainAudio.evaluate(
        (audio) => audio instanceof HTMLAudioElement && !audio.paused
      )
    )
    .toBe(true);
  await playlist.click();
  await expect(page.locator('audio[data-role="music"]')).toHaveCount(1);
  await page.getByRole("button", { exact: true, name: "Parar pad" }).click();
  await expect(page.locator('audio[data-role="music"]')).toHaveCount(0);
  await expect(rainAudio).toHaveCount(1);
});

test("uma cena de Combate permanece na categoria correta após recarregar", async ({
  page,
}) => {
  await page.goto("/");
  await importSound(page, "effect", wav("Espada", 440, 4));
  await openDeskAction(page, "Biblioteca");
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
  await openDeskAction(page, "Cenas");
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

test("a mesa Cerâmica mantém volume e loop independentes por pad após recarregar", async ({
  page,
}) => {
  await page.setViewportSize({ height: 900, width: 1440 });
  await page.goto("/");
  await importSound(page, "ambience", wav("Chuva real", 130, 10));
  await importSound(page, "ambience", wav("Vento na floresta", 180, 10));
  const volume = page.getByRole("slider", {
    exact: true,
    name: "Volume de Chuva real",
  });
  const otherVolume = page.getByRole("slider", {
    exact: true,
    name: "Volume de Vento na floresta",
  });
  await expect(volume).toBeVisible();
  const controls = page.getByRole("region", {
    exact: true,
    name: "Controles do pad",
  });
  await expect(
    controls.getByRole("slider", { exact: true, name: "Volume do pad" })
  ).toHaveCount(0);
  await expect(
    controls.getByRole("slider", { exact: true, name: "Volume geral" })
  ).toBeVisible();
  const originalOtherVolume = await otherVolume.getAttribute("aria-valuenow");
  await volume.focus();
  await volume.press("End");
  await expect(volume).toHaveAttribute("aria-valuenow", "100");
  await expect(otherVolume).toHaveAttribute(
    "aria-valuenow",
    originalOtherVolume ?? ""
  );
  const loop = page.getByRole("switch", {
    exact: true,
    name: "Loop de Chuva real",
  });
  await loop.click();
  await expect(loop).not.toBeChecked();
  await page.reload();
  await expect(volume).toHaveAttribute("aria-valuenow", "100");
  await expect(loop).not.toBeChecked();
  await page.setViewportSize({ height: 320, width: 568 });
  await loop.click();
  await expect(loop).toBeChecked();
  await volume.focus();
  await volume.press("Home");
  await expect(volume).toHaveAttribute("aria-valuenow", "0");
});

test("o header mostra menu e adicionar músicas e preserva o acesso à biblioteca", async ({
  page,
}) => {
  await page.goto("/");
  const header = page.getByRole("banner");
  const trigger = header.getByRole("button", {
    exact: true,
    name: "Abrir menu",
  });
  await expect(trigger).toBeVisible();
  await expect(header.getByRole("button")).toHaveCount(2);
  await trigger.press("Enter");
  const menu = page.getByRole("dialog", { exact: true, name: "Menu da mesa" });
  await expect(menu).toBeVisible();
  await menu.getByRole("button", { exact: true, name: "Biblioteca" }).click();
  await expect(
    page.getByRole("dialog", { exact: true, name: "Biblioteca e organização" })
  ).toBeVisible();
  await expect(menu).not.toBeVisible();
  await page
    .getByRole("button", { exact: true, name: "Voltar à mesa" })
    .click();
  await expect(trigger).toBeFocused();
  await trigger.press("Enter");
  await menu
    .getByRole("button", { exact: true, name: "Importar áudios" })
    .click();
  await expect(
    page.getByRole("dialog", { exact: true, name: "Importar áudios" })
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
});

test("o botão abaixo de um pad não selecionado abre diretamente o áudio correto", async ({
  page,
}) => {
  await page.goto("/");
  await importSound(page, "music", wav("Primeira música", 223));
  await importSound(page, "music", wav("Segunda música", 337));
  await page
    .getByRole("button", { exact: true, name: "Tocar Primeira música" })
    .click();
  const module = page.locator("[data-ceramic-module]").filter({
    has: page.getByRole("button", {
      exact: true,
      name: "Tocar Segunda música",
    }),
  });
  const edit = module
    .getByRole("button")
    .filter({ has: page.locator("svg.lucide-sliders-horizontal") });
  await edit.click();
  await expect(page.getByLabel("Nome do som")).toHaveValue("Segunda música");
  await expect(
    page.getByRole("button", { exact: true, name: "Cortar áudio" })
  ).toBeVisible();
  await page.getByRole("button", { exact: true, name: "Cancelar" }).click();
  await expect(edit).toHaveAccessibleName("Editar Segunda música");
  await expect(
    page.getByRole("region", { exact: true, name: "Controles do pad" })
  ).toContainText("Segunda música");
});

test("oferece chips de filtro por tipo (Música, Ambiente, Efeitos) perto de Todos os pads", async ({
  page,
}) => {
  await page.goto("/");
  await importSound(page, "music", wav("Canção Épica", 220));
  await importSound(page, "ambience", wav("Vento Gelado", 180));
  await importSound(page, "effect", wav("Golpe Espada", 300));

  await expect(
    page.getByRole("heading", { exact: true, name: "Todos os pads" })
  ).toBeVisible();

  const chipTodos = page.getByRole("button", { exact: true, name: "Todos" });
  const chipMusica = page.getByRole("button", { exact: true, name: "Música" });
  const chipAmbiente = page.getByRole("button", {
    exact: true,
    name: "Ambiente",
  });
  const chipEfeitos = page.getByRole("button", {
    exact: true,
    name: "Efeitos",
  });

  await expect(chipTodos).toBeVisible();
  await expect(chipMusica).toBeVisible();
  await expect(chipAmbiente).toBeVisible();
  await expect(chipEfeitos).toBeVisible();
  await expect(chipTodos).toHaveAttribute("aria-pressed", "true");

  await chipMusica.click();
  await expect(chipMusica).toHaveAttribute("aria-pressed", "true");
  await expect(chipTodos).toHaveAttribute("aria-pressed", "false");
  await expect(
    page.getByRole("button", { exact: true, name: "Tocar Canção Épica" })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { exact: true, name: "Tocar Vento Gelado" })
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { exact: true, name: "Tocar Golpe Espada" })
  ).toHaveCount(0);

  await chipAmbiente.click();
  await expect(chipAmbiente).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { exact: true, name: "Tocar Canção Épica" })
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { exact: true, name: "Tocar Vento Gelado" })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { exact: true, name: "Tocar Golpe Espada" })
  ).toHaveCount(0);

  await chipEfeitos.click();
  await expect(chipEfeitos).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { exact: true, name: "Tocar Canção Épica" })
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { exact: true, name: "Tocar Vento Gelado" })
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { exact: true, name: "Tocar Golpe Espada" })
  ).toBeVisible();

  await chipTodos.click();
  await expect(chipTodos).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { exact: true, name: "Tocar Canção Épica" })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { exact: true, name: "Tocar Vento Gelado" })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { exact: true, name: "Tocar Golpe Espada" })
  ).toBeVisible();
});

test("clicar em um pad de efeito que já está tocando para o áudio e próximo clique reinicia", async ({
  page,
}) => {
  await page.goto("/");
  await importSound(page, "effect", wav("Metralhadora Teste", 200, 20));
  const effectPad = page
    .getByRole("button", { name: TEST_MACHINE_GUN_NAME })
    .first();

  // 1º clique: inicia reprodução
  await effectPad.click();
  await expect(page.locator("audio")).toHaveCount(1);
  const audio = page.locator("audio").first();
  await expect
    .poll(() => audio.evaluate((el: HTMLAudioElement) => !el.paused))
    .toBe(true);

  // 2º clique: deve parar (remover áudio), e NÃO apenas pausar ou duplicar
  await effectPad.click();
  await expect(page.locator("audio")).toHaveCount(0);

  // 3º clique: deve reiniciar do começo
  await effectPad.click();
  await expect(page.locator("audio")).toHaveCount(1);
  await expect
    .poll(() => audio.evaluate((el: HTMLAudioElement) => !el.paused))
    .toBe(true);
});

test("a tela de edição de som oferece botão para excluir som da biblioteca", async ({
  page,
}) => {
  await page.setViewportSize({ height: 900, width: 1440 });
  await page.goto("/");
  await expect(page.locator("[data-soundboard-desk]")).toBeVisible();
  await importSound(page, "effect", wav("Som Para Deletar", 250));
  await expect(
    page.getByRole("button", { name: "Tocar Som Para Deletar" })
  ).toBeVisible();

  // Abre a tela de edição do som
  await page
    .getByRole("button", { exact: true, name: "Editar Som Para Deletar" })
    .click();
  await expect(page.getByLabel("Nome do som")).toHaveValue("Som Para Deletar");

  // Botão Excluir som deve estar presente
  const deleteBtn = page.getByRole("button", {
    exact: true,
    name: "Excluir som",
  });
  await expect(deleteBtn).toBeVisible();
  await deleteBtn.click();

  // Confirmação
  await expect(
    page.getByRole("heading", { name: "Excluir som da biblioteca?" })
  ).toBeVisible();
  await page.getByRole("button", { exact: true, name: "Excluir som" }).click();

  // Deve sumir da mesa
  await expect(
    page.getByRole("button", { name: "Tocar Som Para Deletar" })
  ).toHaveCount(0);
});
