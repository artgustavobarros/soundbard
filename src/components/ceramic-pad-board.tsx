import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useDndContext,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "cn";
import { GripVertical, SlidersHorizontal } from "lucide-react";
import {
  type CSSProperties,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { orderPads, reorderVisiblePads } from "../lib/pad-order";
import {
  LoopToggle,
  SculptedPad,
  VerticalFader,
} from "./hardware-prototype-controls";
import type { Playback, PreviewPad } from "./soundboard-preview";
import { Button } from "./ui/button";

interface BoardProps {
  onEdit: (id: string) => void;
  onLoop: (id: string, loop: boolean) => void;
  onReorder: (ids: string[]) => Promise<boolean | undefined>;
  onTrigger: (id: string) => void;
  onVolume: (id: string, volume: number) => void;
  onVolumeCommit: (id: string, volume: number) => void;
  pads: PreviewPad[];
  playback: Record<string, Playback>;
  reorderDisabled?: boolean;
  selected: string;
  title: string;
}

type KindFilter = "all" | "music" | "ambience" | "effect";

const filterChips: Array<{ id: KindFilter; label: string }> = [
  { id: "all", label: "Todos" },
  { id: "music", label: "Música" },
  { id: "ambience", label: "Ambiente" },
  { id: "effect", label: "Efeitos" },
];

function FilterChip({
  id,
  label,
  active,
  onSelect,
}: {
  id: KindFilter;
  label: string;
  active: boolean;
  onSelect: (id: KindFilter) => void;
}) {
  const click = useCallback(() => onSelect(id), [id, onSelect]);
  return (
    <Button
      aria-pressed={active}
      className={cn(
        "relative h-7 min-w-[44px] rounded-full px-3 text-xs font-medium shadow-none before:absolute before:inset-x-0 before:top-1/2 before:h-[44px] before:-translate-y-1/2",
        active
          ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
          : "border-border text-muted-foreground hover:text-foreground hover:border-primary/40 bg-(--surface-raised)"
      )}
      onClick={click}
      size="sm"
      variant={active ? "default" : "outline"}
    >
      {label}
    </Button>
  );
}

type CeramicModuleProps = Omit<
  BoardProps,
  "pads" | "playback" | "selected" | "title" | "onReorder"
> & {
  pad: PreviewPad;
  playback: Playback;
  selected: boolean;
};

function SortableCeramicModule(props: CeramicModuleProps) {
  const { activatorEvent } = useDndContext();
  const sortable = useSortable({
    disabled: props.reorderDisabled,
    id: props.pad.id,
    transition:
      activatorEvent?.type === "keydown"
        ? null
        : {
            duration: 200,
            easing: "cubic-bezier(0.77, 0, 0.175, 1)",
          },
  });
  return <CeramicModule {...props} sortable={sortable} />;
}

function CeramicModule({
  pad,
  playback,
  selected,
  onEdit,
  onTrigger,
  onVolume,
  onVolumeCommit,
  onLoop,
  reorderDisabled,
  lifted = false,
  sortable,
}: CeramicModuleProps & {
  lifted?: boolean;
  sortable?: ReturnType<typeof useSortable>;
}) {
  const dragStyle: CSSProperties & { "--ceramic-sort-transition": string } = {
    "--ceramic-sort-transition":
      sortable?.transition ?? "box-shadow 200ms ease, border-color 200ms ease",
    transform: sortable
      ? CSS.Transform.toString(sortable.transform)
      : undefined,
  };
  const sound = {
    ...playback,
    id: pad.id,
    loop: Boolean(pad.loop),
    name: pad.name,
  };
  const edit = useCallback(() => onEdit(pad.id), [onEdit, pad.id]);

  const track = pad.playlistData?.tracks[playback.track];
  let detail = {
    ambience: "Ambiente",
    effect: "Efeito",
    music: "Música",
    playlist: "Playlist",
  }[pad.kind];
  if (pad.playlistData) {
    detail =
      playback.status === "idle"
        ? `${pad.playlistData.tracks.length} músicas`
        : (track ?? "Áudio indisponível");
  }
  return (
    <div
      aria-hidden={lifted || undefined}
      className={cn(
        "relative mx-auto grid w-full max-w-[calc(var(--ceramic-pad-size)+56px)] min-w-0 grid-cols-[minmax(0,1fr)_44px] content-start gap-x-3 gap-y-2 rounded-2xl border p-2 select-none [transition:var(--ceramic-sort-transition)] motion-reduce:transition-none",
        lifted
          ? "border-primary ring-primary/20 transform-[rotate(2.5deg)_scale(1.03)] bg-(--surface-raised) shadow-2xl ring-2 motion-reduce:transform-none"
          : "hover:border-primary/30 border-transparent",
        sortable?.isDragging && "opacity-0"
      )}
      data-ceramic-module={pad.id}
      data-lifted={lifted ? "true" : undefined}
      inert={lifted || undefined}
      ref={sortable?.setNodeRef}
      style={dragStyle}
    >
      <SculptedPad
        className="max-w-(--ceramic-pad-size)"
        onTrigger={onTrigger}
        selected={selected}
        sound={sound}
        subtitle={detail}
      />
      <div className="shrink-0">
        <VerticalFader
          className="h-(--ceramic-pad-size)"
          onVolume={onVolume}
          onVolumeCommit={onVolumeCommit}
          sound={sound}
        />
      </div>
      <div className="col-span-2 min-w-0">
        <div className="flex min-h-11 flex-wrap items-center justify-between gap-1">
          <div>
            {pad.kind === "playlist" ? (
              <span className="text-muted-foreground text-[11px]">
                Playlist
              </span>
            ) : (
              <LoopToggle onLoop={onLoop} sound={sound} />
            )}
          </div>
          <Button
            {...sortable?.attributes}
            {...sortable?.listeners}
            aria-label={`Mover ${pad.name}`}
            aria-roledescription="pad reorganizável"
            className="text-muted-foreground hover:bg-primary/10 hover:text-primary size-[44px] shrink-0 cursor-grab touch-none rounded-md p-0 active:cursor-grabbing"
            data-pad-drag-handle
            disabled={reorderDisabled}
            ref={sortable?.setActivatorNodeRef}
            size="icon"
            title={`Mover ${pad.name}`}
            variant="ghost"
          >
            <GripVertical aria-hidden="true" className="size-5" />
          </Button>
          <div>
            <Button
              aria-label={`Editar ${pad.name}`}
              className="text-muted-foreground hover:bg-primary/10 hover:text-primary size-[44px] shrink-0 rounded-md p-0"
              onClick={edit}
              size="icon"
              title={`Editar ${pad.name} sem interromper a reprodução`}
              variant="ghost"
            >
              <SlidersHorizontal aria-hidden="true" className="size-6" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CeramicPadBoard({
  pads,
  playback,
  selected,
  title,
  onReorder,
  ...controls
}: BoardProps) {
  const host = useRef<HTMLDivElement>(null);
  const keyboardDrop = useRef<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [pendingOrder, setPendingOrder] = useState<string[] | null>(null);
  const [slotHeight, setSlotHeight] = useState(0);
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const isAllPads = title === "Todos os pads";
  const displayedPads = useMemo(
    () => (pendingOrder ? orderPads(pads, pendingOrder) : pads),
    [pads, pendingOrder]
  );

  const filteredPads = useMemo(() => {
    if (!isAllPads || kindFilter === "all") {
      return displayedPads;
    }
    if (kindFilter === "music") {
      return displayedPads.filter(
        (pad) => pad.kind === "music" || pad.kind === "playlist"
      );
    }
    if (kindFilter === "ambience") {
      return displayedPads.filter((pad) => pad.kind === "ambience");
    }
    if (kindFilter === "effect") {
      return displayedPads.filter((pad) => pad.kind === "effect");
    }
    return displayedPads;
  }, [isAllPads, kindFilter, displayedPads]);
  const activePad = filteredPads.find((pad) => pad.id === activeId);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      scrollBehavior: "auto",
    })
  );
  const startDrag = useCallback(({ active }: DragStartEvent) => {
    setActiveId(String(active.id));
    setOverId(String(active.id));
    setSlotHeight(
      host.current?.querySelector<HTMLElement>(
        `[data-ceramic-module="${active.id}"]`
      )?.offsetHeight ?? 0
    );
  }, []);
  const moveDrag = useCallback(({ over }: DragOverEvent) => {
    setOverId(over ? String(over.id) : null);
  }, []);
  const cancelDrag = useCallback(() => {
    setActiveId(null);
    setOverId(null);
  }, []);
  const reorder = useCallback(
    async ({ active, over, activatorEvent }: DragEndEvent) => {
      cancelDrag();
      if (
        !over ||
        active.id === over.id ||
        controls.reorderDisabled ||
        pendingOrder
      ) {
        return;
      }
      const filteredIds = filteredPads.map((pad) => pad.id);
      const from = filteredIds.indexOf(String(active.id));
      const to = filteredIds.indexOf(String(over.id));
      if (from >= 0 && to >= 0) {
        keyboardDrop.current =
          activatorEvent.type === "keydown" ? String(active.id) : null;
        const ids = reorderVisiblePads(
          pads,
          filteredIds,
          arrayMove(filteredIds, from, to)
        );
        // Keep dnd-kit's preview in place until the central save succeeds or rolls back.
        setPendingOrder(ids);
        try {
          await onReorder(ids);
        } finally {
          setPendingOrder(null);
        }
      }
    },
    [
      cancelDrag,
      controls.reorderDisabled,
      filteredPads,
      onReorder,
      pads,
      pendingOrder,
    ]
  );
  useLayoutEffect(() => {
    if (!keyboardDrop.current || controls.reorderDisabled) {
      return;
    }
    if (!filteredPads.some((pad) => pad.id === keyboardDrop.current)) {
      keyboardDrop.current = null;
      return;
    }
    // Central saves can remount columns after dnd-kit's own focus restoration.
    host.current
      ?.querySelector<HTMLButtonElement>(
        `[data-ceramic-module="${keyboardDrop.current}"] [data-pad-drag-handle]`
      )
      ?.focus();
    keyboardDrop.current = null;
  }, [filteredPads, controls.reorderDisabled]);

  const [layout, setLayout] = useState({ columns: 4, padSize: 164, rows: 1 });
  useLayoutEffect(() => {
    const element = host.current;
    if (!element) {
      return;
    }
    const measure = () => {
      const { width, height } = element.getBoundingClientRect();
      const maxColumns = Math.max(2, Math.floor(width / 210));
      let next = { columns: maxColumns, padSize: 128, rows: 1 };
      for (const rows of [2, 1]) {
        const columns = Math.max(
          1,
          Math.min(maxColumns, Math.ceil(filteredPads.length / rows))
        );
        const cellSize = (width - 24 * (columns - 1)) / columns;
        const controlsHeight = cellSize < 172 ? 102 : 58;
        const heightLimit =
          (height - 8 - (rows - 1) * 28) / rows - controlsHeight;
        const padSize = Math.min(176, cellSize - 56, heightLimit);
        if (rows === 1 || padSize >= 88) {
          next = { columns, padSize: Math.max(44, padSize), rows };
          break;
        }
      }
      setLayout((previous) =>
        previous.columns === next.columns &&
        previous.padSize === next.padSize &&
        previous.rows === next.rows
          ? previous
          : next
      );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    return () => observer.disconnect();
  }, [filteredPads.length]);

  const style: CSSProperties & {
    "--ceramic-column": string;
    "--ceramic-pad-size": string;
  } = {
    "--ceramic-column": `calc((100% - ${(layout.columns - 1) * 24}px) / ${layout.columns})`,
    "--ceramic-pad-size": `${layout.padSize}px`,
  };

  const selectFilter = useCallback((id: KindFilter) => {
    setKindFilter((current) => (current === id ? "all" : id));
  }, []);

  return (
    <section
      aria-label={`Pads de ${title}`}
      className="flex min-h-0 flex-1 flex-col gap-4"
    >
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1
            className="min-w-0 truncate text-[18px] font-semibold tracking-normal"
            title={title}
          >
            {title}
          </h1>
          {isAllPads && (
            <fieldset className="m-0 flex flex-wrap items-center gap-x-1.5 gap-y-[20px] border-0 p-0">
              <legend className="sr-only">Filtrar por tipo</legend>
              {filterChips.map((chip) => (
                <FilterChip
                  active={kindFilter === chip.id}
                  id={chip.id}
                  key={chip.id}
                  label={chip.label}
                  onSelect={selectFilter}
                />
              ))}
            </fieldset>
          )}
        </div>
        <p className="text-muted-foreground shrink-0 text-[11px]">
          {filteredPads.length} {filteredPads.length === 1 ? "pad" : "pads"}
        </p>
      </div>
      <DndContext
        accessibility={{
          screenReaderInstructions: {
            draggable:
              "Para mover este pad, pressione espaço. Use as setas para escolher a posição. Pressione espaço para confirmar ou Escape para cancelar.",
          },
        }}
        collisionDetection={closestCenter}
        onDragCancel={cancelDrag}
        onDragEnd={reorder}
        onDragOver={moveDrag}
        onDragStart={startDrag}
        sensors={sensors}
      >
        <SortableContext
          items={filteredPads.map((pad) => pad.id)}
          strategy={rectSortingStrategy}
        >
          <div
            className="relative grid min-h-0 flex-1 content-start gap-x-6 gap-y-7 overflow-x-auto overflow-y-hidden py-2"
            data-ceramic-pad-grid
            ref={host}
            style={{
              ...style,
              gridAutoColumns: "var(--ceramic-column)",
              gridAutoFlow: "column",
              gridTemplateRows: `repeat(${layout.rows}, max-content)`,
            }}
          >
            {filteredPads.map((pad) => (
              <SortableCeramicModule
                {...controls}
                key={pad.id}
                pad={pad}
                playback={playback[pad.id]}
                reorderDisabled={
                  controls.reorderDisabled || pendingOrder !== null
                }
                selected={selected === pad.id}
              />
            ))}
            {activeId !== null &&
              (["origin", "target"] as const).map((slot) => {
                const id = slot === "origin" ? activeId : overId;
                const index = filteredPads.findIndex((pad) => pad.id === id);
                if (index < 0 || (slot === "target" && id === activeId)) {
                  return null;
                }
                return (
                  <div
                    aria-hidden="true"
                    className={cn(
                      "pointer-events-none absolute inset-x-0 top-0 z-10 mx-auto w-full max-w-[calc(var(--ceramic-pad-size)+56px)] rounded-2xl border-2 border-dashed",
                      slot === "origin"
                        ? "border-muted-foreground/50"
                        : "border-primary bg-primary/5"
                    )}
                    data-pad-drop-slot={slot}
                    key={slot}
                    style={{
                      gridColumn: `${Math.floor(index / layout.rows) + 1} / ${Math.floor(index / layout.rows) + 2}`,
                      gridRow: `${(index % layout.rows) + 1} / ${(index % layout.rows) + 2}`,
                      height: slotHeight,
                    }}
                  />
                );
              })}
          </div>
        </SortableContext>
        {typeof document !== "undefined" &&
          createPortal(
            <DragOverlay
              className="pointer-events-none"
              dropAnimation={null}
              style={style}
              transition="none"
            >
              {activePad && (
                <div>
                  <CeramicModule
                    {...controls}
                    lifted
                    pad={activePad}
                    playback={playback[activePad.id]}
                    selected={selected === activePad.id}
                  />
                </div>
              )}
            </DragOverlay>,
            document.body
          )}
      </DndContext>
    </section>
  );
}
