import { cn } from "cn";
import type { LucideIcon } from "lucide-react";
import {
  AudioLines,
  Clapperboard,
  Download,
  FolderOpen,
  Headphones,
  LibraryBig,
  ListMusic,
  Pause,
  Play,
  Plus,
  Square,
  Upload,
  Volume2,
} from "lucide-react";
import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { toast } from "sonner";
import { AudioEngine } from "../lib/audio";
import { createBackup, readBackup } from "../lib/backup";
import { restoreWorkspaceFocus } from "../lib/dialog-focus";
import type { Kind, Library, Playlist, Scene, Sound } from "../lib/model";
import {
  deletePlaylist as deletePlaylistFromLibrary,
  deleteSound,
  removeFromPlaylist,
} from "../lib/model";
import { prepareImport } from "../lib/repository";
import { ServerRepository as Repository } from "../lib/server-repository";
import { tagsFrom } from "../lib/utils";
import { AudioToolsDialog } from "./audio-tools-dialog";
import type { Editor } from "./editors";
import { Editors } from "./editors";
import { LibraryView } from "./library-view";
import { DeskView } from "./mix-view";
import { PlaylistsView } from "./music-view";
import { ScenesView } from "./scenes-view";
import { SoundboardDesk } from "./soundboard-desk";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

interface System {
  engine: AudioEngine;
  library: Library;
  repository: Repository;
}
interface Notice {
  error: boolean;
  text: string;
}
type View = "desk" | "library" | "playlists" | "scenes" | "mix";
interface WorkspaceProps {
  notify: (notice: Notice) => void;
  system: System;
}
const titles: Record<View, string> = {
  desk: "Mesa de som",
  library: "Biblioteca",
  mix: "Mixagem",
  playlists: "Playlists",
  scenes: "Cenas",
};
const subtitles: Record<View, string> = {
  desk: "Dê vida à próxima cena da sua campanha.",
  library: "Todos os sons da sua campanha, no mesmo lugar.",
  mix: "Ajuste e salve a combinação de sons da cena.",
  playlists: "A trilha certa para cada momento.",
  scenes: "Prepare a atmosfera. O resto acontece na mesa.",
};
function reloadPage() {
  location.reload();
}
function showNotice({ error, text }: Notice) {
  if (error) {
    toast.error(text, { duration: 8000 });
  } else {
    toast.success(text);
  }
}
function downloadBackup(backup: Blob, prefix = "soundbard") {
  const url = URL.createObjectURL(backup);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${prefix}-${new Date().toISOString().slice(0, 10)}.soundbard`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
export function Application() {
  const [system, setSystem] = useState<System | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    let active: System | null = null;
    Repository.open()
      .then(async (repository) => {
        const library = await repository.read();
        if (cancelled) {
          repository.close();
          return;
        }
        active = {
          engine: new AudioEngine(repository, library, (text) =>
            showNotice({ error: true, text })
          ),
          library,
          repository,
        };
        setSystem(active);
      })
      .catch((error) => {
        if (!cancelled) {
          setBootError(`Não foi possível abrir a biblioteca. ${String(error)}`);
        }
      });
    return () => {
      cancelled = true;
      active?.engine.dispose();
      active?.repository.close();
    };
  }, []);
  return system ? (
    <Workspace notify={showNotice} system={system} />
  ) : (
    <main className="text-muted-foreground [&>h1]:text-foreground flex min-h-dvh flex-col items-center justify-center gap-5 p-5 text-center [&>h1]:text-2xl [&>h1]:font-bold [&>p]:max-w-[65ch] [&>p]:leading-relaxed">
      <AudioLines size={36} />
      <h1>Soundbard</h1>
      <p role="status">{bootError ?? "Abrindo a biblioteca central…"}</p>
      {bootError ? (
        <Button onClick={reloadPage}>Tentar novamente</Button>
      ) : null}
    </main>
  );
}
function useWorkspaceState({ system, notify }: WorkspaceProps) {
  const { repository, engine } = system;
  const [library, setLibrary] = useState(system.library);
  const playback = useSyncExternalStore(
    engine.subscribe,
    engine.snapshot,
    engine.snapshot
  );
  const [view, setView] = useState<View>("desk");
  const [editor, setEditor] = useState<Editor | null>(null);
  const [busy, setBusy] = useState("");
  const lock = useRef<boolean>(false);
  const restoreInput = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("all");
  const [selectedPlaylist, selectPlaylist] = useState<string | null>(null);
  const [offlineReady, setOfflineReady] = useState(false);
  const activeScene = library.scenes.find(
    (scene) => scene.id === playback.sceneId
  );
  const activePlaylist = library.playlists.find(
    (playlist) => playlist.id === playback.playlistId
  );
  const currentMusic = playback.voices.find(
    (voice) => voice.role === "music" && !voice.retiring
  );
  const music = library.sounds.find(
    (sound) => sound.id === currentMusic?.soundId
  );
  const soundById = useMemo(
    () => new Map(library.sounds.map((sound) => [sound.id, sound])),
    [library.sounds]
  );
  const filteredSounds = useMemo(() => {
    const term = search.toLocaleLowerCase("pt-BR");
    return library.sounds.filter(
      (sound) =>
        (kind === "all" || sound.kind === kind) &&
        `${sound.name} ${sound.tags.join(" ")}`
          .toLocaleLowerCase("pt-BR")
          .includes(term)
    );
  }, [library.sounds, search, kind]);
  useEffect(() => {
    if (import.meta.env.DEV || !("serviceWorker" in navigator)) {
      return;
    }
    let active = true;
    navigator.serviceWorker
      .register("/sw.js", { type: "module" })
      .then(async () => {
        await navigator.serviceWorker.ready;
        if (active) {
          setOfflineReady(true);
        }
      })
      .catch((error) => {
        if (active) {
          notify({
            error: true,
            text: `Não foi possível preparar o modo offline. ${String(error)}`,
          });
        }
      });
    return () => {
      active = false;
    };
  }, [notify]);
  const act = useCallback(
    (task: () => Promise<void>) => {
      task().catch((error) =>
        notify({
          error: true,
          text: error instanceof Error ? error.message : String(error),
        })
      );
    },
    [notify]
  );
  const run = useCallback(
    async (task: () => Promise<void>, message = "Salvando…") => {
      if (lock.current) {
        return;
      }
      lock.current = true;
      setBusy(message);
      try {
        await task();
        return true;
      } catch (error) {
        notify({
          error: true,
          text: error instanceof Error ? error.message : String(error),
        });
        return false;
      } finally {
        lock.current = false;
        setBusy("");
      }
    },
    [notify]
  );
  const commit = useCallback(
    async (next: Library, options?: Parameters<Repository["commit"]>[1]) => {
      const saved = await repository.commit(next, options);
      setLibrary(saved);
      engine.updateLibrary(saved);
    },
    [engine, repository]
  );
  const mutate = useCallback(
    (change: (next: Library) => void) =>
      run(async () => {
        const next = structuredClone(library);
        change(next);
        await commit(next);
      }),
    [commit, library, run]
  );
  const confirm = useCallback(
    (
      title: string,
      description: string,
      label: string,
      action: () => Promise<void>
    ) => setEditor({ action, description, label, title, type: "confirm" }),
    []
  );
  const references = useCallback(
    (sound: Sound) => {
      const playlists = library.playlists.filter((playlist) =>
        playlist.soundIds.includes(sound.id)
      );
      const scenes = library.scenes.filter(
        (scene) =>
          scene.effectIds.includes(sound.id) ||
          scene.layers.some((layer) => layer.soundId === sound.id) ||
          playlists.some((playlist) => playlist.id === scene.playlistId)
      );
      return [
        ...playlists.map((p) => `playlist “${p.name}”`),
        ...scenes.map((s) => `cena “${s.name}”`),
      ].join(", ");
    },
    [library]
  );
  const saveImport = useCallback(
    async (data: FormData, files: File[]) => {
      const value = data.get("kind");
      if (value !== "music" && value !== "ambience" && value !== "effect") {
        throw new Error("Escolha o tipo dos arquivos.");
      }
      const imported = await prepareImport(
        files,
        library,
        value,
        tagsFrom(data.get("tags")),
        setBusy
      );
      if (imported.sounds.length) {
        await commit(
          { ...library, sounds: [...library.sounds, ...imported.sounds] },
          { files: imported.files }
        );
      }
      notify({
        error: Boolean(imported.errors.length),
        text: `${imported.sounds.length} áudio(s) importado(s).${imported.duplicates ? ` ${imported.duplicates} já estavam na biblioteca.` : ""}${imported.errors.length ? ` ${imported.errors.join(" ")}` : ""}`,
      });
      if (navigator.storage?.persist) {
        navigator.storage
          .persist()
          .catch((error) =>
            console.info("Persistência não concedida:", error.name)
          );
      }
      setView("desk");
      return true;
    },
    [commit, library, notify]
  );
  const importPreparedAudio = useCallback(
    async (file: File, audioKind: Kind, audioTags: string[]) =>
      Boolean(
        await run(async () => {
          const imported = await prepareImport(
            [file],
            library,
            audioKind,
            audioTags,
            setBusy
          );
          if (imported.errors.length) {
            throw new Error(imported.errors.join(" "));
          }
          if (imported.sounds.length) {
            await commit(
              { ...library, sounds: [...library.sounds, ...imported.sounds] },
              { files: imported.files }
            );
          }
          notify({
            error: false,
            text: imported.duplicates
              ? "Este áudio já está na biblioteca."
              : "Áudio adicionado à mesa.",
          });
          setView("desk");
        }, "Adicionando áudio à biblioteca…")
      ),
    [commit, library, notify, run]
  );
  const importAudioFiles = useCallback(
    async (files: File[], audioKind: Kind, audioTags: string[]) =>
      Boolean(
        await run(async () => {
          const data = new FormData();
          data.set("kind", audioKind);
          data.set("tags", audioTags.join(","));
          await saveImport(data, files);
        }, "Adicionando áudios à biblioteca…")
      ),
    [run, saveImport]
  );
  const saveSound = useCallback(
    async (current: Extract<Editor, { type: "sound" }>, data: FormData) => {
      const value = data.get("kind");
      if (value !== "music" && value !== "ambience" && value !== "effect") {
        throw new Error("Escolha o tipo do som.");
      }
      const updated: Sound = {
        ...current.sound,
        kind: value,
        loop: data.has("loop"),
        name: String(data.get("name")).trim(),
        tags: tagsFrom(data.get("tags")),
        volume: Number(data.get("volume")),
      };
      const change = async () => {
        const next =
          value === current.sound.kind
            ? structuredClone(library)
            : deleteSound(library, current.sound.id);
        next.sounds = library.sounds.map((sound) =>
          sound.id === updated.id ? updated : sound
        );
        await commit(next);
      };
      const usage = references(current.sound);
      if (value !== current.sound.kind && usage) {
        confirm(
          "Alterar o tipo deste som?",
          `O som será retirado de ${usage}. O arquivo permanece na biblioteca.`,
          "Alterar tipo",
          change
        );
        return false;
      }
      await change();
      return true;
    },
    [commit, confirm, library, references]
  );
  const savePlaylist = useCallback(
    async (current: Extract<Editor, { type: "playlist" }>, data: FormData) => {
      const ids = data
        .getAll("soundIds")
        .filter((id): id is string => typeof id === "string");
      const original = current.playlist;
      const repeat = data.get("repeat");
      if (repeat !== "off" && repeat !== "one" && repeat !== "all") {
        throw new Error("Modo de repetição inválido.");
      }
      const playlist: Playlist = {
        id: original?.id ?? crypto.randomUUID(),
        name: String(data.get("name")).trim(),
        repeat,
        shuffle: data.has("shuffle"),
        soundIds: [
          ...(original?.soundIds.filter((id) => ids.includes(id)) ?? []),
          ...ids.filter((id) => !original?.soundIds.includes(id)),
        ],
      };
      await commit({
        ...library,
        playlists: original
          ? library.playlists.map((p) => (p.id === playlist.id ? playlist : p))
          : [...library.playlists, playlist],
      });
      selectPlaylist(playlist.id);
      setView("playlists");
      return true;
    },
    [commit, library]
  );
  const saveScene = useCallback(
    async (current: Extract<Editor, { type: "scene" }>, data: FormData) => {
      const type = data.get("type");
      if (type !== "characters" && type !== "locations" && type !== "combat") {
        throw new Error("Escolha o tipo da cena.");
      }
      const layers = data
        .getAll("layers")
        .filter((id): id is string => typeof id === "string")
        .map((id) => ({
          loop: data.has(`loop-${id}`),
          soundId: id,
          volume: Number(data.get(`volume-${id}`)),
        }));
      const scene: Scene = {
        effectIds: data
          .getAll("effects")
          .filter((id): id is string => typeof id === "string"),
        id: current.scene?.id ?? crypto.randomUUID(),
        layers,
        musicVolume: Number(data.get("musicVolume")),
        name: String(data.get("name")).trim(),
        playlistId: String(data.get("playlistId")) || null,
        type,
      };
      await commit({
        ...library,
        scenes: current.scene
          ? library.scenes.map((s) => (s.id === scene.id ? scene : s))
          : [...library.scenes, scene],
      });
      setView("scenes");
      return true;
    },
    [commit, library]
  );
  const save = useCallback(
    async (data: FormData, files: File[]) => {
      if (!editor) {
        return;
      }
      const current = editor;
      await run(
        async () => {
          let shouldClose = true;
          switch (current.type) {
            case "import":
              shouldClose = await saveImport(data, files);
              break;
            case "sound":
              shouldClose = await saveSound(current, data);
              break;
            case "playlist":
              shouldClose = await savePlaylist(current, data);
              break;
            case "scene":
              shouldClose = await saveScene(current, data);
              break;
            case "confirm":
              await current.action();
              break;
            default:
              throw new Error("Editor desconhecido.");
          }
          if (shouldClose) {
            setEditor(null);
          }
        },
        current.type === "import" ? "Verificando arquivos…" : "Salvando…"
      );
    },
    [editor, run, saveImport, savePlaylist, saveScene, saveSound]
  );
  const exportLibrary = useCallback(
    () =>
      run(async () => {
        const backup = await createBackup(library, (id) => repository.file(id));
        downloadBackup(backup);
        notify({
          error: false,
          text: "Backup completo exportado, incluindo os áudios.",
        });
      }, "Preparando backup completo…"),
    [library, notify, repository, run]
  );
  const exportLegacyLibrary = useCallback(
    () =>
      run(async () => {
        downloadBackup(await repository.legacyBackup(), "soundbard-legado");
        notify({
          error: false,
          text: "Biblioteca antiga exportada. Os dados originais continuam neste navegador.",
        });
      }, "Preparando backup da biblioteca antiga…"),
    [notify, repository, run]
  );
  const restore = useCallback(
    (file: File) =>
      run(async () => {
        const backup = await readBackup(file);
        confirm(
          "Substituir a biblioteca?",
          `Este backup contém ${backup.library.sounds.length} sons, ${backup.library.playlists.length} playlists e ${backup.library.scenes.length} cenas. A biblioteca atual será substituída. Exporte um backup atual se quiser preservá-la.`,
          "Substituir biblioteca",
          async () => {
            await commit(
              { ...backup.library, revision: library.revision },
              { files: backup.files, replace: true }
            );
            engine.stopAll();
            notify({
              error: false,
              text: "Biblioteca restaurada com todos os áudios e configurações.",
            });
          }
        );
      }, "Verificando integridade do backup…"),
    [commit, confirm, engine, library.revision, notify, run]
  );
  const deleteAudio = useCallback(
    (sound: Sound) =>
      confirm(
        "Excluir som da biblioteca?",
        `“${sound.name}” será excluído.${references(sound) ? ` Afeta ${references(sound)}.` : ""} Remover de uma playlist é uma ação diferente.`,
        "Excluir som",
        () => commit(deleteSound(library, sound.id), { removed: [sound.id] })
      ),
    [commit, confirm, library, references]
  );
  const saveMix = useCallback(() => {
    if (activeScene) {
      mutate((next) => {
        next.scenes = next.scenes.map((scene) =>
          scene.id === activeScene.id
            ? { ...scene, ...engine.sceneMix() }
            : scene
        );
      }).then((saved) => {
        if (saved) {
          notify({ error: false, text: "Configuração da cena salva." });
        }
      });
    }
  }, [activeScene, engine, mutate, notify]);
  const totalSize = library.sounds.reduce(
    (size, sound) => size + sound.size,
    0
  );
  const activeVoices = playback.voices.filter((voice) => !voice.retiring);
  const liveCount = playback.voices.length;
  const shownPlaylist =
    library.playlists.find((p) => p.id === selectedPlaylist) ??
    library.playlists.at(0);

  const openImport = useCallback(() => setEditor({ type: "import" }), []);
  const openScene = useCallback(
    (scene?: Scene) => setEditor({ scene, type: "scene" }),
    []
  );
  const openPlaylist = useCallback(
    (playlist?: Playlist) => setEditor({ playlist, type: "playlist" }),
    []
  );
  const openSound = useCallback(
    (sound: Sound) => setEditor({ sound, type: "sound" }),
    []
  );
  const closeEditor = useCallback(() => setEditor(null), []);
  const activateScene = useCallback(
    (scene: Scene) => {
      act(() => engine.activateScene(scene));
      setView("mix");
    },
    [act, engine]
  );
  const triggerSound = useCallback(
    (id: string) => act(() => engine.trigger(id)),
    [act, engine]
  );
  const moveSound = useCallback(
    (playlistId: string, index: number, direction: number) =>
      mutate((next) => {
        const playlist = next.playlists.find(
          (candidate) => candidate.id === playlistId
        );
        const target = index + direction;
        if (playlist && target >= 0 && target < playlist.soundIds.length) {
          [playlist.soundIds[index], playlist.soundIds[target]] = [
            playlist.soundIds[target],
            playlist.soundIds[index],
          ];
        }
      }),
    [mutate]
  );
  const removePlaylistSound = useCallback(
    (playlistId: string, soundId: string) =>
      run(() => commit(removeFromPlaylist(library, playlistId, soundId))),
    [commit, library, run]
  );
  const updateShuffle = useCallback(
    (playlistId: string, shuffle: boolean) =>
      mutate((next) => {
        const playlist = next.playlists.find(
          (candidate) => candidate.id === playlistId
        );
        if (playlist) {
          playlist.shuffle = shuffle;
        }
      }),
    [mutate]
  );
  const updateRepeat = useCallback(
    (playlistId: string, repeat: string) => {
      if (repeat !== "off" && repeat !== "one" && repeat !== "all") {
        return;
      }
      mutate((next) => {
        const playlist = next.playlists.find(
          (candidate) => candidate.id === playlistId
        );
        if (playlist) {
          playlist.repeat = repeat;
        }
      });
    },
    [mutate]
  );
  const deletePlaylist = useCallback(
    (playlist: Playlist) =>
      confirm(
        "Excluir playlist?",
        `As músicas continuam na biblioteca. As cenas que usam “${playlist.name}” ficarão sem playlist.`,
        "Excluir playlist",
        () => commit(deletePlaylistFromLibrary(library, playlist.id))
      ),
    [commit, confirm, library]
  );
  const deleteScene = useCallback(
    (scene: Scene) =>
      confirm(
        "Excluir cena?",
        `A cena “${scene.name}” será excluída. Os sons e playlists permanecem na biblioteca.`,
        "Excluir cena",
        () =>
          commit({
            ...library,
            scenes: library.scenes.filter(
              (candidate) => candidate.id !== scene.id
            ),
          })
      ),
    [commit, confirm, library]
  );
  return {
    act,
    activateScene,
    activePlaylist,
    activeScene,
    activeVoices,
    busy,
    closeEditor,
    commit,
    confirm,
    connection: repository.connection,
    currentMusic,
    deleteAudio,
    deletePlaylist,
    deleteScene,
    editor,
    engine,
    exportLegacyLibrary,
    exportLibrary,
    filteredSounds,
    importAudioFiles,
    importPreparedAudio,
    kind,
    legacyRecoveryAvailable: repository.legacyRecoveryAvailable,
    library,
    liveCount,
    migrationNotice: repository.migrationNotice,
    moveSound,
    music,
    mutate,
    notify,
    offlineReady,
    openImport,
    openPlaylist,
    openScene,
    openSound,
    playback,
    removePlaylistSound,
    repository,
    restore,
    restoreInput,
    run,
    save,
    saveMix,
    search,
    selectedPlaylist,
    selectPlaylist,
    setKind,
    setSearch,
    setView,
    shownPlaylist,
    soundById,
    totalSize,
    triggerSound,
    updateRepeat,
    updateShuffle,
    view,
  };
}
export type WorkspaceState = ReturnType<typeof useWorkspaceState>;

function NavigationButton({
  state,
  id,
  Icon,
}: {
  state: WorkspaceState;
  id: View;
  Icon: LucideIcon;
}) {
  const { view, setView, library } = state;
  const select = useCallback(() => setView(id), [id, setView]);
  return (
    <button
      aria-label={id === "scenes" ? "Gerenciar cenas" : titles[id]}
      className={cn(
        "text-muted-foreground flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors hover:bg-[var(--surface-hover)] sm:gap-2.5 sm:text-sm",
        view === id
          ? "text-foreground bg-[var(--selected)] font-semibold shadow-xs"
          : "hover:text-foreground"
      )}
      onClick={select}
      type="button"
    >
      <Icon size={18} />
      <span>{id === "scenes" ? "Gerenciar cenas" : titles[id]}</span>
      {id === "library" ? (
        <small className="ml-1.5 hidden rounded bg-[var(--surface-inset)] px-1.5 py-0.5 text-[11px] tabular-nums sm:inline">
          {library.sounds.length}
        </small>
      ) : null}
    </button>
  );
}

const navigation = [
  { Icon: Headphones, id: "mix" },
  { Icon: LibraryBig, id: "library" },
  { Icon: ListMusic, id: "playlists" },
  { Icon: Clapperboard, id: "scenes" },
] satisfies { id: View; Icon: LucideIcon }[];

function WorkspaceHeader({ state }: { state: WorkspaceState }) {
  const {
    view,
    offlineReady,
    busy,
    exportLibrary,
    restoreInput,
    restore,
    openImport,
  } = state;
  const chooseBackup = useCallback(
    () => restoreInput.current?.click(),
    [restoreInput]
  );
  const restoreBackup = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        restore(file);
      }
      event.target.value = "";
    },
    [restore]
  );
  return (
    <header className="border-border flex min-h-[65px] flex-wrap items-center justify-between gap-4 border-b py-3">
      <div className="text-muted-foreground hidden text-xs sm:flex sm:items-center sm:gap-3">
        Biblioteca central <span>/</span>{" "}
        <strong className="text-foreground font-medium">{titles[view]}</strong>
      </div>
      <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
        <span
          className="text-muted-foreground mr-auto flex items-center gap-1.5 text-xs sm:mr-3"
          title={
            offlineReady
              ? "Interface preparada para abrir sem internet."
              : "O modo offline é preparado na versão compilada."
          }
        >
          <span className="size-1.5 shrink-0 rounded-full bg-[var(--playback)]" />
          {state.connection === "offline"
            ? "Cache offline"
            : "Servidor conectado"}
          {offlineReady ? " · Pronto para offline" : ""}
        </span>
        <Button
          aria-label="Exportar backup"
          disabled={Boolean(busy)}
          onClick={exportLibrary}
          size="icon"
          title="Exportar backup"
          variant="ghost"
        >
          <Download />
        </Button>
        <Button
          aria-label="Restaurar backup"
          disabled={Boolean(busy)}
          onClick={chooseBackup}
          size="icon"
          title="Restaurar backup"
          variant="ghost"
        >
          <FolderOpen />
        </Button>
        <input
          accept=".soundbard"
          aria-label="Arquivo de backup"
          hidden
          onChange={restoreBackup}
          ref={restoreInput}
          type="file"
        />
        <Button disabled={Boolean(busy)} onClick={openImport}>
          <Upload size={16} />
          <span>Importar áudios</span>
        </Button>
      </div>
    </header>
  );
}

function GlobalControls({ state }: { state: WorkspaceState }) {
  const { engine, playback, liveCount, mutate, act } = state;
  const master = useCallback(
    (event: ChangeEvent<HTMLInputElement>) =>
      engine.setMaster(Number(event.target.value)),
    [engine]
  );
  const saveMaster = useCallback(
    () =>
      mutate((next) => {
        next.master = engine.snapshot().master;
      }),
    [engine, mutate]
  );
  const toggle = useCallback(
    () => act(() => (playback.paused ? engine.resume() : engine.pause())),
    [act, engine, playback.paused]
  );
  const stop = useCallback(() => engine.stopAll(), [engine]);
  let status = `${liveCount} sons tocando`;
  if (liveCount === 1) {
    status = "1 som tocando";
  }
  if (playback.paused) {
    status = `${liveCount} som(ns) pausado(s)`;
  }
  return (
    <section
      aria-label="Controles gerais"
      className="mb-6 flex flex-wrap items-center gap-3 rounded-xl bg-[var(--surface)] p-3 shadow-[var(--shadow-inset)] sm:gap-4 sm:p-4"
    >
      <div className="flex flex-1 items-center gap-2 text-xs whitespace-nowrap">
        <span
          className={cn(
            "size-2 shrink-0 rounded-full transition-colors",
            liveCount > 0 && !playback.paused
              ? "bg-[var(--playback)] shadow-[0_0_8px_var(--playback)]"
              : "bg-[var(--border-strong)]"
          )}
        />
        <strong className="font-medium">{status}</strong>
      </div>
      <div className="text-muted-foreground flex items-center gap-2 text-xs">
        <Volume2 size={17} />
        <label className="hidden sm:inline" htmlFor="master-volume">
          Volume geral
        </label>
        <input
          className="w-20 sm:w-28"
          id="master-volume"
          max="1"
          min="0"
          onChange={master}
          onKeyUp={saveMaster}
          onPointerUp={saveMaster}
          step="0.01"
          type="range"
          value={playback.master}
        />
        <output className="w-8 text-right text-xs tabular-nums">
          {Math.round(playback.master * 100)}%
        </output>
      </div>
      <Button disabled={liveCount === 0} onClick={toggle} variant="outline">
        {playback.paused ? <Play /> : <Pause />}
        {playback.paused ? "Retomar tudo" : "Pausar tudo"}
      </Button>
      <Button
        className="text-destructive hover:text-destructive"
        disabled={liveCount === 0}
        onClick={stop}
        variant="ghost"
      >
        <Square /> Parar tudo
      </Button>
    </section>
  );
}

function PageHeading({ state }: { state: WorkspaceState }) {
  const { view, busy, openScene, openPlaylist } = state;
  const newScene = useCallback(() => openScene(), [openScene]);
  const newPlaylist = useCallback(() => openPlaylist(), [openPlaylist]);
  return (
    <div className="mb-6 flex items-center justify-between gap-4">
      <div>
        <h1 className="text-xl font-bold sm:text-2xl">{titles[view]}</h1>
        <p className="text-muted-foreground mt-1 text-xs sm:text-sm">
          {subtitles[view]}
        </p>
      </div>
      {view === "scenes" ? (
        <Button disabled={Boolean(busy)} onClick={newScene}>
          <Plus /> Criar cena
        </Button>
      ) : null}
      {view === "playlists" ? (
        <Button
          aria-label="Nova playlist"
          disabled={Boolean(busy)}
          onClick={newPlaylist}
        >
          <Plus /> Nova playlist
        </Button>
      ) : null}
    </div>
  );
}

function editorKey(editor: Editor | null) {
  if (!editor) {
    return;
  }
  switch (editor.type) {
    case "sound":
      return editor.sound.id;
    case "scene":
      return editor.scene?.id ?? "new-scene";
    case "playlist":
      return editor.playlist?.id ?? "new-playlist";
    default:
      return editor.type;
  }
}
function LibraryManager({ state }: { state: WorkspaceState }) {
  const { view, setView } = state;
  const returnToDesk = useCallback(() => setView("desk"), [setView]);
  const changeOpen = useCallback(
    (open: boolean) => {
      if (!open) {
        returnToDesk();
      }
    },
    [returnToDesk]
  );
  return (
    <Dialog onOpenChange={changeOpen} open={view !== "desk"}>
      <DialogContent
        className="border-border text-foreground max-h-[94dvh] overflow-y-auto bg-[var(--surface-raised)] p-4 shadow-[var(--shadow-dialog)] sm:max-w-[1100px]"
        onCloseAutoFocus={restoreWorkspaceFocus}
        showCloseButton={false}
      >
        <DialogHeader className="flex-row flex-wrap items-center justify-between gap-3 text-left">
          <div className="grid gap-2">
            <DialogTitle>Biblioteca e organização</DialogTitle>
            <DialogDescription>
              Organize seus arquivos e prepare playlists e cenas.
            </DialogDescription>
          </div>
          <Button onClick={returnToDesk} variant="outline">
            Voltar à mesa
          </Button>
        </DialogHeader>
        <nav aria-label="Organizar biblioteca" className="flex flex-wrap gap-2">
          {navigation.map((item) => (
            <NavigationButton
              Icon={item.Icon}
              id={item.id}
              key={item.id}
              state={state}
            />
          ))}
        </nav>
        <WorkspaceHeader state={state} />
        <PageHeading state={state} />
        <GlobalControls state={state} />
        {view === "mix" ? <DeskView state={state} /> : null}
        {view === "library" ? <LibraryView state={state} /> : null}
        {view === "playlists" ? <PlaylistsView state={state} /> : null}
        {view === "scenes" ? <ScenesView state={state} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function Workspace(props: WorkspaceProps) {
  const state = useWorkspaceState(props);
  const { busy, closeEditor, deleteAudio, editor, library, save, setView } =
    state;
  const openManager = useCallback(() => setView("library"), [setView]);
  const [audioTools, setAudioTools] = useState<{
    source?: "youtube" | "file";
    sound?: Sound;
  } | null>(null);
  const openYouTube = useCallback(() => {
    closeEditor();
    setAudioTools({ source: "youtube" });
  }, [closeEditor]);
  const openFile = useCallback(() => {
    closeEditor();
    setAudioTools({ source: "file" });
  }, [closeEditor]);
  const openTrim = useCallback(
    (sound: Sound) => {
      closeEditor();
      setAudioTools({ sound });
    },
    [closeEditor]
  );
  const closeAudioTools = useCallback(() => setAudioTools(null), []);
  return (
    <>
      <SoundboardDesk onManage={openManager} state={state} />
      <LibraryManager state={state} />
      <Editors
        busy={busy}
        close={closeEditor}
        editor={editor}
        key={editorKey(editor)}
        library={library}
        onDeleteSound={deleteAudio}
        onFile={openFile}
        onTrim={openTrim}
        onYouTube={openYouTube}
        save={save}
      />
      {audioTools !== null && (
        <AudioToolsDialog
          knownTags={library.tags ?? []}
          onClose={closeAudioTools}
          onImport={state.importPreparedAudio}
          onImportFiles={state.importAudioFiles}
          repository={state.repository}
          sound={audioTools.sound}
          source={audioTools.source}
        />
      )}
    </>
  );
}
