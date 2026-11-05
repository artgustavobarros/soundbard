import { expect } from "@playwright/test";
import { test } from "./fixtures";

test("o hambúrguer mantém alvo de toque e barras proporcionais", async ({
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
  const geometry = await trigger.evaluate((button) => {
    const bounds = button.getBoundingClientRect();
    return {
      height: bounds.height,
      lines: Array.from(button.querySelectorAll("[data-menu-line]"), (line) => {
        const lineBounds = line.getBoundingClientRect();
        return {
          height: lineBounds.height,
          left: lineBounds.left,
          ratio: lineBounds.width / bounds.width,
          top: lineBounds.top,
        };
      }),
      width: bounds.width,
    };
  });
  expect(geometry.width).toBeGreaterThanOrEqual(44);
  expect(geometry.height).toBeGreaterThanOrEqual(44);
  expect(geometry.lines).toHaveLength(3);
  for (const [index, ratio] of [1, 0.8, 0.6].entries()) {
    expect(geometry.lines[index].ratio).toBeCloseTo(ratio, 2);
    expect(geometry.lines[index].left).toBe(geometry.lines[0].left);
    expect(geometry.lines[index].height).toBe(2);
    expect(geometry.lines[index].top - geometry.lines[0].top).toBe(index * 8);
  }
});

test("o menu cabe em 320px e devolve o foco ao fechar pelo teclado", async ({
  page,
}) => {
  await page.setViewportSize({ height: 568, width: 320 });
  await page.goto("/");
  const trigger = page.getByRole("button", { exact: true, name: "Abrir menu" });
  await trigger.focus();
  await trigger.press("Enter");
  const menu = page.getByRole("dialog", { exact: true, name: "Menu da mesa" });
  await expect(menu).toBeVisible();
  await expect(menu).toHaveCSS("transform", "none");
  const geometry = await menu.evaluate((element) => ({
    clientWidth: element.clientWidth,
    right: element.getBoundingClientRect().right,
    scrollWidth: element.scrollWidth,
    x: element.getBoundingClientRect().x,
  }));
  expect(geometry.x).toBe(0);
  expect(geometry.right).toBeLessThanOrEqual(320);
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth);
  await page.keyboard.press("Tab");
  await expect(menu.locator(":focus")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(menu).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

for (const route of ["/", "/previa?estudo=hardware&variant=A"]) {
  test(`o Sheet desliza na abertura e no fechamento em ${route}`, async ({
    page,
  }) => {
    await page.goto(route);
    await page.getByRole("button", { exact: true, name: "Abrir menu" }).click();
    const sheet = page.locator('[data-slot="sheet-content"]');
    const overlay = page.locator('[data-slot="sheet-overlay"]');
    await expect(sheet).not.toHaveCSS("animation-name", "none");
    await expect(overlay).not.toHaveCSS("animation-name", "none");

    const opening = await sheet.evaluate(async (element) => {
      const [animation] = element.getAnimations();
      if (!animation?.effect) {
        throw new Error("Sheet sem animação de entrada");
      }
      animation.pause();
      await animation.ready;
      const duration = Number(animation.effect.getComputedTiming().duration);
      animation.currentTime = 0;
      const start = element.getBoundingClientRect().x;
      animation.currentTime = duration / 2;
      const middle = element.getBoundingClientRect().x;
      animation.finish();
      return { duration, middle, start };
    });
    expect(opening.duration).toBeGreaterThan(0);
    expect(opening.duration).toBeLessThanOrEqual(500);
    expect(opening.start).toBeLessThan(-300);
    expect(opening.middle).toBeGreaterThan(opening.start);
    expect(opening.middle).toBeLessThan(0);
    await expect(sheet).toHaveCSS("transform", "none");

    await sheet.getByRole("button", { exact: true, name: "Fechar" }).click();
    const closing = await sheet.evaluate(async (element) => {
      const [animation] = element.getAnimations();
      if (!animation?.effect) {
        throw new Error("Sheet sem animação de saída");
      }
      animation.pause();
      await animation.ready;
      const duration = Number(animation.effect.getComputedTiming().duration);
      animation.currentTime = duration / 2;
      const { x } = element.getBoundingClientRect();
      animation.finish();
      return { duration, x };
    });
    expect(closing.duration).toBeGreaterThan(0);
    expect(closing.duration).toBeLessThanOrEqual(300);
    expect(closing.x).toBeLessThan(0);
    expect(closing.x).toBeGreaterThan(-340);
    await expect(sheet).not.toBeVisible();
  });
}

test("o Sheet respeita a preferência por movimento reduzido", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { exact: true, name: "Abrir menu" }).click();
  const sheet = page.locator('[data-slot="sheet-content"]');
  await expect(sheet).toBeVisible();
  await expect(sheet).toHaveCSS("animation-name", "none");
  await page.keyboard.press("Escape");
  await expect(sheet).not.toBeVisible();
});

for (const width of [1440, 320]) {
  test(`o header oferece adicionar músicas por ícone à direita do menu em ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ height: 900, width });
    await page.goto("/");
    const header = page.getByRole("banner");
    const menu = header.getByRole("button", {
      exact: true,
      name: "Abrir menu",
    });
    const add = header.getByRole("button", {
      exact: true,
      name: "Adicionar músicas",
    });
    await expect(add).toBeVisible();
    await expect(add).toHaveAttribute("title", "Adicionar músicas");
    await expect(add.locator("svg")).toBeVisible();
    expect(await add.textContent()).toBe("");
    const bounds = await header.boundingBox();
    const left = await menu.boundingBox();
    const right = await add.boundingBox();
    if (!(bounds && left && right)) {
      throw new Error("Controles do header sem posição visível");
    }
    expect(left.x).toBeCloseTo(bounds.x, 1);
    expect(right.x + right.width).toBeCloseTo(bounds.x + bounds.width, 1);
    expect(right.x).toBeGreaterThan(left.x + left.width);
    expect(right.width).toBeGreaterThanOrEqual(44);
    expect(right.height).toBeGreaterThanOrEqual(44);
    await add.click();
    const dialog = page.getByRole("dialog", {
      exact: true,
      name: "Importar áudios",
    });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("button", { exact: true, name: "Importar do YouTube" })
    ).toBeVisible();
    await expect(
      dialog.getByRole("button", { exact: true, name: "Arquivo de áudio" })
    ).toBeVisible();
    await page.goto("/previa?estudo=hardware&variant=A");
    await expect(page.locator("header").getByRole("button")).toHaveCount(1);
    await expect(
      page.getByRole("button", { exact: true, name: "Adicionar músicas" })
    ).toHaveCount(0);
  });
}
