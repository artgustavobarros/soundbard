import { expect } from "@playwright/test";
import { openDeskAction, test, wav } from "./fixtures";

const ROBOTO = /Roboto/u;
const INSET = /inset/u;

test("o footer e seus botões seguem a superfície e a tipografia dos pads", async ({
  page,
}) => {
  await page.goto("/");
  await openDeskAction(page, "Importar áudios");
  await page
    .getByRole("button", { exact: true, name: "Arquivo de áudio" })
    .click();
  await page
    .getByLabel("Arquivos de áudio")
    .setInputFiles(wav("Música do footer", 218, 8));
  await page
    .getByRole("button", { exact: true, name: "Adicionar à biblioteca" })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  const footer = page.getByRole("region", {
    exact: true,
    name: "Controles do pad",
  });
  await expect(footer).toHaveCSS("background-color", "rgb(247, 247, 247)");
  await expect(footer).toHaveCSS("border-color", "rgb(21, 21, 23)");
  await expect(footer).toHaveCSS("border-width", "1px");
  await expect(footer).toHaveCSS("border-radius", "12px");
  await expect(footer).toHaveCSS("box-shadow", INSET);
  const title = footer.getByRole("heading", { name: "Música do footer" });
  await expect(title).toHaveCSS("font-family", ROBOTO);
  await expect(title).toHaveCSS("font-weight", "800");
  await expect(title).toHaveCSS("text-transform", "uppercase");
  await Promise.all(
    (await footer.getByRole("button").all()).map(async (button) => {
      await expect(button).toHaveCSS("background-color", "rgb(247, 247, 247)");
      await expect(button).toHaveCSS("border-color", "rgb(21, 21, 23)");
      await expect(button).toHaveCSS("border-radius", "12px");
    })
  );
  await expect(footer.locator('[data-slot="slider-track"]')).toHaveCSS(
    "background-color",
    "rgb(21, 21, 23)"
  );
  await expect(footer.locator('[data-slot="slider-range"]')).toHaveCSS(
    "background-color",
    "rgb(21, 21, 23)"
  );
  await footer.screenshot({ path: ".qa/footer-pad-surface.png" });
});
