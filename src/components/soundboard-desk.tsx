import { LibraryBig, ListMusic, Square, Upload } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import type { Library } from "../lib/model";
import {
  loadPreviewPadGroups,
  type PreviewPadGroup,
  savePreviewPadGroups,
} from "../lib/preview-pad-groups";
import type { WorkspaceState } from "./application";
import { CreatePadGroupDialog } from "./create-pad-group-dialog";
import { PreviewNavigation } from "./preview-navigation";
import {
  PadBoard,
  PadControls,
  type Playback,
  type PreviewPad,
} from "./soundboard-preview";
import { Button } from "./ui/button";

const groupKey = "soundbard-pad-groups";
const actionClass =
  "size-[44px] rounded-[4px] border-[#303030] bg-transparent p-2 text-white shadow-none hover:border-[#69aeff] hover:bg-[#242424]";
const effectTitles: Record<string, string> = {
  "effects:all": "Efeitos",
  "effects:ambience": "Ambiente",
  "effects:effect": "Efeitos pontuais",
};

function libraryPads(library: Library): PreviewPad[] {
  const names = new Map(library.sounds.map((sound) => [sound.id, sound.name]));
  return [
    ...library.playlists.map(
      (playlist): PreviewPad => ({
        id: `playlist:${playlist.id}`,
        kind: "playlist",
        name: playlist.name,
        playlistData: {
          name: playlist.name,
          tracks: playlist.soundIds.map(
            (id) => names.get(id) ?? "Áudio indisponível"
          ),
        },
        playlistId: playlist.id,
      })
    ),
    ...library.sounds.map(
      (sound): PreviewPad => ({
        id: sound.id,
        kind: sound.kind,
        loop: sound.loop,
        name: sound.name,
      })
    ),
  ];
}

function voicesFor(pad: PreviewPad, state: WorkspaceState) {
  return state.playback.voices.filter(
    (voice) =>
      !voice.retiring &&
      (pad.kind === "playlist"
        ? state.playback.playlistId === pad.playlistId && voice.role === "music"
        : voice.soundId === pad.id && voice.role !== "music")
  );
}

function padPlayback(
  pad: PreviewPad,
  state: WorkspaceState,
  volume?: number
): Playback {
  const voices = voicesFor(pad, state);
  const voice = voices.at(-1);
  const sound = state.library.sounds.find((item) => item.id === pad.id);
  const playlist = state.library.playlists.find(
    (item) => item.id === pad.playlistId
  );
  let status: Playback["status"] = "idle";
  if (voice) {
    status = voice.paused ? "paused" : "playing";
  }
  return {
    hits: voices.length,
    status,
    track: Math.max(0, playlist?.soundIds.indexOf(voice?.soundId ?? "") ?? 0),
    volume:
      volume ??
      Math.round(
        (pad.kind === "playlist"
          ? state.playback.musicVolume
          : (voice?.volume ?? sound?.volume ?? 0.7)) * 100
      ),
  };
}

function readGroups(pads: PreviewPad[]) {
  try {
    return loadPreviewPadGroups(
      localStorage,
      pads.map((pad) => pad.id),
      groupKey
    );
  } catch {
    return [];
  }
}

function scenePads(library: Library, sceneId: string) {
  const scene = library.scenes.find((item) => item.id === sceneId);
  return new Set(
    scene
      ? [
          ...scene.effectIds,
          ...scene.layers.map((layer) => layer.soundId),
          ...(scene.playlistId ? [`playlist:${scene.playlistId}`] : []),
        ]
      : []
  );
}

function padSet(
  library: Library,
  pads: PreviewPad[],
  groups: PreviewPadGroup[],
  view: string
) {
  const scene = library.scenes.find((item) => view === `scene:${item.id}`);
  const group = groups.find((item) => view === `group:${item.id}`);
  if (scene) {
    const ids = scenePads(library, scene.id);
    return {
      title: scene.name,
      visiblePads: pads.filter((pad) => ids.has(pad.id)),
    };
  }
  if (group) {
    const ids = new Set(group.padIds);
    return {
      title: group.name,
      visiblePads: pads.filter((pad) => ids.has(pad.id)),
    };
  }
  if (view.startsWith("effects:")) {
    return {
      title: effectTitles[view] ?? "Efeitos",
      visiblePads: pads.filter((pad) =>
        view === "effects:all"
          ? pad.kind === "ambience" || pad.kind === "effect"
          : pad.kind === view.slice(8)
      ),
    };
  }
  return { title: "Todos os pads", visiblePads: pads };
}

function useSoundboardDesk(state: WorkspaceState) {
  const { library, engine, act, openPlaylist, openSound, mutate } = state;
  const pads = useMemo(() => libraryPads(library), [library]);
  const [selectedId, setSelectedId] = useState("");
  const [view, setView] = useState("all");
  const [groups, setGroups] = useState<PreviewPadGroup[]>(() =>
    readGroups(pads)
  );
  const [groupEditorOpen, setGroupEditorOpen] = useState(false);
  const [volumes, setVolumes] = useState<Record<string, number>>({});
  const selected = pads.find((pad) => pad.id === selectedId) ?? pads[0];
  const playback = Object.fromEntries(
    pads.map((pad) => [pad.id, padPlayback(pad, state, volumes[pad.id])])
  );
  const scenes = library.scenes.map((scene) => ({
    ...scene,
    type: scene.type ?? "locations",
  }));
  const { title, visiblePads } = padSet(library, pads, groups, view);
  const openNewPlaylist = useCallback(() => openPlaylist(), [openPlaylist]);
  const showAll = useCallback(() => setView("all"), []);
  const selectScene = useCallback((id: string) => setView(`scene:${id}`), []);
  const selectEffects = useCallback(
    (kind: "all" | "ambience" | "effect") => setView(`effects:${kind}`),
    []
  );
  const selectGroup = useCallback((id: string) => setView(`group:${id}`), []);
  const openGroup = useCallback(() => setGroupEditorOpen(true), []);
  const stopAll = useCallback(() => engine.stopAll(), [engine]);
  const saveGroup = useCallback(
    (name: string, padIds: string[]) => {
      const saved = { id: crypto.randomUUID(), name, padIds };
      const next = [...groups, saved];
      try {
        if (!savePreviewPadGroups(localStorage, next, groupKey)) {
          return false;
        }
      } catch {
        return false;
      }
      setGroups(next);
      setView(`group:${saved.id}`);
      return true;
    },
    [groups]
  );
  const trigger = useCallback(
    (id: string) => {
      const pad = pads.find((item) => item.id === id);
      if (!pad) {
        return;
      }
      setSelectedId(id);
      const voices = voicesFor(pad, state);
      if (pad.kind === "effect") {
        act(() => engine.trigger(pad.id));
      } else if (voices.length) {
        const paused = voices.every((voice) => voice.paused);
        for (const voice of voices) {
          if (paused) {
            act(() => engine.resumeVoice(voice.id));
          } else {
            engine.pauseVoice(voice.id);
          }
        }
      } else if (pad.playlistId) {
        act(() => engine.playPlaylist(pad.playlistId ?? ""));
      } else {
        act(() => engine.trigger(pad.id));
      }
    },
    [act, engine, pads, state]
  );
  const toggleSelected = useCallback(() => {
    if (!selected) {
      return;
    }
    const voices = voicesFor(selected, state);
    if (!voices.length) {
      trigger(selected.id);
      return;
    }
    const paused = voices.every((voice) => voice.paused);
    for (const voice of voices) {
      if (paused) {
        act(() => engine.resumeVoice(voice.id));
      } else {
        engine.pauseVoice(voice.id);
      }
    }
  }, [act, engine, selected, state, trigger]);
  const stopSelected = useCallback(() => {
    if (!selected) {
      return;
    }
    if (
      selected.kind === "playlist" &&
      state.playback.playlistId === selected.playlistId
    ) {
      engine.stopMusic();
      return;
    }
    for (const voice of voicesFor(selected, state)) {
      engine.stopVoice(voice.id);
    }
  }, [engine, selected, state]);
  const nextTrack = useCallback(() => {
    if (selected?.playlistId) {
      act(() =>
        state.playback.playlistId === selected.playlistId
          ? engine.next()
          : engine.playPlaylist(selected.playlistId ?? "")
      );
    }
  }, [act, engine, selected, state.playback.playlistId]);
  const previousTrack = useCallback(() => {
    if (selected?.playlistId) {
      act(() =>
        state.playback.playlistId === selected.playlistId
          ? engine.previous()
          : engine.playPlaylist(selected.playlistId ?? "")
      );
    }
  }, [act, engine, selected, state.playback.playlistId]);
  const changeVolume = useCallback(
    ([value]: number[]) => {
      if (!selected) {
        return;
      }
      setVolumes((previous) => ({ ...previous, [selected.id]: value }));
      if (selected.kind === "playlist") {
        engine.setMusicVolume(value / 100);
      } else {
        for (const voice of voicesFor(selected, state)) {
          engine.setVolume(voice.id, value / 100);
        }
      }
    },
    [engine, selected, state]
  );
  const commitVolume = useCallback(
    ([value]: number[]) => {
      if (!selected || selected.kind === "playlist") {
        return;
      }
      mutate((next) => {
        const sound = next.sounds.find((item) => item.id === selected.id);
        if (sound) {
          sound.volume = value / 100;
        }
      }).then(() =>
        setVolumes((previous) => {
          const next = { ...previous };
          delete next[selected.id];
          return next;
        })
      );
    },
    [mutate, selected]
  );
  const changeMaster = useCallback(
    ([value]: number[]) => engine.setMaster(value / 100),
    [engine]
  );
  const commitMaster = useCallback(
    ([value]: number[]) =>
      mutate((next) => {
        next.master = value / 100;
      }),
    [mutate]
  );
  const editSelected = useCallback(() => {
    if (!selected) {
      return;
    }
    const playlist = library.playlists.find(
      (item) => item.id === selected.playlistId
    );
    const sound = library.sounds.find((item) => item.id === selected.id);
    if (playlist) {
      openPlaylist(playlist);
    } else if (sound) {
      openSound(sound);
    }
  }, [library, openPlaylist, openSound, selected]);
  const toggleLoop = useCallback(() => {
    if (!selected || selected.kind === "playlist") {
      return;
    }
    const loop = !selected.loop;
    for (const voice of voicesFor(selected, state)) {
      engine.setLoop(voice.id, loop);
    }
    mutate((next) => {
      const sound = next.sounds.find((item) => item.id === selected.id);
      if (sound) {
        sound.loop = loop;
      }
    });
  }, [engine, mutate, selected, state]);
  const current = selected ? playback[selected.id] : null;
  return {
    changeMaster,
    changeVolume,
    commitMaster,
    commitVolume,
    current,
    editSelected,
    groupEditorOpen,
    groups,
    nextTrack,
    openGroup,
    openNewPlaylist,
    pads,
    playback,
    previousTrack,
    saveGroup,
    scenes,
    selectEffects,
    selected,
    selectGroup,
    selectScene,
    setGroupEditorOpen,
    setSelectedId,
    showAll,
    stopAll,
    stopSelected,
    title,
    toggleLoop,
    toggleSelected,
    trigger,
    view,
    visiblePads,
  };
}

type DeskState = ReturnType<typeof useSoundboardDesk>;

function DeskHeader({
  desk,
  state,
  onManage,
}: {
  desk: DeskState;
  state: WorkspaceState;
  onManage: () => void;
}) {
  const {
    groups,
    openGroup,
    openNewPlaylist,
    scenes,
    selectEffects,
    selectGroup,
    selectScene,
    showAll,
    stopAll,
    view,
  } = desk;
  const { library, openImport } = state;
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      <header className="flex min-h-[44px] min-w-0 flex-[1_1_220px] items-center justify-between gap-2">
        <Button
          aria-label="Todos os pads"
          className="h-[44px] min-w-0 flex-[1_1_100px] flex-col items-start gap-0 bg-transparent p-0 text-white hover:bg-transparent"
          onClick={showAll}
          variant="ghost"
        >
          <span className="w-full truncate text-left text-[21px] font-bold tracking-[-0.03em]">
            soundbard
          </span>
          <span className="w-full truncate text-left text-[11px] font-normal text-[#a6a6a6]">
            <span>{library.sounds.length} sons</span>
            {" · "}
            <span>
              {state.offlineReady ? "Pronto para offline" : "Biblioteca local"}
            </span>
          </span>
        </Button>
        <div className="flex shrink-0 gap-1">
          <Button
            aria-label="Biblioteca"
            className={actionClass}
            onClick={onManage}
            title="Biblioteca e organização"
            variant="outline"
          >
            <LibraryBig aria-hidden="true" />
          </Button>
          <Button
            aria-label="Importar áudios"
            className={actionClass}
            disabled={Boolean(state.busy)}
            onClick={openImport}
            title="Importar áudios"
            variant="outline"
          >
            <Upload aria-hidden="true" />
          </Button>
          <Button
            aria-label="Nova playlist"
            className={actionClass}
            onClick={openNewPlaylist}
            title="Nova playlist"
            variant="outline"
          >
            <ListMusic aria-hidden="true" />
          </Button>
          <Button
            aria-label="Parar tudo"
            className={`${actionClass} text-[#ff6666]`}
            onClick={stopAll}
            title="Parar tudo"
            variant="outline"
          >
            <Square aria-hidden="true" />
          </Button>
        </div>
      </header>
      <PreviewNavigation
        groups={groups}
        onCreateGroup={openGroup}
        onEffects={selectEffects}
        onGroup={selectGroup}
        onScene={selectScene}
        scenes={scenes}
        selected={view}
      />
    </div>
  );
}

function DeskContent({
  desk,
  state,
}: {
  desk: DeskState;
  state: WorkspaceState;
}) {
  const {
    visiblePads,
    setSelectedId,
    trigger,
    playback,
    selected,
    title,
    pads,
    showAll,
  } = desk;
  const { openImport } = state;
  return visiblePads.length ? (
    <PadBoard
      onSelect={setSelectedId}
      onTrigger={trigger}
      pads={visiblePads}
      playback={playback}
      selected={selected?.id ?? ""}
      title={title}
    />
  ) : (
    <section
      aria-label={`Pads de ${title}`}
      className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 text-center"
    >
      <h1 className="text-[18px]! font-semibold!">
        {pads.length
          ? "Nenhum pad neste conjunto"
          : "Sua mesa começa com seus sons"}
      </h1>
      <p className="max-w-[320px] text-[13px] text-[#a6a6a6]">
        {pads.length
          ? "Escolha outro conjunto ou volte para todos os pads."
          : "Importe músicas, ambientes e efeitos. Cada áudio e playlist aparece como um pad."}
      </p>
      <Button
        className="border-[#444] bg-[#191919] text-white"
        onClick={pads.length ? showAll : openImport}
        variant="outline"
      >
        {pads.length ? "Todos os pads" : "Adicionar músicas e sons"}
      </Button>
    </section>
  );
}

function DeskControls({
  desk,
  state,
}: {
  desk: DeskState;
  state: WorkspaceState;
}) {
  const {
    selected,
    current,
    editSelected,
    toggleLoop,
    changeMaster,
    commitMaster,
    nextTrack,
    previousTrack,
    stopSelected,
    toggleSelected,
    changeVolume,
    commitVolume,
  } = desk;
  return selected && current ? (
    <PadControls
      master={Math.round(state.playback.master * 100)}
      onEdit={editSelected}
      onLoop={selected.kind === "playlist" ? undefined : toggleLoop}
      onMaster={changeMaster}
      onMasterCommit={commitMaster}
      onNext={nextTrack}
      onPrevious={previousTrack}
      onStop={stopSelected}
      onToggle={toggleSelected}
      onVolume={changeVolume}
      onVolumeCommit={commitVolume}
      pad={selected}
      playback={current}
    />
  ) : (
    <div className="shrink-0 rounded-[5px] bg-[#111] p-3 text-[12px] text-[#a6a6a6]">
      Tudo pronto para importar sua biblioteca.
    </div>
  );
}

export function SoundboardDesk({
  state,
  onManage,
}: {
  state: WorkspaceState;
  onManage: () => void;
}) {
  const desk = useSoundboardDesk(state);
  const { groupEditorOpen, setGroupEditorOpen, saveGroup, pads } = desk;
  return (
    <div
      className="fixed inset-0 z-10 bg-[#080808] text-[#fafafa] [--background:#080808] [--border:#303030] [--foreground:#fafafa] [--muted:#a6a6a6] [--primary-foreground:#080808] [--primary:#fafafa] [--ring:#69aeff] [--secondary:#242424] [&_*]:[scrollbar-color:#444_#111] [&_button:focus-visible]:outline-[#69aeff]!"
      data-soundboard-desk
    >
      <div className="mx-auto flex h-dvh max-w-[1300px] flex-col gap-2 overflow-hidden px-[12px] pt-[calc(10px+env(safe-area-inset-top))] pb-[calc(8px+env(safe-area-inset-bottom))]">
        <DeskHeader desk={desk} onManage={onManage} state={state} />
        <DeskContent desk={desk} state={state} />
        <DeskControls desk={desk} state={state} />
        {groupEditorOpen === true && (
          <CreatePadGroupDialog
            description="Reúna sons e playlists em um conjunto de pads. O grupo fica salvo neste navegador."
            onOpenChange={setGroupEditorOpen}
            onSave={saveGroup}
            pads={pads}
          />
        )}
      </div>
    </div>
  );
}
