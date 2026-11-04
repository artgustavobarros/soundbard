import { Pause, Play } from "lucide-react";
import { useCallback, useId, useMemo } from "react";
import type { AudioWaveform } from "../lib/audio-tools";
import { duration as formatDuration } from "../lib/utils";
import { Button } from "./ui/button";
import { Slider } from "./ui/slider";

interface Props {
  disabled: boolean;
  end: number;
  onMarkEnd: () => void;
  onMarkStart: () => void;
  onPlay: () => void;
  onRange: (values: number[]) => void;
  onSeek: (values: number[]) => void;
  playing: boolean;
  ready: boolean;
  start: number;
  time: number;
  waveform: AudioWaveform;
}

function waveformPath(peaks: number[]) {
  const step = 1000 / peaks.length;
  const top = peaks
    .map((peak, index) => `${(index + 0.5) * step},${50 - peak * 47}`)
    .join(" L");
  const bottom = peaks
    .map((peak, index) => `${(index + 0.5) * step},${50 + peak * 47}`)
    .reverse()
    .join(" L");
  return `M0,50 L${top} L1000,50 L${bottom} Z`;
}
const buttonClass =
  "min-h-[44px] border-[#444] bg-transparent px-3 text-white hover:border-[#69aeff] hover:bg-[#242424]";

export function AudioWaveformEditor({
  waveform,
  start,
  end,
  time,
  playing,
  disabled,
  ready,
  onRange,
  onSeek,
  onPlay,
  onMarkStart,
  onMarkEnd,
}: Props) {
  const clipId = useId();
  const path = useMemo(() => waveformPath(waveform.peaks), [waveform.peaks]);
  const length = waveform.duration;
  const selectionStart = Math.max(0, Math.min(1000, (start / length) * 1000));
  const selectionEnd = Math.max(
    selectionStart,
    Math.min(1000, (end / length) * 1000)
  );
  const position = Math.max(0, Math.min(1000, (time / length) * 1000));
  const changeRange = useCallback(
    (values: number[]) => {
      if (values[1] > values[0]) {
        onRange(values);
      }
    },
    [onRange]
  );
  return (
    <section
      aria-label="Prévia e seleção do corte"
      className="grid min-w-0 gap-3 border-y border-[#303030] py-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-[#b8b8b8]">
        <span>Forma de onda do áudio</span>
        <span className="tabular-nums">
          {formatDuration(start)} – {formatDuration(end)}
        </span>
      </div>
      <div className="relative h-[96px] min-w-0 bg-[#181818]">
        <svg
          aria-label="Forma de onda do áudio"
          className="pointer-events-none absolute inset-0 size-full"
          preserveAspectRatio="none"
          role="img"
          viewBox="0 0 1000 100"
        >
          <title>
            Amplitudes reais do áudio. Arraste os marcadores de início e fim
            para selecionar um trecho.
          </title>
          <defs>
            <clipPath id={clipId}>
              <rect
                height="100"
                width={selectionEnd - selectionStart}
                x={selectionStart}
                y="0"
              />
            </clipPath>
          </defs>
          <line
            stroke="#444"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
            x1="0"
            x2="1000"
            y1="50"
            y2="50"
          />
          <path d={path} fill="#666" />
          <path clipPath={`url(#${clipId})`} d={path} fill="#eee" />
          {!ready && (
            <line
              stroke="#69aeff"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
              x1={position}
              x2={position}
              y1="0"
              y2="100"
            />
          )}
        </svg>
        <Slider
          aria-label="Intervalo do corte"
          className="h-full [&_[data-slot=slider-range]]:bg-white/5 [&_[data-slot=slider-thumb]]:h-[96px] [&_[data-slot=slider-thumb]]:w-[10px] [&_[data-slot=slider-thumb]]:rounded-[2px] [&_[data-slot=slider-thumb]]:border-[#ff8848] [&_[data-slot=slider-thumb]]:bg-[#ff8848]/30 [&_[data-slot=slider-track]]:h-full [&_[data-slot=slider-track]]:rounded-none [&_[data-slot=slider-track]]:bg-transparent"
          disabled={disabled || ready}
          max={length}
          min={0}
          minStepsBetweenThumbs={1}
          onValueChange={changeRange}
          step={0.01}
          thumbLabels={["Início do corte", "Fim do corte"]}
          value={[
            Math.max(0, Math.min(length, start)),
            Math.max(0, Math.min(length, end)),
          ]}
        />
      </div>
      {!ready && (
        <>
          <div className="flex items-center justify-between gap-2">
            <Button
              className={buttonClass}
              disabled={disabled || end <= start}
              onClick={onPlay}
              type="button"
              variant="outline"
            >
              {playing ? (
                <Pause aria-hidden="true" />
              ) : (
                <Play aria-hidden="true" />
              )}
              {playing ? "Pausar prévia" : "Ouvir seleção"}
            </Button>
            <output
              aria-label="Posição da prévia"
              className="text-[12px] text-[#b8b8b8] tabular-nums"
            >
              {formatDuration(time)} / {formatDuration(length)}
            </output>
          </div>
          <Slider
            aria-label="Posição da prévia"
            className="h-[32px]"
            disabled={disabled}
            max={length}
            min={0}
            onValueChange={onSeek}
            step={0.01}
            value={[Math.max(0, Math.min(length, time))]}
          />
          <div className="grid grid-cols-2 gap-2">
            <Button
              className={buttonClass}
              disabled={disabled || time >= end}
              onClick={onMarkStart}
              type="button"
              variant="outline"
            >
              Marcar início
            </Button>
            <Button
              className={buttonClass}
              disabled={disabled || time <= start}
              onClick={onMarkEnd}
              type="button"
              variant="outline"
            >
              Marcar fim
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
