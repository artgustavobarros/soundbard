import { cn } from "cn";
import { AudioLines, Play, Repeat2, Volume2, X } from "lucide-react";
import type { ChangeEvent } from "react";
import { useCallback } from "react";
import type { AudioEngine, AudioView } from "../lib/audio";
import type { Sound } from "../lib/model";
import type { WorkspaceState } from "./application";
import { MusicPanel } from "./music-view";
import { ScenePanel } from "./scenes-view";
import { Button } from "./ui/button";

function duration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function MixerRow({
  engine,
  sound,
  voice,
}: {
  engine: AudioEngine;
  sound: Sound;
  voice: AudioView;
}) {
  const stop = useCallback(
    () => engine.stopVoice(voice.id),
    [engine, voice.id]
  );
  const volume = useCallback(
    (event: ChangeEvent<HTMLInputElement>) =>
      engine.setVolume(voice.id, Number(event.target.value)),
    [engine, voice.id]
  );
  const loop = useCallback(
    () => engine.setLoop(voice.id, !voice.loop),
    [engine, voice.id, voice.loop]
  );
  return (
    <div className="border-border border-t py-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className="size-1.5 shrink-0 rounded-full bg-[var(--playback)]" />
        <strong className="flex-1 truncate text-[13px] font-[550]">
          {sound.name}
        </strong>
        <span className="text-muted-foreground text-xs tabular-nums">
          {duration(voice.time)}
        </span>
        <Button
          aria-label={`Parar ${sound.name}`}
          onClick={stop}
          size="icon"
          variant="ghost"
        >
          <X size={15} />
        </Button>
      </div>
      <div className="text-muted-foreground mt-1.5 ml-4 flex items-center gap-2.5">
        <Volume2 size={15} />
        <input
          aria-label={`Volume de ${sound.name}`}
          className="w-full flex-1"
          max="1"
          min="0"
          onChange={volume}
          step="0.01"
          type="range"
          value={voice.volume}
        />
        <output className="w-8 text-right text-xs tabular-nums">
          {Math.round(voice.volume * 100)}%
        </output>
        <button
          aria-label={`Loop de ${sound.name}`}
          aria-pressed={voice.loop}
          className={cn(
            "grid size-8 place-items-center rounded-md p-1 transition-colors",
            voice.loop
              ? "text-primary opacity-100"
              : "text-muted-foreground opacity-60 hover:opacity-100"
          )}
          onClick={loop}
          type="button"
        >
          <Repeat2 size={17} />
        </button>
      </div>
    </div>
  );
}

export function LayersPanel({ state }: { state: WorkspaceState }) {
  const { engine, activeVoices, soundById, setView } = state;
  const layers = activeVoices.filter((voice) => voice.role !== "music");
  const library = useCallback(() => setView("library"), [setView]);
  return (
    <section className="min-w-0 rounded-[14px] bg-[var(--surface)] p-4 shadow-[var(--shadow-raised)] sm:p-5 md:p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold sm:text-lg">
          <AudioLines size={19} /> Camadas de som
        </h2>
        <span className="text-muted-foreground text-xs">
          {layers.length} ativas
        </span>
      </div>
      {layers.map((voice) => {
        const sound = soundById.get(voice.soundId);
        return sound ? (
          <MixerRow
            engine={engine}
            key={voice.id}
            sound={sound}
            voice={voice}
          />
        ) : null;
      })}
      {layers.length === 0 ? (
        <div className="text-muted-foreground flex flex-col items-center justify-center gap-2 py-8 text-center">
          <AudioLines size={29} />
          <p className="text-foreground text-sm font-medium">
            O ambiente começa aqui.
          </p>
          <span className="text-xs">
            Ative uma cena ou toque um som da biblioteca.
          </span>
          <Button className="mt-2" onClick={library} variant="ghost">
            Abrir biblioteca
          </Button>
        </div>
      ) : null}
    </section>
  );
}

export function EffectButton({
  sound,
  trigger,
}: {
  sound: Sound;
  trigger: WorkspaceState["triggerSound"];
}) {
  const play = useCallback(() => trigger(sound.id), [sound.id, trigger]);
  return (
    <button
      aria-label={`Disparar ${sound.name}`}
      className="border-border text-foreground flex min-w-0 items-center gap-2.5 rounded-lg border bg-[var(--surface-raised)] p-3 text-left shadow-[var(--shadow-raised)] transition-all hover:bg-[var(--surface-hover)] active:scale-[0.98] sm:gap-3 sm:p-3.5"
      onClick={play}
      type="button"
    >
      <Play className="shrink-0" size={16} />
      <strong className="flex-1 truncate text-xs font-medium">
        {sound.name}
      </strong>
      <span className="text-muted-foreground hidden text-[11px] tabular-nums sm:inline">
        {duration(sound.duration)}
      </span>
    </button>
  );
}

export function EffectsPanel({ state }: { state: WorkspaceState }) {
  const { library, activeScene, triggerSound } = state;
  const effects = library.sounds.filter(
    (sound) =>
      sound.kind === "effect" &&
      (!activeScene || activeScene.effectIds.includes(sound.id))
  );
  return (
    <section className="mt-5 min-w-0 rounded-[14px] bg-[var(--surface)] p-4 shadow-[var(--shadow-raised)] sm:p-5 md:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold sm:text-lg">Efeitos à mão</h2>
          <p className="text-muted-foreground text-xs">
            Clique para disparar. Clique novamente para sobrepor.
          </p>
        </div>
        <span className="text-muted-foreground text-xs">
          {activeScene?.name ?? "Da sua biblioteca"}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-[repeat(auto-fill,minmax(165px,1fr))] sm:gap-3">
        {effects.map((sound) => (
          <EffectButton key={sound.id} sound={sound} trigger={triggerSound} />
        ))}
      </div>
      {effects.length === 0 ? (
        <p className="text-muted-foreground pt-4 text-[13px] leading-[1.7]">
          Importe sons como Efeito e adicione-os à cena. Uma espada, uma porta,
          um trovão: cada detalhe conta.
        </p>
      ) : null}
    </section>
  );
}

export function DeskView({ state }: { state: WorkspaceState }) {
  return (
    <>
      <ScenePanel state={state} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5">
        <MusicPanel state={state} />
        <LayersPanel state={state} />
      </div>
      <EffectsPanel state={state} />
    </>
  );
}
