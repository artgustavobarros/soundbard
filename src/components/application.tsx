import type { LucideIcon } from "lucide-react";
import {
  ArrowDown,
  ArrowUp,
  AudioLines,
  BookAudio,
  Clapperboard,
  Download,
  FolderOpen,
  Headphones,
  LibraryBig,
  ListMusic,
  Music2,
  Pause,
  Pencil,
  Play,
  Plus,
  Repeat2,
  Save,
  Search,
  Settings2,
  SkipBack,
  SkipForward,
  Square,
  Trash2,
  Upload,
  Volume2,
  X,
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
import type { AudioView, Playback } from "../lib/audio";
import { AudioEngine } from "../lib/audio";
import { createBackup, readBackup } from "../lib/backup";
import type { Kind, Library, Playlist, Scene, Sound } from "../lib/model";
import { deleteSound, removeFromPlaylist } from "../lib/model";
import { prepareImport, Repository } from "../lib/repository";
import { duration, tagsFrom } from "../lib/utils";
import { AudioToolsDialog } from "./audio-tools-dialog";
import type { Editor } from "./editors";
import { Editors, kindNames } from "./editors";
import { SoundboardDesk } from "./soundboard-desk";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";

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
    <main className="boot">
      <AudioLines size={36} />
      <h1>Soundbard</h1>
      <p role="status">{bootError ?? "Abrindo sua biblioteca local…"}</p>
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
        const url = URL.createObjectURL(backup);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `soundbard-${new Date().toISOString().slice(0, 10)}.soundbard`;
        anchor.click();
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
        notify({
          error: false,
          text: "Backup completo exportado, incluindo os áudios.",
        });
      }, "Preparando backup completo…"),
    [library, notify, repository, run]
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
        () =>
          commit({
            ...library,
            playlists: library.playlists.filter(
              (candidate) => candidate.id !== playlist.id
            ),
            scenes: library.scenes.map((scene) =>
              scene.playlistId === playlist.id
                ? { ...scene, playlistId: null }
                : scene
            ),
          })
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
    currentMusic,
    deleteAudio,
    deletePlaylist,
    deleteScene,
    editor,
    engine,
    exportLibrary,
    filteredSounds,
    importAudioFiles,
    importPreparedAudio,
    kind,
    library,
    liveCount,
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

function SoundRow({
  state,
  sound,
  index,
  playlist,
}: {
  state: WorkspaceState;
  sound: Sound;
  index?: number;
  playlist?: Playlist;
}) {
  const {
    activeVoices,
    busy,
    triggerSound,
    moveSound,
    removePlaylistSound,
    openSound,
    deleteAudio,
  } = state;
  const playing = activeVoices.some((voice) => voice.soundId === sound.id);
  const play = useCallback(
    () => triggerSound(sound.id),
    [sound.id, triggerSound]
  );
  const edit = useCallback(() => openSound(sound), [openSound, sound]);
  const remove = useCallback(() => deleteAudio(sound), [deleteAudio, sound]);
  const moveUp = useCallback(() => {
    if (playlist && index !== undefined) {
      moveSound(playlist.id, index, -1);
    }
  }, [index, moveSound, playlist]);
  const moveDown = useCallback(() => {
    if (playlist && index !== undefined) {
      moveSound(playlist.id, index, 1);
    }
  }, [index, moveSound, playlist]);
  const removeFromList = useCallback(() => {
    if (playlist) {
      removePlaylistSound(playlist.id, sound.id);
    }
  }, [playlist, removePlaylistSound, sound.id]);
  return (
    <div className={`sound-row ${playing ? "is-playing" : ""}`}>
      <button
        aria-label={`Tocar ${sound.name}`}
        className="sound-play"
        onClick={play}
        type="button"
      >
        {playing && sound.kind === "ambience" ? (
          <Square size={15} />
        ) : (
          <Play size={17} />
        )}
      </button>
      <div className="sound-name">
        <strong>{sound.name}</strong>
        <span>
          {sound.tags.length ? sound.tags.join(" · ") : kindNames[sound.kind]}
        </span>
      </div>
      <span className="sound-kind">{kindNames[sound.kind]}</span>
      <span className="time">{duration(sound.duration)}</span>
      {playlist && index !== undefined ? (
        <>
          <Button
            aria-label={`Subir ${sound.name}`}
            disabled={index === 0 || Boolean(busy)}
            onClick={moveUp}
            size="icon"
            variant="ghost"
          >
            <ArrowUp />
          </Button>
          <Button
            aria-label={`Descer ${sound.name}`}
            disabled={index === playlist.soundIds.length - 1 || Boolean(busy)}
            onClick={moveDown}
            size="icon"
            variant="ghost"
          >
            <ArrowDown />
          </Button>
          <Button
            aria-label={`Remover ${sound.name} da playlist`}
            disabled={Boolean(busy)}
            onClick={removeFromList}
            size="icon"
            variant="ghost"
          >
            <X />
          </Button>
        </>
      ) : (
        <>
          <Button
            aria-label={`Editar ${sound.name}`}
            disabled={Boolean(busy)}
            onClick={edit}
            size="icon"
            variant="ghost"
          >
            <Settings2 />
          </Button>
          <Button
            aria-label={`Excluir ${sound.name}`}
            disabled={Boolean(busy)}
            onClick={remove}
            size="icon"
            variant="ghost"
          >
            <Trash2 />
          </Button>
        </>
      )}
    </div>
  );
}

function SceneTile({ state, scene }: { state: WorkspaceState; scene: Scene }) {
  const { activeScene, activateScene } = state;
  const activate = useCallback(
    () => activateScene(scene),
    [activateScene, scene]
  );
  const active = activeScene?.id === scene.id;
  return (
    <button
      aria-label={`Ativar cena ${scene.name}`}
      aria-pressed={active}
      className={`scene-button ${active ? "active" : ""}`}
      onClick={activate}
      type="button"
    >
      <Clapperboard size={20} />
      <strong>{scene.name}</strong>
      <span>
        {scene.layers.length} ambientes · {scene.effectIds.length} efeitos
      </span>
      <span className="scene-play">
        {active ? <AudioLines size={18} /> : <Play size={18} />}
      </span>
    </button>
  );
}
function ScenePanel({ state }: { state: WorkspaceState }) {
  const { activeScene, library, busy, saveMix, openScene } = state;
  const create = useCallback(() => openScene(), [openScene]);
  return (
    <section className="scene-panel">
      <div className="section-heading">
        <div>
          <h2>Cena em foco</h2>
          <p>{activeScene?.name ?? "Escolha a atmosfera da sessão"}</p>
        </div>
        <Button
          disabled={!activeScene || Boolean(busy)}
          onClick={saveMix}
          variant="outline"
        >
          <Save /> Salvar cena
        </Button>
      </div>
      <div className="scene-buttons">
        {library.scenes.map((scene) => (
          <SceneTile key={scene.id} scene={scene} state={state} />
        ))}
        <button
          className="new-scene"
          disabled={Boolean(busy)}
          onClick={create}
          type="button"
        >
          <Plus size={20} /> Nova cena
        </button>
      </div>
      {library.scenes.length === 0 ? (
        <p className="empty-hint">
          Uma cena reúne música, ambientes e efeitos. Prepare a primeira para
          ativar tudo com um clique.
        </p>
      ) : null}
    </section>
  );
}
function musicToggleLabel(playback: Playback, hasMusic: boolean) {
  if (playback.paused) {
    return "Retomar música";
  }
  return hasMusic ? "Pausar música" : "Tocar playlist";
}
function MusicPanel({ state }: { state: WorkspaceState }) {
  const {
    engine,
    playback,
    currentMusic,
    activePlaylist,
    library,
    music,
    act,
    openPlaylist,
  } = state;
  const hasMusic = Boolean(currentMusic);
  const playlistId = activePlaylist?.id ?? library.playlists.at(0)?.id;
  const choosePlaylist = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const id = event.target.value;
      act(() => engine.playPlaylist(id));
    },
    [act, engine]
  );
  const seek = useCallback(
    (event: ChangeEvent<HTMLInputElement>) =>
      engine.seek(Number(event.target.value)),
    [engine]
  );
  const previous = useCallback(
    () => act(() => engine.previous()),
    [act, engine]
  );
  const next = useCallback(() => act(() => engine.next()), [act, engine]);
  const toggle = useCallback(() => {
    if (hasMusic) {
      act(() => (playback.paused ? engine.resume() : engine.pause()));
      return;
    }
    if (playlistId) {
      act(() => engine.playPlaylist(playlistId));
    }
  }, [act, engine, hasMusic, playback.paused, playlistId]);
  const volume = useCallback(
    (event: ChangeEvent<HTMLInputElement>) =>
      engine.setMusicVolume(Number(event.target.value)),
    [engine]
  );
  const create = useCallback(() => openPlaylist(), [openPlaylist]);
  return (
    <section className="music-panel">
      <div className="section-heading">
        <h2>
          <Music2 size={19} /> Trilha sonora
        </h2>
        <select
          aria-label="Playlist em reprodução"
          onChange={choosePlaylist}
          value={playback.playlistId ?? ""}
        >
          <option disabled value="">
            Escolher playlist
          </option>
          {library.playlists.map((playlist) => (
            <option key={playlist.id} value={playlist.id}>
              {playlist.name}
            </option>
          ))}
        </select>
      </div>
      <div className="now-playing">
        <div
          className={`record ${music && !playback.paused ? "spinning" : ""}`}
        >
          <Music2 size={30} />
        </div>
        <div>
          <span className="muted">
            {activePlaylist?.name ?? "Nenhuma playlist selecionada"}
          </span>
          <h3>{music?.name ?? "A trilha está em suas mãos"}</h3>
          <p>
            {music
              ? "Reproduzindo da sua biblioteca"
              : "Crie uma playlist com as músicas da campanha."}
          </p>
        </div>
      </div>
      <div className="music-progress">
        <input
          aria-label="Posição da música"
          disabled={!currentMusic}
          max={currentMusic?.duration || 1}
          min="0"
          onChange={seek}
          step="0.1"
          type="range"
          value={currentMusic?.time ?? 0}
        />
        <div>
          <span>{duration(currentMusic?.time ?? 0)}</span>
          <span>{duration(currentMusic?.duration ?? 0)}</span>
        </div>
      </div>
      <div className="transport">
        <Button
          aria-label="Música anterior"
          disabled={!activePlaylist}
          onClick={previous}
          size="icon"
          variant="ghost"
        >
          <SkipBack />
        </Button>
        <Button
          aria-label={musicToggleLabel(playback, hasMusic)}
          className="play-large"
          disabled={!playlistId}
          onClick={toggle}
          size="icon"
        >
          {hasMusic && !playback.paused ? <Pause /> : <Play />}
        </Button>
        <Button
          aria-label="Próxima música"
          disabled={!activePlaylist}
          onClick={next}
          size="icon"
          variant="ghost"
        >
          <SkipForward />
        </Button>
        <label className="music-volume">
          <Volume2 size={16} />
          <span className="sr-only">Volume da música</span>
          <input
            max="1"
            min="0"
            onChange={volume}
            step="0.01"
            type="range"
            value={playback.musicVolume}
          />
        </label>
      </div>
      {library.playlists.length === 0 ? (
        <Button className="inline-action" onClick={create} variant="ghost">
          <Plus size={16} /> Criar primeira playlist
        </Button>
      ) : null}
    </section>
  );
}
function MixerRow({
  engine,
  sound,
  voice,
}: {
  engine: AudioEngine;
  sound: Sound;
  voice: AudioView;
}) {
  const stop = useCallback(
    () => engine.stopVoice(voice.id),
    [engine, voice.id]
  );
  const volume = useCallback(
    (event: ChangeEvent<HTMLInputElement>) =>
      engine.setVolume(voice.id, Number(event.target.value)),
    [engine, voice.id]
  );
  const loop = useCallback(
    () => engine.setLoop(voice.id, !voice.loop),
    [engine, voice.id, voice.loop]
  );
  return (
    <div className="mixer-row">
      <div className="mixer-title">
        <span className="live-light on" />
        <strong>{sound.name}</strong>
        <span className="muted">{duration(voice.time)}</span>
        <Button
          aria-label={`Parar ${sound.name}`}
          onClick={stop}
          size="icon"
          variant="ghost"
        >
          <X size={15} />
        </Button>
      </div>
      <div className="mixer-controls">
        <Volume2 size={15} />
        <input
          aria-label={`Volume de ${sound.name}`}
          max="1"
          min="0"
          onChange={volume}
          step="0.01"
          type="range"
          value={voice.volume}
        />
        <output>{Math.round(voice.volume * 100)}%</output>
        <button
          aria-label={`Loop de ${sound.name}`}
          aria-pressed={voice.loop}
          className={`loop-toggle ${voice.loop ? "enabled" : ""}`}
          onClick={loop}
          type="button"
        >
          <Repeat2 size={17} />
        </button>
      </div>
    </div>
  );
}
function LayersPanel({ state }: { state: WorkspaceState }) {
  const { engine, activeVoices, soundById, setView } = state;
  const layers = activeVoices.filter((voice) => voice.role !== "music");
  const library = useCallback(() => setView("library"), [setView]);
  return (
    <section className="layers-panel">
      <div className="section-heading">
        <h2>
          <AudioLines size={19} /> Camadas de som
        </h2>
        <span className="muted">{layers.length} ativas</span>
      </div>
      {layers.map((voice) => {
        const sound = soundById.get(voice.soundId);
        return sound ? (
          <MixerRow
            engine={engine}
            key={voice.id}
            sound={sound}
            voice={voice}
          />
        ) : null;
      })}
      {layers.length === 0 ? (
        <div className="empty-panel">
          <AudioLines size={29} />
          <p>O ambiente começa aqui.</p>
          <span>Ative uma cena ou toque um som da biblioteca.</span>
          <Button onClick={library} variant="ghost">
            Abrir biblioteca
          </Button>
        </div>
      ) : null}
    </section>
  );
}
function EffectButton({
  sound,
  trigger,
}: {
  sound: Sound;
  trigger: WorkspaceState["triggerSound"];
}) {
  const play = useCallback(() => trigger(sound.id), [sound.id, trigger]);
  return (
    <button
      aria-label={`Disparar ${sound.name}`}
      className="effect-button"
      onClick={play}
      type="button"
    >
      <Play size={16} />
      <strong>{sound.name}</strong>
      <span>{duration(sound.duration)}</span>
    </button>
  );
}
function EffectsPanel({ state }: { state: WorkspaceState }) {
  const { library, activeScene, triggerSound } = state;
  const effects = library.sounds.filter(
    (sound) =>
      sound.kind === "effect" &&
      (!activeScene || activeScene.effectIds.includes(sound.id))
  );
  return (
    <section className="effects-panel">
      <div className="section-heading">
        <div>
          <h2>Efeitos à mão</h2>
          <p>Clique para disparar. Clique novamente para sobrepor.</p>
        </div>
        <span className="muted">
          {activeScene?.name ?? "Da sua biblioteca"}
        </span>
      </div>
      <div className="effects-grid">
        {effects.map((sound) => (
          <EffectButton key={sound.id} sound={sound} trigger={triggerSound} />
        ))}
      </div>
      {effects.length === 0 ? (
        <p className="empty-hint">
          Importe sons como Efeito e adicione-os à cena. Uma espada, uma porta,
          um trovão: cada detalhe conta.
        </p>
      ) : null}
    </section>
  );
}
function DeskView({ state }: { state: WorkspaceState }) {
  return (
    <>
      <ScenePanel state={state} />
      <div className="desk-grid">
        <MusicPanel state={state} />
        <LayersPanel state={state} />
      </div>
      <EffectsPanel state={state} />
    </>
  );
}
function LibraryView({ state }: { state: WorkspaceState }) {
  const {
    library,
    filteredSounds,
    search,
    kind,
    setSearch,
    setKind,
    openImport,
  } = state;
  const searchChanged = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setSearch(event.target.value),
    [setSearch]
  );
  const kindChanged = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => setKind(event.target.value),
    [setKind]
  );
  const empty = library.sounds.length === 0;
  return (
    <section className="library-panel">
      <div className="library-toolbar">
        <div className="search-field">
          <Search size={18} />
          <Input
            aria-label="Buscar sons"
            onChange={searchChanged}
            placeholder="Buscar por nome ou tag…"
            value={search}
          />
        </div>
        <select aria-label="Filtrar tipo" onChange={kindChanged} value={kind}>
          <option value="all">Todos os tipos</option>
          {Object.entries(kindNames).map(([value, title]) => (
            <option key={value} value={value}>
              {title}
            </option>
          ))}
        </select>
        <span className="muted">{filteredSounds.length} sons</span>
      </div>
      {filteredSounds.map((sound) => (
        <SoundRow key={sound.id} sound={sound} state={state} />
      ))}
      {filteredSounds.length === 0 ? (
        <div className="large-empty">
          <BookAudio size={40} />
          <h2>
            {empty
              ? "Sua campanha merece uma trilha."
              : "Nenhum som encontrado"}
          </h2>
          <p>
            {empty
              ? "Importe seus arquivos MP3, WAV ou OGG. Organize por tags e prepare a próxima sessão."
              : "Tente outro nome, tag ou tipo de som."}
          </p>
          {empty ? (
            <Button onClick={openImport}>
              <Upload /> Importar primeiros sons
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
function PlaylistTab({
  state,
  playlist,
}: {
  state: WorkspaceState;
  playlist: Playlist;
}) {
  const { shownPlaylist, selectPlaylist } = state;
  const select = useCallback(
    () => selectPlaylist(playlist.id),
    [playlist.id, selectPlaylist]
  );
  return (
    <button
      className={shownPlaylist?.id === playlist.id ? "selected" : ""}
      onClick={select}
      type="button"
    >
      {playlist.name}
      <span>{playlist.soundIds.length}</span>
    </button>
  );
}
function PlaylistDetail({
  state,
  playlist,
}: {
  state: WorkspaceState;
  playlist: Playlist;
}) {
  const {
    engine,
    act,
    openPlaylist,
    deletePlaylist,
    updateShuffle,
    updateRepeat,
    soundById,
    busy,
  } = state;
  const edit = useCallback(
    () => openPlaylist(playlist),
    [openPlaylist, playlist]
  );
  const play = useCallback(
    () => act(() => engine.playPlaylist(playlist.id)),
    [act, engine, playlist.id]
  );
  const remove = useCallback(
    () => deletePlaylist(playlist),
    [deletePlaylist, playlist]
  );
  const shuffle = useCallback(
    (event: ChangeEvent<HTMLInputElement>) =>
      updateShuffle(playlist.id, event.target.checked),
    [playlist.id, updateShuffle]
  );
  const repeat = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) =>
      updateRepeat(playlist.id, event.target.value),
    [playlist.id, updateRepeat]
  );
  return (
    <div className="playlist-detail">
      <div className="section-heading">
        <div>
          <h2>{playlist.name}</h2>
          <p>
            {playlist.soundIds.length} músicas ·{" "}
            {playlist.shuffle ? "Embaralhada" : "Ordem escolhida"}
          </p>
        </div>
        <div className="row-actions">
          <Button disabled={Boolean(busy)} onClick={edit} variant="outline">
            <Pencil /> Editar
          </Button>
          <Button disabled={playlist.soundIds.length === 0} onClick={play}>
            <Play /> Tocar
          </Button>
          <Button
            aria-label={`Excluir playlist ${playlist.name}`}
            disabled={Boolean(busy)}
            onClick={remove}
            size="icon"
            variant="ghost"
          >
            <Trash2 />
          </Button>
        </div>
      </div>
      <div className="playlist-options">
        <label className="check-line">
          <input
            checked={playlist.shuffle}
            disabled={Boolean(busy)}
            onChange={shuffle}
            type="checkbox"
          />{" "}
          Embaralhar
        </label>
        <label>
          Repetição{" "}
          <select
            aria-label="Repetição da playlist"
            disabled={Boolean(busy)}
            onChange={repeat}
            value={playlist.repeat}
          >
            <option value="off">Desligada</option>
            <option value="one">Música atual</option>
            <option value="all">Playlist inteira</option>
          </select>
        </label>
      </div>
      {playlist.soundIds.map((id, index) => {
        const sound = soundById.get(id);
        return sound ? (
          <SoundRow
            index={index}
            key={id}
            playlist={playlist}
            sound={sound}
            state={state}
          />
        ) : null;
      })}
      {playlist.soundIds.length === 0 ? (
        <div className="large-empty">
          <ListMusic size={34} />
          <h3>Escolha as músicas deste momento.</h3>
          <Button onClick={edit} variant="outline">
            Adicionar músicas
          </Button>
        </div>
      ) : null}
    </div>
  );
}
function PlaylistsView({ state }: { state: WorkspaceState }) {
  const { library, shownPlaylist, openPlaylist } = state;
  const create = useCallback(() => openPlaylist(), [openPlaylist]);
  return (
    <section className="playlists-view">
      <div className="playlist-tabs">
        {library.playlists.map((playlist) => (
          <PlaylistTab key={playlist.id} playlist={playlist} state={state} />
        ))}
      </div>
      {shownPlaylist ? (
        <PlaylistDetail playlist={shownPlaylist} state={state} />
      ) : (
        <div className="large-empty">
          <ListMusic size={40} />
          <h2>Uma playlist para cada momento.</h2>
          <p>
            Combate, viagem ou suspense. Suas músicas podem participar de
            quantas listas você quiser.
          </p>
          <Button onClick={create}>
            <Plus /> Criar primeira playlist
          </Button>
        </div>
      )}
    </section>
  );
}
function SceneListRow({
  state,
  scene,
}: {
  state: WorkspaceState;
  scene: Scene;
}) {
  const { library, openScene, activateScene, deleteScene, busy } = state;
  const edit = useCallback(() => openScene(scene), [openScene, scene]);
  const activate = useCallback(
    () => activateScene(scene),
    [activateScene, scene]
  );
  const remove = useCallback(() => deleteScene(scene), [deleteScene, scene]);
  return (
    <div className="scene-list-row">
      <Clapperboard size={24} />
      <div>
        <h2>{scene.name}</h2>
        <p>
          {library.playlists.find(
            (playlist) => playlist.id === scene.playlistId
          )?.name ?? "Sem música"}{" "}
          · {scene.layers.length} ambientes · {scene.effectIds.length} efeitos
        </p>
      </div>
      <Button
        aria-label={`Editar cena ${scene.name}`}
        disabled={Boolean(busy)}
        onClick={edit}
        variant="outline"
      >
        <Pencil /> Editar
      </Button>
      <Button aria-label={`Ativar cena ${scene.name}`} onClick={activate}>
        <Play /> Ativar
      </Button>
      <Button
        aria-label={`Excluir cena ${scene.name}`}
        disabled={Boolean(busy)}
        onClick={remove}
        size="icon"
        variant="ghost"
      >
        <Trash2 />
      </Button>
    </div>
  );
}
function ScenesView({ state }: { state: WorkspaceState }) {
  const { library, openScene } = state;
  const create = useCallback(() => openScene(), [openScene]);
  return (
    <section className="scene-list">
      {library.scenes.map((scene) => (
        <SceneListRow key={scene.id} scene={scene} state={state} />
      ))}
      {library.scenes.length === 0 ? (
        <div className="large-empty">
          <Clapperboard size={40} />
          <h2>Prepare o próximo lugar da história.</h2>
          <p>
            Combine uma playlist, chuva, conversas e efeitos. Ative o conjunto
            com um clique durante a sessão.
          </p>
          <Button onClick={create}>
            <Plus /> Criar primeira cena
          </Button>
        </div>
      ) : null}
    </section>
  );
}

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
      className={view === id ? "nav-item selected" : "nav-item"}
      onClick={select}
      type="button"
    >
      <Icon size={19} />
      <span>{id === "scenes" ? "Gerenciar cenas" : titles[id]}</span>
      {id === "library" ? <small>{library.sounds.length}</small> : null}
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
    <header className="topbar">
      <div className="breadcrumb">
        Campanha local <span>/</span> <strong>{titles[view]}</strong>
      </div>
      <div className="header-actions">
        <span
          className="offline-state"
          title={
            offlineReady
              ? "Interface preparada para abrir sem internet."
              : "O modo offline é preparado na versão compilada."
          }
        >
          <span className="local-dot" />
          {offlineReady ? "Pronto para offline" : "Uso local"}
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
    <section aria-label="Controles gerais" className="global-controls">
      <div className="live-status">
        <span
          className={`live-light ${liveCount > 0 && !playback.paused ? "on" : ""}`}
        />
        <strong>{status}</strong>
      </div>
      <div className="master-control">
        <Volume2 size={17} />
        <label htmlFor="master-volume">Volume geral</label>
        <input
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
        <output>{Math.round(playback.master * 100)}%</output>
      </div>
      <Button disabled={liveCount === 0} onClick={toggle} variant="outline">
        {playback.paused ? <Play /> : <Pause />}
        {playback.paused ? "Retomar tudo" : "Pausar tudo"}
      </Button>
      <Button
        className="stop-all"
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
    <div className="page-heading">
      <div>
        <h1>{titles[view]}</h1>
        <p>{subtitles[view]}</p>
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
        className="max-h-[94dvh] overflow-y-auto border-[#303030] bg-[#111] p-4 text-white sm:max-w-[1100px]"
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
  const { busy, editor, closeEditor, library, save, setView } = state;
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
