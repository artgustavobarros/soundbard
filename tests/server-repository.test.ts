import { IDBFactory } from "fake-indexeddb";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  it as test,
  vi,
} from "vitest";
import {
  createBackup,
  readBackup,
  sha256,
  validateLibrary,
} from "../src/lib/backup";
import { deletePlaylist, emptyLibrary, type Library } from "../src/lib/model";
import { ServerRepository as Repository } from "../src/lib/server-repository";

const connectionPattern = /servidor|conexão/iu;
const filePattern = /áudio|arquivo/iu;
const invalidFilePattern = /áudio|arquivo|integridade/iu;
const integrityPattern = /integridade|danificado/iu;

const repositories: Repository[] = [];
const request = vi.fn<typeof fetch>();
const storage = new Map<string, string>();

beforeEach(() => {
  vi.stubGlobal("indexedDB", new IDBFactory());
  vi.stubGlobal("fetch", request);
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
  });
  request.mockReset();
  storage.clear();
});
afterEach(() => {
  for (const repository of repositories.splice(0)) {
    repository.close();
  }
  vi.unstubAllGlobals();
});

async function openRepository() {
  const repository = await Repository.open();
  repositories.push(repository);
  return repository;
}
async function seedLegacy(library: Library, files = new Map<string, Blob>()) {
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const opening = indexedDB.open("soundbard", 1);
    opening.onupgradeneeded = () => {
      opening.result.createObjectStore("config");
      opening.result.createObjectStore("files");
    };
    opening.onsuccess = () => resolve(opening.result);
    opening.onerror = () => reject(opening.error);
  });
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(["config", "files"], "readwrite");
    transaction.objectStore("config").put(library, "library");
    for (const [id, blob] of files) {
      transaction.objectStore("files").put(blob, id);
    }
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error);
  });
  database.close();
}
async function legacyLibrary() {
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const opening = indexedDB.open("soundbard", 1);
    opening.onsuccess = () => resolve(opening.result);
    opening.onerror = () => reject(opening.error);
  });
  const value = await new Promise<unknown>((resolve, reject) => {
    const reading = database
      .transaction("config")
      .objectStore("config")
      .get("library");
    reading.onsuccess = () => resolve(reading.result);
    reading.onerror = () => reject(reading.error);
  });
  database.close();
  return value;
}
async function soundFixture(name = "Chuva") {
  const audio = new Blob([name], { type: "audio/wav" });
  const id = await sha256(audio);
  const library: Library = {
    ...emptyLibrary(),
    sounds: [
      {
        duration: 10,
        id,
        kind: "ambience",
        loop: true,
        mime: audio.type,
        name,
        size: audio.size,
        tags: [],
        volume: 0.75,
      },
    ],
  };
  return { audio, id, library };
}
function serve(library: Library) {
  request.mockImplementation(async () => Response.json(library));
}
function formData(init: RequestInit | undefined) {
  if (!(init?.body instanceof FormData)) {
    throw new Error("Requisição sem multipart");
  }
  return init.body;
}
function manifest(data: FormData): Library {
  const value = data.get("library");
  if (typeof value !== "string") {
    throw new Error("Manifesto ausente");
  }
  return validateLibrary(JSON.parse(value));
}

test("migra e guarda em cache a ordem dos pads sem alterar o legado", async () => {
  const { audio, id, library } = await soundFixture();
  const legacy = { ...library, padOrder: [id] };
  await seedLegacy(legacy, new Map([[id, audio]]));
  request.mockImplementation((_url, init) =>
    Promise.resolve(
      Response.json(
        init?.method === "PUT"
          ? { ...manifest(formData(init)), revision: 1 }
          : emptyLibrary()
      )
    )
  );
  const repository = await openRepository();
  expect((await repository.read()).padOrder).toEqual([id]);
  expect(await legacyLibrary()).toMatchObject({ padOrder: [id] });
  request.mockRejectedValue(new TypeError("offline"));
  expect((await repository.read()).padOrder).toEqual([id]);
});

test("ordem ausente e ordem vazia não criam um falso conflito com o legado", async () => {
  const { audio, id, library } = await soundFixture();
  await seedLegacy(library, new Map([[id, audio]]));
  serve({ ...library, padOrder: [] });
  const repository = await openRepository();
  await repository.read();
  expect(repository.legacyRecoveryAvailable).toBe(false);
});

describe("biblioteca autoritativa no servidor", () => {
  it("carrega a revisão do servidor em vez de uma biblioteca vazia local", async () => {
    serve({ ...emptyLibrary(), revision: 4, tags: ["Central"] });
    const repository = await openRepository();
    expect(await repository.read()).toMatchObject({
      revision: 4,
      tags: ["Central"],
    });
    expect(repository.connection).toBe("online");
  });

  it("envia manifesto e arquivos multipart e só aceita a revisão confirmada pelo servidor", async () => {
    const { audio, id, library } = await soundFixture();
    let sent: FormData | undefined;
    request.mockImplementation((_url, init) => {
      if (init?.method !== "PUT") {
        return Promise.resolve(
          Response.json({ ...emptyLibrary(), revision: 2 })
        );
      }
      sent = formData(init);
      return Promise.resolve(Response.json({ ...manifest(sent), revision: 3 }));
    });
    const repository = await openRepository();
    await repository.read();
    const saved = await repository.commit(
      { ...library, revision: 2 },
      { files: new Map([[id, audio]]) }
    );
    expect(saved.revision).toBe(3);
    expect(sent).toBeInstanceOf(FormData);
    if (!sent) {
      throw new Error("Upload não observado");
    }
    expect(manifest(sent).revision).toBe(2);
    const [uploaded] = sent.getAll("files");
    expect(uploaded).toBeInstanceOf(File);
    if (!(uploaded instanceof File)) {
      throw new Error("Áudio não enviado");
    }
    expect(uploaded.name).toBe(id);
    expect(await uploaded.text()).toBe("Chuva");
  });

  it.each([409, 503])(
    "não altera o cache nem informa sucesso após erro HTTP %s",
    async (status) => {
      request.mockResolvedValueOnce(
        Response.json({ ...emptyLibrary(), revision: 2 })
      );
      request.mockResolvedValueOnce(
        Response.json({ detail: "falha" }, { status })
      );
      const repository = await openRepository();
      await repository.read();
      await expect(
        repository.commit({ ...emptyLibrary(), master: 0.4, revision: 2 })
      ).rejects.toThrow();
      request.mockRejectedValue(new TypeError("offline"));
      expect(await repository.read()).toMatchObject({
        master: 0.8,
        revision: 2,
      });
    }
  );

  it("recusa gravação offline sem transformar o cache em fonte de sucesso", async () => {
    serve({ ...emptyLibrary(), revision: 3 });
    const repository = await openRepository();
    await repository.read();
    request.mockRejectedValue(new TypeError("offline"));
    await expect(
      repository.commit({ ...emptyLibrary(), master: 0.2, revision: 3 })
    ).rejects.toThrow(connectionPattern);
    expect(await repository.read()).toMatchObject({ master: 0.8, revision: 3 });
    expect(repository.connection).toBe("offline");
  });

  it("não abre uma biblioteca vazia como se fosse central quando servidor e cache estão indisponíveis", async () => {
    request.mockRejectedValue(new TypeError("offline"));
    const repository = await openRepository();
    await expect(repository.read()).rejects.toThrow(connectionPattern);
  });

  it("rejeita um novo som sem arquivo e um arquivo com hash divergente antes de persistir", async () => {
    const { library, id } = await soundFixture();
    serve(emptyLibrary());
    const repository = await openRepository();
    await repository.read();
    await expect(repository.commit(library)).rejects.toThrow(filePattern);
    await expect(
      repository.commit(library, {
        files: new Map([[id, new Blob(["outro áudio"])]]),
      })
    ).rejects.toThrow(invalidFilePattern);
  });

  it("guarda um áudio remoto íntegro para leitura offline e preserva seu MIME", async () => {
    const { audio, id, library } = await soundFixture();
    request.mockImplementation(async (url) =>
      String(url).includes("/files/")
        ? new Response(audio, { headers: { "content-type": "audio/wav" } })
        : Response.json({ ...library, revision: 4 })
    );
    const repository = await openRepository();
    await repository.read();
    const remote = await repository.file(id);
    expect(remote.type).toBe("audio/wav");
    expect(await remote.text()).toBe("Chuva");
    request.mockRejectedValue(new TypeError("offline"));
    expect(await (await repository.file(id)).text()).toBe("Chuva");
  });

  it("recusa um áudio remoto cujo hash não corresponde ao identificador", async () => {
    const { id, library } = await soundFixture();
    request.mockImplementation(async (url) =>
      String(url).includes("/files/")
        ? new Response("conteúdo alterado")
        : Response.json({ ...library, revision: 4 })
    );
    const repository = await openRepository();
    await repository.read();
    await expect(repository.file(id)).rejects.toThrow(integrityPattern);
  });
});

describe("migração sem apagar os áudios do navegador", () => {
  it("migra manifesto, grupos e todos os arquivos só quando o servidor está vazio", async () => {
    const { audio, id, library } = await soundFixture();
    const old = { ...library, revision: 7 };
    await seedLegacy(old, new Map([[id, audio]]));
    storage.set(
      "soundbard-pad-groups",
      JSON.stringify([{ id: "g1", name: "Taverna", padIds: [id] }])
    );
    let sent: FormData | undefined;
    request.mockImplementation((_url, init) => {
      if (init?.method !== "PUT") {
        return Promise.resolve(Response.json(emptyLibrary()));
      }
      sent = formData(init);
      return Promise.resolve(Response.json({ ...manifest(sent), revision: 1 }));
    });
    const repository = await openRepository();
    expect(await repository.read()).toMatchObject({
      padGroups: [{ name: "Taverna", padIds: [id] }],
      revision: 1,
      sounds: [{ name: "Chuva" }],
    });
    if (!sent) {
      throw new Error("Migração não enviada");
    }
    expect(manifest(sent).revision).toBe(0);
    expect(sent.getAll("files")).toHaveLength(1);
    expect(await legacyLibrary()).toEqual(old);
    expect(storage.has("soundbard-pad-groups")).toBe(true);
  });

  it("não esconde falha de arquivo legado ausente nem escreve uma migração incompleta", async () => {
    const { library } = await soundFixture();
    await seedLegacy({ ...library, revision: 2 });
    serve(emptyLibrary());
    const repository = await openRepository();
    await expect(repository.read()).rejects.toThrow(filePattern);
    expect(request.mock.calls.some(([, init]) => init?.method === "PUT")).toBe(
      false
    );
    expect(await legacyLibrary()).toMatchObject({
      revision: 2,
      sounds: [{ name: "Chuva" }],
    });
  });

  it("preserva o legado e carrega o servidor existente sem sobrepor bibliotecas diferentes", async () => {
    const { audio, id, library } = await soundFixture();
    await seedLegacy({ ...library, revision: 3 }, new Map([[id, audio]]));
    serve({ ...emptyLibrary(), revision: 9, tags: ["Servidor"] });
    const repository = await openRepository();
    expect(await repository.read()).toMatchObject({
      revision: 9,
      sounds: [],
      tags: ["Servidor"],
    });
    expect(repository.legacyRecoveryAvailable).toBe(true);
    expect(request.mock.calls.some(([, init]) => init?.method === "PUT")).toBe(
      false
    );
    expect(await legacyLibrary()).toMatchObject({
      revision: 3,
      sounds: [{ name: "Chuva" }],
    });
  });

  it("não sobrepõe outro cliente que preencheu o servidor durante a migração", async () => {
    const { audio, id, library } = await soundFixture();
    await seedLegacy(library, new Map([[id, audio]]));
    request.mockResolvedValueOnce(Response.json(emptyLibrary()));
    request.mockResolvedValueOnce(
      Response.json({ detail: "revisão alterada" }, { status: 409 })
    );
    request.mockResolvedValueOnce(
      Response.json({ ...emptyLibrary(), revision: 1, tags: ["Outro cliente"] })
    );
    const repository = await openRepository();
    expect(await repository.read()).toMatchObject({
      revision: 1,
      sounds: [],
      tags: ["Outro cliente"],
    });
    expect(repository.legacyRecoveryAvailable).toBe(true);
    expect(
      request.mock.calls.filter(([, init]) => init?.method === "PUT")
    ).toHaveLength(1);
    expect(await legacyLibrary()).toMatchObject({
      sounds: [{ name: "Chuva" }],
    });
  });

  it("preserva grupos nos backups e rejeita referências inexistentes", async () => {
    const { audio, id, library } = await soundFixture();
    const grouped = {
      ...library,
      padGroups: [{ id: "g1", name: "Taverna", padIds: [id] }],
    };
    const restored = await readBackup(
      await createBackup(grouped, async () => audio)
    );
    expect(restored.library.padGroups).toEqual([
      { id: "g1", name: "Taverna", padIds: [id] },
    ]);
    expect(() =>
      validateLibrary({
        ...library,
        padGroups: [{ id: "g1", name: "Inválido", padIds: ["missing"] }],
      })
    ).toThrow();
  });
});

test("exporta a biblioteca legada preservada com áudios e grupos sem alterar o servidor", async () => {
  const { audio, id, library } = await soundFixture("Legado");
  const previous = { ...library, revision: 5 };
  await seedLegacy(previous, new Map([[id, audio]]));
  storage.set(
    "soundbard-pad-groups",
    JSON.stringify([{ id: "g1", name: "Antigo", padIds: [id] }])
  );
  serve({ ...emptyLibrary(), revision: 9, tags: ["Servidor"] });
  const repository = await openRepository();
  await repository.read();
  expect(repository).toHaveProperty("legacyBackup", expect.any(Function));
  const backup = await readBackup(await repository.legacyBackup());
  expect(backup.library).toMatchObject({
    padGroups: [{ name: "Antigo", padIds: [id] }],
    revision: 5,
    sounds: [{ name: "Legado" }],
  });
  expect(await backup.files.get(id)?.text()).toBe("Legado");
  expect(await legacyLibrary()).toEqual(previous);
  expect(request.mock.calls.some(([, init]) => init?.method === "PUT")).toBe(
    false
  );
});

test("não entrega um backup parcial quando um áudio legado está ausente", async () => {
  const { library } = await soundFixture("Legado");
  await seedLegacy(library);
  serve({ ...emptyLibrary(), revision: 9 });
  const repository = await openRepository();
  await repository.read();
  expect(repository).toHaveProperty("legacyBackup", expect.any(Function));
  await expect(repository.legacyBackup()).rejects.toThrow(filePattern);
});

test("excluir playlist preserva o grupo e remove só sua referência", async () => {
  const { id, library } = await soundFixture();
  const grouped: Library = {
    ...library,
    padGroups: [
      { id: "g1", name: "Mesa", padIds: ["playlist:p1", "playlist:p2", id] },
    ],
    playlists: [
      {
        id: "p1",
        name: "Primeira",
        repeat: "off",
        shuffle: false,
        soundIds: [],
      },
      {
        id: "p2",
        name: "Segunda",
        repeat: "off",
        shuffle: false,
        soundIds: [],
      },
    ],
    scenes: [
      {
        effectIds: [],
        id: "s1",
        layers: [],
        musicVolume: 0.5,
        name: "Cena",
        playlistId: "p1",
      },
    ],
  };
  const changed = deletePlaylist(grouped, "p1");
  expect(changed.playlists.map((item) => item.id)).toEqual(["p2"]);
  expect(changed.padGroups).toEqual([
    { id: "g1", name: "Mesa", padIds: ["playlist:p2", id] },
  ]);
  expect(changed.scenes[0].playlistId).toBeNull();
  expect(grouped.padGroups?.[0].padIds).toEqual([
    "playlist:p1",
    "playlist:p2",
    id,
  ]);
});
