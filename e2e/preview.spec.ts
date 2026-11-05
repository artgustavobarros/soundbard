import { expect, type Locator, type Page } from "@playwright/test";
import { inOrder } from "../src/lib/utils";
import { test } from "./fixtures";

const PLAYLIST_PAD_NAME = /\bCaminhada à noite\b/u;
const FIRE_PAD_NAME = /\bLareira\b/u;
const RENAMED_PAD_NAME = /\bMarcha na floresta\b/u;
const PAGINATION_NAME = /^(?:Página|Canal) \d+ de \d+$/u;
const SWEEP_WIDTHS = [
  ...new Set([
    ...Array.from({ length: 67 }, (_, index) => 320 + index * 24),
    400,
    684,
    685,
    686,
    838,
    839,
    840,
    985,
    986,
    987,
    1024,
    1279,
    1280,
    1281,
    1920,
  ]),
].sort((left, right) => left - right);

test.use({ reducedMotion: "reduce" });

test.afterEach(async ({ page }) => {
  expect(await page.pageErrors()).toEqual([]);
});

async function expectFixedControls(page: Page) {
  await expect(
    page.getByRole("region", { exact: true, name: "Controles do pad" })
  ).toBeInViewport({ ratio: 1 });
  await expect(
    page.getByRole("button", { exact: true, name: "Parar tudo" })
  ).toBeInViewport({ ratio: 1 });
  await expect(
    page.getByRole("slider", { exact: true, name: "Volume geral" })
  ).toBeInViewport({ ratio: 1 });
  expect(
    await page.evaluate(() => ({
      horizontal: document.documentElement.scrollWidth > window.innerWidth,
      vertical: document.documentElement.scrollHeight > window.innerHeight,
    }))
  ).toEqual({ horizontal: false, vertical: false });
}

async function expectDragNavigation(page: Page) {
  await expect(
    page.locator('[data-slot="carousel-next"], [data-slot="carousel-previous"]')
  ).toHaveCount(0);
  await expect(page.getByText(PAGINATION_NAME)).toHaveCount(0);
  await expect(page.getByRole("tab")).toHaveCount(0);
}

async function ensurePlaying(pad: Locator) {
  if ((await pad.getAttribute("aria-pressed")) !== "true") {
    await pad.click();
  }
  await expect(pad).toHaveAttribute("aria-pressed", "true");
}

function padByName(page: Page, name: RegExp) {
  return page
    .getByRole("region", { exact: true, name: "Pads de Taverna" })
    .getByRole("button", { name })
    .and(page.locator("button[aria-pressed]"));
}

async function waitForLayout(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      })
  );
}

async function dragLeft(page: Page, viewport: Locator, anchor: Locator) {
  const bounds = await viewport.boundingBox();
  if (!bounds) {
    throw new Error("A área de arraste precisa estar visível.");
  }
  const initialX = await anchor.evaluate(
    (element) => element.getBoundingClientRect().x
  );
  const y = bounds.y + 20;
  await page.mouse.move(bounds.x + bounds.width * 0.8, y);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * 0.2, y, { steps: 12 });
  await page.mouse.up();
  await expect
    .poll(() => anchor.evaluate((element) => element.getBoundingClientRect().x))
    .toBeLessThan(initialX - 30);
  await expect
    .poll(async () => {
      const before = await anchor.evaluate(
        (element) => element.getBoundingClientRect().x
      );
      await page.evaluate(
        () =>
          new Promise<void>((resolve) => {
            let frames = 0;
            function nextFrame() {
              frames += 1;
              if (frames === 12) {
                resolve();
                return;
              }
              requestAnimationFrame(nextFrame);
            }
            requestAnimationFrame(nextFrame);
          })
      );
      const after = await anchor.evaluate(
        (element) => element.getBoundingClientRect().x
      );
      return Math.abs(after - before);
    })
    .toBeLessThan(0.05);
  return anchor.evaluate((element) => element.getBoundingClientRect().x);
}

function measurePads(page: Page) {
  return page
    .getByRole("region", { exact: true, name: "Pads de Taverna" })
    .evaluate((board) => {
      const viewport = board.querySelector('[data-slot="carousel-content"]');
      if (!viewport) {
        throw new Error("A mesa precisa expor a área do carrossel de pads.");
      }
      const region = viewport.getBoundingClientRect();
      const pads = [...board.querySelectorAll("button[aria-pressed]")].map(
        (element) => {
          const { bottom, height, left, right, top, width } =
            element.getBoundingClientRect();
          return { bottom, height, left, right, top, width };
        }
      );
      const firstRow = pads
        .filter(({ top }) => Math.abs(top - pads[0].top) < 1)
        .sort((left, right) => left.left - right.left);
      const firstColumn = pads
        .filter(({ left }) => Math.abs(left - pads[0].left) < 1)
        .sort((upper, lower) => upper.top - lower.top);
      const horizontalGaps = firstRow
        .slice(1)
        .map(({ left }, index) => left - firstRow[index].right);
      const verticalGaps = firstColumn
        .slice(1)
        .map(({ top }, index) => top - firstColumn[index].bottom);
      const visibleRow = firstRow.filter(
        ({ left, right }) =>
          left >= region.left - 1 && right <= region.right + 1
      );
      const visibleGaps = visibleRow
        .slice(1)
        .map(({ left }, index) => left - visibleRow[index].right);
      const intersecting = firstRow.filter(
        ({ left, right }) => left < region.right && right > region.left
      );
      const leftSpace = Math.max(
        0,
        Math.min(...intersecting.map(({ left }) => left)) - region.left
      );
      const rightSpace = Math.max(
        0,
        region.right - Math.max(...intersecting.map(({ right }) => right))
      );
      const extraGapSpace = visibleGaps.reduce(
        (total, gap) => total + Math.max(0, gap - 12),
        0
      );
      const heading = board.querySelector("h1");
      const headingBox = heading?.getBoundingClientRect();
      const wholeRowFits = firstRow.every(
        ({ left, right }) =>
          left >= region.left - 1 && right <= region.right + 1
      );
      const visible = pads.filter(
        ({ bottom, left, right, top }) =>
          left >= region.left - 1 &&
          right <= region.right + 1 &&
          top >= region.top - 1 &&
          bottom <= region.bottom + 1
      );
      return {
        dimensions: pads,
        firstRowCount: visibleRow.length,
        headingGap: headingBox?.height ? pads[0].top - headingBox.bottom : null,
        horizontalGaps,
        leftMargin: firstRow[0].left - region.left,
        rightMargin:
          region.right - Math.max(...firstRow.map(({ right }) => right)),
        size: pads[0].width,
        verticalGaps,
        visible: visible.length,
        wastedHorizontalSpace: leftSpace + rightSpace + extraGapSpace,
        wholeRowFits,
      };
    });
}

test("toca, pausa e retoma a playlist no pad sem interromper outro som", async ({
  page,
}) => {
  await page.setViewportSize({ height: 1000, width: 1440 });
  await page.goto("/previa");
  await expectDragNavigation(page);
  const fire = padByName(page, FIRE_PAD_NAME);
  const playlist = padByName(page, PLAYLIST_PAD_NAME);
  const controls = page.getByRole("region", {
    exact: true,
    name: "Controles do pad",
  });
  await ensurePlaying(fire);
  await expect(playlist).toHaveAttribute("aria-pressed", "false");
  await playlist.click();
  await expect(playlist).toHaveAttribute("aria-pressed", "true");
  await expect(controls).toContainText("Brumas da estrada");
  await playlist.click();
  await expect(playlist).toHaveAttribute("aria-pressed", "false");
  await expect(playlist).toContainText("Pausado");
  await playlist.click();
  await expect(playlist).toHaveAttribute("aria-pressed", "true");
  await expect(fire).toHaveAttribute("aria-pressed", "true");

  await controls
    .getByRole("button", { exact: true, name: "Próxima música" })
    .click();
  await expect(controls).toContainText("Entre as árvores");
  await controls
    .getByRole("button", { exact: true, name: "Música anterior" })
    .click();
  await expect(controls).toContainText("Brumas da estrada");

  const padVolume = page.getByRole("slider", {
    exact: true,
    name: "Volume do pad",
  });
  await padVolume.focus();
  await padVolume.press("Home");
  await padVolume.press("ArrowRight");
  await expect(padVolume).toHaveAttribute("aria-valuenow", "1");
  const masterVolume = page.getByRole("slider", {
    exact: true,
    name: "Volume geral",
  });
  await masterVolume.focus();
  await masterVolume.press("End");
  await masterVolume.press("ArrowLeft");
  await expect(masterVolume).toHaveAttribute("aria-valuenow", "99");

  await controls
    .getByRole("button", { exact: true, name: "Pausar pad" })
    .click();
  await expect(playlist).toContainText("Pausado");
  await controls
    .getByRole("button", { exact: true, name: "Retomar pad" })
    .click();
  await expect(playlist).toHaveAttribute("aria-pressed", "true");
  await expect(padVolume).toHaveAttribute("aria-valuenow", "1");
  await controls
    .getByRole("button", { exact: true, name: "Parar pad" })
    .click();
  await expect(playlist).toHaveAttribute("aria-pressed", "false");
  await expect(fire).toHaveAttribute("aria-pressed", "true");
  await controls
    .getByRole("button", { exact: true, name: "Tocar pad" })
    .click();
  await expect(playlist).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { exact: true, name: "Parar tudo" }).click();
  await expect(
    page
      .getByRole("region", { exact: true, name: "Pads de Taverna" })
      .locator('button[aria-pressed="true"]')
  ).toHaveCount(0);
  await expectFixedControls(page);
});

test("personaliza nome e playlist do pad sem interromper os outros sons", async ({
  page,
}) => {
  await page.setViewportSize({ height: 1000, width: 1440 });
  await page.goto("/previa");
  const fire = padByName(page, FIRE_PAD_NAME);
  await ensurePlaying(fire);
  await padByName(page, PLAYLIST_PAD_NAME).click();
  await page
    .getByRole("button", { exact: true, name: "Personalizar pad" })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome do pad").fill("Marcha na floresta");
  await expect(
    dialog.getByRole("button", { exact: true, name: "Playlist Viagem noturna" })
  ).toBeVisible();
  await dialog
    .getByRole("button", { exact: true, name: "Playlist Confronto" })
    .click();
  await dialog.getByRole("button", { exact: true, name: "Salvar pad" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(padByName(page, RENAMED_PAD_NAME)).toBeVisible();
  const controls = page.getByRole("region", {
    exact: true,
    name: "Controles do pad",
  });
  await expect(controls).toContainText("Marcha na floresta");
  await expect(controls).toContainText("Confronto");
  await expect(fire).toHaveAttribute("aria-pressed", "true");
});

test("aproveita a área com pads quadrados, gaps constantes e título próximo de 320 a 1920 px", async ({
  page,
}) => {
  await page.setViewportSize({ height: 768, width: 320 });
  await page.goto("/previa");
  await expectDragNavigation(page);
  const board = page.getByRole("region", {
    exact: true,
    name: "Pads de Taverna",
  });
  await expect(board.locator("button[aria-pressed]")).toHaveCount(16);
  const samples: (Awaited<ReturnType<typeof measurePads>> & {
    width: number;
  })[] = [];
  await inOrder(SWEEP_WIDTHS, async (width) => {
    await page.setViewportSize({ height: 768, width });
    await waitForLayout(page);
    const layout = await measurePads(page);
    await expectFixedControls(page);
    samples.push({ ...layout, width });
  });
  const invalidSquares = samples.flatMap(({ dimensions, width }) =>
    dimensions
      .filter(
        ({ height, width: side }) => Math.abs(height - side) >= 1 || side <= 0
      )
      .map(({ height, width: side }) => ({ height, side, width }))
  );
  const gaps = samples.flatMap(({ horizontalGaps, verticalGaps, width }) =>
    [...horizontalGaps, ...verticalGaps].map((gap) => ({ gap, width }))
  );
  const invalidGaps = gaps.filter(({ gap }) => gap < 8 || gap > 12);
  const gapVariation =
    Math.max(...gaps.map(({ gap }) => gap)) -
    Math.min(...gaps.map(({ gap }) => gap));
  const distantHeadings = samples
    .filter(
      ({ headingGap }) =>
        headingGap === null || headingGap < -1 || headingGap > 16
    )
    .map(({ headingGap, width }) => ({ headingGap, width }));
  const wastedSlots = samples
    .filter(
      ({ size, wastedHorizontalSpace }) => wastedHorizontalSpace >= size + 8
    )
    .map(({ size, wastedHorizontalSpace, width }) => ({
      size,
      wastedHorizontalSpace,
      width,
    }));
  const unbalancedMargins = samples
    .filter(
      ({ leftMargin, rightMargin, wholeRowFits }) =>
        wholeRowFits && Math.abs(leftMargin - rightMargin) > 2
    )
    .map(({ leftMargin, rightMargin, width }) => ({
      leftMargin,
      rightMargin,
      width,
    }));
  const tablet = samples.find(({ width }) => width === 1024);
  const compact = samples.find(({ width }) => width === 685);
  const medium = samples.find(({ width }) => width === 839);
  expect({
    compactHasEnoughColumns: (compact?.firstRowCount ?? 0) >= 4,
    distantHeadings,
    gapsAreConsistent: gapVariation <= 1,
    invalidGaps,
    invalidSquares,
    mediumHasEnoughColumns: (medium?.firstRowCount ?? 0) >= 5,
    tabletHasEnoughColumns: (tablet?.firstRowCount ?? 0) >= 6,
    tabletHasMultipleRows: (tablet?.visible ?? 0) > 4,
    unbalancedMargins,
    wastedSlots,
  }).toEqual({
    compactHasEnoughColumns: true,
    distantHeadings: [],
    gapsAreConsistent: true,
    invalidGaps: [],
    invalidSquares: [],
    mediumHasEnoughColumns: true,
    tabletHasEnoughColumns: true,
    tabletHasMultipleRows: true,
    unbalancedMargins: [],
    wastedSlots: [],
  });
});

test("arrasta a mesa no celular sem disparar pads nem deslocar os controles", async ({
  page,
}) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/previa");
  await expectDragNavigation(page);
  const board = page.getByRole("region", {
    exact: true,
    name: "Pads de Taverna",
  });
  await expect(board.locator("button[aria-pressed]")).toHaveCount(16);
  await expect
    .poll(async () => (await measurePads(page)).visible)
    .toBeGreaterThanOrEqual(4);
  const firstPad = board.locator("button[aria-pressed]").first();
  const activePads = board.locator('button[aria-pressed="true"]');
  const activeBeforeDrag = await activePads.allTextContents();
  const padX = await dragLeft(
    page,
    board.locator('[data-slot="carousel-content"]').first(),
    firstPad
  );
  await expect(activePads).toHaveText(activeBeforeDrag);
  await expectFixedControls(page);
  const masterVolume = page.getByRole("slider", {
    exact: true,
    name: "Volume geral",
  });
  await masterVolume.focus();
  await masterVolume.press("End");
  await expect(masterVolume).toHaveAttribute("aria-valuenow", "100");
  await expect
    .poll(async () =>
      Math.abs(
        (await firstPad.evaluate(
          (element) => element.getBoundingClientRect().x
        )) - padX
      )
    )
    .toBeLessThan(2);
  await expect(activePads).toHaveText(activeBeforeDrag);
});

test("navega pela hierarquia de cenas e filtra ambientes sem categorias soltas no topo", async ({
  page,
}) => {
  await page.setViewportSize({ height: 768, width: 320 });
  await page.goto("/previa");
  const navigation = page.getByRole("navigation", {
    exact: true,
    name: "Conjuntos de pads",
  });
  await expect(navigation.getByRole("button")).toHaveText([
    "Cenas",
    "Efeitos",
    "Personalizado",
  ]);
  await expect(
    navigation.getByRole("button", { exact: true, name: "Ambiente" })
  ).toHaveCount(0);
  await expect(
    navigation.getByRole("button", { exact: true, name: "Combate" })
  ).toHaveCount(0);

  await navigation.getByRole("button", { exact: true, name: "Cenas" }).click();
  await page.getByRole("menuitem", { exact: true, name: "Combate" }).click();
  await expect(
    page.getByRole("menuitemradio", { exact: true, name: "Emboscada" })
  ).toBeInViewport({ ratio: 1 });
  await page
    .getByRole("menuitemradio", { exact: true, name: "Emboscada" })
    .click();
  await expect(
    page.getByRole("heading", { exact: true, level: 1, name: "Emboscada" })
  ).toBeVisible();
  await expect(
    page
      .getByRole("region", { exact: true, name: "Pads de Emboscada" })
      .locator("button[aria-pressed]")
  ).toHaveCount(3);

  await navigation
    .getByRole("button", { exact: true, name: "Efeitos" })
    .click();
  await page
    .getByRole("menuitemradio", { exact: true, name: "Ambiente" })
    .click();
  await expect(
    page.getByRole("heading", { exact: true, level: 1, name: "Ambiente" })
  ).toBeVisible();
  const ambiences = page
    .getByRole("region", { exact: true, name: "Pads de Ambiente" })
    .locator("button[aria-pressed]");
  await expect(ambiences).toHaveCount(3);
  expect(await ambiences.allTextContents()).toEqual(
    expect.arrayContaining([
      expect.stringContaining("Lareira"),
      expect.stringContaining("Conversas"),
      expect.stringContaining("Chuva no telhado"),
    ])
  );
  await expectFixedControls(page);
});

test("salva um grupo de dois pads, mantém outros sons e reabre a seleção após recarregar", async ({
  page,
}) => {
  await page.setViewportSize({ height: 1000, width: 1440 });
  await page.goto("/previa");
  await ensurePlaying(padByName(page, FIRE_PAD_NAME));
  await page
    .getByRole("button", { exact: true, name: "Personalizado" })
    .click();
  await page
    .getByRole("menuitem", { exact: true, name: "Criar grupo de pads" })
    .click();
  const dialog = page.getByRole("dialog", {
    exact: true,
    name: "Criar grupo de pads",
  });
  await expect(dialog.getByRole("checkbox")).toHaveCount(16);
  await dialog.getByLabel("Nome do grupo").fill("Sons da jornada");
  await dialog
    .getByRole("checkbox", { exact: true, name: "Caminhada à noite" })
    .check();
  await dialog.getByRole("checkbox", { exact: true, name: "Espada" }).check();
  await dialog
    .getByRole("button", { exact: true, name: "Salvar grupo" })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("heading", {
      exact: true,
      level: 1,
      name: "Sons da jornada",
    })
  ).toBeVisible();
  const groupPads = page
    .getByRole("region", { exact: true, name: "Pads de Sons da jornada" })
    .locator("button[aria-pressed]");
  await expect(groupPads).toHaveCount(2);
  expect(await groupPads.allTextContents()).toEqual(
    expect.arrayContaining([
      expect.stringContaining("Caminhada à noite"),
      expect.stringContaining("Espada"),
    ])
  );

  await page.getByRole("button", { exact: true, name: "Cenas" }).click();
  await page.getByRole("menuitem", { exact: true, name: "Locais" }).click();
  await page
    .getByRole("menuitemradio", { exact: true, name: "Taverna" })
    .click();
  await expect(padByName(page, FIRE_PAD_NAME)).toHaveAttribute(
    "aria-pressed",
    "true"
  );

  await page.reload();
  await page
    .getByRole("button", { exact: true, name: "Personalizado" })
    .click();
  await page
    .getByRole("menuitemradio", { exact: true, name: "Sons da jornada" })
    .click();
  await expect(
    page.getByRole("heading", {
      exact: true,
      level: 1,
      name: "Sons da jornada",
    })
  ).toBeVisible();
  await expect(groupPads).toHaveCount(2);
  expect(await groupPads.allTextContents()).toEqual(
    expect.arrayContaining([
      expect.stringContaining("Caminhada à noite"),
      expect.stringContaining("Espada"),
    ])
  );
  await expectFixedControls(page);
});
