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
        error: <CircleX className="size-4 text-[#ff9292]" />,
        info: <Info className="size-4" />,
        loading: (
          <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" />
        ),
        success: <CircleCheck className="size-4" />,
        warning: <TriangleAlert className="size-4 text-[#ff8848]" />,
      }}
      mobileOffset={{
        left: 16,
        right: 16,
        top: "calc(12px + env(safe-area-inset-top))",
      }}
      position="top-right"
      theme="dark"
      toastOptions={{
        classNames: {
          closeButton:
            "static! order-last! ms-auto! size-11! shrink-0! transform-none! border-0! bg-transparent! text-[#a6a6a6]! hover:text-white! focus-visible:outline-2! focus-visible:outline-[#69aeff]!",
          toast:
            "gap-3! rounded-[6px]! border-[#444]! bg-[#111]! p-3! text-[#fafafa]! shadow-none!",
        },
        closeButtonAriaLabel: "Fechar aviso",
      }}
    />
  );
}
