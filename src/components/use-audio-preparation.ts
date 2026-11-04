import { useCallback, useEffect, useRef, useState } from "react";
import {
  type AudioJob,
  type AudioWaveform,
  createPreparedClip,
  deleteAudioJob,
  getAudioJob,
  getAudioWaveform,
} from "../lib/audio-tools";

interface ClipCompletion {
  id: string | null;
  resolve: (job: AudioJob | null) => void;
}

function pending(job: AudioJob | null) {
  return Boolean(
    job && ["queued", "downloading", "processing"].includes(job.status)
  );
}
function failure(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Não foi possível preparar o áudio.";
}
function dispose(id: string | null) {
  if (id) {
    deleteAudioJob(id).catch(() => undefined);
  }
}

export function useAudioPreparation(report: (message: string) => void) {
  const [source, setSource] = useState<AudioJob | null>(null);
  const [clip, setClip] = useState<AudioJob | null>(null);
  const [waveform, setWaveform] = useState<AudioWaveform | null>(null);
  const [creating, setCreating] = useState<"source" | "clip" | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const sourceId = useRef<string | null>(null);
  const clipId = useRef<string | null>(null);
  const alive = useRef<boolean>(true);
  const generation = useRef(0);
  const clipCompletion = useRef<ClipCompletion | null>(null);
  const finishClip = useCallback((job: AudioJob | null) => {
    const completion = clipCompletion.current;
    clipCompletion.current = null;
    completion?.resolve(job);
  }, []);
  const pendingSource = pending(source) ? source : null;
  const activeJob = pending(clip) ? clip : pendingSource;

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      generation.current += 1;
      finishClip(null);
      dispose(clipId.current);
      dispose(sourceId.current);
    };
  }, [finishClip]);
  useEffect(() => {
    if (!activeJob) {
      return;
    }
    const controller = new AbortController();
    const token = generation.current;
    const update = activeJob.id === sourceId.current ? setSource : setClip;
    const current = () =>
      !controller.signal.aborted &&
      alive.current &&
      generation.current === token;
    const timer = setTimeout(() => {
      getAudioJob(activeJob.id, controller.signal)
        .then((value) => {
          if (current()) {
            update(value);
            if (clipCompletion.current?.id === value.id && !pending(value)) {
              finishClip(value.status === "ready" ? value : null);
            }
          }
        })
        .catch((error) => {
          if (current()) {
            const message = failure(error);
            update({ ...activeJob, error: message, message, status: "error" });
            if (clipCompletion.current?.id === activeJob.id) {
              finishClip(null);
            }
            report(message);
          }
        });
    }, 500);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [activeJob, finishClip, report]);
  useEffect(() => {
    if (source?.status !== "ready") {
      return;
    }
    const controller = new AbortController();
    getAudioWaveform(source.id, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted && alive.current) {
          setWaveform(value);
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted && alive.current) {
          report(failure(error));
        }
      });
    return () => controller.abort();
  }, [report, source]);

  const clear = useCallback(() => {
    generation.current += 1;
    finishClip(null);
    dispose(clipId.current);
    dispose(sourceId.current);
    clipId.current = null;
    sourceId.current = null;
    setClip(null);
    setSource(null);
    setWaveform(null);
    setCreating(null);
    setCancelling(false);
  }, [finishClip]);
  const removePrevious = useCallback(async (target: "source" | "clip") => {
    if (clipId.current) {
      await deleteAudioJob(clipId.current);
    }
    if (target === "source" && sourceId.current) {
      await deleteAudioJob(sourceId.current);
    }
  }, []);
  const execute = useCallback(
    async (
      target: "source" | "clip",
      task: (isCurrent: () => boolean) => Promise<AudioJob | null>
    ): Promise<AudioJob | null> => {
      generation.current += 1;
      finishClip(null);
      const token = generation.current;
      const current = () => alive.current && generation.current === token;
      setCreating(target);
      report("");
      try {
        await removePrevious(target);
        if (!current()) {
          return null;
        }
        clipId.current = null;
        setClip(null);
        if (target === "source") {
          sourceId.current = null;
          setSource(null);
          setWaveform(null);
        }
        const job = await task(current);
        if (!job) {
          return null;
        }
        if (!current()) {
          dispose(job.id);
          return null;
        }
        if (target === "source") {
          sourceId.current = job.id;
          setSource(job);
        } else {
          clipId.current = job.id;
          setClip(job);
        }
        return job;
      } catch (error) {
        if (current()) {
          report(failure(error));
        }
        return null;
      } finally {
        if (current()) {
          setCreating(null);
        }
      }
    },
    [finishClip, removePrevious, report]
  );
  const createSource = useCallback(
    (task: (isCurrent: () => boolean) => Promise<AudioJob | null>) =>
      execute("source", task),
    [execute]
  );
  const createClip = useCallback(
    (value: { name: string; start: number; end: number }) => {
      const id = sourceId.current;
      if (!id) {
        return Promise.resolve(null);
      }
      return new Promise<AudioJob | null>((resolve) => {
        const request = execute("clip", () => createPreparedClip(id, value));
        const completion: ClipCompletion = { id: null, resolve };
        clipCompletion.current = completion;
        request.then((job) => {
          if (clipCompletion.current !== completion) {
            return;
          }
          if (job && pending(job)) {
            completion.id = job.id;
            return;
          }
          finishClip(job?.status === "ready" ? job : null);
        });
      });
    },
    [execute, finishClip]
  );
  const cancel = useCallback(async () => {
    generation.current += 1;
    const token = generation.current;
    const current = () => alive.current && generation.current === token;
    finishClip(null);
    const onlyClip = creating === "clip" || clipId.current !== null;
    const id = onlyClip ? clipId.current : sourceId.current;
    setCancelling(true);
    try {
      if (id) {
        await deleteAudioJob(id);
      }
      if (!current()) {
        return;
      }
      clipId.current = null;
      setClip(null);
      if (!onlyClip) {
        sourceId.current = null;
        setSource(null);
        setWaveform(null);
      }
      setCreating(null);
      report("");
    } catch (error) {
      if (current()) {
        report(failure(error));
      }
    } finally {
      if (current()) {
        setCancelling(false);
      }
    }
  }, [creating, finishClip, report]);
  const retry = useCallback(async () => {
    report("");
    const candidate = activeJob ?? clip ?? source;
    if (!candidate) {
      return;
    }
    const token = generation.current;
    const current = () =>
      alive.current &&
      generation.current === token &&
      [sourceId.current, clipId.current].includes(candidate.id);
    try {
      const job = await getAudioJob(candidate.id);
      if (!current()) {
        return;
      }
      if (job.id === sourceId.current) {
        setSource(job);
      } else {
        setClip(job);
      }
    } catch (error) {
      if (current()) {
        report(failure(error));
      }
    }
  }, [activeJob, clip, report, source]);
  return {
    active: pending(source) || pending(clip),
    busy: Boolean(creating || cancelling),
    cancel,
    cancelling,
    clear,
    clip,
    createClip,
    createSource,
    creating,
    job: clip ?? source,
    ready: clip?.status === "ready",
    retry,
    source,
    sourceReady: source?.status === "ready" && waveform !== null,
    waveform,
  };
}
