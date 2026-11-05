import { sha256 } from "./backup";
import type { Kind, Library, Sound } from "./model";
import { inOrder } from "./utils";

const audioExtensionPattern = /\.(?:mp3|wav|ogg)$/iu;
const extensionPattern = /\.[^.]+$/u;
const mimeTypes: Record<string, string> = {
  mp3: "audio/mpeg",
  ogg: "audio/ogg",
  wav: "audio/wav",
};

export function audioDuration(blob: Blob): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    const url = URL.createObjectURL(blob);
    const finish = (duration?: number) => {
      audio.onloadedmetadata = null;
      audio.onerror = null;
      clearTimeout(timer);
      audio.removeAttribute("src");
      audio.load();
      URL.revokeObjectURL(url);
      if (duration !== undefined && Number.isFinite(duration) && duration > 0) {
        resolve(duration);
      } else {
        reject(
          new Error(
            "Não foi possível decodificar este áudio. Use um arquivo MP3, WAV ou OGG válido."
          )
        );
      }
    };
    const timer = setTimeout(() => finish(), 15_000);
    audio.preload = "metadata";
    audio.onloadedmetadata = () => finish(audio.duration);
    audio.onerror = () => finish();
    audio.src = url;
  });
}

export async function prepareImport(
  input: File[],
  library: Library,
  kind: Kind,
  tags: string[],
  progress: (message: string) => void
) {
  const sounds: Sound[] = [];
  const files = new Map<string, Blob>();
  const errors: string[] = [];
  const known = new Set(library.sounds.map((sound) => sound.id));
  let duplicates = 0;
  await inOrder(input, async (file, index) => {
    progress(`Verificando ${index + 1} de ${input.length}: ${file.name}`);
    try {
      if (!(audioExtensionPattern.test(file.name) && file.size)) {
        throw new Error("Use um arquivo MP3, WAV ou OGG válido.");
      }
      const id = await sha256(file);
      if (known.has(id)) {
        duplicates += 1;
        return;
      }
      const duration = await audioDuration(file);
      const mime =
        file.type ||
        (mimeTypes[file.name.split(".").pop()?.toLowerCase() ?? ""] ??
          "audio/mpeg");
      sounds.push({
        duration,
        id,
        kind,
        loop: kind === "ambience",
        mime,
        name: file.name.replace(extensionPattern, "").slice(0, 200) || "Áudio",
        size: file.size,
        tags,
        volume: 0.75,
      });
      files.set(id, file);
      known.add(id);
    } catch (error) {
      errors.push(
        `${file.name}: ${error instanceof Error ? error.message : "Não foi possível importar."}`
      );
    }
  });
  return { duplicates, errors, files, sounds };
}
