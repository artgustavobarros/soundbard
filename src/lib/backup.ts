import { z } from "zod";
import type { Library } from "./model";
import { normalizeLibraryTags } from "./tags";
import { inOrder } from "./utils";
export async function sha256(blob: Blob): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return [...new Uint8Array(hash)]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
}
const identifierPattern = /^[a-zA-Z0-9_-]{1,100}$/u;
const audioIdPattern = /^[a-f0-9]{64}$/u;
const id = z.string().regex(identifierPattern);
const name = z.string().trim().min(1).max(200);
const volume = z.number().min(0).max(1);
const schema = z.object({
  master: volume,
  padGroups: z
    .array(z.object({ id, name, padIds: z.array(z.string().min(1).max(110)) }))
    .optional(),
  padOrder: z.array(z.string().min(1).max(110)).optional(),
  playlists: z.array(
    z.object({
      id,
      name,
      repeat: z.enum(["off", "one", "all"]),
      shuffle: z.boolean(),
      soundIds: z.array(id),
    })
  ),
  revision: z.number().int().nonnegative(),
  scenes: z.array(
    z.object({
      effectIds: z.array(id),
      id,
      layers: z.array(z.object({ loop: z.boolean(), soundId: id, volume })),
      musicVolume: volume,
      name,
      playlistId: id.nullable(),
      type: z.enum(["characters", "locations", "combat"]).optional(),
    })
  ),
  sounds: z.array(
    z.object({
      duration: z.number().positive(),
      id: z.string().regex(audioIdPattern),
      kind: z.enum(["music", "ambience", "effect"]),
      loop: z.boolean(),
      mime: z.string().min(1).max(100),
      name,
      size: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
      tags: z.array(z.string().trim().min(1).max(60)),
      volume,
    })
  ),
  tags: z.array(z.string().trim().min(1).max(60)).optional(),
  version: z.literal(1),
});

function validPadReferences(ids: string[], pads: Set<string>) {
  return (
    new Set(ids).size === ids.length && ids.every((padId) => pads.has(padId))
  );
}

export function validateLibrary(input: unknown): Library {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new Error(
      "Organização inválida: confira os nomes, tipos de som e configurações."
    );
  }
  const library = parsed.data;
  const unique = (ids: string[]) => new Set(ids).size === ids.length;
  if (
    ![
      library.sounds,
      library.playlists,
      library.scenes,
      library.padGroups ?? [],
    ].every((items) => unique(items.map((item) => item.id)))
  ) {
    throw new Error("A biblioteca contém identificadores duplicados.");
  }
  const sounds = new Map(library.sounds.map((sound) => [sound.id, sound]));
  const pads = new Set([
    ...sounds.keys(),
    ...library.playlists.map((playlist) => `playlist:${playlist.id}`),
  ]);
  if (!validPadReferences(library.padOrder ?? [], pads)) {
    throw new Error("Ordem de pads com referência ausente ou repetida.");
  }
  for (const group of library.padGroups ?? []) {
    if (!validPadReferences(group.padIds, pads)) {
      throw new Error("Grupo de pads com referência ausente ou repetida.");
    }
  }
  for (const playlist of library.playlists) {
    if (
      !unique(playlist.soundIds) ||
      playlist.soundIds.some((soundId) => sounds.get(soundId)?.kind !== "music")
    ) {
      throw new Error(
        "Playlist com referência ausente, repetida ou incompatível."
      );
    }
  }
  for (const scene of library.scenes) {
    if (
      scene.playlistId !== null &&
      !library.playlists.some((p) => p.id === scene.playlistId)
    ) {
      throw new Error("Cena com referência de playlist ausente.");
    }
    if (
      !unique(scene.layers.map((layer) => layer.soundId)) ||
      scene.layers.some(
        (layer) => sounds.get(layer.soundId)?.kind !== "ambience"
      ) ||
      !unique(scene.effectIds) ||
      scene.effectIds.some((soundId) => sounds.get(soundId)?.kind !== "effect")
    ) {
      throw new Error(
        "Cena com referência de som ausente, repetida ou incompatível."
      );
    }
  }
  return normalizeLibraryTags(library);
}

const magic = new TextEncoder().encode("SOUNDBARD/1\n");
const headerSize = magic.length + 4;
const maxManifest = 16 * 1024 * 1024;

export async function createBackup(
  library: Library,
  getFile: (id: string) => Promise<Blob>
): Promise<Blob> {
  const clean = validateLibrary(library);
  const manifest = new TextEncoder().encode(JSON.stringify(clean));
  if (manifest.byteLength > maxManifest) {
    throw new Error(
      "A organização da biblioteca é grande demais para este formato de backup."
    );
  }
  const files: Blob[] = [];
  await inOrder(clean.sounds, async (sound) => {
    const file = await getFile(sound.id);
    if (file.size !== sound.size || (await sha256(file)) !== sound.id) {
      throw new Error(`O áudio “${sound.name}” está ausente ou danificado.`);
    }
    files.push(file);
  });
  const size = new ArrayBuffer(4);
  new DataView(size).setUint32(0, manifest.byteLength, true);
  return new Blob([magic, size, manifest, ...files], {
    type: "application/octet-stream",
  });
}

export async function readBackup(
  file: Blob
): Promise<{ library: Library; files: Map<string, Blob> }> {
  if (file.size < headerSize) {
    throw new Error("Backup incompleto ou incompatível.");
  }
  const header = new Uint8Array(await file.slice(0, headerSize).arrayBuffer());
  if (!magic.every((byte, index) => header[index] === byte)) {
    throw new Error("Este arquivo não é um backup Soundbard compatível.");
  }
  const size = new DataView(header.buffer).getUint32(magic.length, true);
  if (!size || size > maxManifest || size > file.size - headerSize) {
    throw new Error("Backup com manifesto inválido.");
  }
  let input: unknown;
  try {
    input = JSON.parse(await file.slice(headerSize, headerSize + size).text());
  } catch (cause) {
    throw new Error("Não foi possível ler a organização do backup.", { cause });
  }
  const library = validateLibrary(input);
  const files = new Map<string, Blob>();
  let offset = headerSize + size;
  await inOrder(library.sounds, async (sound) => {
    if (sound.size > file.size - offset) {
      throw new Error("Backup incompleto: há áudios ausentes.");
    }
    const blob = file.slice(offset, offset + sound.size, sound.mime);
    if ((await sha256(blob)) !== sound.id) {
      throw new Error(
        `Backup danificado: “${sound.name}” falhou na verificação.`
      );
    }
    files.set(sound.id, blob);
    offset += sound.size;
  });
  if (offset !== file.size) {
    throw new Error("Backup com conteúdo adicional inesperado.");
  }
  return { files, library };
}
