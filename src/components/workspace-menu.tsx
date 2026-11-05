import { Plus } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./ui/sheet";

export function WorkspaceMenu({
  children,
  open,
  onOpenChange,
  onAddAudio,
}: {
  children: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddAudio?: () => void;
}) {
  return (
    <header className="flex h-[44px] shrink-0 items-center justify-start">
      <Sheet onOpenChange={onOpenChange} open={open}>
        <SheetTrigger asChild>
          <Button
            aria-label="Abrir menu"
            className="size-[44px] flex-col items-start gap-[6px] rounded-none p-0 hover:bg-transparent"
            size="icon"
            variant="ghost"
          >
            <span
              aria-hidden="true"
              className="h-[2px] w-full shrink-0 rounded-full bg-current"
              data-menu-line
            />
            <span
              aria-hidden="true"
              className="h-[2px] w-4/5 shrink-0 rounded-full bg-current"
              data-menu-line
            />
            <span
              aria-hidden="true"
              className="h-[2px] w-3/5 shrink-0 rounded-full bg-current"
              data-menu-line
            />
          </Button>
        </SheetTrigger>
        <SheetContent
          className="w-[min(340px,100vw)]! max-w-none! gap-6 overflow-y-auto border-0 p-6 pt-[calc(24px+env(safe-area-inset-top))] pb-[calc(24px+env(safe-area-inset-bottom))]"
          side="left"
        >
          <SheetHeader className="pr-11">
            <SheetTitle>Menu da mesa</SheetTitle>
            <SheetDescription>
              Seus sons, conjuntos e biblioteca.
            </SheetDescription>
          </SheetHeader>
          {children}
        </SheetContent>
      </Sheet>
      {onAddAudio ? (
        <Button
          aria-label="Adicionar músicas"
          className="ml-auto size-[44px] shrink-0 p-0"
          onClick={onAddAudio}
          size="icon"
          title="Adicionar músicas"
          variant="ghost"
        >
          <Plus aria-hidden="true" className="size-6" />
        </Button>
      ) : null}
    </header>
  );
}
