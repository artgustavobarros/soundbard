import { describe, expect, it, it as test } from "vitest";
import type { Playlist } from "../src/lib/model";
import {
  deleteSound,
  emptyLibrary,
  Queue,
  removeFromPlaylist,
  transition,
} from "../src/lib/model";

const playlist = (changes: Partial<Playlist> = {}): Playlist => ({
  id: "p1",
  name: "Combate",
  repeat: "off",
  shuffle: false,
  soundIds: ["a", "b", "c"],
  ...changes,
});

describe("participação nas playlists", () => {
  it("remove de uma lista e preserva a outra e a biblioteca original", () => {
    const library = {
      ...emptyLibrary(),
      playlists: [playlist(), playlist({ id: "p2" })],
    };
    const result = removeFromPlaylist(library, "p1", "a");
    expect(result.playlists[0].soundIds).toEqual(["b", "c"]);
    expect(result.playlists[1].soundIds).toEqual(["a", "b", "c"]);
    expect(library.playlists[0].soundIds).toEqual(["a", "b", "c"]);
  });
  it("excluir da biblioteca remove todas as referências diretas", () => {
    const library = {
      ...emptyLibrary(),
      playlists: [playlist(), playlist({ id: "p2" })],
      scenes: [
        {
          effectIds: ["a", "b"],
          id: "s1",
          layers: [{ loop: true, soundId: "a", volume: 0.5 }],
          musicVolume: 0.6,
          name: "Taverna",
          playlistId: "p1",
        },
      ],
    };
    const result = deleteSound(library, "a");
    expect(result.playlists.map((p) => p.soundIds)).toEqual([
      ["b", "c"],
      ["b", "c"],
    ]);
    expect(result.scenes[0].layers).toEqual([]);
    expect(result.scenes[0].effectIds).toEqual(["b"]);
  });
});

describe("fila musical", () => {
  it("avança em ordem e termina sem repetir", () => {
    const queue = new Queue(playlist());
    expect(queue.current).toBe("a");
    expect(queue.next()).toBe("b");
    expect(queue.next()).toBe("c");
    expect(queue.next()).toBeNull();
  });
  it("repete uma música, mas permite avanço manual", () => {
    const queue = new Queue(playlist({ repeat: "one" }));
    expect(queue.next()).toBe("a");
    expect(queue.next(true)).toBe("b");
  });
  it("repete a playlist e permite voltar", () => {
    const queue = new Queue(playlist({ repeat: "all", soundIds: ["a", "b"] }));
    expect(queue.next()).toBe("b");
    expect(queue.next()).toBe("a");
    expect(queue.previous()).toBe("a");
  });
  it("embaralha sem perder ou duplicar músicas", () => {
    const queue = new Queue(playlist({ shuffle: true }), () => 0);
    expect(queue.order).toEqual(["b", "c", "a"]);
  });
  it("preserva a música atual ao reordenar a playlist", () => {
    const queue = new Queue(playlist());
    queue.next();
    queue.update(playlist({ soundIds: ["c", "a", "b"] }));
    expect(queue.current).toBe("b");
    expect(queue.next()).toBeNull();
  });
  it("trata uma playlist vazia", () => {
    const queue = new Queue(playlist({ soundIds: [] }));
    expect(queue.current).toBeNull();
    expect(queue.next()).toBeNull();
    expect(queue.previous()).toBeNull();
  });
  it("editar uma playlist encerrada não inicia as músicas adicionadas", () => {
    const queue = new Queue(playlist({ soundIds: ["a"] }));
    queue.next();
    queue.update(playlist({ soundIds: ["a", "b"] }));
    expect(queue.current).toBeNull();
    expect(queue.next()).toBeNull();
  });
});

test("preserva a chuva compartilhada com o volume da nova cena", () => {
  const result = transition(
    [
      { loop: true, soundId: "rain", volume: 0.8 },
      { loop: true, soundId: "fire", volume: 0.5 },
    ],
    [
      { loop: true, soundId: "rain", volume: 0.3 },
      { loop: false, soundId: "wind", volume: 0.2 },
    ]
  );
  expect(result.keep).toEqual([{ loop: true, soundId: "rain", volume: 0.3 }]);
  expect(result.start.map((s) => s.soundId)).toEqual(["wind"]);
  expect(result.stop.map((s) => s.soundId)).toEqual(["fire"]);
});
