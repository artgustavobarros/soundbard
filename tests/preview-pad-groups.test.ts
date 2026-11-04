import { describe, expect, it } from "vitest";
import {
  loadPreviewPadGroups,
  savePreviewPadGroups,
} from "../src/lib/preview-pad-groups";

const storageKey = "soundbard-preview-pad-groups";
const allowedIds = ["fire", "walk", "sword"];

function memoryStorage(initial?: string) {
  const values = new Map<string, string>();
  if (initial !== undefined) {
    values.set(storageKey, initial);
  }
  values.set("soundbard-library", "biblioteca existente");
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

describe("grupos de pads da prévia", () => {
  it("recupera os grupos salvos sem alterar a biblioteca existente", () => {
    const storage = memoryStorage();
    expect(loadPreviewPadGroups(storage, allowedIds)).toEqual([]);
    expect(
      savePreviewPadGroups(storage, [
        { id: "journey", name: "Viagem", padIds: ["fire", "walk"] },
      ])
    ).toBe(true);
    expect(loadPreviewPadGroups(storage, allowedIds)).toEqual([
      { id: "journey", name: "Viagem", padIds: ["fire", "walk"] },
    ]);
    expect(storage.getItem("soundbard-library")).toBe("biblioteca existente");
  });

  it("mantém grupos reais separados da prévia no mesmo navegador", () => {
    const storage = memoryStorage();
    const demo = [{ id: "demo", name: "Prévia", padIds: ["fire"] }];
    const real = [{ id: "real", name: "Sessão", padIds: ["uploaded"] }];
    expect(savePreviewPadGroups(storage, demo)).toBe(true);
    expect(savePreviewPadGroups(storage, real, "soundbard-pad-groups")).toBe(
      true
    );
    expect(loadPreviewPadGroups(storage, allowedIds)).toEqual(demo);
    expect(
      loadPreviewPadGroups(storage, ["uploaded"], "soundbard-pad-groups")
    ).toEqual(real);
    expect(storage.getItem("soundbard-library")).toBe("biblioteca existente");
  });

  it("descarta grupos inválidos, remove referências desconhecidas e deduplica IDs", () => {
    const storage = memoryStorage(
      JSON.stringify([
        {
          id: "journey",
          name: "  Viagem  ",
          padIds: ["walk", "walk", "missing", "fire"],
        },
        { id: "journey", name: "Duplicado", padIds: ["sword"] },
        { id: "unknown", name: "Sem pads válidos", padIds: ["missing"] },
        { id: "empty", name: "", padIds: ["fire"] },
        { id: " ", name: "Sem identificador", padIds: ["fire"] },
        { id: "wrong", name: "Tipo inválido", padIds: ["fire", 42] },
        { id: "none", name: "Sem pads", padIds: [] },
        { id: "effect", name: "Efeitos", padIds: ["sword"] },
        null,
      ])
    );
    expect(loadPreviewPadGroups(storage, allowedIds)).toEqual([
      { id: "journey", name: "Viagem", padIds: ["walk", "fire"] },
      { id: "effect", name: "Efeitos", padIds: ["sword"] },
    ]);
  });

  it.each(["{broken", "null", "{}", '"texto"'])(
    "não sobrescreve armazenamento com conteúdo inválido: %s",
    (value) => {
      const storage = memoryStorage(value);
      expect(loadPreviewPadGroups(storage, allowedIds)).toEqual([]);
      expect(storage.getItem(storageKey)).toBe(value);
    }
  );

  it("trata leitura bloqueada e informa falha de gravação sem apagar os dados anteriores", () => {
    const storage = memoryStorage(
      '[{"id":"existing","name":"Existente","padIds":["fire"]}]'
    );
    const blockedRead = {
      getItem: () => {
        throw new Error("Armazenamento indisponível");
      },
    };
    const blockedWrite = {
      ...storage,
      setItem: () => {
        throw new Error("Quota excedida");
      },
    };
    expect(loadPreviewPadGroups(blockedRead, allowedIds)).toEqual([]);
    expect(
      savePreviewPadGroups(blockedWrite, [
        { id: "new", name: "Novo", padIds: ["walk"] },
      ])
    ).toBe(false);
    expect(loadPreviewPadGroups(blockedWrite, allowedIds)).toEqual([
      { id: "existing", name: "Existente", padIds: ["fire"] },
    ]);
  });
});
