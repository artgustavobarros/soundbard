// Estudo C: canais verticais na mesma mesa, com pad, nome, volume e loop juntos.
import { cn } from "cn";
import {
  type MouseEvent,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  LoopToggle,
  SculptedPad,
  VerticalFader,
} from "./hardware-prototype-controls";
import type { HardwareLayoutProps } from "./hardware-prototype-model";
import { Carousel, CarouselContent, CarouselItem } from "./ui/carousel";

const channelCarouselOptions = {
  align: "start" as const,
  containScroll: "keepSnaps" as const,
  dragFree: true,
};

export function HardwareChannelsLayout({
  sounds,
  selectedId,
  onTrigger,
  onSelect,
  onVolume,
  onLoop,
}: HardwareLayoutProps) {
  const host = useRef<HTMLElement>(null);
  const [compact, setCompact] = useState(false);
  useLayoutEffect(() => {
    const element = host.current;
    if (!element) {
      return;
    }
    const measure = () => {
      const { height } = element.getBoundingClientRect();
      setCompact(height < 240);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    return () => observer.disconnect();
  }, []);
  const select = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const { soundId } = event.currentTarget.dataset;
      if (soundId) {
        onSelect(soundId);
      }
    },
    [onSelect]
  );

  return (
    <section
      aria-label="Mesa de canais Estúdio"
      className="flex h-full min-h-0 min-w-0 flex-col justify-center"
      data-hardware-layout="C"
      ref={host}
    >
      <div className="flex h-full max-h-[580px] min-h-0 flex-col overflow-hidden rounded-[14px] bg-[#f3f4f4] p-2 shadow-[0_8px_22px_#3d424219,inset_0_1px_0_#fff]">
        <Carousel
          aria-label="Canais de áudio"
          className="flex h-full min-h-0 min-w-0 flex-col [&>[data-slot=carousel-content]]:h-full [&>[data-slot=carousel-content]]:min-h-0"
          opts={channelCarouselOptions}
        >
          <CarouselContent className="ml-0 h-full gap-1">
            {sounds.map((sound) => (
              <CarouselItem
                className="h-full basis-[clamp(138px,12vw,164px)] pl-0"
                key={sound.id}
              >
                <div
                  className={cn(
                    "grid h-full min-h-0 justify-items-center gap-1 rounded-[8px] bg-linear-to-b from-[#fcfcfc] to-[#eceef0] p-2 shadow-[inset_1px_0_0_#fff,inset_-1px_0_0_#d8dbdf]",
                    compact
                      ? "grid-cols-[minmax(0,1fr)_44px] grid-rows-[minmax(56px,1fr)_44px]"
                      : "grid-rows-[minmax(56px,min(26%,124px))_44px_minmax(84px,1fr)_44px]",
                    selectedId === sound.id && "from-white to-[#e9e9f0]"
                  )}
                  data-hardware-channel={sound.id}
                >
                  <div
                    className={cn(
                      "aspect-square h-full max-w-full",
                      compact && "col-start-1 row-start-1"
                    )}
                  >
                    <SculptedPad
                      onTrigger={onTrigger}
                      selected={selectedId === sound.id}
                      sound={sound}
                    />
                  </div>
                  <button
                    aria-label={`Selecionar ${sound.name}`}
                    aria-pressed={selectedId === sound.id}
                    className={cn(
                      "grid min-h-[44px] w-full content-start gap-1 rounded-[3px] text-center focus-visible:outline-[#7160a8]!",
                      compact && "col-start-1 row-start-2"
                    )}
                    data-sound-id={sound.id}
                    onClick={select}
                    title={sound.name}
                    type="button"
                  >
                    <span className="line-clamp-2 text-[13px] leading-[1.25] font-semibold text-[#303238]">
                      {sound.name}
                    </span>
                    {!compact && (
                      <span className="text-[10px] leading-none text-[#62666e]">
                        {sound.kind}
                      </span>
                    )}
                  </button>
                  <VerticalFader
                    className={cn(
                      "h-full! self-center",
                      compact
                        ? "col-start-2 row-start-1 min-h-0! gap-1! [&>div]:py-0"
                        : "max-h-[260px] min-h-[84px]!"
                    )}
                    onVolume={onVolume}
                    sound={sound}
                  />
                  <LoopToggle
                    className={
                      compact
                        ? "col-start-2 row-start-2 w-[44px] flex-col gap-0! text-[8px]! leading-none [&_[role=switch]]:h-[32px] [&_[role=switch]]:w-[44px]"
                        : undefined
                    }
                    onLoop={onLoop}
                    sound={sound}
                  />
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
      </div>
    </section>
  );
}
