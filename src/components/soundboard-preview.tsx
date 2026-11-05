import { cn } from "cn";
import {
  ListMusic,
  Pause,
  Play,
  Repeat2,
  Settings2,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Square,
  Waves,
} from "lucide-react";
import {
  type CSSProperties,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  loadPreviewPadGroups,
  type PreviewPadGroup,
  savePreviewPadGroups,
} from "../lib/preview-pad-groups";
import { CreatePadGroupDialog } from "./create-pad-group-dialog";
import { PreviewNavigation } from "./preview-navigation";
import { Button } from "./ui/button";
import { Carousel, CarouselContent, CarouselItem } from "./ui/carousel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Slider } from "./ui/slider";

export interface PreviewPad {
  id: string;
  kind: "music" | "ambience" | "effect" | "playlist";
  loop?: boolean;
  name: string;
  playlistData?: { name: string; tracks: string[] };
  playlistId?: string;
}
export interface Playback {
  hits: number;
  status: "idle" | "playing" | "paused";
  track: number;
  volume: number;
}
const playlists = [
  {
    id: "night",
    name: "Viagem noturna",
    tracks: [
      "Brumas da estrada",
      "Entre as árvores",
      "Caminho antigo",
      "Sob as estrelas",
    ],
  },
  {
    id: "combat",
    name: "Confronto",
    tracks: ["À espreita", "Ataque surpresa", "Último duelo"],
  },
];
const initialPads: PreviewPad[] = [
  { id: "fire", kind: "ambience", name: "Lareira" },
  { id: "talk", kind: "ambience", name: "Conversas" },
  { id: "rain", kind: "ambience", name: "Chuva no telhado" },
  {
    id: "walk",
    kind: "playlist",
    name: "Caminhada à noite",
    playlistId: "night",
  },
  { id: "door", kind: "effect", name: "Porta" },
  { id: "mugs", kind: "effect", name: "Canecas" },
  { id: "steps", kind: "effect", name: "Passos na madeira" },
  { id: "laugh", kind: "effect", name: "Risadas" },
  { id: "sword", kind: "effect", name: "Espada" },
  { id: "coins", kind: "effect", name: "Moedas" },
  { id: "chair", kind: "effect", name: "Cadeira" },
  { id: "shout", kind: "effect", name: "Grito" },
  { id: "thunder", kind: "effect", name: "Trovão" },
  { id: "glass", kind: "effect", name: "Vidro" },
  { id: "bell", kind: "effect", name: "Sino" },
  { id: "whisper", kind: "effect", name: "Sussurro" },
];
const initialPadIds = initialPads.map((pad) => pad.id);
const scenes = [
  {
    id: "tavern",
    name: "Taverna",
    padIds: initialPadIds,
    type: "locations" as const,
  },
  {
    id: "forest",
    name: "Floresta",
    padIds: ["rain", "walk", "thunder", "whisper"],
    type: "locations" as const,
  },
  {
    id: "merchant",
    name: "Mercador",
    padIds: ["talk", "coins", "laugh", "whisper"],
    type: "characters" as const,
  },
  {
    id: "ambush",
    name: "Emboscada",
    padIds: ["sword", "shout", "thunder"],
    type: "combat" as const,
  },
];
const effectTitles: Record<string, string> = {
  "effects:all": "Efeitos",
  "effects:ambience": "Ambiente",
  "effects:effect": "Efeitos pontuais",
};

function loadGroups() {
  try {
    return loadPreviewPadGroups(localStorage, initialPadIds);
  } catch {
    return [];
  }
}
const freeCarousel = {
  align: "start" as const,
  containScroll: "keepSnaps" as const,
  dragFree: true,
};
const statusLabels = { idle: "Pronto", paused: "Pausado", playing: "Tocando" };
const kindLabels = {
  ambience: "Ambiente · Loop",
  effect: "Efeito",
  music: "Música",
  playlist: "Playlist",
};
const playbackActions = {
  idle: "Tocar pad",
  paused: "Retomar pad",
  playing: "Pausar pad",
};
const controlButton =
  "pad-surface size-[44px] border text-foreground focus-visible:outline-ring!";

function initialPlayback(): Record<string, Playback> {
  return Object.fromEntries(
    initialPads.map((pad) => [
      pad.id,
      {
        hits: pad.id === "sword" ? 3 : 0,
        status: pad.id === "fire" || pad.id === "sword" ? "playing" : "idle",
        track: 0,
        volume: 65,
      },
    ])
  );
}

function usePadLayout() {
  const ref = useRef<HTMLElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState({
    columns: 2,
    rows: 2,
    size: 120,
  });
  useLayoutEffect(() => {
    const viewport = ref.current?.querySelector<HTMLElement>(
      '[data-slot="carousel-content"]'
    );
    const grid = gridRef.current;
    if (!(viewport && grid)) {
      return;
    }
    const update = () => {
      const height = viewport.clientHeight;
      const size = grid.firstElementChild?.getBoundingClientRect().width;
      if (!(size && height)) {
        return;
      }
      // O CSS Grid define as tracks; esta leitura só agrupa os slides do Embla.
      const columns =
        getComputedStyle(grid).gridTemplateColumns.split(" ").length;
      const rows = Math.max(1, Math.floor((height + 10) / (size + 10)));
      setLayout((current) =>
        current.columns === columns &&
        current.rows === rows &&
        current.size === size
          ? current
          : { columns, rows, size }
      );
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);
  return { gridRef, layout, ref };
}

function arrangePads(pads: PreviewPad[], columns: number, rows: number) {
  const result: PreviewPad[][] = [];
  const capacity = columns * rows;
  for (let start = 0; start < pads.length; start += capacity) {
    for (
      let column = 0;
      column < columns && start + column < pads.length;
      column += 1
    ) {
      const items: PreviewPad[] = [];
      for (let row = 0; row < rows; row += 1) {
        const pad = pads[start + row * columns + column];
        if (pad) {
          items.push(pad);
        }
      }
      result.push(items);
    }
  }
  return result;
}

function Pad({
  pad,
  playback,
  selected,
  onTrigger,
  onSelect,
}: {
  pad: PreviewPad;
  playback: Playback;
  selected: boolean;
  onTrigger: (id: string) => void;
  onSelect: (id: string) => void;
}) {
  const trigger = useCallback(() => onTrigger(pad.id), [onTrigger, pad.id]);
  const select = useCallback(() => onSelect(pad.id), [onSelect, pad.id]);
  const playlist =
    pad.playlistData ?? playlists.find((item) => item.id === pad.playlistId);
  const PadIcon = pad.kind === "playlist" ? ListMusic : Waves;
  const kindLabel =
    pad.kind === "ambience" && pad.loop === false
      ? "Ambiente"
      : kindLabels[pad.kind];
  const sourceLabel = playlist ? `Playlist · ${playlist.name}` : kindLabel;
  return (
    <div className="relative aspect-square h-[var(--pad-size)] w-full min-w-0">
      <Button
        aria-pressed={playback.status === "playing"}
        className={cn(
          "border-border hover:border-b-primary focus-visible:outline-ring! size-full min-w-0 flex-col items-stretch justify-between overflow-hidden rounded-[5px] border border-b-[3px] border-b-[var(--border-strong)] bg-[var(--surface-inset)] p-[10px] text-left whitespace-normal shadow-none transition-colors hover:bg-[var(--surface-hover)]",
          selected && "border-primary",
          playback.status === "playing" &&
            "border-b-[var(--playback)] bg-[var(--selected)] hover:border-b-[var(--playback)]"
        )}
        onClick={trigger}
        variant="ghost"
      >
        <span
          className={cn(
            "text-muted-foreground flex items-center gap-2 pr-[34px] text-[11px] font-normal",
            playback.status === "playing" && "text-[var(--playback)]"
          )}
        >
          <PadIcon aria-hidden="true" className="size-[15px]" />
          <span>{statusLabels[playback.status]}</span>
        </span>
        <span className="block min-w-0">
          <span className="block text-[14px] leading-tight font-semibold">
            {pad.name}
          </span>
          <span className="text-muted-foreground mt-1 block truncate text-[11px] font-normal">
            {sourceLabel}
          </span>
          {Boolean(playlist) && (
            <span className="text-muted-foreground mt-1 block truncate text-[11px] font-normal">
              {playback.status === "idle"
                ? `${playlist?.tracks.length} músicas`
                : playlist?.tracks[playback.track]}
            </span>
          )}
        </span>
      </Button>
      <Button
        aria-label={`Controlar ${pad.name}`}
        className="text-muted-foreground hover:bg-secondary hover:text-foreground absolute top-0 right-0 size-[44px] rounded-[3px] bg-transparent p-2"
        onClick={select}
        size="icon"
        title={`Controlar ${pad.name} sem interromper a reprodução`}
        variant="ghost"
      >
        <SlidersHorizontal aria-hidden="true" className="size-[14px]" />
      </Button>
    </div>
  );
}

export function PadBoard({
  pads,
  playback,
  selected,
  onTrigger,
  onSelect,
  title,
}: {
  pads: PreviewPad[];
  playback: Record<string, Playback>;
  selected: string;
  onTrigger: (id: string) => void;
  onSelect: (id: string) => void;
  title: string;
}) {
  const { gridRef, layout, ref } = usePadLayout();
  const columns = arrangePads(pads, layout.columns, layout.rows);
  const style: CSSProperties & {
    "--pad-size": string;
    "--pad-rows": number;
  } = {
    "--pad-rows": layout.rows,
    "--pad-size": `${layout.size}px`,
  };
  return (
    <section
      aria-label={`Pads de ${title}`}
      className="flex min-h-0 flex-1 flex-col gap-2"
    >
      <div className="flex h-[26px] shrink-0 items-center justify-between gap-3">
        <h1
          className="min-w-0 truncate text-[18px]! font-semibold! tracking-normal!"
          title={title}
        >
          {title}
        </h1>
        <p className="text-muted-foreground shrink-0 text-[11px]">
          {pads.length} pads · sons e playlists
        </p>
      </div>
      <Carousel
        aria-description="Arraste livremente ou use as setas do teclado. O botão de controles seleciona um pad sem interrompê-lo."
        aria-label="Arraste os pads para explorar"
        className="flex min-h-0 flex-1 flex-col [&>[data-slot=carousel-content]]:min-h-0 [&>[data-slot=carousel-content]]:flex-1 [&>[data-slot=carousel-content]]:cursor-grab [&>[data-slot=carousel-content]]:touch-pan-y [&>[data-slot=carousel-content]]:touch-pinch-zoom"
        opts={freeCarousel}
        ref={ref}
        style={style}
        tabIndex={0}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none invisible absolute inset-0 grid grid-cols-[repeat(auto-fill,minmax(min(100%,120px),1fr))] content-start gap-[10px]"
          ref={gridRef}
        >
          <div className="aspect-square min-w-0" />
        </div>
        <CarouselContent className="ml-0 h-full items-start gap-[10px]">
          {columns.map((column) => (
            <CarouselItem
              className="grid basis-[var(--pad-size)] grid-rows-[repeat(var(--pad-rows),var(--pad-size))] gap-[10px] pl-0"
              key={column[0].id}
            >
              {column.map((pad) => (
                <Pad
                  key={pad.id}
                  onSelect={onSelect}
                  onTrigger={onTrigger}
                  pad={pad}
                  playback={playback[pad.id]}
                  selected={selected === pad.id}
                />
              ))}
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
    </section>
  );
}

function VolumeControl({
  label,
  value,
  onChange,
  onCommit,
}: {
  label: string;
  value: number;
  onChange: (values: number[]) => void;
  onCommit?: (values: number[]) => void;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-2 text-[11px] font-semibold">
        <span>{label}</span>
        <output className="tabular-nums">{value}%</output>
      </div>
      <Slider
        aria-label={label}
        className="h-[28px] [&_[data-slot=slider-range]]:bg-[#151517] [&_[data-slot=slider-thumb]]:border-[#151517] [&_[data-slot=slider-thumb]]:bg-[#f7f7f7] [&_[data-slot=slider-track]]:bg-[#151517]"
        onValueChange={onChange}
        onValueCommit={onCommit}
        value={[value]}
      />
    </div>
  );
}

function PadPreviousControl({
  playlist,
  onPrevious,
  onLoop,
  loop,
}: {
  playlist: boolean;
  onPrevious: () => void;
  onLoop?: () => void;
  loop?: boolean;
}) {
  const showLoop = !playlist && Boolean(onLoop);
  return (
    <Button
      aria-label={showLoop ? "Loop do pad" : "Música anterior"}
      aria-pressed={showLoop ? Boolean(loop) : undefined}
      className={cn(controlButton, showLoop && loop && "text-primary")}
      disabled={!(playlist || onLoop)}
      onClick={showLoop ? onLoop : onPrevious}
      size="icon"
      variant="ghost"
    >
      {showLoop ? (
        <Repeat2 aria-hidden="true" />
      ) : (
        <SkipBack aria-hidden="true" />
      )}
    </Button>
  );
}

function PadNextControl({
  playlist,
  onNext,
  onEdit,
}: {
  playlist: boolean;
  onNext: () => void;
  onEdit?: () => void;
}) {
  const showEdit = !playlist && Boolean(onEdit);
  return (
    <Button
      aria-label={showEdit ? "Editar pad" : "Próxima música"}
      className={controlButton}
      disabled={!(playlist || onEdit)}
      onClick={showEdit ? onEdit : onNext}
      size="icon"
      variant="ghost"
    >
      {showEdit ? (
        <Settings2 aria-hidden="true" />
      ) : (
        <SkipForward aria-hidden="true" />
      )}
    </Button>
  );
}

export function PadControls({
  pad,
  playback,
  master,
  onToggle,
  onStop,
  onPrevious,
  onNext,
  onVolume,
  onMaster,
  onVolumeCommit,
  onMasterCommit,
  onLoop,
  onEdit,
}: {
  pad: PreviewPad;
  playback: Playback;
  master: number;
  onToggle: () => void;
  onStop: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onVolume?: (values: number[]) => void;
  onMaster: (values: number[]) => void;
  onVolumeCommit?: (values: number[]) => void;
  onMasterCommit?: (values: number[]) => void;
  onLoop?: () => void;
  onEdit?: () => void;
}) {
  const playlist =
    pad.playlistData ?? playlists.find((item) => item.id === pad.playlistId);
  const playing = playback.status === "playing";
  const action = playbackActions[playback.status];
  let detail = `${playback.hits} disparos`;
  if (pad.kind === "ambience") {
    detail = pad.loop === false ? "Ambiente" : "Ambiente em loop";
  } else if (pad.kind === "music") {
    detail = "Música";
  }
  if (playlist) {
    detail = `${playlist.name} · ${playlist.tracks[playback.track]}`;
  }
  return (
    <section
      aria-label="Controles do pad"
      className="pad-surface flex shrink-0 flex-wrap items-center gap-x-4 gap-y-3 border p-3 md:p-4"
    >
      <div className="min-w-0 flex-[1_1_70px]">
        <div className="flex items-center gap-2">
          <h2
            className="min-w-0 truncate text-[14px]! font-extrabold! uppercase"
            title={pad.name}
          >
            {pad.name}
          </h2>
          <span className="text-muted-foreground shrink-0 text-[11px]">
            {statusLabels[playback.status]}
          </span>
        </div>
        <p className="text-muted-foreground mt-1 truncate text-[11px] font-semibold">
          {detail}
        </p>
      </div>
      <div className="flex shrink-0 justify-end gap-1">
        <PadPreviousControl
          loop={pad.loop}
          onLoop={onLoop}
          onPrevious={onPrevious}
          playlist={Boolean(playlist)}
        />
        <Button
          aria-label={action}
          className={cn(controlButton, playing && "text-primary")}
          onClick={onToggle}
          size="icon"
          variant="ghost"
        >
          {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
        </Button>
        <Button
          aria-label="Parar pad"
          className={controlButton}
          onClick={onStop}
          size="icon"
          variant="ghost"
        >
          <Square aria-hidden="true" />
        </Button>
        <PadNextControl
          onEdit={onEdit}
          onNext={onNext}
          playlist={Boolean(playlist)}
        />
      </div>
      <div
        className={
          onVolume
            ? "grid min-w-[220px] flex-[2_1_220px] grid-cols-2 gap-4"
            : "min-w-[140px] flex-[1_1_160px]"
        }
      >
        {onVolume ? (
          <VolumeControl
            label="Volume do pad"
            onChange={onVolume}
            onCommit={onVolumeCommit}
            value={playback.volume}
          />
        ) : null}
        <VolumeControl
          label="Volume geral"
          onChange={onMaster}
          onCommit={onMasterCommit}
          value={master}
        />
      </div>
    </section>
  );
}

function CustomizePad({
  pad,
  onSave,
}: {
  pad: PreviewPad;
  onSave: (name: string, source: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [source, setSource] = useState("night");
  const changeOpen = useCallback(
    (next: boolean) => {
      if (next) {
        setName(pad.name);
        setSource(pad.playlistId ?? "fire");
      }
      setOpen(next);
    },
    [pad]
  );
  const chooseSource = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) =>
      setSource(event.currentTarget.value),
    []
  );
  const changeName = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) =>
      setName(event.currentTarget.value),
    []
  );
  const save = useCallback(
    (event: React.SubmitEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!name.trim()) {
        return;
      }
      onSave(name.trim(), source);
      setOpen(false);
    },
    [name, onSave, source]
  );
  return (
    <Dialog onOpenChange={changeOpen} open={open}>
      <DialogTrigger asChild>
        <Button
          aria-label="Personalizar pad"
          className="border-border h-[44px] rounded-[4px] bg-transparent px-[10px] shadow-none"
          variant="outline"
        >
          <Settings2 aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent className="border-border text-foreground max-h-[90dvh] overflow-y-auto bg-[var(--surface)] sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Personalizar pad</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Escolha o nome e o conteúdo deste pad. Alterações demonstrativas,
            sem áudio ou gravação na biblioteca.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={save}>
          <div className="grid gap-2">
            <Label htmlFor="preview-pad-name">Nome do pad</Label>
            <Input
              className="border-border bg-[var(--surface-inset)] text-[16px]"
              id="preview-pad-name"
              onChange={changeName}
              required
              value={name}
            />
          </div>
          <fieldset className="grid gap-2">
            <legend className="mb-2 text-[13px]">Som ou playlist</legend>
            {[
              { id: "night", label: "Playlist Viagem noturna" },
              { id: "combat", label: "Playlist Confronto" },
              { id: "fire", label: "Som Lareira" },
            ].map((option) => (
              <Button
                aria-pressed={source === option.id}
                className={cn(
                  "border-border text-foreground justify-start rounded-[4px] bg-[var(--surface-inset)] shadow-none",
                  source === option.id && "border-white"
                )}
                key={option.id}
                onClick={chooseSource}
                type="button"
                value={option.id}
                variant="outline"
              >
                {option.label}
              </Button>
            ))}
          </fieldset>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            type="submit"
          >
            Salvar pad
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function SoundboardPreview() {
  const [pads, setPads] = useState(initialPads);
  const [playback, setPlayback] = useState(initialPlayback);
  const [selectedId, setSelectedId] = useState("walk");
  const [master, setMaster] = useState(78);
  const [announcement, setAnnouncement] = useState("");
  const [groups, setGroups] = useState<PreviewPadGroup[]>(loadGroups);
  const [groupEditorOpen, setGroupEditorOpen] = useState(false);
  const [view, setView] = useState("scene:tavern");
  const scene = scenes.find((item) => view === `scene:${item.id}`);
  const group = groups.find((item) => view === `group:${item.id}`);
  const title = scene?.name ?? group?.name ?? effectTitles[view] ?? "Pads";
  const visiblePads = pads.filter((pad) => {
    if (scene) {
      return scene.padIds.includes(pad.id);
    }
    if (group) {
      return group.padIds.includes(pad.id);
    }
    if (view === "effects:ambience") {
      return pad.kind === "ambience";
    }
    if (view === "effects:effect") {
      return pad.kind === "effect";
    }
    return pad.kind !== "playlist";
  });
  const selectScene = useCallback((id: string) => setView(`scene:${id}`), []);
  const selectEffects = useCallback(
    (kind: "all" | "ambience" | "effect") => setView(`effects:${kind}`),
    []
  );
  const selectGroup = useCallback((id: string) => setView(`group:${id}`), []);
  const openGroupEditor = useCallback(() => setGroupEditorOpen(true), []);
  const saveGroup = useCallback(
    (name: string, padIds: string[]) => {
      const created = { id: crypto.randomUUID(), name, padIds };
      const next = [...groups, created];
      try {
        if (!savePreviewPadGroups(localStorage, next)) {
          return false;
        }
      } catch {
        return false;
      }
      setGroups(next);
      setView(`group:${created.id}`);
      return true;
    },
    [groups]
  );
  const selected = pads.find((pad) => pad.id === selectedId) ?? pads[0];
  const current = playback[selected.id];
  const playlist = playlists.find((item) => item.id === selected.playlistId);
  const trigger = useCallback(
    (id: string) => {
      setSelectedId(id);
      setPlayback((states) => {
        const previous = states[id];
        const effect = pads.find((pad) => pad.id === id)?.kind === "effect";
        return {
          ...states,
          [id]: {
            ...previous,
            hits: previous.hits + (effect ? 1 : 0),
            status:
              effect || previous.status !== "playing" ? "playing" : "paused",
          },
        };
      });
    },
    [pads]
  );
  const toggleSelected = useCallback(
    () =>
      setPlayback((states) => ({
        ...states,
        [selectedId]: {
          ...states[selectedId],
          status:
            states[selectedId].status === "playing" ? "paused" : "playing",
        },
      })),
    [selectedId]
  );
  const stopSelected = useCallback(
    () =>
      setPlayback((states) => ({
        ...states,
        [selectedId]: {
          ...states[selectedId],
          hits: 0,
          status: "idle",
          track: 0,
        },
      })),
    [selectedId]
  );
  const moveTrack = useCallback(
    (direction: number) => {
      if (!playlist) {
        return;
      }
      setPlayback((states) => ({
        ...states,
        [selectedId]: {
          ...states[selectedId],
          track:
            (states[selectedId].track + direction + playlist.tracks.length) %
            playlist.tracks.length,
        },
      }));
    },
    [playlist, selectedId]
  );
  const nextTrack = useCallback(() => moveTrack(1), [moveTrack]);
  const previousTrack = useCallback(() => moveTrack(-1), [moveTrack]);
  const changeVolume = useCallback(
    ([volume]: number[]) =>
      setPlayback((states) => ({
        ...states,
        [selectedId]: { ...states[selectedId], volume },
      })),
    [selectedId]
  );
  const changeMaster = useCallback(([value]: number[]) => setMaster(value), []);
  const stopAll = useCallback(() => {
    setPlayback((states) =>
      Object.fromEntries(
        Object.entries(states).map(([id, state]) => [
          id,
          { ...state, hits: 0, status: "idle", track: 0 },
        ])
      )
    );
    setAnnouncement("Todos os pads foram parados na prévia visual.");
  }, []);
  const savePad = useCallback(
    (name: string, source: string) => {
      const assigned = playlists.find((item) => item.id === source);
      setPads((items) =>
        items.map((pad) =>
          pad.id === selectedId
            ? {
                ...pad,
                kind: assigned ? "playlist" : "ambience",
                name,
                playlistId: assigned?.id,
              }
            : pad
        )
      );
      setPlayback((states) => ({
        ...states,
        [selectedId]: {
          ...states[selectedId],
          hits: 0,
          status: "idle",
          track: 0,
        },
      }));
    },
    [selectedId]
  );
  return (
    <div
      className="bg-background text-foreground fixed inset-0 z-10"
      data-soundboard-preview
    >
      <div className="mx-auto flex h-dvh max-w-[1300px] flex-col gap-2 overflow-hidden px-[12px] pt-[calc(10px+env(safe-area-inset-top))] pb-[calc(8px+env(safe-area-inset-bottom))]">
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <header className="flex h-[44px] flex-[1_1_210px] items-center justify-between gap-3">
            <div>
              <p className="text-[21px] font-bold tracking-[-0.03em]">
                soundbard
              </p>
              <p className="text-muted-foreground text-[11px]">
                Prévia visual · sem áudio
              </p>
            </div>
            <div className="flex gap-2">
              <CustomizePad onSave={savePad} pad={selected} />
              <Button
                aria-label="Parar tudo"
                className="border-border text-destructive h-[44px] rounded-[4px] bg-transparent px-[10px] shadow-none"
                onClick={stopAll}
                variant="outline"
              >
                <Square aria-hidden="true" />
              </Button>
            </div>
          </header>
          <PreviewNavigation
            groups={groups}
            onCreateGroup={openGroupEditor}
            onEffects={selectEffects}
            onGroup={selectGroup}
            onScene={selectScene}
            scenes={scenes}
            selected={view}
          />
        </div>
        <PadBoard
          onSelect={setSelectedId}
          onTrigger={trigger}
          pads={visiblePads}
          playback={playback}
          selected={selectedId}
          title={title}
        />
        <PadControls
          master={master}
          onMaster={changeMaster}
          onNext={nextTrack}
          onPrevious={previousTrack}
          onStop={stopSelected}
          onToggle={toggleSelected}
          onVolume={changeVolume}
          pad={selected}
          playback={current}
        />
        <p className="sr-only" role="status">
          {announcement}
        </p>
        {groupEditorOpen === true && (
          <CreatePadGroupDialog
            onOpenChange={setGroupEditorOpen}
            onSave={saveGroup}
            pads={pads}
          />
        )}
      </div>
    </div>
  );
}
