import { sha256, validateLibrary } from "./backup";
import type { Kind, Library, Sound } from "./model";
import { emptyLibrary } from "./model";
import { libraryTags, normalizeLibraryTags } from "./tags";
import { inOrder } from "./utils";

const audioExtensionPattern = /\.(?:mp3|wav|ogg)$/iu;
const extensionPattern = /\.[^.]+$/u;
const mimeTypes: Record<string, string> = {
  mp3: "audio/mpeg",
  ogg: "audio/ogg",
  wav: "audio/wav",
};

function result<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export class Repository {
  private readonly db: IDBDatabase;
  private constructor(db: IDBDatabase) {
    this.db = db;
    db.onversionchange = () => db.close();
  }
  static async open() {
    const request = indexedDB.open("soundbard", 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("config");
      request.result.createObjectStore("files");
    };
    return new Repository(await result(request));
  }
  async read(): Promise<Library> {
    const value: unknown = await result(
      this.db.transaction("config").objectStore("config").get("library")
    );
    return value ? validateLibrary(value) : emptyLibrary();
  }
  async file(id: string): Promise<Blob> {
    const value: unknown = await result(
      this.db.transaction("files").objectStore("files").get(id)
    );
    if (!(value instanceof Blob)) {
      throw new Error(
        "Áudio ausente. Restaure um backup ou importe o arquivo novamente."
      );
    }
    return value;
  }
  commit(
    library: Library,
    {
      files = new Map<string, Blob>(),
      removed = [],
      replace = false,
    }: { files?: Map<string, Blob>; removed?: string[]; replace?: boolean } = {}
  ): Promise<Library> {
    return new Promise((resolve, reject) => {
      const clean = validateLibrary(library);
      const transaction = this.db.transaction(["config", "files"], "readwrite");
      let failure: Error | null = null;
      let next = { ...clean, revision: clean.revision + 1 };
      transaction.oncomplete = () => resolve(next);
      transaction.onabort = () =>
        reject(
          failure ??
            (transaction.error?.name === "QuotaExceededError"
              ? new Error(
                  "Sem espaço no navegador. A biblioteca anterior foi preservada; exporte um backup e libere espaço."
                )
              : (transaction.error ??
                new Error(
                  "A alteração foi cancelada. A biblioteca anterior foi preservada."
                )))
        );
      const store = transaction.objectStore("config");
      const request = store.get("library");
      request.onsuccess = () => {
        const previous: unknown = request.result;
        const saved = previous ? validateLibrary(previous) : emptyLibrary();
        const { revision } = saved;
        if (revision !== clean.revision) {
          failure = new Error(
            "A biblioteca mudou em outra aba. Recarregue a página antes de continuar."
          );
          transaction.abort();
          return;
        }
        next = {
          ...normalizeLibraryTags({
            ...next,
            tags: [...libraryTags(saved), ...libraryTags(next)],
          }),
          revision: next.revision,
        };
        const blobs = transaction.objectStore("files");
        if (replace) {
          blobs.clear();
        }
        for (const id of removed) {
          blobs.delete(id);
        }
        for (const [id, blob] of files) {
          blobs.put(blob, id);
        }
        store.put(next, "library");
      };
    });
  }
  close() {
    this.db.close();
  }
}

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
