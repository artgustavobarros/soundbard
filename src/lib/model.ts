import { libraryTags } from "./tags";

export type Kind = "music" | "ambience" | "effect";
export type Repeat = "off" | "one" | "all";
export interface Sound {
  duration: number;
  id: string;
  kind: Kind;
  loop: boolean;
  mime: string;
  name: string;
  size: number;
  tags: string[];
  volume: number;
}
export interface Playlist {
  id: string;
  name: string;
  repeat: Repeat;
  shuffle: boolean;
  soundIds: string[];
}
export interface Layer {
  loop: boolean;
  soundId: string;
  volume: number;
}
export interface Scene {
  effectIds: string[];
  id: string;
  layers: Layer[];
  musicVolume: number;
  name: string;
  playlistId: string | null;
  type?: "characters" | "locations" | "combat";
}
export interface Library {
  master: number;
  padGroups?: { id: string; name: string; padIds: string[] }[];
  padOrder?: string[];
  playlists: Playlist[];
  revision: number;
  scenes: Scene[];
  sounds: Sound[];
  tags?: string[];
  version: 1;
}
export const emptyLibrary = (): Library => ({
  master: 0.8,
  playlists: [],
  revision: 0,
  scenes: [],
  sounds: [],
  tags: [],
  version: 1,
});
export function removeFromPlaylist(
  library: Library,
  playlistId: string,
  soundId: string
): Library {
  return {
    ...library,
    playlists: library.playlists.map((p) =>
      p.id === playlistId
        ? { ...p, soundIds: p.soundIds.filter((id) => id !== soundId) }
        : p
    ),
  };
}
export function deletePlaylist(library: Library, playlistId: string): Library {
  return {
    ...library,
    ...(library.padOrder
      ? {
          padOrder: library.padOrder.filter(
            (id) => id !== `playlist:${playlistId}`
          ),
        }
      : {}),
    ...(library.padGroups
      ? {
          padGroups: library.padGroups.map((group) => ({
            ...group,
            padIds: group.padIds.filter(
              (id) => id !== `playlist:${playlistId}`
            ),
          })),
        }
      : {}),
    playlists: library.playlists.filter(
      (playlist) => playlist.id !== playlistId
    ),
    scenes: library.scenes.map((scene) =>
      scene.playlistId === playlistId ? { ...scene, playlistId: null } : scene
    ),
  };
}
export function deleteSound(library: Library, soundId: string): Library {
  return {
    ...library,
    ...(library.padOrder
      ? { padOrder: library.padOrder.filter((id) => id !== soundId) }
      : {}),
    ...(library.padGroups
      ? {
          padGroups: library.padGroups.map((group) => ({
            ...group,
            padIds: group.padIds.filter((id) => id !== soundId),
          })),
        }
      : {}),
    playlists: library.playlists.map((p) => ({
      ...p,
      soundIds: p.soundIds.filter((id) => id !== soundId),
    })),
    scenes: library.scenes.map((s) => ({
      ...s,
      effectIds: s.effectIds.filter((id) => id !== soundId),
      layers: s.layers.filter((l) => l.soundId !== soundId),
    })),
    sounds: library.sounds.filter((s) => s.id !== soundId),
    tags: libraryTags(library),
  };
}
export function transition(
  previous: Layer[],
  next: Layer[]
): { keep: Layer[]; start: Layer[]; stop: Layer[] } {
  const before = new Set(previous.map((layer) => layer.soundId));
  const after = new Set(next.map((layer) => layer.soundId));
  return {
    keep: next.filter((layer) => before.has(layer.soundId)),
    start: next.filter((layer) => !before.has(layer.soundId)),
    stop: previous.filter((layer) => !after.has(layer.soundId)),
  };
}
function shuffled(ids: string[], random: () => number) {
  const result = [...ids];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export class Queue {
  order: string[];
  index = 0;
  repeat: Repeat;
  shuffle: boolean;
  private readonly random: () => number;
  constructor(playlist: Playlist, random = Math.random) {
    this.random = random;
    this.order = playlist.shuffle
      ? shuffled(playlist.soundIds, random)
      : [...playlist.soundIds];
    this.repeat = playlist.repeat;
    this.shuffle = playlist.shuffle;
  }
  get current() {
    return this.order[this.index] ?? null;
  }
  next(manual = false): string | null {
    if (!this.current) {
      return null;
    }
    if (!manual && this.repeat === "one") {
      return this.current;
    }
    if (this.index + 1 < this.order.length) {
      this.index += 1;
      return this.order[this.index];
    }
    if (this.repeat === "all") {
      const last = this.current;
      if (this.shuffle) {
        this.order = shuffled(this.order, this.random);
        if (this.order.length > 1 && this.order[0] === last) {
          [this.order[0], this.order[1]] = [this.order[1], this.order[0]];
        }
      }
      this.index = 0;
      return this.current;
    }
    this.index = this.order.length;
    return null;
  }
  previous(): string | null {
    this.index = Math.max(0, Math.min(this.order.length - 1, this.index - 1));
    return this.current;
  }
  update(playlist: Playlist) {
    const { current } = this;
    if (playlist.shuffle) {
      this.order = this.order.filter((id) => playlist.soundIds.includes(id));
      this.order.push(
        ...shuffled(
          playlist.soundIds.filter((id) => !this.order.includes(id)),
          this.random
        )
      );
      if (!this.shuffle) {
        this.order = shuffled(this.order, this.random);
      }
    } else {
      this.order = [...playlist.soundIds];
    }
    this.shuffle = playlist.shuffle;
    this.repeat = playlist.repeat;
    if (current === null) {
      this.index = this.order.length;
    } else if (this.order.includes(current)) {
      this.index = this.order.indexOf(current);
    } else {
      this.index = Math.min(this.index, this.order.length);
    }
  }
}
