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
  sound: HardwareSound;
}
const statusLabels = { idle: "Pronto", paused: "Pausado", playing: "Tocando" };

export function SculptedPad({
  className,
  onTrigger,
  selected,
  sound,
}: SoundControlProps & {
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
        "relative aspect-square h-auto w-full touch-manipulation rounded-[8px] border border-white bg-linear-to-b from-[#fcfcfd] to-[#e6e8eb] p-0 text-[#60636c] shadow-[5px_7px_12px_#b7bbc252,-4px_-4px_10px_#ffffffd9,inset_0_1px_1px_#fff] transition-[box-shadow,color] duration-150 hover:text-[#655586] focus-visible:ring-0 focus-visible:outline-[#75648f]! motion-reduce:transition-none",
        playing &&
          "from-[#e4e5e9] to-[#f3f4f6] text-[#655586] shadow-[inset_3px_3px_7px_#b5b8c17a,inset_-3px_-3px_7px_#ffffffc4]",
        selected && "border-[#aeb0bf]",
        "active:shadow-[inset_3px_3px_7px_#b5b8c17a,inset_-3px_-3px_7px_#ffffffc4]",
        className
      )}
      data-hardware-trigger={sound.id}
      onClick={trigger}
      title={`${playing ? "Pausar" : "Tocar"} ${sound.name}`}
      variant="ghost"
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute top-3 right-3 size-[5px] rounded-full bg-[#a3a6ac] shadow-[inset_0_1px_2px_#0003]",
          playing && "bg-[#ba692f]"
        )}
      />
      {playing ? (
        <Pause aria-hidden="true" className="size-[20px]" strokeWidth={1.5} />
      ) : (
        <Play aria-hidden="true" className="size-[20px]" strokeWidth={1.5} />
      )}
      <span className="sr-only">{statusLabels[sound.status]}</span>
    </Button>
  );
}

export function VerticalFader({
  className,
  onVolume,
  sound,
}: SoundControlProps & { onVolume: HardwareLayoutProps["onVolume"] }) {
  const change = useCallback(
    ([volume]: number[]) => onVolume(sound.id, volume),
    [onVolume, sound.id]
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
          className="h-full! min-h-0! w-[40px]! [&_[data-slot=slider-range]]:bg-[#8e80ad] [&_[data-slot=slider-thumb]]:relative [&_[data-slot=slider-thumb]]:h-[12px] [&_[data-slot=slider-thumb]]:w-[26px] [&_[data-slot=slider-thumb]]:rounded-[5px] [&_[data-slot=slider-thumb]]:border-[#fff] [&_[data-slot=slider-thumb]]:bg-linear-to-b [&_[data-slot=slider-thumb]]:from-white [&_[data-slot=slider-thumb]]:to-[#d9dce2] [&_[data-slot=slider-thumb]]:shadow-[0_2px_4px_#0003] [&_[data-slot=slider-thumb]]:before:absolute [&_[data-slot=slider-thumb]]:before:inset-[-14px] [&_[data-slot=slider-thumb]]:after:absolute [&_[data-slot=slider-thumb]]:after:top-1/2 [&_[data-slot=slider-thumb]]:after:right-[6px] [&_[data-slot=slider-thumb]]:after:left-[6px] [&_[data-slot=slider-thumb]]:after:h-[3px] [&_[data-slot=slider-thumb]]:after:-translate-y-1/2 [&_[data-slot=slider-thumb]]:after:rounded-full [&_[data-slot=slider-thumb]]:after:bg-[#535862] [&_[data-slot=slider-thumb]]:focus-visible:ring-[#8e80ad]/30 [&_[data-slot=slider-thumb]]:focus-visible:outline-[#75648f]! [&_[data-slot=slider-track]]:w-[4px] [&_[data-slot=slider-track]]:bg-[#c3c6cc] [&_[data-slot=slider-track]]:shadow-[inset_1px_0_2px_#0003]"
          max={100}
          min={0}
          onValueChange={change}
          orientation="vertical"
          step={1}
          value={[sound.volume]}
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
        className="group inline-flex h-[44px] w-[48px] shrink-0 touch-manipulation items-center justify-center rounded-md bg-transparent focus-visible:outline-[#75648f]!"
        id={switchId}
        onCheckedChange={change}
        type="button"
      >
        <span className="flex h-[23px] w-[42px] items-center rounded-[6px] bg-[#c9ccd1] p-[2px] shadow-[inset_1px_2px_3px_#0003,inset_-1px_-1px_2px_#fff8] group-data-[state=checked]:bg-[#777083]">
          <Switch.Thumb className="block h-[19px] w-[20px] translate-x-0 rounded-[5px] border border-white bg-linear-to-b from-white to-[#dfe1e6] shadow-[0_1px_3px_#0004] transition-transform duration-150 data-[state=checked]:translate-x-[18px] motion-reduce:transition-none" />
        </span>
      </Switch.Root>
    </label>
  );
}
