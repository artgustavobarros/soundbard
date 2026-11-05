"use client";

import {
  CircleCheck,
  CircleX,
  Info,
  LoaderCircle,
  TriangleAlert,
} from "lucide-react";
import { Toaster as Sonner } from "sonner";

export function Toaster() {
  return (
    <Sonner
      className="toaster [font-family:inherit]!"
      closeButton
      containerAriaLabel="Notificações"
      duration={4500}
      icons={{
        error: <CircleX className="text-destructive size-4" />,
        info: <Info className="size-4" />,
        loading: (
          <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" />
        ),
        success: <CircleCheck className="text-primary size-4" />,
        warning: <TriangleAlert className="size-4 text-(--playback)" />,
      }}
      mobileOffset={{
        bottom: "calc(16px + env(safe-area-inset-bottom))",
        left: 16,
        right: 16,
      }}
      position="bottom-right"
      theme="light"
      toastOptions={{
        classNames: {
          closeButton:
            "static! order-last! ms-auto! size-[44px]! shrink-0! transform-none! rounded-lg! border-0! bg-transparent! text-muted-foreground! hover:bg-secondary! hover:text-foreground! focus-visible:outline-2! focus-visible:outline-ring!",
          toast:
            "gap-3! rounded-xl! border-border! bg-(--surface-raised)! p-3! text-foreground! shadow-(--shadow-raised)!",
        },
        closeButtonAriaLabel: "Fechar aviso",
      }}
    />
  );
}
