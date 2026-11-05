import { cn } from "cn";
import { Pause, Play } from "lucide-react";
import { Switch } from "radix-ui";
import { useCallback, useId } from "react";
import type {
  HardwareLayoutProps,
  HardwareSound,
} from "./hardware-prototype-model";
import { Button } from "./ui/button";
import { Slider } from "./ui/slider";

interface SoundControlProps {
  className?: string;
  sound: Pick<HardwareSound, "id" | "name" | "status" | "volume" | "loop">;
}
const statusLabels = { idle: "Pronto", paused: "Pausado", playing: "Tocando" };

export function SculptedPad({
  className,
  subtitle,
  onTrigger,
  selected,
  sound,
}: SoundControlProps & {
  subtitle?: string;
  onTrigger: HardwareLayoutProps["onTrigger"];
  selected: boolean;
}) {
  const playing = sound.status === "playing";
  const trigger = useCallback(() => onTrigger(sound.id), [onTrigger, sound.id]);
  return (
    <Button
      aria-label={`${playing ? "Pausar" : "Tocar"} ${sound.name}`}
      aria-pressed={playing}
      className={cn(
        "midi-pad relative aspect-square h-auto w-full touch-manipulation rounded-xl border p-0! text-[#292c33] transition-[box-shadow,color,translate] duration-150 hover:text-[#151517] focus-visible:ring-0 focus-visible:outline-[#151517]! motion-reduce:transition-none",
        playing && "text-[#151517]",
        className
      )}
      data-hardware-trigger={sound.id}
      data-selected={selected}
      onClick={trigger}
      title={`${playing ? "Pausar" : "Tocar"} ${sound.name}`}
      variant="ghost"
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute top-3 right-3 flex size-[9px] items-center justify-center rounded-full transition-all duration-200",
          playing
            ? "bg-emerald-500 shadow-[0_0_10px_2px_rgba(16,185,129,0.7)]"
            : "bg-[#a3a6ac] shadow-[inset_0_1px_2px_#0003]"
        )}
        data-pad-led
        data-playing={playing ? "true" : undefined}
      >
        {playing && (
          <span className="size-full animate-ping rounded-full bg-emerald-400 opacity-75 motion-reduce:hidden" />
        )}
      </span>
      <span className="flex size-full min-w-0 flex-col items-start justify-start gap-1 overflow-hidden px-3 pt-3 pb-8 text-left whitespace-normal">
        <span
          className="line-clamp-2 w-full text-[14px] leading-[1.15] font-extrabold tracking-[0.015em] break-words uppercase"
          data-pad-title
        >
          {sound.name}
        </span>
        <span
          className={cn(
            "line-clamp-2 w-full text-[11px] leading-[1.3] font-semibold break-words transition-colors",
            playing ? "font-bold text-emerald-700" : "text-[#575b64]"
          )}
          data-pad-subtitle
        >
          {subtitle ?? statusLabels[sound.status]}
        </span>
      </span>
      {playing ? (
        <Pause
          aria-hidden="true"
          className="absolute right-3 bottom-3 size-[15px] text-emerald-600 drop-shadow-sm transition-colors"
          strokeWidth={2}
        />
      ) : (
        <Play
          aria-hidden="true"
          className="text-muted-foreground absolute right-3 bottom-3 size-[14px]"
          strokeWidth={1.5}
        />
      )}
      <span className="sr-only">{statusLabels[sound.status]}</span>
    </Button>
  );
}

export function VerticalFader({
  className,
  onVolume,
  onVolumeCommit,
  sound,
}: SoundControlProps & {
  onVolume: HardwareLayoutProps["onVolume"];
  onVolumeCommit?: HardwareLayoutProps["onVolume"];
}) {
  const change = useCallback(
    ([volume]: number[]) => onVolume(sound.id, volume),
    [onVolume, sound.id]
  );
  const commit = useCallback(
    ([volume]: number[]) => onVolumeCommit?.(sound.id, volume),
    [onVolumeCommit, sound.id]
  );
  return (
    <div
      className={cn(
        "flex h-[116px] min-h-0 w-[44px] shrink-0 flex-col items-center gap-2",
        className
      )}
    >
      <div className="flex min-h-0 w-full flex-1 justify-center py-1">
        <Slider
          aria-label={`Volume de ${sound.name}`}
          max={100}
          min={0}
          onValueChange={change}
          onValueCommit={commit}
          orientation="vertical"
          step={1}
          value={[sound.volume]}
          variant="fader"
        />
      </div>
      <output className="text-[11px] leading-none text-[#5f626a] tabular-nums">
        {sound.volume}%
      </output>
    </div>
  );
}

export function LoopToggle({
  className,
  onLoop,
  sound,
}: SoundControlProps & { onLoop: HardwareLayoutProps["onLoop"] }) {
  const switchId = useId();
  const change = useCallback(
    (checked: boolean) => onLoop(sound.id, checked),
    [onLoop, sound.id]
  );
  return (
    <label
      className={cn(
        "inline-flex min-h-[44px] items-center justify-center gap-2 text-[10px] font-medium tracking-[0.06em] text-[#575b64] uppercase",
        className
      )}
      htmlFor={switchId}
    >
      Loop
      <Switch.Root
        aria-label={`Loop de ${sound.name}`}
        checked={sound.loop}
        className="group inline-flex h-[44px] w-[48px] shrink-0 touch-manipulation items-center justify-center rounded-md bg-transparent focus-visible:outline-[#151517]!"
        id={switchId}
        onCheckedChange={change}
        type="button"
      >
        <span className="flex h-[23px] w-[42px] items-center rounded-[6px] bg-[#c9ccd1] p-[2px] shadow-[inset_1px_2px_3px_#0003,inset_-1px_-1px_2px_#fff8] group-data-[state=checked]:bg-[#151517]">
          <Switch.Thumb className="block h-[19px] w-[20px] translate-x-0 rounded-[5px] border border-white bg-linear-to-b from-white to-[#dfe1e6] shadow-[0_1px_3px_#0004] transition-transform duration-150 data-[state=checked]:translate-x-[18px] motion-reduce:transition-none" />
        </span>
      </Switch.Root>
    </label>
  );
}
