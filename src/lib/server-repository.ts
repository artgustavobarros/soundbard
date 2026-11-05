import { createBackup, sha256, validateLibrary } from "./backup";
import { BrowserRepository, type CommitOptions } from "./browser-repository";
import { emptyLibrary, type Library } from "./model";
import { loadPreviewPadGroups } from "./preview-pad-groups";
import { libraryTags } from "./tags";
import { inOrder } from "./utils";

class ServerError extends Error {
  readonly status: number;
  constructor(status: number, message: string, options?: ErrorOptions) {
    super(message, options);
    this.status = status;
  }
}

function populated(library: Library) {
  return (
    library.revision > 0 ||
    library.sounds.length > 0 ||
    library.playlists.length > 0 ||
    library.scenes.length > 0 ||
    Boolean(
      library.tags?.length ||
        library.padGroups?.length ||
        library.padOrder?.length
    ) ||
    library.master !== 0.8
  );
}
function equivalent(first: Library, second: Library) {
  return (
    JSON.stringify(
      validateLibrary({
        ...first,
        padGroups: first.padGroups ?? [],
        padOrder: first.padOrder ?? [],
        revision: 0,
      })
    ) ===
    JSON.stringify(
      validateLibrary({
        ...second,
        padGroups: second.padGroups ?? [],
        padOrder: second.padOrder ?? [],
        revision: 0,
      })
    )
  );
}
function unavailable(cause?: unknown) {
  return new ServerError(
    503,
    "A biblioteca central está indisponível. Confira a conexão com o servidor; nenhuma alteração foi confirmada.",
    { cause }
  );
}

export class ServerRepository {
  private readonly cache: BrowserRepository;
  private readonly legacy: BrowserRepository;
  private library: Library | null = null;
  connection: "online" | "offline" = "offline";
  legacyRecoveryAvailable = false;
  migrationNotice: string | null = null;

  private constructor(cache: BrowserRepository, legacy: BrowserRepository) {
    this.cache = cache;
    this.legacy = legacy;
  }
  static async open() {
    const cache = await BrowserRepository.open("soundbard-server-cache");
    try {
      return new ServerRepository(
        cache,
        await BrowserRepository.open("soundbard")
      );
    } catch (error) {
      cache.close();
      throw error;
    }
  }
  private async response(path: string, options?: RequestInit) {
    let response: Response;
    try {
      response = await fetch(path, { cache: "no-store", ...options });
    } catch (cause) {
      this.connection = "offline";
      throw unavailable(cause);
    }
    if (response.status === 409) {
      throw new ServerError(
        409,
        "A biblioteca mudou em outro aparelho. Recarregue a página antes de continuar."
      );
    }
    if (response.status === 503) {
      this.connection = "offline";
      throw unavailable();
    }
    if (!response.ok) {
      throw new ServerError(
        response.status,
        response.status === 404
          ? "Áudio ausente no servidor. Restaure um backup ou importe o arquivo novamente."
          : "O servidor recusou a biblioteca ou o áudio. Nenhuma alteração foi confirmada."
      );
    }
    this.connection = "online";
    return response;
  }
  private async remoteLibrary() {
    return validateLibrary(await (await this.response("/api/library")).json());
  }
  private async cacheLibrary(library: Library, options?: CommitOptions) {
    try {
      await this.cache.write(library, options);
    } catch {
      this.migrationNotice =
        "A biblioteca foi confirmada no servidor, mas o cache local não pôde ser atualizado.";
    }
    this.library = library;
    return library;
  }
  private async legacyLibrary() {
    const library = await this.legacy.read();
    if (!library) {
      return null;
    }
    const allowed = [
      ...library.sounds.map((sound) => sound.id),
      ...library.playlists.map((playlist) => `playlist:${playlist.id}`),
    ];
    const groups =
      typeof localStorage === "undefined"
        ? []
        : loadPreviewPadGroups(localStorage, allowed, "soundbard-pad-groups");
    return validateLibrary({
      ...library,
      padGroups: library.padGroups ?? groups,
    });
  }
  async read(): Promise<Library> {
    let remote: Library;
    try {
      remote = await this.remoteLibrary();
    } catch (error) {
      if (!(error instanceof ServerError && error.status === 503)) {
        throw error;
      }
      const cached = await this.cache.read();
      if (!cached) {
        throw error;
      }
      this.library = cached;
      return cached;
    }
    const legacy = await this.legacyLibrary();
    if (legacy && populated(legacy) && !populated(remote)) {
      const files = new Map<string, Blob>();
      await inOrder(legacy.sounds, async (sound) => {
        const file = await this.legacy.file(sound.id);
        if (
          !file ||
          file.size !== sound.size ||
          (await sha256(file)) !== sound.id
        ) {
          throw new Error(
            `O áudio antigo “${sound.name}” está ausente ou danificado. O original foi preservado no navegador.`
          );
        }
        files.set(sound.id, file);
      });
      this.library = remote;
      try {
        const saved = await this.commit(
          { ...legacy, revision: remote.revision },
          { files }
        );
        this.migrationNotice =
          "A biblioteca deste navegador foi copiada para o servidor. Os dados locais antigos foram preservados.";
        return saved;
      } catch (error) {
        if (!(error instanceof ServerError && error.status === 409)) {
          throw error;
        }
        remote = await this.remoteLibrary();
      }
    }
    this.legacyRecoveryAvailable = Boolean(
      legacy && populated(legacy) && !equivalent(legacy, remote)
    );
    return this.cacheLibrary(remote);
  }
  async legacyBackup(): Promise<Blob> {
    const library = await this.legacyLibrary();
    if (!library) {
      throw new Error(
        "Nenhuma biblioteca antiga foi encontrada neste navegador."
      );
    }
    return createBackup(library, async (id) => {
      const file = await this.legacy.file(id);
      if (!file) {
        throw new Error(
          "Um áudio antigo está ausente. O backup não foi exportado."
        );
      }
      return file;
    });
  }
  async file(id: string): Promise<Blob> {
    const sound = this.library?.sounds.find((item) => item.id === id);
    const cached = await this.cache.file(id);
    if (
      cached &&
      (!sound || cached.size === sound.size) &&
      (await sha256(cached)) === id
    ) {
      return cached;
    }
    const blob = await (
      await this.response(`/api/library/files/${encodeURIComponent(id)}`)
    ).blob();
    if ((sound && blob.size !== sound.size) || (await sha256(blob)) !== id) {
      throw new Error("O áudio recebido falhou na verificação de integridade.");
    }
    try {
      await this.cache.storeFile(id, blob);
    } catch {
      this.migrationNotice =
        "O áudio veio do servidor, mas não pôde ser guardado no cache deste navegador.";
    }
    return blob;
  }
  async commit(
    library: Library,
    options: CommitOptions = {}
  ): Promise<Library> {
    const previous =
      this.library ?? (await this.cache.read()) ?? emptyLibrary();
    const clean = validateLibrary({
      ...library,
      tags: [...libraryTags(previous), ...libraryTags(library)],
    });
    const files = options.files ?? new Map<string, Blob>();
    const known = new Set(previous.sounds.map((sound) => sound.id));
    for (const sound of clean.sounds) {
      if (!(known.has(sound.id) || files.has(sound.id))) {
        throw new Error(
          `O arquivo do áudio “${sound.name}” está ausente; a biblioteca não foi enviada.`
        );
      }
    }
    const data = new FormData();
    data.append("library", JSON.stringify(clean));
    await inOrder([...files], async ([id, file]) => {
      const sound = clean.sounds.find((item) => item.id === id);
      if (!sound || file.size !== sound.size || (await sha256(file)) !== id) {
        throw new Error(
          "Um arquivo de áudio está ausente ou falhou na verificação de integridade."
        );
      }
      data.append("files", file.slice(0, file.size, sound.mime), id);
    });
    const saved = validateLibrary(
      await (
        await this.response("/api/library", { body: data, method: "PUT" })
      ).json()
    );
    if (saved.revision !== clean.revision + 1) {
      throw new Error(
        "O servidor retornou uma revisão inesperada. Recarregue a biblioteca antes de continuar."
      );
    }
    return this.cacheLibrary(saved, options);
  }
  close() {
    this.cache.close();
    this.legacy.close();
  }
}
