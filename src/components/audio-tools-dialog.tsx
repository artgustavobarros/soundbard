import { LoaderCircle, Pause, Play, Upload } from "lucide-react";
import type { ChangeEvent, Ref } from "react";
import { useCallback, useEffect, useRef } from "react";
import { restoreWorkspaceFocus } from "../lib/dialog-focus";
import { duration as formatDuration } from "../lib/utils";
import { AudioWaveformEditor } from "./audio-waveform-editor";
import { TagsInput } from "./tags-input";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { type AudioToolsProps, useAudioTools } from "./use-audio-tools";

type ToolsState = ReturnType<typeof useAudioTools>;
const fieldClass =
  "min-h-[44px] w-full min-w-0 border-border bg-(--surface-raised) text-[16px] text-foreground";
const secondaryButton =
  "min-h-[44px] border-border bg-transparent text-foreground hover:border-ring hover:bg-secondary";

function YouTubeSource({ tools }: { tools: ToolsState }) {
  const { url, setUrl, phase } = tools;
  const changeUrl = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setUrl(event.currentTarget.value),
    [setUrl]
  );
  return (
    <div className="grid gap-2">
      <Label htmlFor="youtube-link">Link do YouTube</Label>
      <Input
        autoComplete="off"
        className={fieldClass}
        id="youtube-link"
        onChange={changeUrl}
        placeholder="https://www.youtube.com/watch?v=…"
        readOnly={phase === "importing"}
        type="url"
        value={url}
      />
    </div>
  );
}

function FileSource({ tools }: { tools: ToolsState }) {
  const input = useRef<HTMLInputElement>(null);
  const { files, fileIndex, fileErrors, changeFiles, selectFile, phase } =
    tools;
  let buttonLabel = "Selecionar arquivos";
  if (files.length === 1) {
    buttonLabel = files[0].file.name;
  } else if (files.length > 1) {
    buttonLabel = `${files.length} arquivos selecionados`;
  }
  const choose = useCallback(() => input.current?.click(), []);
  const change = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const selected = Array.from(event.currentTarget.files ?? []);
      event.currentTarget.value = "";
      changeFiles(selected);
    },
    [changeFiles]
  );
  const select = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      selectFile(Number(event.currentTarget.value));
    },
    [selectFile]
  );
  return (
    <section aria-label="Arquivos selecionados" className="grid min-w-0 gap-3">
      <input
        accept=".mp3,.wav,.ogg,audio/mpeg,audio/wav,audio/ogg"
        aria-label="Arquivos de áudio"
        disabled={phase === "importing"}
        hidden
        multiple
        onChange={change}
        ref={input}
        type="file"
      />
      <Button
        className={`${secondaryButton} min-w-0`}
        disabled={phase === "importing"}
        onClick={choose}
        title={buttonLabel}
        type="button"
        variant="outline"
      >
        <Upload aria-hidden="true" />
        <span className="min-w-0 truncate">{buttonLabel}</span>
      </Button>
      {files.length > 0 && (
        <ul
          aria-label="Nomes dos arquivos"
          className="text-muted-foreground grid max-h-28 gap-1 overflow-y-auto text-[13px]"
        >
          {files.map((entry) => (
            <li className="break-words" key={entry.id}>
              {entry.file.name}
            </li>
          ))}
        </ul>
      )}
      {files.length > 1 && (
        <>
          <div className="grid gap-2">
            <Label htmlFor="file-to-clip">Arquivo para cortar</Label>
            <select
              className={fieldClass}
              disabled={phase === "importing"}
              id="file-to-clip"
              onChange={select}
              value={fileIndex}
            >
              {files.map((entry, index) => (
                <option key={entry.id} value={index}>
                  {entry.file.name}
                </option>
              ))}
            </select>
          </div>
          <p className="text-muted-foreground text-[12px]">
            O arquivo selecionado pode ser cortado; os demais serão importados
            inteiros.
          </p>
        </>
      )}
      {fileErrors.length > 0 && (
        <div className="text-destructive grid gap-1 text-[13px]" role="alert">
          {fileErrors.map((message) => (
            <p className="break-words" key={message}>
              {message}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}

function AudioDetails({ tools }: { tools: ToolsState }) {
  const {
    name,
    setName,
    kind,
    setKind,
    start,
    setStart,
    end,
    setEnd,
    duration,
    locked,
    sound,
    metadata,
  } = tools;
  const changeName = useCallback(
    (event: ChangeEvent<HTMLInputElement>) =>
      setName(event.currentTarget.value),
    [setName]
  );
  const changeKind = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const { value } = event.currentTarget;
      if (value === "music" || value === "ambience" || value === "effect") {
        setKind(value);
      }
    },
    [setKind]
  );
  const changeStart = useCallback(
    (event: ChangeEvent<HTMLInputElement>) =>
      setStart(event.currentTarget.valueAsNumber),
    [setStart]
  );
  const changeEnd = useCallback(
    (event: ChangeEvent<HTMLInputElement>) =>
      setEnd(event.currentTarget.valueAsNumber),
    [setEnd]
  );
  return (
    <fieldset className="grid min-w-0 gap-3">
      <legend className="text-muted-foreground mb-3 max-w-full text-[13px] break-words">
        {sound?.name ?? metadata?.title} · {formatDuration(duration)}
      </legend>
      <div className="grid gap-2">
        <Label htmlFor="prepared-audio-name">Nome do áudio</Label>
        <Input
          className={fieldClass}
          id="prepared-audio-name"
          maxLength={200}
          onChange={changeName}
          readOnly={locked}
          required
          value={name}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="prepared-audio-kind">Tipo do áudio</Label>
        <select
          className={fieldClass}
          disabled={locked}
          id="prepared-audio-kind"
          onChange={changeKind}
          value={kind}
        >
          <option value="music">Música</option>
          <option value="ambience">Ambiente</option>
          <option value="effect">Efeito</option>
        </select>
      </div>
      <TagsInput
        disabled={locked}
        label="Tags"
        onChange={tools.setTags}
        options={tools.knownTags}
        value={tools.tags}
      />
      <div className="grid min-w-0 grid-cols-2 gap-3">
        <div className="grid min-w-0 gap-2">
          <Label htmlFor="audio-start">Início (segundos)</Label>
          <Input
            aria-describedby="audio-range-help"
            className={fieldClass}
            id="audio-start"
            max={duration}
            min={0}
            onChange={changeStart}
            readOnly={locked}
            required
            step="any"
            type="number"
            value={Number.isFinite(start) ? start : ""}
          />
        </div>
        <div className="grid min-w-0 gap-2">
          <Label htmlFor="audio-end">Fim (segundos)</Label>
          <Input
            aria-describedby="audio-range-help"
            className={fieldClass}
            id="audio-end"
            max={duration}
            min={0}
            onChange={changeEnd}
            readOnly={locked}
            required
            step="any"
            type="number"
            value={Number.isFinite(end) ? end : ""}
          />
        </div>
      </div>
      <p className="text-muted-foreground text-[12px]" id="audio-range-help">
        O trecho será salvo em MP3. O áudio original será preservado.
      </p>
    </fieldset>
  );
}

function AudioPreview({ tools }: { tools: ToolsState }) {
  const { ready, listen, playing, time, rangeError, phase, job } = tools;
  const listenLabel = ready ? "Ouvir áudio preparado" : "Ouvir trecho";
  const buttonLabel = playing ? "Pausar prévia" : listenLabel;
  if (!ready) {
    return null;
  }
  return (
    <section
      aria-label={ready ? "Áudio preparado" : "Prévia do trecho"}
      className="border-border flex flex-wrap items-center justify-between gap-2 border-y py-3"
    >
      <Button
        className={secondaryButton}
        disabled={
          Boolean(rangeError) || phase === "creating" || phase === "importing"
        }
        onClick={listen}
        type="button"
        variant="outline"
      >
        {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
        {buttonLabel}
      </Button>
      <output
        aria-label="Posição da prévia"
        className="text-muted-foreground text-[12px] tabular-nums"
      >
        {formatDuration(time)}
        {ready && job?.duration ? ` / ${formatDuration(job.duration)}` : ""}
      </output>
    </section>
  );
}

function JobProgress({ tools }: { tools: ToolsState }) {
  const { job, ready, loading, phase, sourceReady } = tools;
  if (!(job || loading)) {
    return null;
  }
  const awaitingWaveform = job?.status === "ready" && !sourceReady;
  let message = job?.message ?? "Carregando prévia…";
  if (phase === "metadata") {
    message = "Consultando vídeo…";
  } else if (phase === "validating") {
    message = "Verificando arquivos de áudio…";
  } else if (awaitingWaveform) {
    message = "Carregando forma de onda…";
  } else if (job?.status === "ready" && sourceReady && !ready) {
    message = "Prévia pronta. Ouça e escolha o trecho para adicionar.";
  }
  const progress = awaitingWaveform ? undefined : job?.progress;
  return (
    <section aria-label="Preparação do áudio" className="grid gap-2">
      <div className="flex justify-between gap-2 text-[12px]">
        <span role="status">{message}</span>
        {progress !== undefined && (
          <output className="tabular-nums">{Math.round(progress)}%</output>
        )}
      </div>
      <progress
        aria-label="Progresso do áudio"
        className="bg-secondary accent-primary [&::-moz-progress-bar]:bg-primary [&::-webkit-progress-bar]:bg-secondary [&::-webkit-progress-value]:bg-primary h-2 w-full appearance-none overflow-hidden rounded-full shadow-(--shadow-inset)"
        max={100}
        value={progress}
      />
    </section>
  );
}

function PrepareAudio({
  tools,
  editorRef,
}: {
  tools: ToolsState;
  editorRef: Ref<HTMLElement>;
}) {
  const { ready, active, busy, rangeError, waveform } = tools;
  return (
    <section
      aria-label="Seleção do áudio"
      className="grid gap-4 outline-none"
      ref={editorRef}
      tabIndex={-1}
    >
      {waveform ? (
        <AudioWaveformEditor
          disabled={busy || active}
          end={tools.end}
          onMarkEnd={tools.markEnd}
          onMarkStart={tools.markStart}
          onPlay={tools.listen}
          onRange={tools.setRange}
          onSeek={tools.seek}
          playing={tools.playing}
          ready={ready}
          start={tools.start}
          time={tools.time}
          waveform={waveform}
        />
      ) : (
        <p className="text-muted-foreground text-[12px]">
          A forma de onda real aparecerá assim que a análise terminar. Você
          poderá ouvir e marcar o corte antes de adicionar à biblioteca.
        </p>
      )}
      <AudioPreview tools={tools} />
      <AudioDetails tools={tools} />
      {rangeError !== null && (
        <p className="text-destructive text-[13px]" role="alert">
          {rangeError}
        </p>
      )}
    </section>
  );
}

function addButtonLabel(importing: boolean, saving: boolean, loading: boolean) {
  if (loading) {
    return "Carregando áudio…";
  }
  if (importing) {
    return "Adicionando…";
  }
  return saving ? "Preparando trecho…" : "Adicionar à biblioteca";
}

function dialogTitle(cutting: boolean, fileMode: boolean) {
  if (cutting) {
    return "Cortar áudio";
  }
  return fileMode ? "Importar arquivo de áudio" : "Importar do YouTube";
}
function dialogDescription(cutting: boolean, fileMode: boolean) {
  if (cutting) {
    return "Escolha o trecho que deseja guardar como um novo áudio na sua mesa.";
  }
  return fileMode
    ? "Selecione seus arquivos. A prévia e a forma de onda carregam automaticamente."
    : "Cole um link. A prévia e a forma de onda carregam automaticamente.";
}

export function AudioToolsDialog(props: AudioToolsProps) {
  const tools = useAudioTools(props);
  const {
    sound,
    fileMode,
    error,
    ready,
    active,
    busy,
    phase,
    cancel,
    loading,
    sourceReady,
    canAdd,
    canRetry,
    saving,
    retry,
    close,
    add,
    changeOpen,
  } = tools;
  const editorRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (sourceReady) {
      editorRef.current?.focus({ preventScroll: true });
      editorRef.current?.scrollIntoView({
        behavior: "instant",
        block: "start",
      });
    }
  }, [sourceReady]);
  return (
    <Dialog onOpenChange={changeOpen} open>
      <DialogContent
        className="border-border text-foreground flex! max-h-[92dvh] flex-col gap-0 overflow-hidden bg-(--surface-raised) p-0 sm:max-w-[500px]"
        onCloseAutoFocus={restoreWorkspaceFocus}
        showCloseButton={false}
      >
        <section
          aria-label="Configuração do áudio"
          className="grid min-h-0 gap-4 overflow-y-auto p-4"
        >
          <DialogHeader className="text-left">
            <DialogTitle>{dialogTitle(Boolean(sound), fileMode)}</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {dialogDescription(Boolean(sound), fileMode)}
            </DialogDescription>
          </DialogHeader>
          {!sound &&
            (fileMode ? (
              <FileSource tools={tools} />
            ) : (
              <YouTubeSource tools={tools} />
            ))}
          {error.length > 0 && (
            <p
              className="text-destructive text-[13px] break-words"
              role="alert"
            >
              {error}
            </p>
          )}
          {sourceReady === true && (
            <PrepareAudio editorRef={editorRef} tools={tools} />
          )}
        </section>
        <div className="border-border grid shrink-0 gap-3 border-t bg-(--surface-raised) p-4">
          <JobProgress tools={tools} />
          <div className="flex flex-wrap justify-end gap-2">
            {(loading || active || phase === "creating") && (
              <Button
                className={secondaryButton}
                disabled={phase === "cancelling"}
                onClick={cancel}
                type="button"
                variant="outline"
              >
                Cancelar tarefa
              </Button>
            )}
            {error.length > 0 && canRetry && (
              <Button
                className={secondaryButton}
                disabled={busy}
                onClick={retry}
                type="button"
                variant="outline"
              >
                Tentar novamente
              </Button>
            )}
            {ready === true && (
              <Button
                className={secondaryButton}
                disabled={busy}
                onClick={cancel}
                type="button"
                variant="outline"
              >
                Ajustar trecho
              </Button>
            )}
            <Button
              className={secondaryButton}
              disabled={phase === "importing"}
              onClick={close}
              type="button"
              variant="outline"
            >
              Fechar
            </Button>
            <Button
              aria-busy={loading || saving}
              className="bg-primary text-primary-foreground hover:bg-primary/90 min-h-[44px]"
              disabled={!canAdd}
              onClick={add}
              type="button"
            >
              {loading || saving ? (
                <LoaderCircle
                  aria-hidden="true"
                  className="animate-spin motion-reduce:animate-none"
                />
              ) : (
                <Upload aria-hidden="true" />
              )}
              {addButtonLabel(phase === "importing", saving, loading)}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
