import { describe, expect, it } from "vitest";
import { orderPads, reorderVisiblePads } from "../src/lib/pad-order";

const pads = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "playlist:p" }];

describe("ordem visual dos pads", () => {
  it("aplica a ordem salva e acrescenta os pads novos sem mudar o original", () => {
    expect(orderPads(pads, ["c", "playlist:p"]).map((pad) => pad.id)).toEqual([
      "c",
      "playlist:p",
      "a",
      "b",
    ]);
    expect(pads.map((pad) => pad.id)).toEqual(["a", "b", "c", "playlist:p"]);
  });

  it("ignora referências removidas da ordem salva", () => {
    expect(orderPads(pads, ["removido", "b"]).map((pad) => pad.id)).toEqual([
      "b",
      "a",
      "c",
      "playlist:p",
    ]);
  });

  it("reorganiza o filtro sem deslocar os pads ocultos", () => {
    expect(reorderVisiblePads(pads, ["a", "c"], ["c", "a"])).toEqual([
      "c",
      "b",
      "a",
      "playlist:p",
    ]);
  });

  it("permite misturar pads de som e de playlist", () => {
    expect(
      reorderVisiblePads(
        pads,
        ["a", "b", "c", "playlist:p"],
        ["playlist:p", "a", "b", "c"]
      )
    ).toEqual(["playlist:p", "a", "b", "c"]);
  });

  it.each([["a", "a"], ["a", "desconhecido"], ["a"], ["a", "b", "c"]])(
    "recusa uma alteração que não preserva todos os pads visíveis: %j",
    (...changed) => {
      expect(() => reorderVisiblePads(pads, ["a", "b"], changed)).toThrow();
    }
  );
});
