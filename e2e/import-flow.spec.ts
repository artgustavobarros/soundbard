import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";
import { openDeskAction, test, wav } from "./fixtures";

async function chooseFile(page: Page) {
  await openDeskAction(page, "Importar áudios");
  await page
    .getByRole("button", { exact: true, name: "Arquivo de áudio" })
    .click();
}

test("a primeira etapa oferece apenas YouTube ou arquivo", async ({ page }) => {
  await page.goto("/");
  await openDeskAction(page, "Importar áudios");
  const dialog = page.getByRole("dialog", {
    exact: true,
    name: "Importar áudios",
  });
  await expect(
    dialog.getByRole("button", { exact: true, name: "Importar do YouTube" })
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { exact: true, name: "Arquivo de áudio" })
  ).toBeVisible({ timeout: 2500 });
  await expect(dialog.getByLabel("Arquivos de áudio")).toHaveCount(0);
  await expect(dialog.getByLabel("Tipo dos arquivos")).toHaveCount(0);
  await expect(
    dialog.getByRole("button", { exact: true, name: "Importar arquivos" })
  ).toHaveCount(0);
  await page.screenshot({ path: ".qa/import-source-choice.png" });
});

test("corta o arquivo enviado, salva nome e tags e sugere tags depois de recarregar", async ({
  page,
}) => {
  await page.goto("/");
  await chooseFile(page);
  await page
    .getByLabel("Arquivos de áudio")
    .setInputFiles(wav("Chuva original"));
  await expect(
    page.getByText("Chuva original.wav", { exact: true }).first()
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: "Forma de onda do áudio" })
  ).toBeVisible();
  await page.getByLabel("Nome do áudio").fill("Chuva recortada");
  await page.getByLabel("Início (segundos)").fill("1");
  await page.getByLabel("Fim (segundos)").fill("3");
  const tags = page.getByRole("combobox", { exact: true, name: "Tags" });
  await tags.fill("Chuva");
  await tags.press("Enter");
  await tags.fill("Floresta");
  await tags.press("Enter");
  await page.screenshot({ path: ".qa/import-editor-tags.png" });
  await page
    .getByRole("button", { exact: true, name: "Adicionar à biblioteca" })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("button", { exact: true, name: "Editar Chuva recortada" })
  ).toBeVisible();
  await page.reload();
  await chooseFile(page);
  await page
    .getByLabel("Arquivos de áudio")
    .setInputFiles(wav("Outro ambiente", 440));
  await expect(
    page.getByRole("img", { name: "Forma de onda do áudio" })
  ).toBeVisible();
  const nextTags = page.getByRole("combobox", { exact: true, name: "Tags" });
  await nextTags.fill("chu");
  await expect(
    page.getByRole("option", { exact: true, name: "Chuva" })
  ).toBeVisible();
  await expect(
    page.getByRole("option", { exact: true, name: "Chuva" })
  ).toBeInViewport({ ratio: 1 });
  await page.screenshot({ path: ".qa/import-tag-suggestions.png" });
  await page.setViewportSize({ height: 568, width: 320 });
  await nextTags.fill("chuv");
  await expect(
    page.getByRole("option", { exact: true, name: "Chuva" })
  ).toBeInViewport({ ratio: 1 });
  await nextTags.press("Escape");
  await expect(page.getByRole("listbox")).not.toBeVisible();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("button", { exact: true, name: "Adicionar à biblioteca" })
  ).toBeInViewport({ ratio: 1 });
  await nextTags.fill("chu");
  await page.screenshot({ path: ".qa/import-tag-suggestions-mobile.png" });
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    accessibility.violations.filter(
      (violation) =>
        violation.impact === "critical" || violation.impact === "serious"
    )
  ).toEqual([]);
  await page.getByRole("option", { exact: true, name: "Chuva" }).click();
  await nextTags.fill("CHUVA");
  await nextTags.press("Enter");
  await page
    .getByRole("button", { exact: true, name: "Adicionar à biblioteca" })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await openDeskAction(page, "Biblioteca");
  await expect(
    page.getByRole("dialog").getByText("Chuva", { exact: true })
  ).toBeVisible();
  expect(await page.pageErrors()).toEqual([]);
});

test("o lote permite cortar um arquivo e conserva os demais inteiros", async ({
  page,
}) => {
  await page.goto("/");
  await chooseFile(page);
  await page.getByLabel("Arquivos de áudio").setInputFiles([
    wav("Primeiro inteiro", 220, 8),
    wav("Segundo para cortar", 440, 8),
    {
      buffer: Buffer.from("inválido"),
      mimeType: "audio/wav",
      name: "corrompido.wav",
    },
  ]);
  await expect(page.getByRole("alert")).toContainText("corrompido.wav");
  await expect(
    page.getByRole("img", { name: "Forma de onda do áudio" })
  ).toBeVisible();
  await page.getByLabel("Arquivo para cortar").selectOption("1");
  await expect(page.getByLabel("Nome do áudio")).toHaveValue(
    "Segundo para cortar"
  );
  await page.getByLabel("Nome do áudio").fill("Segundo recortado");
  await page.getByLabel("Início (segundos)").fill("1");
  await page.getByLabel("Fim (segundos)").fill("3");
  const tags = page.getByRole("combobox", { exact: true, name: "Tags" });
  await tags.fill("Dungeon");
  await tags.press("Enter");
  await page
    .getByRole("button", { exact: true, name: "Adicionar à biblioteca" })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.reload();
  await openDeskAction(page, "Biblioteca");
  const manager = page.getByRole("dialog", {
    exact: true,
    name: "Biblioteca e organização",
  });
  await expect(manager.getByText("Dungeon", { exact: true })).toHaveCount(2);
  await manager
    .getByRole("button", { exact: true, name: "Tocar Segundo recortado" })
    .click();
  await expect
    .poll(() =>
      page
        .locator("audio[data-sound-id]")
        .evaluateAll((nodes) =>
          nodes.some(
            (node) =>
              node instanceof HTMLAudioElement &&
              !node.paused &&
              node.duration > 1.8 &&
              node.duration < 2.3
          )
        )
    )
    .toBe(true);
  await manager
    .getByRole("button", { exact: true, name: "Tocar Primeiro inteiro" })
    .click();
  await expect
    .poll(() =>
      page
        .locator("audio[data-sound-id]")
        .evaluateAll((nodes) =>
          nodes.some(
            (node) =>
              node instanceof HTMLAudioElement &&
              !node.paused &&
              node.duration === 8
          )
        )
    )
    .toBe(true);
  expect(await page.pageErrors()).toEqual([]);
});
