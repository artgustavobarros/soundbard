import { expect, test } from "vitest";
import {
  createBackup,
  readBackup,
  sha256,
  validateLibrary,
} from "../src/lib/backup";
import {
  deletePlaylist,
  deleteSound,
  emptyLibrary,
  type Library,
} from "../src/lib/model";

const firstId = "a".repeat(64);
const secondId = "b".repeat(64);

function libraryFixture(): Library {
  return {
    ...emptyLibrary(),
    playlists: [
      {
        id: "music",
        name: "Músicas",
        repeat: "off",
        shuffle: false,
        soundIds: [firstId, secondId],
      },
    ],
    sounds: [firstId, secondId].map((id) => ({
      duration: 1,
      id,
      kind: "music",
      loop: false,
      mime: "audio/wav",
      name: id[0],
      size: 1,
      tags: [],
      volume: 0.5,
    })),
  };
}

test("preserva a ordem dos pads sem alterar a sequência da playlist", () => {
  const library = validateLibrary({
    ...libraryFixture(),
    padOrder: [secondId, "playlist:music", firstId],
  });
  expect(library.padOrder).toEqual([secondId, "playlist:music", firstId]);
  expect(library.playlists[0].soundIds).toEqual([firstId, secondId]);
});

test.each([
  { padOrder: [firstId, firstId] },
  { padOrder: ["missing"] },
  { padOrder: ["playlist:missing"] },
  { padOrder: [42] },
])(
  "recusa ordem com referências ausentes, repetidas ou inválidas: $padOrder",
  ({ padOrder }) => {
    expect(() => validateLibrary({ ...libraryFixture(), padOrder })).toThrow();
  }
);

test("excluir som ou playlist remove somente sua referência da ordem dos pads", () => {
  const library = validateLibrary({
    ...libraryFixture(),
    padOrder: [secondId, "playlist:music", firstId],
  });
  expect(deleteSound(library, firstId).padOrder).toEqual([
    secondId,
    "playlist:music",
  ]);
  expect(deletePlaylist(library, "music").padOrder).toEqual([
    secondId,
    firstId,
  ]);
  expect(library.padOrder).toEqual([secondId, "playlist:music", firstId]);
});

test("o backup preserva a ordem dos pads e continua aceitando o formato antigo", async () => {
  const audio = new Blob(["som portátil"], { type: "audio/wav" });
  const id = await sha256(audio);
  const library: Library = {
    ...emptyLibrary(),
    padOrder: [id],
    sounds: [
      {
        duration: 1,
        id,
        kind: "effect",
        loop: false,
        mime: audio.type,
        name: "Som",
        size: audio.size,
        tags: [],
        volume: 0.5,
      },
    ],
  };
  const backup = await readBackup(
    await createBackup(library, async () => audio)
  );
  expect(backup.library.padOrder).toEqual([id]);
  expect(await backup.files.get(id)?.text()).toBe("som portátil");
  const old = await readBackup(
    await createBackup(emptyLibrary(), async () => new Blob())
  );
  expect(old.library.padOrder).toBeUndefined();
});
