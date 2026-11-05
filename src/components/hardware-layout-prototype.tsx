// Três estudos de hardware claro em /previa?estudo=hardware&variant=A|B|C. Sem áudio e sem persistência.
import { cn } from "cn";
import { ArrowLeft, ArrowRight, Square } from "lucide-react";
import { type MouseEvent, useCallback, useEffect, useState } from "react";
import { HardwareCeramicLayout } from "./hardware-prototype-ceramic";
import { HardwareChannelsLayout } from "./hardware-prototype-channels";
import {
  type HardwareSound,
  type HardwareVariant,
  hardwareSounds,
} from "./hardware-prototype-model";
import { HardwareRackLayout } from "./hardware-prototype-rack";
import { Button } from "./ui/button";
import { WorkspaceMenu } from "./workspace-menu";

const variants: HardwareVariant[] = ["A", "B", "C"];
const names = { A: "Cerâmica", B: "Rack OSC", C: "Estúdio" };
const layouts = {
  A: HardwareCeramicLayout,
  B: HardwareRackLayout,
  C: HardwareChannelsLayout,
};
const descriptions = {
  A: "Pad e volume lado a lado, em módulos independentes.",
  B: "Banco de pads e mixer em dois módulos de rack.",
  C: "Um canal completo por som, com volume abaixo do pad.",
};
const buttonClass =
  "h-[44px] touch-manipulation rounded-md bg-transparent px-3 text-[#555963] shadow-none hover:bg-white/60 hover:text-[#151517] focus-visible:outline-[#151517]! focus-visible:ring-0";
const sections = ["Cenas", "Efeitos", "Personalizado"] as const;
const sectionTitles = {
  Cenas: "Taverna",
  Efeitos: "Efeitos",
  Personalizado: "Caminhada à noite",
};
const ignoredArrowTarget =
  "input,textarea,select,[contenteditable],[role=slider],[role=switch],[role=menu],[role=menuitem]";

function HardwareSwitcher({
  variant,
  onChange,
}: {
  variant: HardwareVariant;
  onChange: (variant: HardwareVariant) => void;
}) {
  const move = useCallback(
    (direction: number) => {
      onChange(
        variants[
          (variants.indexOf(variant) + direction + variants.length) %
            variants.length
        ]
      );
    },
    [onChange, variant]
  );
  const previous = useCallback(() => move(-1), [move]);
  const next = useCallback(() => move(1), [move]);
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        (event.target instanceof Element &&
          event.target.closest(ignoredArrowTarget))
      ) {
        return;
      }
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        move(event.key === "ArrowLeft" ? -1 : 1);
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [move]);
  return (
    <nav
      aria-label="Comparar layouts de hardware"
      className="fixed bottom-[calc(12px+env(safe-area-inset-bottom))] left-1/2 z-40 flex w-[390px] max-w-[calc(100vw-24px)] -translate-x-1/2 items-center rounded-[9px] border border-[#d0d2d8] bg-[#f4f5f7] p-1 shadow-[0_5px_16px_#383c451a,inset_0_1px_0_#fff]"
    >
      <Button
        aria-label="Layout anterior"
        className={cn(buttonClass, "w-[44px] p-0")}
        onClick={previous}
        size="icon"
        variant="ghost"
      >
        <ArrowLeft aria-hidden="true" className="size-[16px]" />
      </Button>
      <div className="min-w-0 flex-1 text-center">
        <output aria-live="polite" className="block text-[13px] font-semibold">
          {variant} · {names[variant]}
        </output>
        <span className="text-[10px] text-[#656974]">
          Setas para comparar · sem áudio
        </span>
      </div>
      <Button
        aria-label="Próximo layout"
        className={cn(buttonClass, "w-[44px] p-0")}
        onClick={next}
        size="icon"
        variant="ghost"
      >
        <ArrowRight aria-hidden="true" className="size-[16px]" />
      </Button>
    </nav>
  );
}

export function HardwareLayoutPrototype({
  variant,
  onVariantChange,
}: {
  variant: HardwareVariant;
  onVariantChange: (variant: HardwareVariant) => void;
}) {
  const [sounds, setSounds] = useState(hardwareSounds);
  const [selectedId, setSelectedId] = useState("night");
  const [section, setSection] = useState<(typeof sections)[number]>("Cenas");
  const selected = sounds.find((sound) => sound.id === selectedId) ?? sounds[0];
  const changeSound = useCallback(
    (id: string, update: Partial<HardwareSound>) => {
      setSounds((items) =>
        items.map((sound) =>
          sound.id === id ? { ...sound, ...update } : sound
        )
      );
    },
    []
  );
  const trigger = useCallback((id: string) => {
    setSelectedId(id);
    setSounds((items) =>
      items.map((sound) =>
        sound.id === id
          ? {
              ...sound,
              status: sound.status === "playing" ? "paused" : "playing",
            }
          : sound
      )
    );
  }, []);
  const volume = useCallback(
    (id: string, value: number) => changeSound(id, { volume: value }),
    [changeSound]
  );
  const loop = useCallback(
    (id: string, value: boolean) => changeSound(id, { loop: value }),
    [changeSound]
  );
  const stop = useCallback(
    (id: string) => changeSound(id, { status: "idle" }),
    [changeSound]
  );
  const stopAll = useCallback(() => {
    setMenuOpen(false);
    setSounds((items) => items.map((sound) => ({ ...sound, status: "idle" })));
  }, []);
  const [menuOpen, setMenuOpen] = useState(false);
  const changeSection = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    const label = event.currentTarget.dataset.section;
    if (label === "Cenas" || label === "Efeitos" || label === "Personalizado") {
      setSection(label);
      setMenuOpen(false);
    }
  }, []);
  const visibleSounds = sounds.filter(
    (sound) =>
      section === "Cenas" ||
      (section === "Efeitos"
        ? sound.kind === "Efeito"
        : ["rain", "night", "fire"].includes(sound.id))
  );
  const Layout = layouts[variant];
  const playing = sounds.filter((sound) => sound.status === "playing").length;
  return (
    <main
      className="fixed inset-0 z-10 overflow-hidden bg-[#f8f8f8] text-[#292c33] [--background:#f8f8f8] [--border:#c8cbd2] [--foreground:#292c33] [--muted:#666a73] [--primary-foreground:#fff] [--primary:#151517] [--ring:#151517] [--secondary:#e1e3e8]"
      data-hardware-prototype={variant}
      style={{ colorScheme: "light" }}
    >
      <div className="mx-auto flex h-dvh max-w-[1280px] flex-col gap-2 overflow-hidden px-4 pt-[calc(12px+env(safe-area-inset-top))] pb-[calc(72px+env(safe-area-inset-bottom))] md:gap-5 md:px-8 md:pt-7">
        <WorkspaceMenu onOpenChange={setMenuOpen} open={menuOpen}>
          <nav aria-label="Conjuntos de pads" className="grid gap-2">
            {sections.map((label) => (
              <Button
                aria-pressed={section === label}
                className={cn(
                  buttonClass,
                  "justify-start",
                  section === label && "bg-white/80 text-[#151517]"
                )}
                data-section={label}
                key={label}
                onClick={changeSection}
                variant="ghost"
              >
                {label}
              </Button>
            ))}
          </nav>
          <Button
            className="text-destructive justify-start"
            onClick={stopAll}
            variant="ghost"
          >
            <Square aria-hidden="true" className="size-4" />
            Parar todos os pads demonstrativos
          </Button>
          <p className="text-muted-foreground mt-auto text-[12px]">
            Prévia sem áudio · {playing} em reprodução
          </p>
        </WorkspaceMenu>
        <section
          aria-label="Mesa demonstrativa"
          className="flex min-h-0 flex-1 flex-col gap-2 md:gap-5"
        >
          <div className="flex shrink-0 items-baseline justify-between gap-2">
            <h1 className="text-[18px]! font-semibold! tracking-normal!">
              {sectionTitles[section]}
            </h1>
            <span className="text-[11px] text-[#626773]">
              {visibleSounds.length} pads
            </span>
          </div>
          <div className="flex min-h-0 flex-1 flex-col">
            <Layout
              onLoop={loop}
              onSelect={setSelectedId}
              onStop={stop}
              onTrigger={trigger}
              onVolume={volume}
              selectedId={selectedId}
              sounds={visibleSounds}
            />
          </div>
        </section>
        <p className="sr-only" role="status">
          {descriptions[variant]} {selected.name}: volume {selected.volume}%,
          loop {selected.loop ? "ligado" : "desligado"}.
        </p>
      </div>
      <HardwareSwitcher onChange={onVariantChange} variant={variant} />
    </main>
  );
}
