import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";
import { openDeskAction, segmentedWav, test } from "./fixtures";

const ORIGINAL_PAD = /Original com dinâmica/u;
const WAVEFORM_RESPONSE = /\/api\/audio-jobs\/[^/]+\/waveform$/u;

async function openOriginal(page: Page) {
  await page.goto("/");
  await openDeskAction(page, "Importar áudios");
  await page
    .getByRole("button", { exact: true, name: "Arquivo de áudio" })
    .click();
  await page
    .getByLabel("Arquivos de áudio")
    .setInputFiles(segmentedWav("Original com dinâmica"));
  await page
    .getByRole("button", { exact: true, name: "Adicionar à biblioteca" })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page
    .getByRole("button", {
      exact: true,
      name: "Editar Original com dinâmica",
    })
    .click();
  const response = page.waitForResponse(WAVEFORM_RESPONSE);
  await page.getByRole("button", { exact: true, name: "Cortar áudio" }).click();
  return response;
}

test.beforeEach(({ page }) => {
  page.setDefaultTimeout(10_000);
});

test.afterEach(async ({ page }) => {
  expect(await page.pageErrors()).toEqual([]);
});

test("os limites do corte são linhas finas e continuam ajustáveis", async ({
  page,
}) => {
  await openOriginal(page);
  await page.getByLabel("Início (segundos)").fill("1");
  await page.getByLabel("Fim (segundos)").fill("7");
  const checkMarker = async (name: string) => {
    const marker = page.getByRole("slider", { exact: true, name });
    await expect(marker).toHaveCSS("width", "1px");
    await expect(marker).toHaveCSS("border-left-width", "0px");
    const hitWidth = await marker.evaluate((element) =>
      Number.parseFloat(getComputedStyle(element, "::before").width)
    );
    expect(hitWidth).toBeGreaterThanOrEqual(44);
    const before = Number(await marker.getAttribute("aria-valuenow"));
    await marker.focus();
    await marker.press("ArrowRight");
    await expect(marker).toHaveAttribute(
      "aria-valuenow",
      String(before + 0.01)
    );
    const bounds = await marker.boundingBox();
    if (!bounds) {
      throw new Error("Marcador sem posição visível");
    }
    await page.mouse.move(bounds.x + 10, bounds.y + bounds.height / 2);
    await page.mouse.down();
    await page.mouse.move(bounds.x + 30, bounds.y + bounds.height / 2, {
      steps: 4,
    });
    await page.mouse.up();
    expect(Number(await marker.getAttribute("aria-valuenow"))).toBeGreaterThan(
      before + 0.01
    );
  };
  await checkMarker("Início do corte");
  await checkMarker("Fim do corte");
  await page.getByLabel("Nome do áudio").focus();
  await page.screenshot({ path: ".qa/cut-lines-desktop.png" });
  await page.setViewportSize({ height: 844, width: 390 });
  await page
    .getByRole("slider", { exact: true, name: "Início do corte" })
    .scrollIntoViewIfNeeded();
  await page.screenshot({ path: ".qa/cut-lines-mobile.png" });
});

test("a prévia desenha a dinâmica real do arquivo e permite ouvir e marcar o corte", async ({
  page,
}) => {
  const waveformResponse = await openOriginal(page);
  expect(waveformResponse.status()).toBe(200);
  const data: { duration: number; peaks: number[] } =
    await waveformResponse.json();
  expect(data.duration).toBeCloseTo(8, 1);
  expect(data.peaks).toHaveLength(1024);
  const average = (values: number[]) =>
    values.reduce((sum, value) => sum + value, 0) / values.length;
  expect(average(data.peaks.slice(0, 240))).toBeLessThan(0.01);
  const quiet = average(data.peaks.slice(280, 490));
  const loud = average(data.peaks.slice(540, 740));
  expect(quiet).toBeGreaterThan(0.03);
  expect(loud).toBeGreaterThan(quiet * 3);
  expect(average(data.peaks.slice(800))).toBeLessThan(0.01);
  await expect(
    page.getByRole("img", { name: "Forma de onda do áudio" })
  ).toBeVisible();
  const position = page.getByRole("slider", {
    exact: true,
    name: "Posição da prévia",
  });
  await position.focus();
  await position.press("Home");
  await position.press("ArrowRight");
  const markedStart = Number(await position.getAttribute("aria-valuenow"));
  expect(markedStart).toBeGreaterThan(0);
  await page
    .getByRole("button", { exact: true, name: "Marcar início" })
    .click();
  await expect(page.getByLabel("Início (segundos)")).toHaveValue(
    String(markedStart)
  );
  await position.focus();
  await position.press("End");
  const markedEnd = Number(await position.getAttribute("aria-valuenow"));
  await page.getByRole("button", { exact: true, name: "Marcar fim" }).click();
  await expect(page.getByLabel("Fim (segundos)")).toHaveValue(
    String(markedEnd)
  );
  const rangeStart = page.getByRole("slider", {
    exact: true,
    name: "Início do corte",
  });
  await rangeStart.focus();
  await rangeStart.press("ArrowRight");
  await expect(page.getByLabel("Início (segundos)")).toHaveValue(
    String(Number(await rangeStart.getAttribute("aria-valuenow")))
  );
  await page.getByLabel("Início (segundos)").fill("1");
  await page.getByLabel("Fim (segundos)").fill("3");
  await expect(
    page.getByRole("slider", { exact: true, name: "Início do corte" })
  ).toHaveAttribute("aria-valuenow", "1");
  await expect(
    page.getByRole("slider", { exact: true, name: "Fim do corte" })
  ).toHaveAttribute("aria-valuenow", "3");
  await page
    .getByRole("button", { exact: true, name: "Ouvir seleção" })
    .click();
  await expect(
    page.getByRole("button", { exact: true, name: "Pausar prévia" })
  ).toBeVisible();
  await expect
    .poll(async () => Number(await position.getAttribute("aria-valuenow")))
    .toBeGreaterThan(1.1);
  await expect(
    page.getByRole("button", { exact: true, name: "Ouvir seleção" })
  ).toBeVisible({ timeout: 6000 });
  expect(
    Number(await position.getAttribute("aria-valuenow"))
  ).toBeLessThanOrEqual(3.1);
  const close = page.getByRole("button", { exact: true, name: "Fechar" });
  await page.setViewportSize({ height: 568, width: 320 });
  await expect(close).toBeInViewport({ ratio: 1 });
  await position.scrollIntoViewIfNeeded();
  await page.screenshot({ path: ".qa/waveform-preview-mobile.png" });
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    result.violations.filter(
      (violation) =>
        violation.impact === "critical" || violation.impact === "serious"
    )
  ).toEqual([]);
  await page.setViewportSize({ height: 320, width: 568 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth)
  ).toBeLessThanOrEqual(568);
  await expect(close).toBeInViewport({ ratio: 1 });
  await rangeStart.scrollIntoViewIfNeeded();
  await page.screenshot({ path: ".qa/waveform-preview-landscape.png" });
  const sourceId = waveformResponse.url().split("/").at(-2);
  await close.click();
  await expect
    .poll(async () =>
      (await page.request.get(`/api/audio-jobs/${sourceId}`)).status()
    )
    .toBe(404);
  const original = page
    .getByRole("button", { name: ORIGINAL_PAD })
    .and(page.locator("button[aria-pressed]"));
  await expect(original).toBeVisible();
  await original.click();
  await expect
    .poll(() =>
      page
        .locator("audio[data-sound-id]")
        .evaluateAll((elements) =>
          elements.some(
            (element) =>
              element instanceof HTMLAudioElement &&
              element.duration === 8 &&
              !element.paused
          )
        )
    )
    .toBe(true);
});
