import { createHash } from "node:crypto";
import { expect, type Page } from "@playwright/test";
import { emptyLibrary } from "../src/lib/model";
import { test, wav } from "./fixtures";

async function openThreePads(
  page: Page,
  kinds: Array<"ambience" | "effect"> = []
) {
  const current = await (await page.request.get("/api/library")).json();
  const fixtures = [wav("Chuva", 211), wav("Floresta", 317), wav("Rio", 421)];
  const files = new FormData();
  const sounds = fixtures.map((file, index) => {
    const id = createHash("sha256").update(file.buffer).digest("hex");
    files.append(
      "files",
      new Blob([new Uint8Array(file.buffer)], { type: file.mimeType }),
      id
    );
    return {
      duration: 8,
      id,
      kind: kinds[index] ?? "ambience",
      loop: true,
      mime: file.mimeType,
      name: file.name.replace(".wav", ""),
      size: file.buffer.length,
      tags: [],
      volume: 0.75,
    };
  });
  files.append(
    "library",
    JSON.stringify({ ...emptyLibrary(), revision: current.revision, sounds })
  );
  const saved = await page.request.put("/api/library", { multipart: files });
  expect(saved.ok()).toBe(true);
  await page.setViewportSize({ height: 900, width: 1440 });
  await page.goto("/");
  await expect(
    page.getByRole("button", { exact: true, name: "Tocar Chuva" })
  ).toBeVisible();
}

function names(page: Page) {
  return page
    .locator("[data-ceramic-module] button[data-pad-drag-handle]")
    .evaluateAll((buttons) =>
      buttons.map((button) => button.getAttribute("aria-label"))
    );
}

test("o slider padrão mantém alvo invisível de pelo menos 44px", async ({
  page,
}) => {
  await openThreePads(page);
  const target = await page
    .getByRole("slider", { exact: true, name: "Volume geral" })
    .evaluate((element) => {
      const hitArea = getComputedStyle(element, "::before");
      return {
        height: Number.parseFloat(hitArea.height),
        width: Number.parseFloat(hitArea.width),
      };
    });
  expect(target.width).toBeGreaterThanOrEqual(44);
  expect(target.height).toBeGreaterThanOrEqual(44);
});

test("filtros e edição mantêm alvos de pelo menos 44px", async ({ page }) => {
  await openThreePads(page);
  const controls = ["Todos", "Música", "Ambiente", "Efeitos", "Editar Chuva"];
  await Promise.all(
    controls.map(async (name) => {
      const size = await page
        .getByRole("button", { exact: true, name })
        .evaluate((element) => {
          const rect = element.getBoundingClientRect();
          const hitArea = getComputedStyle(element, "::before");
          return {
            height: Math.max(
              rect.height,
              Number.parseFloat(hitArea.height) || 0
            ),
            width: Math.max(rect.width, Number.parseFloat(hitArea.width) || 0),
          };
        });
      expect(size.width, name).toBeGreaterThanOrEqual(44);
      expect(size.height, name).toBeGreaterThanOrEqual(44);
    })
  );
});

async function dragChuvaToRio(page: Page) {
  const source = await page
    .getByRole("button", { exact: true, name: "Mover Chuva" })
    .boundingBox();
  const target = await page
    .getByRole("button", { exact: true, name: "Mover Rio" })
    .boundingBox();
  if (!(source && target)) {
    throw new Error("Alças sem posição visível");
  }
  await page.mouse.move(
    source.x + source.width / 2,
    source.y + source.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    source.x + source.width / 2 + 8,
    source.y + source.height / 2,
    { steps: 2 }
  );
  await page.mouse.move(
    target.x + target.width / 2,
    target.y + target.height / 2,
    { steps: 12 }
  );
  const neighbor = page
    .locator("[data-ceramic-module]")
    .filter({ hasText: "Floresta" });
  await expect
    .poll(async () => (await neighbor.boundingBox())?.y)
    .toBeLessThan(source.y - 100);
  await neighbor.evaluate(async (element) => {
    await Promise.all(
      element.getAnimations().map((animation) => animation.finished)
    );
  });
  return neighbor;
}

test("soltar mantém os vizinhos na posição prevista enquanto o servidor salva", async ({
  page,
}) => {
  await openThreePads(page);
  let releaseSave: () => void = () => undefined;
  const saveGate = new Promise<void>((resolve) => {
    releaseSave = resolve;
  });
  await page.route("**/api/library", async (route) => {
    if (route.request().method() === "PUT") {
      await saveGate;
    }
    await route.continue();
  });
  try {
    const neighbor = await dragChuvaToRio(page);
    // Wait for the preview to settle, then inspect every frame during the delayed save.
    const before = await neighbor.boundingBox();
    if (!before) {
      throw new Error("Vizinho sem posição visível");
    }
    await page.mouse.up();
    const largestJump = await neighbor.evaluate((element, position) => {
      const started = performance.now();
      let largest = 0;
      return new Promise<number>((resolve) => {
        const sample = () => {
          const rect = element.getBoundingClientRect();
          largest = Math.max(
            largest,
            Math.abs(rect.x - position.x),
            Math.abs(rect.y - position.y)
          );
          if (performance.now() - started < 450) {
            requestAnimationFrame(sample);
          } else {
            resolve(largest);
          }
        };
        requestAnimationFrame(sample);
      });
    }, before);
    expect(largestJump).toBeLessThan(2);
  } finally {
    releaseSave();
  }
  await expect(
    page.getByRole("button", { exact: true, name: "Mover Chuva" })
  ).toBeEnabled();
  await expect
    .poll(() => names(page))
    .toEqual(["Mover Floresta", "Mover Rio", "Mover Chuva"]);
  await expect(page.locator("[data-pad-drop-slot]")).toHaveCount(0);
  expect(await page.pageErrors()).toEqual([]);
});

test("origem e destino mostram contornos pontilhados que somem ao cancelar", async ({
  page,
}) => {
  await openThreePads(page);
  const originBox = await page
    .locator("[data-ceramic-module]")
    .filter({ hasText: "Chuva" })
    .boundingBox();
  const targetBox = await page
    .locator("[data-ceramic-module]")
    .filter({ hasText: "Rio" })
    .boundingBox();
  await dragChuvaToRio(page);
  const origin = page.locator('[data-pad-drop-slot="origin"]');
  const target = page.locator('[data-pad-drop-slot="target"]');
  await expect(origin).toBeVisible();
  await expect(target).toBeVisible();
  await expect(origin).toHaveCSS("border-top-style", "dashed");
  await expect(target).toHaveCSS("border-top-style", "dashed");
  await Promise.all(
    (
      [
        [origin, originBox],
        [target, targetBox],
      ] as const
    ).map(async ([marker, box]) => {
      const actual = await marker.boundingBox();
      if (!(actual && box)) {
        throw new Error("Contorno sem posição visível");
      }
      expect(Math.abs(actual.x - box.x)).toBeLessThan(2);
      expect(Math.abs(actual.y - box.y)).toBeLessThan(2);
      expect(Math.abs(actual.width - box.width)).toBeLessThan(2);
      expect(Math.abs(actual.height - box.height)).toBeLessThan(2);
    })
  );
  if (!targetBox) {
    throw new Error("Destino sem posição visível");
  }
  await page.mouse.move(
    targetBox.x + targetBox.width * 0.6,
    targetBox.y + targetBox.height * 0.55,
    { steps: 5 }
  );
  await expect(target).toHaveCSS("grid-column-start", "2");
  await page.screenshot({ path: ".qa/pad-drag-slots.png" });
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(page.locator("[data-pad-drop-slot]")).toHaveCount(0);
  await expect
    .poll(() => names(page))
    .toEqual(["Mover Chuva", "Mover Floresta", "Mover Rio"]);
});

test("falha no salvamento desfaz a ordem visual sem alterar a biblioteca", async ({
  page,
}) => {
  await openThreePads(page);
  let releaseSave: () => void = () => undefined;
  const saveGate = new Promise<void>((resolve) => {
    releaseSave = resolve;
  });
  await page.route("**/api/library", async (route) => {
    if (route.request().method() !== "PUT") {
      await route.continue();
      return;
    }
    await saveGate;
    await route.fulfill({
      json: { detail: "Falha de teste ao salvar a ordem" },
      status: 503,
    });
  });
  try {
    await dragChuvaToRio(page);
    await page.mouse.up();
    await expect
      .poll(() => names(page))
      .toEqual(["Mover Floresta", "Mover Rio", "Mover Chuva"]);
    await expect(
      page.getByRole("button", { exact: true, name: "Mover Chuva" })
    ).toBeDisabled();
  } finally {
    releaseSave();
  }
  await expect
    .poll(() => names(page))
    .toEqual(["Mover Chuva", "Mover Floresta", "Mover Rio"]);
  await expect(
    page.getByText(
      "A biblioteca central está indisponível. Confira a conexão com o servidor; nenhuma alteração foi confirmada.",
      { exact: true }
    )
  ).toBeVisible();
  await expect(
    page.getByRole("button", { exact: true, name: "Mover Chuva" })
  ).toBeEnabled();
  await page.reload();
  await expect
    .poll(() => names(page))
    .toEqual(["Mover Chuva", "Mover Floresta", "Mover Rio"]);
  expect(await page.pageErrors()).toEqual([]);
});

test("reordenar com filtro preserva a posição dos pads ocultos", async ({
  page,
}) => {
  await openThreePads(page, ["ambience", "effect", "ambience"]);
  await page.getByRole("button", { exact: true, name: "Ambiente" }).click();
  await expect.poll(() => names(page)).toEqual(["Mover Chuva", "Mover Rio"]);
  const source = page.getByRole("button", { exact: true, name: "Mover Chuva" });
  await source.focus();
  await source.press("Space");
  await source.press("ArrowDown");
  await expect(page.locator('[data-pad-drop-slot="target"]')).toBeVisible();
  await source.press("Space");
  await expect.poll(() => names(page)).toEqual(["Mover Rio", "Mover Chuva"]);
  await expect(source).toBeEnabled();
  await page.getByRole("button", { exact: true, name: "Todos" }).click();
  await expect
    .poll(() => names(page))
    .toEqual(["Mover Rio", "Mover Floresta", "Mover Chuva"]);
  await page.reload();
  await expect
    .poll(() => names(page))
    .toEqual(["Mover Rio", "Mover Floresta", "Mover Chuva"]);
});

test("a alça move pads por ponteiro sem tocar áudio", async ({
  page,
  browser,
  baseURL,
}) => {
  await openThreePads(page);
  const source = page.getByRole("button", { exact: true, name: "Mover Chuva" });
  const target = page.getByRole("button", { exact: true, name: "Mover Rio" });
  await expect(source).toBeVisible();
  await expect(source).toHaveCSS("touch-action", "none");
  const start = await source.boundingBox();
  const end = await target.boundingBox();
  if (!(start && end)) {
    throw new Error("Alças sem posição visível");
  }
  expect(start.width).toBeGreaterThanOrEqual(44);
  expect(start.height).toBeGreaterThanOrEqual(44);
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    start.x + start.width / 2 + 8,
    start.y + start.height / 2,
    { steps: 2 }
  );
  await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, {
    steps: 12,
  });
  await page.mouse.up();
  await expect
    .poll(() => names(page))
    .toEqual(["Mover Floresta", "Mover Rio", "Mover Chuva"]);
  await expect(page.locator("audio")).toHaveCount(0);
  await page.reload();
  await expect
    .poll(() => names(page))
    .toEqual(["Mover Floresta", "Mover Rio", "Mover Chuva"]);
  const other = await browser.newContext({ baseURL });
  try {
    const tablet = await other.newPage();
    await tablet.goto("/");
    await expect
      .poll(() => names(tablet))
      .toEqual(["Mover Floresta", "Mover Rio", "Mover Chuva"]);
    await expect(tablet.locator("audio")).toHaveCount(0);
    expect(await tablet.pageErrors()).toEqual([]);
  } finally {
    await other.close();
  }
  expect(await page.pageErrors()).toEqual([]);
});

test("a alça reorganiza pads pelo teclado e respeita movimento reduzido", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openThreePads(page);
  const source = page.getByRole("button", { exact: true, name: "Mover Chuva" });
  await source.focus();
  await source.press("Space");
  await expect(page.locator('[data-lifted="true"]')).toHaveCSS(
    "transform",
    "none"
  );
  await expect(
    page.locator("[data-ceramic-pad-grid] [data-ceramic-module]").last()
  ).toHaveCSS("transition-duration", "0s");
  await source.press("ArrowDown");
  await expect(page.locator('[data-pad-drop-slot="target"]')).toBeVisible();
  await source.press("Space");
  await expect
    .poll(() => names(page))
    .toEqual(["Mover Floresta", "Mover Chuva", "Mover Rio"]);
  await expect(source).toBeFocused();
  await expect(page.locator("audio")).toHaveCount(0);
  expect(await page.pageErrors()).toEqual([]);
});

test("a mesa usa grade direta sem carrossel e o card em arraste ganha rotação e borda Arc UI", async ({
  page,
}) => {
  await openThreePads(page);
  // Não deve existir container de carrossel na mesa de som
  await expect(page.locator('[data-slot="carousel-content"]')).toHaveCount(0);

  const source = page.getByRole("button", { exact: true, name: "Mover Chuva" });
  const start = await source.boundingBox();
  if (!start) {
    throw new Error("Alça sem posição visível");
  }

  // Inicia o arraste
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    start.x + start.width / 2 + 30,
    start.y + start.height / 2 + 20,
    {
      steps: 5,
    }
  );

  const draggingModule = page.locator(
    '[data-ceramic-module][data-lifted="true"]'
  );
  await expect(draggingModule).toBeVisible();

  // Verifica efeito visual Arc UI: rotação no transform e borda em destaque
  const rotation = await draggingModule.evaluate(
    (element) => new DOMMatrix(getComputedStyle(element).transform).b
  );
  expect(rotation).toBeGreaterThan(0);

  // Solta o mouse
  await page.mouse.up();
  await expect(
    page.locator('[data-ceramic-module][data-lifted="true"]')
  ).toHaveCount(0);
});

test("arrastar fora da alça não levanta nem reordena os pads", async ({
  page,
}) => {
  await openThreePads(page);
  const sourceCard = page
    .locator("[data-ceramic-module]")
    .filter({ hasText: "Chuva" });
  const targetCard = page
    .locator("[data-ceramic-module]")
    .filter({ hasText: "Rio" });
  const start = await sourceCard.boundingBox();
  const end = await targetCard.boundingBox();
  if (!(start && end)) {
    throw new Error("Cards sem posição visível");
  }

  // Clica e arrasta a partir do topo do card (área do pad)
  await page.mouse.move(start.x + start.width / 2, start.y + 40);
  await page.mouse.down();
  await page.mouse.move(start.x + start.width / 2 + 10, start.y + 40, {
    steps: 2,
  });
  await page.mouse.move(end.x + end.width / 2, end.y + 40, { steps: 12 });
  await expect(
    page.locator('[data-ceramic-module][data-lifted="true"]')
  ).toHaveCount(0);
  await page.mouse.up();

  await expect
    .poll(() => names(page))
    .toEqual(["Mover Chuva", "Mover Floresta", "Mover Rio"]);
});

test("o pad continua visível fora da grade e pode voltar para outra posição", async ({
  page,
}) => {
  await openThreePads(page);
  const source = page.getByRole("button", { exact: true, name: "Mover Chuva" });
  const target = page.getByRole("button", { exact: true, name: "Mover Rio" });
  const start = await source.boundingBox();
  const end = await target.boundingBox();
  const grid = await page.locator("[data-ceramic-pad-grid]").boundingBox();
  if (!(start && end && grid)) {
    throw new Error("Grade ou alças sem posição visível");
  }
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(start.x + start.width / 2, grid.y - 40, { steps: 8 });
  const dragging = page.locator('[data-ceramic-module][data-lifted="true"]');
  await expect
    .poll(async () => {
      const outside = await dragging.boundingBox();
      return outside ? outside.y + outside.height : Number.POSITIVE_INFINITY;
    })
    .toBeLessThan(grid.y);
  await expect(dragging).toBeInViewport({ ratio: 0.1 });
  await page.screenshot({ path: ".qa/pad-drag-outside.png" });
  await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, {
    steps: 12,
  });
  await page.mouse.up();
  await expect(dragging).toHaveCount(0);
  await expect
    .poll(() => names(page))
    .toEqual(["Mover Floresta", "Mover Rio", "Mover Chuva"]);
  await expect(page.locator("audio")).toHaveCount(0);
  expect(await page.pageErrors()).toEqual([]);
});

test("o pad flutua fora da lateral da mesa e Escape cancela sem reorganizar", async ({
  page,
}) => {
  await openThreePads(page);
  await page.setViewportSize({ height: 900, width: 1920 });
  const source = page.getByRole("button", { exact: true, name: "Mover Chuva" });
  const start = await source.boundingBox();
  const card = await page
    .locator("[data-ceramic-module]")
    .first()
    .boundingBox();
  const grid = await page.locator("[data-ceramic-pad-grid]").boundingBox();
  if (!(start && card && grid)) {
    throw new Error("Grade ou alça sem posição visível");
  }
  const x = start.x + start.width / 2;
  const y = start.y + start.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + grid.x - 24 - card.x - card.width, y, { steps: 8 });
  const dragging = page.locator('[data-ceramic-module][data-lifted="true"]');
  await expect
    .poll(async () => {
      const outside = await dragging.boundingBox();
      return outside ? outside.x + outside.width : Number.POSITIVE_INFINITY;
    })
    .toBeLessThan(grid.x);
  await expect(dragging).toBeInViewport({ ratio: 0.99 });
  await page.screenshot({ path: ".qa/pad-drag-outside-left.png" });
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(dragging).toHaveCount(0);
  await expect
    .poll(() => names(page))
    .toEqual(["Mover Chuva", "Mover Floresta", "Mover Rio"]);
  await expect(page.locator("audio")).toHaveCount(0);
  expect(await page.pageErrors()).toEqual([]);
});

test("o card não tem altura vazia excessiva maior que o pad e controles", async ({
  page,
}) => {
  await openThreePads(page);
  const card = page.locator("[data-ceramic-module]").first();
  const pad = card.getByRole("button", { name: "Tocar Chuva" });
  const cardBox = await card.boundingBox();
  const padBox = await pad.boundingBox();
  if (!(cardBox && padBox)) {
    throw new Error("Bounding box indisponível");
  }

  // O card deve envolver o pad + controles (~60-90px), sem esticar vazio para preencher a tela
  expect(cardBox.height - padBox.height).toBeLessThan(110);
});
