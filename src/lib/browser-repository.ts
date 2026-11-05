import { validateLibrary } from "./backup";
import type { Library } from "./model";

function result<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export interface CommitOptions {
  files?: Map<string, Blob>;
  removed?: string[];
  replace?: boolean;
}

export class BrowserRepository {
  private readonly database: IDBDatabase;
  private constructor(database: IDBDatabase) {
    this.database = database;
    database.onversionchange = () => database.close();
  }
  static async open(name: string) {
    const opening = indexedDB.open(name, 1);
    opening.onupgradeneeded = () => {
      opening.result.createObjectStore("config");
      opening.result.createObjectStore("files");
    };
    return new BrowserRepository(await result(opening));
  }
  async read(): Promise<Library | null> {
    const value: unknown = await result(
      this.database.transaction("config").objectStore("config").get("library")
    );
    return value ? validateLibrary(value) : null;
  }
  async file(id: string): Promise<Blob | null> {
    const value: unknown = await result(
      this.database.transaction("files").objectStore("files").get(id)
    );
    return value instanceof Blob ? value : null;
  }
  write(
    library: Library,
    { files = new Map(), removed = [], replace = false }: CommitOptions = {}
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.database.transaction(
        ["config", "files"],
        "readwrite"
      );
      transaction.oncomplete = () => resolve();
      transaction.onabort = () =>
        reject(
          transaction.error ??
            new Error("Não foi possível atualizar o cache local.")
        );
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
      transaction.objectStore("config").put(library, "library");
    });
  }
  storeFile(id: string, blob: Blob): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.database.transaction("files", "readwrite");
      transaction.oncomplete = () => resolve();
      transaction.onabort = () =>
        reject(
          transaction.error ??
            new Error("Não foi possível guardar o áudio no cache.")
        );
      transaction.objectStore("files").put(blob, id);
    });
  }
  close() {
    this.database.close();
  }
}
