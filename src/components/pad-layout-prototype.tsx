// Três estudos de pads na rota /previa?estudo=pads&variant=A|B|C; estado apenas em memória.
import { cn } from "cn";
import {
  ArrowLeft,
  ArrowRight,
  AudioLines,
  CloudRain,
  DoorOpen,
  Flame,
  Footprints,
  ListMusic,
  Pause,
  Play,
  SlidersHorizontal,
  Square,
  Swords,
  Users,
  Wind,
} from "lucide-react";
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { PreviewNavigation } from "./preview-navigation";
import {
  PadControls,
  type Playback,
  type PreviewPad,
} from "./soundboard-preview";
import { Button } from "./ui/button";
import { Carousel, CarouselContent, CarouselItem } from "./ui/carousel";

export type PadLayoutVariant = "A" | "B" | "C";
interface DemoPad extends PreviewPad {
  icon: typeof Flame;
}
interface PadProps {
  compact: boolean;
  index: number;
  onSelect: (id: string) => void;
  onStop: (id: string) => void;
  onTrigger: (id: string) => void;
  pad: DemoPad;
  selected: boolean;
  state: Playback;
}
const pads: DemoPad[] = [
  { icon: Flame, id: "fire", kind: "ambience", loop: true, name: "Lareira" },
  { icon: Users, id: "talk", kind: "ambience", loop: true, name: "Conversas" },
  {
    icon: CloudRain,
    id: "rain",
    kind: "ambience",
    loop: true,
    name: "Chuva no telhado",
  },
  {
    icon: ListMusic,
    id: "walk",
    kind: "playlist",
    name: "Caminhada à noite",
    playlistData: {
      name: "Viagem noturna",
      tracks: ["Brumas da estrada", "Entre as árvores", "Sob as estrelas"],
    },
    playlistId: "night",
  },
  { icon: DoorOpen, id: "door", kind: "effect", name: "Porta" },
  { icon: Footprints, id: "steps", kind: "effect", name: "Passos na madeira" },
  { icon: Swords, id: "sword", kind: "effect", name: "Espada" },
  { icon: Wind, id: "wind", kind: "ambience", loop: true, name: "Vento" },
  { icon: Users, id: "laugh", kind: "effect", name: "Risadas" },
  { icon: AudioLines, id: "mugs", kind: "effect", name: "Canecas" },
  { icon: AudioLines, id: "coins", kind: "effect", name: "Moedas" },
  { icon: CloudRain, id: "thunder", kind: "effect", name: "Trovão" },
];
const scenes = [
  { id: "tavern", name: "Taverna", type: "locations" as const },
  { id: "merchant", name: "Mercador", type: "characters" as const },
  { id: "ambush", name: "Emboscada", type: "combat" as const },
];
const names = {
  A: "Nome central",
  B: "Ícone e acionamento",
  C: "Canal e transporte",
};
const descriptions = {
  A: "O nome ocupa o centro; tocar no quadrado aciona o pad.",
  B: "Ícone em destaque, nome no rodapé e reprodução no canto.",
  C: "Identificação no topo; tocar e parar são ações separadas.",
};
const statuses = { idle: "Pronto", paused: "Pausado", playing: "Tocando" };
const kinds = {
  ambience: "Ambiente",
  effect: "Efeito",
  music: "Música",
  playlist: "Playlist",
};
const variants: PadLayoutVariant[] = ["A", "B", "C"];
const ignoredArrowTarget =
  "input,textarea,select,[contenteditable],[role=slider],[role=menu],[role=menuitem],[role=menuitemradio]";
const carouselOptions = {
  align: "start" as const,
  containScroll: "keepSnaps" as const,
  dragFree: true,
};
const controlClass =
  "size-[44px] rounded-[4px] border border-[#343434] bg-transparent p-0 text-[#b8b8b8] shadow-none hover:border-[#69aeff] hover:bg-[#242424] hover:text-white focus-visible:outline-[#69aeff]!";
const transportClass =
  "size-[44px] border-0 bg-transparent p-0 text-[#b8b8b8] shadow-none hover:bg-transparent hover:text-[#69aeff] focus-visible:ring-1 focus-visible:ring-[#69aeff]";
const padClass =
  "relative aspect-square size-full min-w-0 overflow-hidden rounded-[5px] border border-[#353535] bg-[#191919] text-white shadow-none transition-colors hover:border-[#69aeff] hover:bg-[#1d1d1d] focus-visible:outline-[#69aeff]!";

function initialPlayback(): Record<string, Playback> {
  return Object.fromEntries(
    pads.map((pad) => [
      pad.id,
      {
        hits: 0,
        status: pad.id === "rain" || pad.id === "walk" ? "playing" : "idle",
        track: 0,
        volume: pad.id === "rain" ? 45 : 65,
      },
    ])
  );
}
function usePadActions({ pad, onTrigger, onSelect, onStop }: PadProps) {
  return {
    select: useCallback(() => onSelect(pad.id), [onSelect, pad.id]),
    stop: useCallback(() => onStop(pad.id), [onStop, pad.id]),
    trigger: useCallback(() => onTrigger(pad.id), [onTrigger, pad.id]),
  };
}
function PadState({ state }: { state: Playback }) {
  return (
    <span
      className={cn(
        "flex items-center gap-1.5 text-[10px] font-normal",
        state.status === "playing" ? "text-[#ff8848]" : "text-[#aaa]"
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "size-[5px] rounded-full",
          state.status === "playing" ? "bg-[#ff8848]" : "bg-[#777]"
        )}
      />
      {statuses[state.status]}
    </span>
  );
}
function SelectPad({
  selected,
  pad,
  onClick,
}: {
  selected: boolean;
  pad: DemoPad;
  onClick: () => void;
}) {
  return (
    <Button
      aria-label={`Controlar ${pad.name}`}
      aria-pressed={selected}
      className="absolute top-0 right-0 z-10 size-[44px] rounded-[3px] bg-transparent p-0 text-[#aaa] hover:bg-[#2b2b2b] hover:text-[#69aeff]"
      onClick={onClick}
      size="icon"
      variant="ghost"
    >
      <SlidersHorizontal aria-hidden="true" className="size-[14px]" />
    </Button>
  );
}

export function VariantA(props: PadProps) {
  const { pad, state, selected, compact } = props;
  const { trigger, select } = usePadActions(props);
  return (
    <div
      className="relative aspect-square size-full min-w-0"
      data-prototype-pad={pad.id}
    >
      <Button
        aria-label={`${statuses[state.status]} · ${pad.name}`}
        aria-pressed={state.status === "playing"}
        className={cn(
          padClass,
          "flex-col justify-center gap-2 p-3 text-center whitespace-normal",
          selected && "border-[#999]",
          state.status === "playing" && "border-b-[3px] border-b-[#ff8848]",
          compact && "gap-1 p-1"
        )}
        onClick={trigger}
        variant="ghost"
      >
        <span className="absolute top-2 left-2">
          <PadState state={state} />
        </span>
        <span
          className={cn(
            "block max-w-full text-[16px] leading-tight font-semibold text-balance",
            compact && "text-[12px]"
          )}
        >
          {pad.name}
        </span>
        {!compact && (
          <span className="text-[11px] font-normal text-[#aaa]">
            {kinds[pad.kind]}
          </span>
        )}
      </Button>
      <SelectPad onClick={select} pad={pad} selected={selected} />
    </div>
  );
}

export function VariantB(props: PadProps) {
  const { pad, state, selected, compact } = props;
  const { trigger, select } = usePadActions(props);
  return (
    <div
      className="relative aspect-square size-full min-w-0"
      data-prototype-pad={pad.id}
    >
      <Button
        aria-label={`${statuses[state.status]} · ${pad.name}`}
        aria-pressed={state.status === "playing"}
        className={cn(
          padClass,
          "flex-col items-start justify-between p-3 text-left whitespace-normal",
          selected && "border-[#999]",
          compact && "p-2"
        )}
        onClick={trigger}
        variant="ghost"
      >
        <span className="flex w-full flex-1 items-center justify-between gap-1 pr-6">
          <pad.icon
            aria-hidden="true"
            className={cn(
              "size-[36px] stroke-[1.4] text-[#ddd]",
              compact && "size-[24px]"
            )}
          />
          <span
            className={cn(
              "flex size-[30px] shrink-0 items-center justify-center rounded-full border border-[#444]",
              state.status === "playing" && "border-[#ff8848] text-[#ff8848]",
              compact && "size-[24px]"
            )}
          >
            {state.status === "playing" ? (
              <Pause aria-hidden="true" className="size-[13px]" />
            ) : (
              <Play aria-hidden="true" className="size-[13px]" />
            )}
          </span>
        </span>
        <span className="block w-full min-w-0">
          <span
            className={cn(
              "block text-[14px] leading-tight font-semibold",
              compact && "truncate text-[11px]"
            )}
          >
            {pad.name}
          </span>
          {!compact && (
            <span className="mt-1 flex items-center justify-between gap-1">
              <span className="text-[10px] font-normal text-[#aaa]">
                {kinds[pad.kind]}
              </span>
              <PadState state={state} />
            </span>
          )}
        </span>
      </Button>
      <SelectPad onClick={select} pad={pad} selected={selected} />
    </div>
  );
}

export function VariantC(props: PadProps) {
  const { pad, state, selected, index, compact } = props;
  const { trigger, select, stop } = usePadActions(props);
  return (
    <div
      className={cn(
        padClass,
        "flex flex-col p-2 hover:bg-[#191919]",
        selected && "border-[#999]",
        compact && "p-1"
      )}
      data-prototype-pad={pad.id}
    >
      <button
        aria-label={`Controlar ${pad.name}`}
        aria-pressed={selected}
        className="flex min-h-0 w-full flex-1 flex-col gap-1 text-left"
        onClick={select}
        type="button"
      >
        <span className="flex w-full items-center justify-between gap-1 text-[10px] text-[#aaa]">
          <span className="tabular-nums">
            {String(index + 1).padStart(2, "0")}
          </span>
          {!compact && <PadState state={state} />}
        </span>
        <span
          className={cn(
            "block w-full text-[14px] leading-tight font-semibold",
            compact && "truncate text-[11px]"
          )}
        >
          {pad.name}
        </span>
      </button>
      <div className="mt-1 flex shrink-0 justify-end">
        <Button
          aria-label={`${state.status === "playing" ? "Pausar" : "Tocar"} ${pad.name}`}
          aria-pressed={state.status === "playing"}
          className={cn(
            transportClass,
            state.status === "playing" && "text-[#ff8848]"
          )}
          onClick={trigger}
          size="icon"
          variant="ghost"
        >
          {state.status === "playing" ? (
            <Pause aria-hidden="true" className="size-3.5" strokeWidth={1.5} />
          ) : (
            <Play aria-hidden="true" className="size-3.5" strokeWidth={1.5} />
          )}
        </Button>
        <Button
          aria-label={`Parar ${pad.name}`}
          className={cn(transportClass, "hover:text-[#ff7777]")}
          onClick={stop}
          size="icon"
          variant="ghost"
        >
          <Square aria-hidden="true" className="size-3" strokeWidth={1.5} />
        </Button>
      </div>
    </div>
  );
}
const variantPads = { A: VariantA, B: VariantB, C: VariantC };

function usePrototypeLayout() {
  const ref = useRef<HTMLElement>(null);
  const probe = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState({ columns: 2, rows: 1, size: 120 });
  useLayoutEffect(() => {
    const viewport = ref.current?.querySelector<HTMLElement>(
      '[data-slot="carousel-content"]'
    );
    const grid = probe.current;
    if (!(viewport && grid)) {
      return;
    }
    const update = () => {
      const height = viewport.clientHeight;
      const width = grid.firstElementChild?.getBoundingClientRect().width;
      if (!(height && width)) {
        return;
      }
      const size = Math.min(width, height);
      const columns =
        getComputedStyle(grid).gridTemplateColumns.split(" ").length;
      const rows = Math.max(1, Math.floor((height + 10) / (size + 10)));
      setLayout((previous) =>
        previous.size === size &&
        previous.rows === rows &&
        previous.columns === columns
          ? previous
          : { columns, rows, size }
      );
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);
  return { layout, probe, ref };
}
function padColumns(items: DemoPad[], columns: number, rows: number) {
  const result: DemoPad[][] = [];
  for (let page = 0; page < items.length; page += columns * rows) {
    for (
      let column = 0;
      column < columns && page + column < items.length;
      column += 1
    ) {
      const group: DemoPad[] = [];
      for (let row = 0; row < rows; row += 1) {
        const pad = items[page + row * columns + column];
        if (pad) {
          group.push(pad);
        }
      }
      result.push(group);
    }
  }
  return result;
}
function PrototypeBoard({
  variant,
  items,
  playback,
  selectedId,
  trigger,
  select,
  stop,
}: {
  variant: PadLayoutVariant;
  items: DemoPad[];
  playback: Record<string, Playback>;
  selectedId: string;
  trigger: (id: string) => void;
  select: (id: string) => void;
  stop: (id: string) => void;
}) {
  const { layout, probe, ref } = usePrototypeLayout();
  const groups = padColumns(items, layout.columns, layout.rows);
  const Component = variantPads[variant];
  const style: CSSProperties & {
    "--prototype-pad-size": string;
    "--prototype-rows": number;
  } = {
    "--prototype-pad-size": `${layout.size}px`,
    "--prototype-rows": layout.rows,
  };
  return (
    <Carousel
      aria-label="Arraste os pads do estudo"
      className="relative flex min-h-0 flex-1 flex-col [&>[data-slot=carousel-content]]:min-h-0 [&>[data-slot=carousel-content]]:flex-1"
      opts={carouselOptions}
      ref={ref}
      style={style}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none invisible absolute inset-0 grid grid-cols-[repeat(auto-fill,minmax(min(100%,120px),1fr))] content-start gap-[10px]"
        ref={probe}
      >
        <div className="aspect-square" />
      </div>
      <CarouselContent className="ml-0 h-full items-start gap-[10px]">
        {groups.map((group) => (
          <CarouselItem
            className="grid basis-[var(--prototype-pad-size)] grid-rows-[repeat(var(--prototype-rows),var(--prototype-pad-size))] gap-[10px] pl-0"
            key={group[0].id}
          >
            {group.map((pad) => (
              <Component
                compact={layout.size < 110}
                index={pads.indexOf(pad)}
                key={pad.id}
                onSelect={select}
                onStop={stop}
                onTrigger={trigger}
                pad={pad}
                selected={pad.id === selectedId}
                state={playback[pad.id]}
              />
            ))}
          </CarouselItem>
        ))}
      </CarouselContent>
    </Carousel>
  );
}

function PrototypeSwitcher({
  variant,
  onChange,
}: {
  variant: PadLayoutVariant;
  onChange: (variant: PadLayoutVariant) => void;
}) {
  const move = useCallback(
    (direction: number) =>
      onChange(
        variants[
          (variants.indexOf(variant) + direction + variants.length) %
            variants.length
        ]
      ),
    [onChange, variant]
  );
  const previous = useCallback(() => move(-1), [move]);
  const next = useCallback(() => move(1), [move]);
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      const { target } = event;
      if (
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        (target instanceof Element && target.closest(ignoredArrowTarget))
      ) {
        return;
      }
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        event.stopPropagation();
        move(event.key === "ArrowLeft" ? -1 : 1);
      }
    };
    window.addEventListener("keydown", handle, true);
    return () => window.removeEventListener("keydown", handle, true);
  }, [move]);
  return (
    <nav
      aria-label="Comparar layouts dos pads"
      className="fixed bottom-[calc(10px+env(safe-area-inset-bottom))] left-1/2 z-40 flex w-[360px] max-w-[calc(100vw-24px)] -translate-x-1/2 items-center gap-2 rounded-[7px] border border-[#666] bg-[#262626] p-1 shadow-[0_4px_20px_#0008]"
    >
      <Button
        aria-label="Layout anterior"
        className={controlClass}
        onClick={previous}
        size="icon"
        variant="ghost"
      >
        <ArrowLeft aria-hidden="true" className="size-[18px]" />
      </Button>
      <div className="min-w-0 flex-1 text-center">
        <output
          aria-live="polite"
          className="block truncate text-[13px] font-semibold"
        >
          {variant} · {names[variant]}
        </output>
        <span className="block text-[10px] text-[#ccc]">
          Setas do teclado para comparar
        </span>
      </div>
      <Button
        aria-label="Próximo layout"
        className={controlClass}
        onClick={next}
        size="icon"
        variant="ghost"
      >
        <ArrowRight aria-hidden="true" className="size-[18px]" />
      </Button>
    </nav>
  );
}

export function PadLayoutPrototype({
  variant,
  onVariantChange,
}: {
  variant: PadLayoutVariant;
  onVariantChange: (variant: PadLayoutVariant) => void;
}) {
  const [playback, setPlayback] = useState(initialPlayback);
  const [selectedId, setSelectedId] = useState("walk");
  const [view, setView] = useState("scene:tavern");
  const [master, setMaster] = useState(78);
  const [announcement, setAnnouncement] = useState("");
  const selected = pads.find((pad) => pad.id === selectedId) ?? pads[0];
  const current = playback[selected.id];
  const trigger = useCallback((id: string) => {
    setSelectedId(id);
    setPlayback((states) => ({
      ...states,
      [id]: {
        ...states[id],
        hits: states[id].hits + 1,
        status: states[id].status === "playing" ? "paused" : "playing",
      },
    }));
  }, []);
  const stop = useCallback(
    (id: string) =>
      setPlayback((states) => ({
        ...states,
        [id]: { ...states[id], status: "idle" },
      })),
    []
  );
  const stopAll = useCallback(
    () =>
      setPlayback((states) =>
        Object.fromEntries(
          Object.entries(states).map(([id, state]) => [
            id,
            { ...state, status: "idle" },
          ])
        )
      ),
    []
  );
  const toggleSelected = useCallback(
    () => trigger(selectedId),
    [selectedId, trigger]
  );
  const stopSelected = useCallback(() => stop(selectedId), [selectedId, stop]);
  const changeVolume = useCallback(
    ([volume]: number[]) =>
      setPlayback((states) => ({
        ...states,
        [selectedId]: { ...states[selectedId], volume },
      })),
    [selectedId]
  );
  const changeMaster = useCallback(
    ([volume]: number[]) => setMaster(volume),
    []
  );
  const moveTrack = useCallback(
    (direction: number) =>
      setPlayback((states) => ({
        ...states,
        [selectedId]: {
          ...states[selectedId],
          track: (states[selectedId].track + direction + 3) % 3,
        },
      })),
    [selectedId]
  );
  const nextTrack = useCallback(() => moveTrack(1), [moveTrack]);
  const previousTrack = useCallback(() => moveTrack(-1), [moveTrack]);
  const scene = useCallback((id: string) => setView(`scene:${id}`), []);
  const effects = useCallback((kind: string) => setView(`effects:${kind}`), []);
  const group = useCallback(() => setView("group:night"), []);
  const createGroup = useCallback(
    () =>
      setAnnouncement(
        "Neste estudo, os grupos e sons são demonstrativos e ficam apenas em memória."
      ),
    []
  );
  let items = pads;
  if (view.startsWith("effects:")) {
    items = pads.filter((pad) =>
      view === "effects:all"
        ? pad.kind !== "playlist"
        : pad.kind === view.slice(8)
    );
  }
  if (view === "scene:merchant") {
    items = pads.filter((pad) => ["talk", "coins", "laugh"].includes(pad.id));
  }
  if (view === "scene:ambush") {
    items = pads.filter((pad) =>
      ["sword", "steps", "thunder"].includes(pad.id)
    );
  }
  if (view === "group:night") {
    items = pads.filter((pad) => ["walk", "rain", "wind"].includes(pad.id));
  }
  const sceneTitle = scenes.find((item) => view === `scene:${item.id}`)?.name;
  const title =
    sceneTitle ?? (view === "group:night" ? "Caminhada à noite" : "Efeitos");
  return (
    <main
      className="fixed inset-0 z-10 bg-[#080808] text-[#fafafa] [--background:#080808] [--border:#303030] [--foreground:#fafafa] [--muted:#aaa] [--primary-foreground:#080808] [--primary:#fafafa] [--ring:#69aeff] [--secondary:#242424]"
      data-pad-layout-prototype={variant}
    >
      <div className="mx-auto flex h-dvh max-w-[1300px] flex-col gap-2 overflow-hidden px-3 pt-[calc(10px+env(safe-area-inset-top))] pb-[calc(74px+env(safe-area-inset-bottom))]">
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <header className="flex h-[44px] min-w-0 flex-[1_1_210px] items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[21px] font-bold tracking-[-0.03em]">
                soundbard
              </p>
              <p className="truncate text-[10px] text-[#aaa]">
                Estudo de pads · sem áudio
              </p>
            </div>
            <Button
              aria-label="Parar todos os pads demonstrativos"
              className={cn(controlClass, "text-[#ff7777]")}
              onClick={stopAll}
              size="icon"
              variant="ghost"
            >
              <Square aria-hidden="true" className="size-[16px]" />
            </Button>
          </header>
          <PreviewNavigation
            groups={[{ id: "night", name: "Caminhada à noite" }]}
            onCreateGroup={createGroup}
            onEffects={effects}
            onGroup={group}
            onScene={scene}
            scenes={scenes}
            selected={view}
          />
        </div>
        <section
          aria-label={`Pads de ${title}`}
          className="flex min-h-0 flex-1 flex-col gap-2"
        >
          <div className="flex shrink-0 items-baseline justify-between gap-2">
            <h1 className="truncate text-[18px]! font-semibold! tracking-normal!">
              {title}
            </h1>
            <span className="shrink-0 text-[11px] text-[#aaa]">
              {items.length} pads · opção {variant}
            </span>
          </div>
          <PrototypeBoard
            items={items}
            playback={playback}
            select={setSelectedId}
            selectedId={selectedId}
            stop={stop}
            trigger={trigger}
            variant={variant}
          />
        </section>
        <p className="sr-only" role="status">
          {descriptions[variant]} {announcement}
        </p>
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
      </div>
      <PrototypeSwitcher onChange={onVariantChange} variant={variant} />
    </main>
  );
}
