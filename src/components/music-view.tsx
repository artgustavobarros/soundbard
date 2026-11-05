import { cn } from "cn";
import {
  ListMusic,
  Music2,
  Pause,
  Pencil,
  Play,
  Plus,
  SkipBack,
  SkipForward,
  Trash2,
  Volume2,
} from "lucide-react";
import type { ChangeEvent } from "react";
import { useCallback } from "react";
import type { Playlist } from "../lib/model";
import type { WorkspaceState } from "./application";
import { SoundRow } from "./library-view";
import { Button } from "./ui/button";

function duration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function musicToggleLabel(
  playback: WorkspaceState["playback"],
  hasMusic: boolean
): string {
  if (!hasMusic) {
    return "Iniciar playlist";
  }
  return playback.paused ? "Retomar música" : "Pausar música";
}

export function MusicPanel({ state }: { state: WorkspaceState }) {
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
    <section className="min-w-0 rounded-[14px] bg-[var(--surface)] p-4 shadow-[var(--shadow-raised)] sm:p-5 md:p-6">
      <div className="[&>h2_svg]:text-muted-foreground mb-5 flex items-center justify-between gap-2.5 sm:gap-3.5 [&>h2]:flex [&>h2]:items-center [&>h2]:gap-2 [&>h2]:text-base sm:[&>h2]:text-lg [&>select]:max-w-[160px] [&>select]:text-xs">
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
      <div className="my-5 flex min-w-0 items-center gap-3 sm:my-6 sm:gap-4">
        <div
          className={cn(
            "text-muted-foreground grid size-16 shrink-0 place-items-center rounded-full border-[9px] border-[var(--surface-inset)] bg-[var(--surface)] shadow-[var(--shadow-inset)] sm:size-[76px] sm:border-[12px]",
            music && !playback.paused && "animate-spin [animation-duration:14s]"
          )}
        >
          <Music2 size={30} />
        </div>
        <div className="min-w-0 flex-1">
          <span className="text-muted-foreground text-xs">
            {activePlaylist?.name ?? "Nenhuma playlist selecionada"}
          </span>
          <h3 className="my-1 truncate text-base leading-snug sm:text-lg">
            {music?.name ?? "A trilha está em suas mãos"}
          </h3>
          <p className="text-muted-foreground text-xs leading-relaxed">
            {music
              ? "Reproduzindo da sua biblioteca"
              : "Crie uma playlist com as músicas da campanha."}
          </p>
        </div>
      </div>
      <div className="mb-4 [&>input]:w-full">
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
        <div className="text-muted-foreground flex justify-between text-xs tabular-nums">
          <span>{duration(currentMusic?.time ?? 0)}</span>
          <span>{duration(currentMusic?.duration ?? 0)}</span>
        </div>
      </div>
      <div className="mt-5 flex items-center justify-center gap-3.5">
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
          className="size-11 rounded-full"
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
        <label className="text-muted-foreground ml-auto flex items-center gap-2.5">
          <Volume2 size={16} />
          <span className="sr-only">Volume da música</span>
          <input
            className="w-20 sm:w-28"
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
        <Button
          className="mt-4 flex items-center gap-2"
          onClick={create}
          variant="ghost"
        >
          <Plus size={16} /> Criar primeira playlist
        </Button>
      ) : null}
    </section>
  );
}

export function PlaylistTab({
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
      className={cn(
        "text-muted-foreground flex max-w-full items-center gap-3.5 rounded-lg border border-transparent bg-[var(--surface)] px-4 py-2.5 text-xs shadow-[var(--shadow-raised)] transition-colors hover:bg-[var(--surface-hover)] sm:text-sm",
        shownPlaylist?.id === playlist.id &&
          "border-border text-foreground bg-[var(--selected)]"
      )}
      onClick={select}
      type="button"
    >
      <span>{playlist.name}</span>
      <span className="text-muted-foreground text-xs">
        {playlist.soundIds.length}
      </span>
    </button>
  );
}

export function PlaylistDetail({
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
    <div className="min-w-0">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold sm:text-xl">{playlist.name}</h2>
          <p className="text-muted-foreground text-xs sm:text-[13px]">
            {playlist.soundIds.length} músicas ·{" "}
            {playlist.shuffle ? "Embaralhada" : "Ordem escolhida"}
          </p>
        </div>
        <div className="flex items-center gap-2">
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
      <div className="text-muted-foreground flex items-center gap-3.5 pb-4 text-xs sm:gap-7 sm:text-[13px]">
        <label className="flex cursor-pointer items-center gap-2">
          <input
            checked={playlist.shuffle}
            onChange={shuffle}
            type="checkbox"
          />
          Ordem aleatória
        </label>
        <label className="flex items-center gap-2">
          Repetição
          <select onChange={repeat} value={playlist.repeat}>
            <option value="off">Sem repetição</option>
            <option value="one">Repetir atual</option>
            <option value="all">Repetir playlist</option>
          </select>
        </label>
      </div>
      <div className="border-border divide-border divide-y border-t">
        {playlist.soundIds.map((soundId) => {
          const sound = soundById.get(soundId);
          return sound ? (
            <SoundRow key={sound.id} sound={sound} state={state} />
          ) : null;
        })}
      </div>
    </div>
  );
}

export function PlaylistsView({ state }: { state: WorkspaceState }) {
  const { library, shownPlaylist, openPlaylist } = state;
  const create = useCallback(() => openPlaylist(), [openPlaylist]);
  return (
    <section className="min-w-0">
      <div className="mb-6 flex flex-wrap gap-2">
        {library.playlists.map((playlist) => (
          <PlaylistTab key={playlist.id} playlist={playlist} state={state} />
        ))}
      </div>
      {shownPlaylist ? (
        <PlaylistDetail playlist={shownPlaylist} state={state} />
      ) : (
        <div className="text-muted-foreground [&>h2]:text-foreground flex flex-col items-center justify-center gap-3 p-8 text-center [&>h2]:text-lg [&>h2]:font-semibold [&>p]:max-w-[50ch] [&>p]:text-sm">
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
