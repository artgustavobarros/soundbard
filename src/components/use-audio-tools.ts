import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";
import {
  type AudioJob,
  audioJobFileUrl,
  audioRangeError,
  createAudioClip,
  createAudioDownload,
  lookupYouTube,
  preparedAudioFile,
  type YouTubeMetadata,
} from "../lib/audio-tools";
import type { Kind, Sound } from "../lib/model";
import type { ServerRepository as Repository } from "../lib/server-repository";
import { type AudioFile, useAudioFiles } from "./use-audio-files";
import { useAudioPreparation } from "./use-audio-preparation";
import { useAudioPreview } from "./use-audio-preview";

export interface AudioToolsProps {
  knownTags: string[];
  onClose: () => void;
  onImport: (file: File, kind: Kind, tags: string[]) => Promise<boolean>;
  onImportFiles?: (
    files: File[],
    kind: Kind,
    tags: string[]
  ) => Promise<boolean>;
  repository: Repository;
  sound?: Sound;
  source?: "youtube" | "file";
}
interface AudioSelection {
  end: number;
  sourceDuration: number | undefined;
  start: number;
}

function selectionForDuration(
  selection: AudioSelection,
  sourceDuration: number | undefined
): AudioSelection {
  if (
    sourceDuration === undefined ||
    selection.sourceDuration === sourceDuration
  ) {
    return selection;
  }
  return {
    end: Math.min(selection.end, sourceDuration),
    sourceDuration,
    start: Math.min(selection.start, Math.max(0, sourceDuration - 0.01)),
  };
}

function useAudioSource(
  sound: Sound | undefined,
  sourceDuration: number | undefined
) {
  const [url, setUrl] = useState("");
  const [metadata, setMetadata] = useState<YouTubeMetadata | null>(null);
  const [name, setName] = useState(
    sound ? `${sound.name} (trecho)`.slice(0, 200) : ""
  );
  const [kind, setKind] = useState<Kind>(sound?.kind ?? "music");
  const [tags, setTags] = useState<string[]>(sound?.tags ?? []);
  const [selection, setSelection] = useState<AudioSelection>({
    end: sound?.duration ?? 0,
    sourceDuration,
    start: 0,
  });
  const { start, end } = selectionForDuration(selection, sourceDuration);
  const setStart = useCallback(
    (value: number) => {
      setSelection((current) => ({
        ...selectionForDuration(current, sourceDuration),
        sourceDuration,
        start: value,
      }));
    },
    [sourceDuration]
  );
  const setEnd = useCallback(
    (value: number) => {
      setSelection((current) => ({
        ...selectionForDuration(current, sourceDuration),
        end: value,
        sourceDuration,
      }));
    },
    [sourceDuration]
  );
  const duration = sound?.duration ?? metadata?.duration ?? 0;
  const rangeError = duration ? audioRangeError(start, end, duration) : null;
  const changeUrl = useCallback((value: string) => {
    setUrl(value);
    setMetadata(null);
  }, []);
  return {
    duration,
    end,
    kind,
    metadata,
    name,
    rangeError,
    setEnd,
    setKind,
    setMetadata,
    setName,
    setStart,
    setTags,
    setUrl: changeUrl,
    start,
    tags,
    url,
  };
}

const FILE_EXTENSION = /\.[^.]+$/u;
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/u;
const VIDEO_PATH = /^\/(?:shorts|live|embed)\/(?:[A-Za-z0-9_-]{11})\/?$/u;
const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
]);
function completeYouTubeUrl(value: string) {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.port || url.username || url.password) {
      return false;
    }
    if (url.hostname === "youtu.be" || url.hostname === "www.youtu.be") {
      return VIDEO_ID.test(url.pathname.slice(1));
    }
    if (!YOUTUBE_HOSTS.has(url.hostname)) {
      return false;
    }
    if (url.pathname === "/watch") {
      const ids = url.searchParams.getAll("v");
      return ids.length === 1 && VIDEO_ID.test(ids[0]);
    }
    return VIDEO_PATH.test(url.pathname);
  } catch {
    return false;
  }
}

function failureMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function taskPhase(
  lookup: boolean,
  importing: boolean,
  cancelling: boolean,
  creating: boolean
) {
  if (lookup) {
    return "metadata";
  }
  if (importing) {
    return "importing";
  }
  if (cancelling) {
    return "cancelling";
  }
  if (creating) {
    return "creating";
  }
  return "idle";
}
function sourceExtension(mime: string) {
  if (mime.includes("wav")) {
    return "wav";
  }
  if (mime.includes("ogg")) {
    return "ogg";
  }
  return "mp3";
}

async function localAudioSource(
  sound: Sound,
  repository: Repository,
  name: string,
  isCurrent: () => boolean
) {
  const blob = await repository.file(sound.id);
  if (!isCurrent()) {
    return null;
  }
  const file = new File(
    [blob],
    `${sound.name}.${sourceExtension(sound.mime)}`,
    { type: sound.mime }
  );
  return createAudioClip(file, name.trim(), 0, null, "preview");
}

function canImportSelection(
  sourceReady: boolean,
  rangeError: string | null,
  name: string,
  busy: boolean,
  active: boolean
) {
  return (
    sourceReady && !rangeError && name.trim().length > 0 && !busy && !active
  );
}

function preparationError(
  error: string,
  job: AudioJob | null,
  cancelled: boolean
) {
  if (error || job?.error) {
    return error || job?.error || "";
  }
  return cancelled || job?.status === "cancelled"
    ? "A tarefa foi cancelada. Tente novamente quando quiser."
    : "";
}

export function useAudioTools({
  sound,
  repository,
  onImport,
  onImportFiles,
  onClose,
  knownTags,
  source: sourceType = "youtube",
}: AudioToolsProps) {
  const [error, setError] = useState("");
  const preparation = useAudioPreparation(setError);
  const upload = useAudioFiles();
  const selectedUpload = upload.selected?.file;
  const fileMode = sourceType === "file" && !sound;
  const form = useAudioSource(sound, preparation.waveform?.duration);
  const {
    name,
    kind,
    tags,
    start,
    end,
    setMetadata,
    setName,
    setStart,
    setEnd,
    url,
  } = form;
  const [lookup, setLookup] = useState(false);
  const [importing, setImporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [retryController, setRetryController] =
    useState<AbortController | null>(null);
  const alive = useRef<boolean>(true);
  const request = useRef<AbortController | null>(null);
  const preview = useAudioPreview(sound, repository, setError);
  const { source, clip, waveform, active, ready, sourceReady } = preparation;
  const duration =
    waveform?.duration ?? upload.selected?.duration ?? form.duration;
  const rangeError = duration ? audioRangeError(start, end, duration) : null;
  const busy =
    lookup || saving || importing || preparation.busy || upload.validating;
  const locked = busy || active || ready;
  const phase = upload.validating
    ? "validating"
    : taskPhase(
        lookup,
        importing,
        preparation.cancelling,
        preparation.creating !== null
      );

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      request.current?.abort();
    };
  }, []);

  const close = useCallback(() => {
    if (!importing) {
      request.current?.abort();
      preview.reset();
      onClose();
    }
  }, [importing, onClose, preview]);
  const changeOpen = useCallback(
    (open: boolean) => {
      if (!open) {
        close();
      }
    },
    [close]
  );
  const changeUrl = useCallback(
    (value: string) => {
      request.current?.abort();
      preview.reset();
      preparation.clear();
      setLookup(false);
      setSaving(false);
      setCancelled(false);
      setRetryController(null);
      form.setUrl(value);
      setError("");
    },
    [form, preparation, preview]
  );
  const resetUpload = useCallback(() => {
    request.current?.abort();
    preview.reset();
    preparation.clear();
    setLookup(false);
    setSaving(false);
    setCancelled(false);
    setRetryController(null);
    setError("");
  }, [preparation, preview]);
  const showUpload = useCallback(
    (entry: AudioFile) => {
      setName(entry.file.name.replace(FILE_EXTENSION, "").slice(0, 200));
      setStart(0);
      setEnd(entry.duration);
    },
    [setEnd, setName, setStart]
  );
  const changeFiles = useCallback(
    async (files: File[]) => {
      resetUpload();
      const entry = await upload.pick(files);
      if (entry) {
        showUpload(entry);
      }
    },
    [resetUpload, showUpload, upload]
  );
  const selectFile = useCallback(
    (index: number) => {
      resetUpload();
      const entry = upload.select(index);
      if (entry) {
        showUpload(entry);
      }
    },
    [resetUpload, showUpload, upload]
  );
  const changeStart = useCallback(
    (value: number) => {
      preview.pause();
      setStart(value);
    },
    [preview, setStart]
  );
  const changeEnd = useCallback(
    (value: number) => {
      preview.pause();
      setEnd(value);
    },
    [preview, setEnd]
  );
  const changeRange = useCallback(
    ([first, last]: number[]) => {
      preview.pause();
      setStart(first);
      setEnd(last);
    },
    [preview, setEnd, setStart]
  );
  const seek = useCallback(
    ([value]: number[]) => preview.seek(Math.max(0, Math.min(duration, value))),
    [duration, preview]
  );
  const markStart = useCallback(
    () => changeStart(Math.round(preview.time * 1000) / 1000),
    [changeStart, preview.time]
  );
  const markEnd = useCallback(
    () => changeEnd(Math.round(preview.time * 1000) / 1000),
    [changeEnd, preview.time]
  );

  const isCurrentRequest = useCallback(
    (controller: AbortController): boolean =>
      alive.current && !controller.signal.aborted,
    []
  );
  const loadSource = useEffectEvent(async (controller: AbortController) => {
    if (!isCurrentRequest(controller)) {
      return;
    }
    setError("");
    setCancelled(false);
    preview.reset();
    if (!(sound || selectedUpload || completeYouTubeUrl(url))) {
      setError("Use um link HTTPS de um vídeo do YouTube.");
      return;
    }
    try {
      if (selectedUpload) {
        await preparation.createSource(() =>
          createAudioClip(selectedUpload, name.trim(), 0, null, "preview")
        );
        return;
      }
      if (sound) {
        await preparation.createSource((isCurrent) =>
          localAudioSource(
            sound,
            repository,
            name,
            () => isCurrentRequest(controller) && isCurrent()
          )
        );
        return;
      }
      setLookup(true);
      const value = await lookupYouTube(url.trim(), controller.signal);
      if (!isCurrentRequest(controller)) {
        return;
      }
      setMetadata(value);
      setName(value.title.slice(0, 200));
      setStart(0);
      setEnd(value.duration);
      setLookup(false);
      await preparation.createSource(() =>
        createAudioDownload({
          end: null,
          name: value.title.slice(0, 200),
          purpose: "preview",
          start: 0,
          url: value.url,
        })
      );
    } catch (failure) {
      if (isCurrentRequest(controller)) {
        setError(
          failureMessage(failure, "Não foi possível carregar a prévia.")
        );
      }
    } finally {
      if (isCurrentRequest(controller)) {
        setLookup(false);
      }
    }
  });
  const soundId = sound?.id;
  useEffect(() => {
    if (!(soundId || selectedUpload || url.trim())) {
      return;
    }
    const controller = retryController ?? new AbortController();
    request.current = controller;
    const timer = setTimeout(
      () => loadSource(controller),
      soundId || selectedUpload ? 0 : 600
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [retryController, selectedUpload, soundId, url]);
  const cancel = useCallback(async () => {
    upload.cancelValidation();
    request.current?.abort();
    preview.reset();
    setLookup(false);
    setSaving(false);
    setCancelled(true);
    await preparation.cancel();
  }, [preparation, preview, upload]);
  const importPrepared = useCallback(
    async (id: string, controller: AbortController) => {
      setImporting(true);
      try {
        const file = await preparedAudioFile(id, name, controller.signal);
        if (!isCurrentRequest(controller)) {
          return;
        }
        const saved =
          fileMode && onImportFiles
            ? await onImportFiles(
                upload.files.map((entry) =>
                  entry.file === selectedUpload ? file : entry.file
                ),
                kind,
                tags
              )
            : await onImport(file, kind, tags);
        if (!isCurrentRequest(controller)) {
          return;
        }
        if (saved) {
          onClose();
        } else {
          setError(
            "Não foi possível adicionar à biblioteca. O áudio preparado foi preservado; tente novamente."
          );
        }
      } finally {
        if (isCurrentRequest(controller)) {
          setImporting(false);
        }
      }
    },
    [
      fileMode,
      isCurrentRequest,
      kind,
      name,
      onClose,
      onImport,
      onImportFiles,
      selectedUpload,
      tags,
      upload.files,
    ]
  );
  const originalUpload = useCallback(() => {
    if (!selectedUpload || start !== 0 || end < duration - 0.01) {
      return null;
    }
    const extension = selectedUpload.name.split(".").pop() ?? "mp3";
    return new File([selectedUpload], `${name.trim()}.${extension}`, {
      type: selectedUpload.type,
    });
  }, [duration, end, name, selectedUpload, start]);
  const importOriginal = useCallback(
    async (file: File, controller: AbortController) => {
      setImporting(true);
      try {
        const files = upload.files.map((entry) =>
          entry.file === selectedUpload ? file : entry.file
        );
        const saved = onImportFiles
          ? await onImportFiles(files, kind, tags)
          : await onImport(file, kind, tags);
        if (isCurrentRequest(controller) && saved) {
          onClose();
        }
        if (isCurrentRequest(controller) && !saved) {
          setError("Não foi possível adicionar à biblioteca. Tente novamente.");
        }
      } finally {
        if (isCurrentRequest(controller)) {
          setImporting(false);
        }
      }
    },
    [
      isCurrentRequest,
      kind,
      onClose,
      onImport,
      onImportFiles,
      selectedUpload,
      tags,
      upload.files,
    ]
  );
  const canAdd = canImportSelection(
    sourceReady,
    rangeError,
    name,
    busy,
    active
  );
  const add = useCallback(async () => {
    if (!canAdd) {
      return;
    }
    preview.reset();
    setError("");
    setSaving(true);
    const controller = new AbortController();
    request.current = controller;
    try {
      const original = originalUpload();
      if (original) {
        await importOriginal(original, controller);
        return;
      }
      const result =
        clip && ready
          ? clip
          : await preparation.createClip({ end, name: name.trim(), start });
      if (result && isCurrentRequest(controller)) {
        await importPrepared(result.id, controller);
      }
    } catch (failure) {
      if (isCurrentRequest(controller)) {
        setError(failureMessage(failure, "Não foi possível salvar o áudio."));
      }
    } finally {
      if (isCurrentRequest(controller)) {
        setSaving(false);
      }
    }
  }, [
    clip,
    canAdd,
    importPrepared,
    importOriginal,
    originalUpload,
    isCurrentRequest,
    end,
    name,
    preparation,
    preview,
    ready,
    start,
  ]);
  const retry = useCallback(() => {
    if (clip && ready) {
      add();
      return;
    }
    if (source?.status === "ready" || active) {
      preparation.retry();
      return;
    }
    preparation.clear();
    setError("");
    setCancelled(false);
    setRetryController(new AbortController());
  }, [active, add, clip, preparation, ready, source]);
  const listen = useCallback(() => {
    if (clip && ready) {
      preview.play(audioJobFileUrl(clip.id), 0, clip.duration ?? end - start);
    } else if (source && sourceReady && !rangeError) {
      preview.play(audioJobFileUrl(source.id), start, end);
    }
  }, [clip, end, preview, rangeError, ready, source, sourceReady, start]);
  const { job } = preparation;
  const message = preparationError(error, job, cancelled);
  const hasInput = Boolean(
    sound || selectedUpload || (!fileMode && completeYouTubeUrl(url))
  );
  return {
    ...form,
    active,
    add,
    busy,
    canAdd,
    cancel,
    canRetry: hasInput,
    changeFiles,
    changeOpen,
    close,
    duration,
    error: message,
    fileErrors: upload.errors,
    fileIndex: upload.index,
    fileMode,
    files: upload.files,
    hasSource: source !== null,
    job,
    knownTags,
    listen,
    loading: upload.validating || (hasInput && !sourceReady && !message),
    locked,
    markEnd,
    markStart,
    phase,
    playing: preview.playing,
    rangeError,
    ready,
    retry,
    saving,
    seek,
    selectFile,
    setEnd: changeEnd,
    setRange: changeRange,
    setStart: changeStart,
    setUrl: changeUrl,
    sound,
    sourceReady,
    time: preview.time,
    waveform,
  };
}
