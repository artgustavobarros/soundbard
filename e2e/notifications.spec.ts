import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { wav } from "./fixtures";

const APP_FONT = /DM Sans/u;

test("avisa que o áudio foi importado e permite fechar o toast no celular", async ({
  page,
}) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/");
  await page
    .getByRole("button", { exact: true, name: "Importar áudios" })
    .click();
  await page
    .getByRole("button", { exact: true, name: "Arquivo de áudio" })
    .click();
  await page
    .getByLabel("Arquivos de áudio")
    .setInputFiles(wav("Chuva para a mesa"));
  await page
    .getByRole("button", { exact: true, name: "Adicionar à biblioteca" })
    .click();

  const notification = page.locator('[data-sonner-toast][data-type="success"]');
  await expect(notification).toContainText("1 áudio(s) importado(s).");
  await notification.hover();
  await expect(notification).toHaveCSS("opacity", "1");
  await expect(notification).toBeInViewport({ ratio: 1 });
  await expect(notification).toHaveCSS("background-color", "rgb(17, 17, 17)");
  await expect(notification).toHaveCSS("color", "rgb(250, 250, 250)");
  await expect(notification).toHaveCSS("font-family", APP_FONT);
  const close = notification.getByRole("button", {
    exact: true,
    name: "Fechar aviso",
  });
  await expect(close).toBeInViewport({ ratio: 1 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBe(true);
  await page.screenshot({ path: ".qa/toast-mobile.png" });
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    accessibility.violations.filter(
      (violation) =>
        violation.impact === "critical" || violation.impact === "serious"
    )
  ).toEqual([]);
  await page.setViewportSize({ height: 900, width: 1440 });
  await notification.hover();
  await expect(notification).toBeInViewport({ ratio: 1 });
  await page.screenshot({ path: ".qa/toast-desktop.png" });
  await page.setViewportSize({ height: 844, width: 390 });
  await notification.hover();
  await close.click();
  await expect(notification).toHaveCount(0);

  await page.getByRole("button", { exact: true, name: "Biblioteca" }).click();
  await expect(
    page
      .getByRole("dialog", { exact: true, name: "Biblioteca e organização" })
      .getByText("Chuva para a mesa", { exact: true })
  ).toBeVisible();
  expect(await page.pageErrors()).toEqual([]);
});
