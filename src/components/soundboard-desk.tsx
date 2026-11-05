import { LibraryBig, ListMusic, Square, Upload } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import type { Library } from "../lib/model";
import { orderPads, reorderVisiblePads } from "../lib/pad-order";
import type { PreviewPadGroup } from "../lib/preview-pad-groups";
import type { WorkspaceState } from "./application";
import { CeramicPadBoard } from "./ceramic-pad-board";
import { CreatePadGroupDialog } from "./create-pad-group-dialog";
import { PreviewNavigation } from "./preview-navigation";
import {
  PadControls,
  type Playback,
  type PreviewPad,
} from "./soundboard-preview";
import { Button } from "./ui/button";
import { WorkspaceMenu } from "./workspace-menu";

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
  const pads = useMemo(
    () => orderPads(libraryPads(library), library.padOrder ?? []),
    [library]
  );
  const [selectedId, setSelectedId] = useState("");
  const [view, setView] = useState("all");
  const groups = library.padGroups ?? [];
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
  const reorderPads = useCallback(
    (ids: string[]) =>
      mutate((next) => {
        next.padOrder = reorderVisiblePads(
          pads,
          visiblePads.map((pad) => pad.id),
          ids
        );
      }),
    [mutate, pads, visiblePads]
  );
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
    async (name: string, padIds: string[]) => {
      const saved = { id: crypto.randomUUID(), name, padIds };
      const success = await mutate((next) => {
        next.padGroups = [...(next.padGroups ?? []), saved];
      });
      if (!success) {
        return false;
      }
      setView(`group:${saved.id}`);
      return true;
    },
    [mutate]
  );
  const trigger = useCallback(
    (id: string) => {
      const pad = pads.find((item) => item.id === id);
      if (!pad) {
        return;
      }
      setSelectedId(id);
      const voices = voicesFor(pad, state);
      if (voices.length) {
        if (pad.kind === "playlist" || pad.playlistId) {
          engine.stopMusic();
        } else {
          for (const voice of voices) {
            engine.stopVoice(voice.id);
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
    trigger(selected.id);
  }, [selected, trigger]);
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
  const changePadVolume = useCallback(
    (id: string, value: number) => {
      const pad = pads.find((item) => item.id === id);
      if (!pad) {
        return;
      }
      setVolumes((previous) => ({ ...previous, [id]: value }));
      if (pad.kind === "playlist") {
        engine.setMusicVolume(value / 100);
      } else {
        for (const voice of voicesFor(pad, state)) {
          engine.setVolume(voice.id, value / 100);
        }
      }
    },
    [engine, pads, state]
  );
  const commitPadVolume = useCallback(
    (id: string, value: number) => {
      const pad = pads.find((item) => item.id === id);
      if (!pad || pad.kind === "playlist") {
        return;
      }
      mutate((next) => {
        const sound = next.sounds.find((item) => item.id === id);
        if (sound) {
          sound.volume = value / 100;
        }
      }).then(() =>
        setVolumes((previous) => {
          const next = { ...previous };
          delete next[id];
          return next;
        })
      );
    },
    [mutate, pads]
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
  const editPad = useCallback(
    (id: string) => {
      const pad = pads.find((item) => item.id === id);
      if (!pad) {
        return;
      }
      setSelectedId(id);
      const playlist = library.playlists.find(
        (item) => item.id === pad.playlistId
      );
      const sound = library.sounds.find((item) => item.id === id);
      if (playlist) {
        openPlaylist(playlist);
      } else if (sound) {
        openSound(sound);
      }
    },
    [library, openPlaylist, openSound, pads]
  );
  const editSelected = useCallback(() => {
    if (selected) {
      editPad(selected.id);
    }
  }, [editPad, selected]);
  const changePadLoop = useCallback(
    (id: string, loop: boolean) => {
      const pad = pads.find((item) => item.id === id);
      if (!pad || pad.kind === "playlist") {
        return;
      }
      for (const voice of voicesFor(pad, state)) {
        engine.setLoop(voice.id, loop);
      }
      mutate((next) => {
        const sound = next.sounds.find((item) => item.id === id);
        if (sound) {
          sound.loop = loop;
        }
      });
    },
    [engine, mutate, pads, state]
  );
  const toggleLoop = useCallback(() => {
    if (selected) {
      changePadLoop(selected.id, !selected.loop);
    }
  }, [changePadLoop, selected]);
  const current = selected ? playback[selected.id] : null;
  return {
    changeMaster,
    changePadLoop,
    changePadVolume,
    commitMaster,
    commitPadVolume,
    current,
    editPad,
    editSelected,
    groupEditorOpen,
    groups,
    nextTrack,
    openGroup,
    openNewPlaylist,
    pads,
    playback,
    previousTrack,
    reorderPads,
    saveGroup,
    scenes,
    selectEffects,
    selected,
    selectGroup,
    selectScene,
    setGroupEditorOpen,
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
  const [menuOpen, setMenuOpen] = useState(false);
  const { openImport } = state;
  const showPads = useCallback(() => {
    setMenuOpen(false);
    showAll();
  }, [showAll]);
  const manage = useCallback(() => {
    setMenuOpen(false);
    onManage();
  }, [onManage]);
  const importAudio = useCallback(() => {
    setMenuOpen(false);
    openImport();
  }, [openImport]);
  const newPlaylist = useCallback(() => {
    setMenuOpen(false);
    openNewPlaylist();
  }, [openNewPlaylist]);
  const stop = useCallback(() => {
    setMenuOpen(false);
    stopAll();
  }, [stopAll]);
  const createGroup = useCallback(() => {
    setMenuOpen(false);
    openGroup();
  }, [openGroup]);
  const chooseScene = useCallback(
    (id: string) => {
      setMenuOpen(false);
      selectScene(id);
    },
    [selectScene]
  );
  const chooseEffects = useCallback(
    (kind: "all" | "ambience" | "effect") => {
      setMenuOpen(false);
      selectEffects(kind);
    },
    [selectEffects]
  );
  const chooseGroup = useCallback(
    (id: string) => {
      setMenuOpen(false);
      selectGroup(id);
    },
    [selectGroup]
  );
  return (
    <WorkspaceMenu
      onAddAudio={openImport}
      onOpenChange={setMenuOpen}
      open={menuOpen}
    >
      <PreviewNavigation
        groups={groups}
        onCreateGroup={createGroup}
        onEffects={chooseEffects}
        onGroup={chooseGroup}
        onScene={chooseScene}
        scenes={scenes}
        selected={view}
      />
      <nav aria-label="Ações da mesa" className="grid gap-2">
        <Button className="justify-start" onClick={showPads} variant="ghost">
          Todos os pads
        </Button>
        <Button className="justify-start" onClick={manage} variant="ghost">
          <LibraryBig aria-hidden="true" />
          Biblioteca
        </Button>
        <Button
          className="justify-start"
          disabled={Boolean(state.busy)}
          onClick={importAudio}
          variant="ghost"
        >
          <Upload aria-hidden="true" />
          Importar áudios
        </Button>
        <Button className="justify-start" onClick={newPlaylist} variant="ghost">
          <ListMusic aria-hidden="true" />
          Nova playlist
        </Button>
        <Button
          className="text-destructive justify-start"
          onClick={stop}
          variant="ghost"
        >
          <Square aria-hidden="true" />
          Parar tudo
        </Button>
      </nav>
      <div className="text-muted-foreground mt-auto grid gap-3 text-[12px]">
        {Boolean(state.migrationNotice) && (
          <p role="status">{state.migrationNotice}</p>
        )}
        {state.legacyRecoveryAvailable === true && (
          <>
            <p>
              A biblioteca antiga deste navegador foi preservada. Exporte-a para
              recuperar seus sons sem substituir a biblioteca central.
            </p>
            <Button
              disabled={Boolean(state.busy)}
              onClick={state.exportLegacyLibrary}
              variant="outline"
            >
              Exportar biblioteca antiga
            </Button>
          </>
        )}
        <p>
          {state.library.sounds.length} sons ·{" "}
          {state.connection === "online"
            ? "Servidor conectado"
            : "Cache offline · alterações indisponíveis"}
        </p>
        {state.offlineReady === true && <p>Pronto para offline</p>}
      </div>
    </WorkspaceMenu>
  );
}

function DeskContent({
  desk,
  state,
}: {
  desk: DeskState;
  state: WorkspaceState;
}) {
  const { visiblePads, trigger, playback, selected, title, pads, showAll } =
    desk;
  const { openImport } = state;
  return visiblePads.length ? (
    <CeramicPadBoard
      onEdit={desk.editPad}
      onLoop={desk.changePadLoop}
      onReorder={desk.reorderPads}
      onTrigger={trigger}
      onVolume={desk.changePadVolume}
      onVolumeCommit={desk.commitPadVolume}
      pads={visiblePads}
      playback={playback}
      reorderDisabled={Boolean(state.busy)}
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
      <p className="text-muted-foreground max-w-[320px] text-[13px]">
        {pads.length
          ? "Escolha outro conjunto ou volte para todos os pads."
          : "Importe músicas, ambientes e efeitos. Cada áudio e playlist aparece como um pad."}
      </p>
      <Button
        className="border-border text-foreground bg-[var(--surface-raised)] shadow-[var(--shadow-raised)]"
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
      pad={selected}
      playback={current}
    />
  ) : (
    <div className="text-muted-foreground shrink-0 rounded-lg bg-[var(--surface)] p-3 text-[12px]">
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
      className="bg-background text-foreground fixed inset-0 z-10"
      data-soundboard-desk
    >
      <div className="mx-auto flex h-dvh max-w-[1280px] flex-col gap-4 overflow-hidden px-4 pt-[calc(12px+env(safe-area-inset-top))] pb-[calc(12px+env(safe-area-inset-bottom))] md:gap-5 md:px-8 md:pt-7">
        <DeskHeader desk={desk} onManage={onManage} state={state} />
        <DeskContent desk={desk} state={state} />
        <DeskControls desk={desk} state={state} />
        {groupEditorOpen === true && (
          <CreatePadGroupDialog
            description="Reúna sons e playlists em um conjunto de pads. O grupo fica salvo no servidor e aparece nos seus aparelhos."
            onOpenChange={setGroupEditorOpen}
            onSave={saveGroup}
            pads={pads}
          />
        )}
      </div>
    </div>
  );
}
