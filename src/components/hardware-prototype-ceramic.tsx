// Estudo A: pads de cerâmica com controles junto de cada som; sem áudio real.
import type { CSSProperties } from "react";
import { useLayoutEffect, useRef, useState } from "react";
import {
  LoopToggle,
  SculptedPad,
  VerticalFader,
} from "./hardware-prototype-controls";
import type {
  HardwareLayoutProps,
  HardwareSound,
} from "./hardware-prototype-model";
import { Carousel, CarouselContent, CarouselItem } from "./ui/carousel";

const carouselOptions = {
  align: "start" as const,
  containScroll: "keepSnaps" as const,
  dragFree: true,
};
type CeramicStyle = CSSProperties & {
  "--ceramic-column": string;
  "--ceramic-pad-size": string;
};

function CeramicSound({
  sound,
  selected,
  onTrigger,
  onVolume,
  onLoop,
}: {
  onLoop: HardwareLayoutProps["onLoop"];
  onTrigger: HardwareLayoutProps["onTrigger"];
  onVolume: HardwareLayoutProps["onVolume"];
  selected: boolean;
  sound: HardwareSound;
}) {
  return (
    <div
      className="mx-auto grid w-full max-w-[calc(var(--ceramic-pad-size)+56px)] min-w-0 grid-cols-[minmax(0,1fr)_44px] content-start gap-x-[12px] gap-y-2"
      data-hardware-module={sound.id}
    >
      <SculptedPad
        className="max-w-[var(--ceramic-pad-size)]"
        onTrigger={onTrigger}
        selected={selected}
        sound={sound}
        subtitle={sound.kind}
      />
      <VerticalFader
        className="h-[var(--ceramic-pad-size)]!"
        onVolume={onVolume}
        sound={sound}
      />
      <div className="col-span-2 min-w-0">
        <LoopToggle className="flex! w-fit" onLoop={onLoop} sound={sound} />
      </div>
    </div>
  );
}

export function HardwareCeramicLayout({
  sounds,
  selectedId,
  onTrigger,
  onVolume,
  onLoop,
}: HardwareLayoutProps) {
  const host = useRef<HTMLElement>(null);
  const [layout, setLayout] = useState({ columns: 4, padSize: 164, rows: 1 });

  useLayoutEffect(() => {
    const element = host.current;
    if (!element) {
      return;
    }
    const measure = () => {
      const { width, height } = element.getBoundingClientRect();
      const maxColumns = Math.max(2, Math.floor(width / 190));
      let next = { columns: maxColumns, padSize: 128, rows: 1 };
      for (const rows of [2, 1]) {
        const columns = Math.min(maxColumns, Math.ceil(sounds.length / rows));
        const cellSize = (width - 24 * (columns - 1)) / columns;
        const heightLimit = (height - 8 - (rows - 1) * 28) / rows - 52;
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
  }, [sounds.length]);

  const groups = Array.from(
    { length: Math.ceil(sounds.length / layout.rows) },
    (_, index) => sounds.slice(index * layout.rows, (index + 1) * layout.rows)
  );
  const style: CeramicStyle = {
    "--ceramic-column": `calc((100% - ${(layout.columns - 1) * 24}px) / ${layout.columns})`,
    "--ceramic-pad-size": `${layout.padSize}px`,
  };

  return (
    <Carousel
      aria-label="Pads de cerâmica"
      className="relative min-h-0 flex-1 overflow-hidden [&>[data-slot=carousel-content]]:h-full"
      opts={carouselOptions}
      ref={host}
      style={style}
    >
      <CarouselContent className="ml-0 items-start gap-[24px] py-1">
        {groups.map((group) => (
          <CarouselItem
            className="grid basis-[var(--ceramic-column)] content-start gap-[28px] pl-0"
            key={group[0].id}
          >
            {group.map((sound) => (
              <CeramicSound
                key={sound.id}
                onLoop={onLoop}
                onTrigger={onTrigger}
                onVolume={onVolume}
                selected={sound.id === selectedId}
                sound={sound}
              />
            ))}
          </CarouselItem>
        ))}
      </CarouselContent>
    </Carousel>
  );
}
