import { expect, type Locator, type Page } from "@playwright/test";
import { test } from "./fixtures";

const ROBOTO = /Roboto/u;
const EMERALD_REGEX = /text-emerald/u;

async function padSurface(page: Page, pad: Locator) {
  const screenshot = await pad.screenshot({ animations: "disabled" });
  return page.evaluate(async (encoded) => {
    const bytes = Uint8Array.from(atob(encoded), (value) =>
      value.charCodeAt(0)
    );
    const bitmap = await createImageBitmap(
      new Blob([bytes], { type: "image/png" })
    );
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Não foi possível ler a superfície do pad");
    }
    context.drawImage(bitmap, 0, 0);
    const brightness = (x: number, y: number) =>
      context.getImageData(x, y, 1, 1).data[0];
    const result = {
      corner: brightness(5, 5),
      face: brightness(
        Math.floor(bitmap.width / 2),
        Math.floor(bitmap.height / 2)
      ),
      pastEdge: brightness(Math.floor(bitmap.width / 2), 4),
    };
    bitmap.close();
    return result;
  }, screenshot.toString("base64"));
}

test("o pad mantém a face clara e a borda com transição interna de dois pixels", async ({
  page,
}) => {
  await page.goto("/previa?estudo=hardware&variant=A");
  const pad = page.locator("[data-hardware-trigger]").first();
  await expect(pad).toHaveCSS("border-color", "rgb(21, 21, 23)");
  await expect(pad).toHaveCSS("border-width", "1px");
  await expect(pad).toHaveCSS("background-color", "rgb(247, 247, 247)");
  await expect(pad).toHaveCSS("border-radius", "12px");
  const surface = await padSurface(page, pad);
  expect(surface.face).toBe(247);
  expect(surface.pastEdge).toBe(247);
  expect(surface.corner).toBeLessThan(245);
  await expect(pad).not.toHaveCSS("box-shadow", "none");
  await pad.click();
  await expect(pad).toHaveAttribute("aria-pressed", "true");
  await expect(pad).toHaveCSS("border-color", "rgb(21, 21, 23)");
  await expect(pad).toHaveCSS("background-color", "rgb(247, 247, 247)");
  await expect(pad).toHaveCSS("border-radius", "12px");
  expect((await padSurface(page, pad)).corner).toBeLessThan(245);
});

test("o título e subtítulo ficam dentro do pad em Roboto", async ({ page }) => {
  await page.goto("/previa?estudo=hardware&variant=A");
  const pad = page.locator("[data-hardware-trigger]").first();
  const title = pad.getByText("Lareira", { exact: true });
  const subtitle = pad.getByText("Ambiente", { exact: true });
  await expect(title).toBeVisible();
  await expect(title).toHaveCSS("font-family", ROBOTO);
  await expect(title).toHaveCSS("font-weight", "800");
  await expect(title).toHaveCSS("text-transform", "uppercase");
  await expect(subtitle).toBeVisible();
  await expect(subtitle).toHaveCSS("font-family", ROBOTO);
  await expect(subtitle).toHaveCSS("font-weight", "600");
  await expect(pad).toHaveCSS("overflow", "hidden");
  const padBox = await pad.boundingBox();
  const titleBox = await title.boundingBox();
  expect(padBox).not.toBeNull();
  expect(titleBox).not.toBeNull();
  if (!(padBox && titleBox)) {
    throw new Error("Pad sem dimensões");
  }
  expect(titleBox.x - padBox.x).toBeLessThanOrEqual(16);
  expect(titleBox.y - padBox.y).toBeLessThanOrEqual(16);
});

test("o trilho de volume e a marca do fader usam a cor da borda do pad", async ({
  page,
}) => {
  await page.goto("/previa?estudo=hardware&variant=A");
  const track = page.locator('[data-slot="slider-track"]').first();
  const range = page.locator('[data-slot="slider-range"]').first();
  const thumb = page.getByRole("slider", {
    exact: true,
    name: "Volume de Lareira",
  });
  await expect(track).toHaveCSS("background-color", "rgb(21, 21, 23)");
  await expect(range).toHaveCSS("background-color", "rgb(21, 21, 23)");
  expect(
    await thumb.evaluate(
      (element) => getComputedStyle(element, "::after").backgroundColor
    )
  ).toBe("rgb(21, 21, 23)");
});

test("o pad em reprodução acende luz verde de atividade e destaca o status", async ({
  page,
}) => {
  await page.goto("/previa?estudo=hardware&variant=A");
  const pad = page.locator("[data-hardware-trigger]").first();
  await pad.click();
  await expect(pad).toHaveAttribute("aria-pressed", "true");

  const led = pad.locator("[data-pad-led]");
  await expect(led).toBeVisible();
  await expect(led).toHaveAttribute("data-playing", "true");

  // O ícone de pause deve estar destacado em verde esmeralda
  const pauseIcon = pad.locator("svg.lucide-pause");
  await expect(pauseIcon).toBeVisible();
  await expect(pauseIcon).toHaveClass(EMERALD_REGEX);
});
