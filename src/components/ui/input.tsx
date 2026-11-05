import { cn } from "cn";
import type * as React from "react";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "border-input selection:bg-primary selection:text-primary-foreground file:text-foreground placeholder:text-muted-foreground text-foreground h-[44px] w-full min-w-0 rounded-lg border bg-(--surface-inset) px-3 py-2 text-base shadow-(--shadow-inset) transition-[border-color,box-shadow] duration-150 outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none md:text-sm",
        "focus-visible:border-ring focus-visible:ring-ring/20 focus-visible:ring-[3px]",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
        className
      )}
      data-slot="input"
      type={type}
      {...props}
    />
  );
}

export { Input };
