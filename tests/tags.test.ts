import { expect, it as test } from "vitest";
import { createBackup, readBackup, validateLibrary } from "../src/lib/backup";
import type { Library, Sound } from "../src/lib/model";
import { deleteSound, emptyLibrary } from "../src/lib/model";
import { normalizeTags, suggestTags } from "../src/lib/tags";

const sound: Sound = {
  duration: 10,
  id: "a".repeat(64),
  kind: "ambience",
  loop: true,
  mime: "audio/wav",
  name: "Floresta",
  size: 10,
  tags: ["  Combate  ", "combáte", "Floresta"],
  volume: 0.5,
};

test("migra tags de sons antigos sem duplicar caixa ou acentos", () => {
  const library = validateLibrary({ ...emptyLibrary(), sounds: [sound] });
  expect(library.tags).toEqual(["Combate", "Floresta"]);
  expect(library.sounds[0].tags).toEqual(["Combate", "Floresta"]);
});

test("reutiliza a grafia do catálogo e preserva tags sem sons", () => {
  const library = validateLibrary({
    ...emptyLibrary(),
    sounds: [{ ...sound, tags: ["chuva", " Tensão "] }],
    tags: ["Vento", "  Chuva ", "CHUVA"],
  });
  expect(library.tags).toEqual(["Vento", "Chuva", "Tensão"]);
  expect(library.sounds[0].tags).toEqual(["Chuva", "Tensão"]);
});

test("excluir o último som conserva suas tags para novas importações", () => {
  const library: Library = { ...emptyLibrary(), sounds: [sound] };
  const next = deleteSound(library, sound.id);
  expect(next.sounds).toEqual([]);
  expect(next.tags).toEqual(["Combate", "Floresta"]);
  expect(library.sounds).toHaveLength(1);
});

test("o backup recupera o catálogo mesmo quando todas as tags estão sem sons", async () => {
  const backup = await createBackup(
    { ...emptyLibrary(), tags: ["Taverna", "Noite"] },
    async () => new Blob()
  );
  const restored = await readBackup(backup);
  expect(restored.library.tags).toEqual(["Taverna", "Noite"]);
});

test.each([[null], [42], ["a".repeat(61)]])(
  "rejeita tags inválidas no catálogo importado: %s",
  (tags) => {
    expect(() => validateLibrary({ ...emptyLibrary(), tags })).toThrow();
  }
);

test("sugere tags existentes sem distinguir caixa ou acentos e omite as selecionadas", () => {
  expect(
    suggestTags(["Tensão", "Tempestade", "Atenção"], "ten", ["TENSAO"])
  ).toEqual(["Atenção"]);
  expect(suggestTags(["CHUVA", "chuvá", "Chuva forte"], "chu", [])).toEqual([
    "CHUVA",
    "Chuva forte",
  ]);
});

test("mantém palavras compostas e normaliza espaços antes de remover duplicatas", () => {
  expect(
    normalizeTags([" Cidade   antiga ", "cidade antiga", " ", "NOITE"])
  ).toEqual(["Cidade antiga", "NOITE"]);
});
