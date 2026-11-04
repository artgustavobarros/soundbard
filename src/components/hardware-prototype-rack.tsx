// Estudo B: banco de pads e mixer em dois módulos de uma mesma bancada.
import { cn } from "cn";
import useEmblaCarousel from "embla-carousel-react";
import type { CSSProperties } from "react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  LoopToggle,
  SculptedPad,
  VerticalFader,
} from "./hardware-prototype-controls";
import type {
  HardwareLayoutProps,
  HardwareSound,
} from "./hardware-prototype-model";
import { Button } from "./ui/button";

const carouselOptions = {
  align: "start" as const,
  containScroll: "trimSnaps" as const,
  dragFree: true,
};
const rackPanel =
  "min-w-0 shrink-0 overflow-hidden rounded-[10px] border border-[#777b82] bg-linear-to-b from-[#fafafa] to-[#e7e8eb] px-3 py-[6px] shadow-[0_5px_12px_#3439431a,inset_0_1px_0_#fff] sm:px-5";
type RackStyle = CSSProperties & {
  "--rack-fader-height": string;
  "--rack-pad-size": string;
};

function RackPad({
  sound,
  selected,
  onTrigger,
}: {
  onTrigger: HardwareLayoutProps["onTrigger"];
  selected: boolean;
  sound: HardwareSound;
}) {
  return (
    <div
      className="w-[var(--rack-pad-size)] min-w-0 shrink-0"
      data-hardware-rack-pad={sound.id}
    >
      <SculptedPad onTrigger={onTrigger} selected={selected} sound={sound} />
      <h2
        className="mt-[4px]! line-clamp-2 h-[28px] text-center text-[11px]! leading-[14px]! font-semibold! tracking-normal! text-[#30343c]"
        title={sound.name}
      >
        {sound.name}
      </h2>
    </div>
  );
}

function RackChannel({
  sound,
  selected,
  onSelect,
  onVolume,
  onLoop,
}: {
  onLoop: HardwareLayoutProps["onLoop"];
  onSelect: HardwareLayoutProps["onSelect"];
  onVolume: HardwareLayoutProps["onVolume"];
  selected: boolean;
  sound: HardwareSound;
}) {
  const select = useCallback(() => onSelect(sound.id), [onSelect, sound.id]);
  return (
    <div
      className={cn(
        "flex w-[max(88px,var(--rack-pad-size))] shrink-0 flex-col items-center rounded-[6px] px-1",
        selected && "bg-[#dedce7]"
      )}
      data-hardware-rack-channel={sound.id}
    >
      <VerticalFader
        className="h-[var(--rack-fader-height)]!"
        onVolume={onVolume}
        sound={sound}
      />
      <Button
        aria-label={`Selecionar canal ${sound.name}`}
        aria-pressed={selected}
        className="h-[28px] w-full min-w-0 rounded-[3px] bg-transparent px-1 text-center text-[11px]! leading-[14px]! whitespace-normal text-[#3d424b] shadow-none hover:bg-[#d8d9df]"
        onClick={select}
        variant="ghost"
      >
        <span className="line-clamp-2" title={sound.name}>
          {sound.name}
        </span>
      </Button>
      <LoopToggle onLoop={onLoop} sound={sound} />
    </div>
  );
}

export function HardwareRackLayout({
  sounds,
  selectedId,
  onTrigger,
  onSelect,
  onLoop,
  onVolume,
}: HardwareLayoutProps) {
  const host = useRef<HTMLDivElement>(null);
  const [sizes, setSizes] = useState({
    faderHeight: 90,
    padSize: 80,
    sideBySide: false,
  });
  const [bankRef] = useEmblaCarousel(carouselOptions);
  const [mixerRef, mixerApi] = useEmblaCarousel(carouselOptions);
  const selectedIndex = sounds.findIndex((sound) => sound.id === selectedId);
  useLayoutEffect(() => {
    const element = host.current;
    if (!element) {
      return;
    }
    const measure = () => {
      const { height } = element.getBoundingClientRect();
      // Reserva espaço para nomes, switches, bordas e distância entre os painéis.
      const available = Math.max(0, height - 150);
      // Empilhados, os dois módulos precisam de 56 + 64 + 150 px.
      const sideBySide = height < 270;
      const padSize = sideBySide
        ? Math.min(80, Math.max(56, Math.floor(height - 50)))
        : Math.min(112, Math.max(56, Math.floor(available * 0.45)));
      const faderHeight = sideBySide
        ? Math.min(100, Math.max(64, Math.floor(height - 86)))
        : Math.min(144, Math.max(64, Math.floor(available - padSize)));
      setSizes((previous) =>
        previous.padSize === padSize &&
        previous.faderHeight === faderHeight &&
        previous.sideBySide === sideBySide
          ? previous
          : { faderHeight, padSize, sideBySide }
      );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (selectedIndex >= 0) {
      mixerApi?.scrollTo(selectedIndex);
    }
  }, [mixerApi, selectedIndex]);
  const style: RackStyle = {
    "--rack-fader-height": `${sizes.faderHeight}px`,
    "--rack-pad-size": `${sizes.padSize}px`,
  };
  return (
    <div
      className={cn(
        "flex min-h-0 min-w-0 flex-1 gap-[8px] overflow-y-auto overscroll-contain",
        sizes.sideBySide
          ? "flex-row items-start"
          : "flex-col px-1 pt-[2px] pb-1 sm:px-3"
      )}
      data-hardware-rack
      data-hardware-rack-mode={sizes.sideBySide ? "side-by-side" : "stacked"}
      ref={host}
      style={style}
    >
      <section
        aria-label="Banco de pads"
        className={cn(rackPanel, sizes.sideBySide && "flex-1")}
      >
        <div
          className="touch-pan-y overflow-hidden px-1 py-[2px]"
          ref={bankRef}
        >
          <div className="flex gap-4">
            {sounds.map((sound) => (
              <RackPad
                key={sound.id}
                onTrigger={onTrigger}
                selected={selectedId === sound.id}
                sound={sound}
              />
            ))}
          </div>
        </div>
      </section>
      <section
        aria-label="Mixer de canais"
        className={cn(rackPanel, sizes.sideBySide && "flex-1")}
      >
        <div className="touch-pan-y overflow-hidden" ref={mixerRef}>
          <div className="flex gap-3">
            {sounds.map((sound) => (
              <RackChannel
                key={sound.id}
                onLoop={onLoop}
                onSelect={onSelect}
                onVolume={onVolume}
                selected={selectedId === sound.id}
                sound={sound}
              />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
