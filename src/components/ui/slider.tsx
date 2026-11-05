"use client";

import { cn } from "cn";
import { Slider as SliderPrimitive } from "radix-ui";
import { type ComponentProps, useId } from "react";

const sliderStyles = {
  default: {
    range: "bg-primary",
    root: "data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:w-auto",
    thumb:
      "border-border hover:border-ring size-4 rounded-[5px] border bg-(--surface-raised) shadow-(--shadow-raised) before:top-1/2 before:left-1/2 before:size-[44px] before:-translate-1/2",
    track:
      "bg-secondary rounded-full shadow-(--shadow-inset) data-[orientation=horizontal]:h-1.5 data-[orientation=horizontal]:w-full data-[orientation=vertical]:w-1.5",
  },
  fader: {
    range: "bg-primary",
    root: "h-full min-h-0 w-[40px]",
    thumb:
      "h-[36px] w-[26px] rounded-[5px] border border-white bg-linear-to-b from-white to-[#d9dce2] shadow-[0_2px_4px_#0003] before:inset-[-14px] after:absolute after:top-1/2 after:right-[6px] after:left-[6px] after:h-[3px] after:-translate-y-1/2 after:rounded-full after:bg-primary",
    track: "w-[4px] bg-primary shadow-[inset_1px_0_2px_#0003]",
  },
  waveform: {
    range: "bg-primary/5",
    root: "h-full",
    thumb:
      "h-[96px] w-px bg-primary before:inset-y-0 before:left-1/2 before:w-[44px] before:-translate-x-1/2",
    track: "h-full w-full bg-transparent",
  },
};

function Slider({
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  thumbLabels,
  variant = "default",
  ...props
}: ComponentProps<typeof SliderPrimitive.Root> & {
  thumbLabels?: readonly string[];
  variant?: keyof typeof sliderStyles;
}) {
  const id = useId();
  const values = value ?? defaultValue ?? [min, max];
  const thumbIds = Array.from(
    { length: values.length },
    (_, position) => `${id}-thumb-${position}`
  );

  return (
    <SliderPrimitive.Root
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      className={cn(
        "relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50 data-[orientation=vertical]:h-full data-[orientation=vertical]:flex-col",
        sliderStyles[variant].root,
        className
      )}
      data-slot="slider"
      defaultValue={defaultValue}
      max={max}
      min={min}
      value={value}
      {...props}
    >
      <SliderPrimitive.Track
        className={cn(
          "relative grow overflow-hidden data-[orientation=vertical]:h-full",
          sliderStyles[variant].track
        )}
        data-slot="slider-track"
      >
        <SliderPrimitive.Range
          className={cn(
            "absolute data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full",
            sliderStyles[variant].range
          )}
          data-slot="slider-range"
        />
      </SliderPrimitive.Track>
      {thumbIds.map((thumbId, index) => (
        <SliderPrimitive.Thumb
          aria-label={thumbLabels?.[index] ?? ariaLabel}
          aria-labelledby={ariaLabelledBy}
          className={cn(
            "ring-ring/25 relative block shrink-0 transition-[border-color,box-shadow] before:absolute focus-visible:ring-4 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50",
            sliderStyles[variant].thumb
          )}
          data-slot="slider-thumb"
          key={thumbId}
        />
      ))}
    </SliderPrimitive.Root>
  );
}

export { Slider };
