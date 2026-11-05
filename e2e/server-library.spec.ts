import { expect } from "@playwright/test";
import { openDeskAction, test, wav } from "./fixtures";

test("uma importação fica no servidor e é reproduzida em outro navegador", async ({
  page,
  browser,
  baseURL,
}) => {
  await page.goto("/");
  await openDeskAction(page, "Importar áudios");
  await page
    .getByRole("button", { exact: true, name: "Arquivo de áudio" })
    .click();
  await page
    .getByLabel("Arquivos de áudio")
    .setInputFiles(wav("Chuva compartilhada", 210, 20));
  await page.getByLabel("Tipo do áudio").selectOption("ambience");
  await page
    .getByRole("button", { exact: true, name: "Adicionar à biblioteca" })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  const server = await page.request.get("/api/library");
  expect(server.ok()).toBe(true);
  const library = await server.json();
  expect(library.sounds).toHaveLength(1);
  expect(library.sounds[0].name).toBe("Chuva compartilhada");
  const other = await browser.newContext({ baseURL });
  try {
    const tablet = await other.newPage();
    await tablet.goto("/");
    const pad = tablet.getByRole("button", {
      exact: true,
      name: "Tocar Chuva compartilhada",
    });
    await expect(pad).toBeVisible();
    await pad.click();
    await expect
      .poll(() =>
        tablet
          .locator("audio")
          .evaluateAll((nodes) =>
            nodes.some(
              (node) =>
                node instanceof HTMLAudioElement &&
                !node.paused &&
                node.currentTime > 0.1
            )
          )
      )
      .toBe(true);
    expect(await tablet.pageErrors()).toEqual([]);
  } finally {
    await other.close();
  }
});

test("grupos de pads são compartilhados com outro navegador", async ({
  page,
  browser,
  baseURL,
}) => {
  await page.goto("/");
  await openDeskAction(page, "Importar áudios");
  await page
    .getByRole("button", { exact: true, name: "Arquivo de áudio" })
    .click();
  await page
    .getByLabel("Arquivos de áudio")
    .setInputFiles(wav("Chuva do grupo", 211, 20));
  await page.getByLabel("Tipo do áudio").selectOption("ambience");
  await page
    .getByRole("button", { exact: true, name: "Adicionar à biblioteca" })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await openDeskAction(page, "Personalizado");
  await page.getByRole("menuitem", { name: "Criar grupo de pads" }).click();
  await page.getByLabel("Nome do grupo").fill("Mesa compartilhada");
  await page.getByRole("checkbox", { name: "Chuva do grupo" }).check();
  await page.getByRole("button", { name: "Salvar grupo" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  const library = await (await page.request.get("/api/library")).json();
  expect(library.padGroups).toEqual([
    {
      id: expect.any(String),
      name: "Mesa compartilhada",
      padIds: [library.sounds[0].id],
    },
  ]);
  const other = await browser.newContext({ baseURL });
  try {
    const tablet = await other.newPage();
    await tablet.goto("/");
    await openDeskAction(tablet, "Personalizado");
    await tablet
      .getByRole("menuitemradio", { name: "Mesa compartilhada" })
      .click();
    await expect(
      tablet.getByRole("heading", { name: "Mesa compartilhada" })
    ).toBeVisible();
    await expect(
      tablet.getByRole("button", { exact: true, name: "Tocar Chuva do grupo" })
    ).toBeVisible();
  } finally {
    await other.close();
  }
});

test("o menu permite exportar a biblioteca antiga preservada sem substituir o servidor", async ({
  page,
}) => {
  await page.goto("/");
  const current = await (await page.request.get("/api/library")).json();
  await page.request.put("/api/library", {
    multipart: { library: JSON.stringify({ ...current, tags: ["Servidor"] }) },
  });
  await page.evaluate(async () => {
    const audio = new Blob(["Legado preservado"], { type: "audio/wav" });
    const hash = await crypto.subtle.digest(
      "SHA-256",
      await audio.arrayBuffer()
    );
    const id = Array.from(new Uint8Array(hash), (byte) =>
      byte.toString(16).padStart(2, "0")
    ).join("");
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("soundbard", 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore("config");
        request.result.createObjectStore("files");
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(
        ["config", "files"],
        "readwrite"
      );
      transaction.objectStore("config").put(
        {
          master: 0.8,
          playlists: [],
          revision: 3,
          scenes: [],
          sounds: [
            {
              duration: 1,
              id,
              kind: "ambience",
              loop: true,
              mime: audio.type,
              name: "Legado",
              size: audio.size,
              tags: [],
              volume: 0.5,
            },
          ],
          version: 1,
        },
        "library"
      );
      transaction.objectStore("files").put(audio, id);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  });
  await page.reload();
  await page.getByRole("button", { name: "Abrir menu" }).click();
  await expect(
    page.getByText("Servidor conectado", { exact: false })
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Exportar biblioteca antiga" })
    .click();
  expect((await download).suggestedFilename()).toContain("soundbard-legado-");
  const server = await (await page.request.get("/api/library")).json();
  expect(server.sounds).toHaveLength(0);
  expect(server.tags).toEqual(["Servidor"]);
});
