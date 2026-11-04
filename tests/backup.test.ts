import { expect, it as test } from "vitest";
import {
  createBackup,
  readBackup,
  sha256,
  validateLibrary,
} from "../src/lib/backup";
import type { Library } from "../src/lib/model";
import { emptyLibrary } from "../src/lib/model";

const damagedPattern = /danificado/u;
const referencePattern = /referência/u;

test.each([undefined, "characters", "locations", "combat"] as const)(
  "preserva o tipo de cena %s no backup, incluindo cenas antigas sem tipo",
  async (type) => {
    const library: Library = {
      ...emptyLibrary(),
      scenes: [
        {
          effectIds: [],
          id: "s1",
          layers: [],
          musicVolume: 0.5,
          name: "Cena",
          playlistId: null,
          ...(type ? { type } : {}),
        },
      ],
    };
    const restored = await readBackup(
      await createBackup(library, async () => new Blob())
    );
    expect(restored.library.scenes[0].type).toBe(type);
  }
);

test("recusa tipo de cena desconhecido na organização importada", () => {
  expect(() =>
    validateLibrary({
      ...emptyLibrary(),
      scenes: [
        {
          effectIds: [],
          id: "s1",
          layers: [],
          musicVolume: 0.5,
          name: "Cena",
          playlistId: null,
          type: "invalid",
        },
      ],
    })
  ).toThrow();
});

test("recupera áudios e organização em uma biblioteca portátil", async () => {
  const audio = new Blob(["audio de teste"], { type: "audio/wav" });
  const id = await sha256(audio);
  const library = {
    ...emptyLibrary(),
    scenes: [
      {
        effectIds: [],
        id: "s1",
        layers: [{ loop: true, soundId: id, volume: 0.3 }],
        musicVolume: 0.5,
        name: "Floresta",
        playlistId: null,
      },
    ],
    sounds: [
      {
        duration: 10,
        id,
        kind: "ambience" as const,
        loop: true,
        mime: audio.type,
        name: "Chuva",
        size: audio.size,
        tags: ["floresta"],
        volume: 0.6,
      },
    ],
  };
  const backup = await createBackup(library, async () => audio);
  const restored = await readBackup(backup);
  expect(restored.library.sounds.map((sound) => sound.name)).toEqual(["Chuva"]);
  expect(restored.library.scenes[0].layers[0].volume).toBe(0.3);
  expect(await restored.files.get(id)?.text()).toBe("audio de teste");
});

test("recusa áudio corrompido em um backup", async () => {
  const audio = new Blob(["integridade"]);
  const id = await sha256(audio);
  const library = {
    ...emptyLibrary(),
    sounds: [
      {
        duration: 1,
        id,
        kind: "effect" as const,
        loop: false,
        mime: "audio/wav",
        name: "Efeito",
        size: audio.size,
        tags: [],
        volume: 1,
      },
    ],
  };
  const backup = await createBackup(library, async () => audio);
  const corrupt = new Blob([backup.slice(0, -1), "X"]);
  await expect(readBackup(corrupt)).rejects.toThrow(damagedPattern);
});

test("recusa outro formato e bibliotecas com referências ausentes", async () => {
  await expect(readBackup(new Blob(["não é um backup"]))).rejects.toThrow();
  const library = {
    ...emptyLibrary(),
    playlists: [
      {
        id: "p1",
        name: "Vazia",
        repeat: "off" as const,
        shuffle: false,
        soundIds: ["inexistente"],
      },
    ],
  };
  await expect(createBackup(library, async () => new Blob())).rejects.toThrow(
    referencePattern
  );
});

test("exporta os áudios em ordem sem abrir o próximo antes de concluir o atual", async () => {
  const first = new Blob(["primeiro"]);
  const second = new Blob(["segundo"]);
  const [firstId, secondId] = await Promise.all([
    sha256(first),
    sha256(second),
  ]);
  const library: Library = {
    ...emptyLibrary(),
    sounds: [
      {
        duration: 1,
        id: firstId,
        kind: "effect",
        loop: false,
        mime: "audio/wav",
        name: "Primeiro",
        size: first.size,
        tags: [],
        volume: 1,
      },
      {
        duration: 1,
        id: secondId,
        kind: "effect",
        loop: false,
        mime: "audio/wav",
        name: "Segundo",
        size: second.size,
        tags: [],
        volume: 1,
      },
    ],
  };
  let release: (() => void) | undefined;
  const blocked = new Promise<void>((resolve) => {
    release = resolve;
  });
  const reads: string[] = [];
  const exporting = createBackup(library, async (id) => {
    reads.push(id);
    if (id === firstId) {
      await blocked;
    }
    return id === firstId ? first : second;
  });
  await Promise.resolve();
  expect(reads).toEqual([firstId]);
  release?.();
  const restored = await readBackup(await exporting);
  expect(reads).toEqual([firstId, secondId]);
  expect(restored.library.sounds.map((sound) => sound.name)).toEqual([
    "Primeiro",
    "Segundo",
  ]);
  expect(await restored.files.get(firstId)?.text()).toBe("primeiro");
  expect(await restored.files.get(secondId)?.text()).toBe("segundo");
});
