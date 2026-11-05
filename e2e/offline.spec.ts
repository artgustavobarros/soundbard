import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type BrowserContext, chromium, expect } from "@playwright/test";
import { openDeskAction, test, wav } from "./fixtures";

test("reabre a interface compilada e toca arquivos importados sem conexão", async ({
  page,
  context,
}) => {
  page.setDefaultTimeout(10_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await openDeskAction(page, "Importar áudios");
  await page
    .getByRole("button", { exact: true, name: "Arquivo de áudio" })
    .click();
  await page
    .getByLabel("Arquivos de áudio")
    .setInputFiles(wav("Ambiente offline"));
  await page.getByLabel("Tipo do áudio").selectOption("ambience");
  await page
    .getByRole("button", { exact: true, name: "Adicionar à biblioteca" })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("button", { exact: true, name: "Abrir menu" }).click();
  await expect(
    page.getByText("Pronto para offline", { exact: true })
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => Boolean(navigator.serviceWorker.controller))
    )
    .toBe(true);
  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await openDeskAction(page, "Biblioteca");
  await expect(
    page.getByRole("dialog").getByText("Ambiente offline", { exact: true })
  ).toBeVisible();
  await page
    .getByRole("button", { exact: true, name: "Tocar Ambiente offline" })
    .click();
  await expect
    .poll(() =>
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
  const secondPage = await context.newPage();
  await secondPage.goto(
    test.info().project.use.baseURL ?? "http://127.0.0.1:3312/"
  );
  await expect(
    secondPage.getByRole("heading", { exact: true, name: "Todos os pads" })
  ).toBeVisible();
  expect(await secondPage.pageErrors()).toEqual([]);
  expect(errors).toEqual([]);
});

test("preserva a biblioteca e o cache após fechar o navegador e reabrir sem conexão", async () => {
  const profile = await mkdtemp(join(tmpdir(), "soundbard-offline-"));
  let context: BrowserContext | undefined;
  try {
    context = await chromium.launchPersistentContext(profile, {
      headless: true,
    });
    const firstPage = await context.newPage();
    await firstPage.goto(
      test.info().project.use.baseURL ?? "http://127.0.0.1:3312/"
    );
    await openDeskAction(firstPage, "Importar áudios");
    await firstPage
      .getByRole("button", { exact: true, name: "Arquivo de áudio" })
      .click();
    await firstPage
      .getByLabel("Arquivos de áudio")
      .setInputFiles(wav("Som persistido"));
    await firstPage.getByLabel("Tipo do áudio").selectOption("ambience");
    await firstPage
      .getByRole("button", { exact: true, name: "Adicionar à biblioteca" })
      .click();
    await expect(firstPage.getByRole("dialog")).not.toBeVisible();
    await firstPage
      .getByRole("button", { exact: true, name: "Abrir menu" })
      .click();
    await expect(
      firstPage.getByText("Pronto para offline", { exact: true })
    ).toBeVisible();
    expect(await firstPage.pageErrors()).toEqual([]);
    await context.close();
    context = undefined;

    context = await chromium.launchPersistentContext(profile, {
      headless: true,
      offline: true,
    });
    const reopened = await context.newPage();
    await reopened.goto(
      test.info().project.use.baseURL ?? "http://127.0.0.1:3312/"
    );
    await openDeskAction(reopened, "Biblioteca");
    await expect(
      reopened.getByRole("dialog").getByText("Som persistido", { exact: true })
    ).toBeVisible();
    await reopened
      .getByRole("button", { exact: true, name: "Tocar Som persistido" })
      .click();
    await expect
      .poll(() =>
        reopened
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
    expect(await reopened.pageErrors()).toEqual([]);
  } finally {
    await context?.close();
    await rm(profile, { force: true, recursive: true });
  }
});
