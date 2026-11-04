"use client";

import { cn } from "cn";
import { Slider as SliderPrimitive } from "radix-ui";
import { type ComponentProps, useId } from "react";

function Slider({
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  thumbLabels,
  ...props
}: ComponentProps<typeof SliderPrimitive.Root> & {
  thumbLabels?: readonly string[];
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
        "relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col",
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
          "bg-muted relative grow overflow-hidden rounded-full data-[orientation=horizontal]:h-1.5 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5"
        )}
        data-slot="slider-track"
      >
        <SliderPrimitive.Range
          className={cn(
            "bg-primary absolute data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full"
          )}
          data-slot="slider-range"
        />
      </SliderPrimitive.Track>
      {thumbIds.map((thumbId, index) => (
        <SliderPrimitive.Thumb
          aria-label={thumbLabels?.[index] ?? ariaLabel}
          aria-labelledby={ariaLabelledBy}
          className="border-primary ring-ring/50 block size-4 shrink-0 rounded-full border bg-white shadow-sm transition-[color,box-shadow] hover:ring-4 focus-visible:ring-4 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50"
          data-slot="slider-thumb"
          key={thumbId}
        />
      ))}
    </SliderPrimitive.Root>
  );
}

export { Slider };
