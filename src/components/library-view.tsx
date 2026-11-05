import { cn } from "cn";
import {
  ArrowDown,
  ArrowUp,
  BookAudio,
  Play,
  Search,
  Settings2,
  Square,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import type { ChangeEvent } from "react";
import { useCallback } from "react";
import type { Playlist, Sound } from "../lib/model";
import { duration } from "../lib/utils";
import type { WorkspaceState } from "./application";
import { kindNames } from "./editors";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

export function SoundRow({
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
    <div
      className={cn(
        "border-border flex min-w-0 items-center gap-2 border-b px-0 py-3.5 transition-colors sm:gap-3.5 sm:px-2.5",
        playing && "bg-[var(--selected)]"
      )}
    >
      <button
        aria-label={`Tocar ${sound.name}`}
        className="grid size-11 shrink-0 place-items-center rounded-[10px] bg-[var(--surface-raised)] text-[var(--playback)] shadow-[var(--shadow-raised)]"
        onClick={play}
        type="button"
      >
        {playing && sound.kind === "ambience" ? (
          <Square size={15} />
        ) : (
          <Play size={17} />
        )}
      </button>
      <div className="[&>span]:text-muted-foreground min-w-0 flex-1 [&>span]:mt-1 [&>span]:block [&>span]:truncate [&>span]:text-[11px] [&>strong]:block [&>strong]:truncate [&>strong]:text-[13px] [&>strong]:font-[550] sm:[&>strong]:text-sm">
        <strong>{sound.name}</strong>
        <span>
          {sound.tags.length ? sound.tags.join(" · ") : kindNames[sound.kind]}
        </span>
      </div>
      <span className="text-muted-foreground hidden w-[70px] text-xs sm:block">
        {kindNames[sound.kind]}
      </span>
      <span className="text-muted-foreground w-[33px] text-[11px] tabular-nums sm:w-[42px] sm:text-xs">
        {duration(sound.duration)}
      </span>
      <div className="flex items-center gap-1.5 sm:gap-2">
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
    </div>
  );
}

export function LibraryView({ state }: { state: WorkspaceState }) {
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
    <section className="min-w-0">
      <div className="flex flex-wrap items-center gap-2 pt-0.5 pb-6 sm:flex-nowrap sm:gap-4 [&>select]:flex-1 sm:[&>select]:flex-none">
        <div className="[&>svg]:text-muted-foreground relative flex max-w-none flex-1 basis-full items-center sm:max-w-[460px] sm:basis-auto [&>input]:h-11 [&>input]:pl-10 [&>svg]:absolute [&>svg]:left-3">
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
        <span className="text-muted-foreground ml-auto text-xs whitespace-nowrap sm:text-sm">
          {filteredSounds.length} sons
        </span>
      </div>
      {filteredSounds.map((sound) => (
        <SoundRow key={sound.id} sound={sound} state={state} />
      ))}
      {filteredSounds.length === 0 ? (
        <div className="large-empty text-muted-foreground [&>h2]:text-foreground flex min-h-[340px] flex-col items-center justify-center gap-4 px-8 py-16 text-center [&>h2]:text-xl [&>h2]:font-semibold [&>p]:max-w-[51ch] [&>p]:text-sm [&>p]:leading-relaxed">
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
