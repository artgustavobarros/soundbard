import { useCallback, useEffect, useRef, useState } from "react";
import type { Sound } from "../lib/model";
import type { Repository } from "../lib/repository";

function disposeAudio(audio: HTMLAudioElement | null) {
  if (!audio) {
    return;
  }
  audio.onended = null;
  audio.onerror = null;
  audio.onpause = null;
  audio.ontimeupdate = null;
  audio.pause();
  audio.removeAttribute("src");
  audio.load();
}

export function useAudioPreview(
  sound: Sound | undefined,
  repository: Repository,
  report: (message: string) => void
) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const localUrl = useRef<string | null>(null);
  const alive = useRef<boolean>(true);
  const generation = useRef(0);
  const position = useRef(0);
  const bounds = useRef({ end: 0, start: 0 });
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      generation.current += 1;
      disposeAudio(audio.current);
      audio.current = null;
      if (localUrl.current) {
        URL.revokeObjectURL(localUrl.current);
      }
      localUrl.current = null;
    };
  }, []);

  const pause = useCallback(() => {
    generation.current += 1;
    audio.current?.pause();
    if (alive.current) {
      setPlaying(false);
    }
  }, []);
  const reset = useCallback(() => {
    generation.current += 1;
    disposeAudio(audio.current);
    audio.current = null;
    position.current = 0;
    if (alive.current) {
      setPlaying(false);
      setTime(0);
    }
  }, []);
  const seek = useCallback((value: number) => {
    if (!Number.isFinite(value)) {
      return;
    }
    position.current = value;
    if (audio.current) {
      audio.current.pause();
      audio.current.currentTime = value;
    }
    generation.current += 1;
    if (alive.current) {
      setPlaying(false);
      setTime(value);
    }
  }, []);
  const resolveSource = useCallback(
    async (source: string | null) => {
      if (source) {
        return source;
      }
      if (!sound) {
        return null;
      }
      if (localUrl.current) {
        return localUrl.current;
      }
      const file = await repository.file(sound.id);
      if (!alive.current) {
        return null;
      }
      localUrl.current = URL.createObjectURL(file);
      return localUrl.current;
    },
    [repository, sound]
  );

  const prepareAudio = useCallback(
    (url: string) => {
      if (audio.current?.src !== new URL(url, location.href).href) {
        disposeAudio(audio.current);
        audio.current = new Audio(url);
      }
      const { current } = audio;
      current.onerror = () => {
        if (!alive.current) {
          return;
        }
        setPlaying(false);
        report(
          "Não foi possível ouvir a prévia. Confira o serviço local ou carregue o áudio novamente."
        );
      };
      const stopped = () => {
        if (alive.current) {
          setPlaying(false);
        }
      };
      current.onpause = stopped;
      current.onended = stopped;
      current.ontimeupdate = () => {
        if (!alive.current) {
          return;
        }
        const reachedEnd =
          !current.paused && current.currentTime >= bounds.current.end;
        const value = reachedEnd ? bounds.current.end : current.currentTime;
        position.current = value;
        setTime(value);
        if (reachedEnd) {
          current.pause();
          current.currentTime = value;
        }
      };
      return current;
    },
    [report]
  );

  const isCurrent = useCallback(
    (token: number) => alive.current && generation.current === token,
    []
  );
  const play = useCallback(
    async (source: string | null, start: number, end: number) => {
      if (audio.current && !audio.current.paused) {
        pause();
        return;
      }
      generation.current += 1;
      const token = generation.current;
      try {
        const url = await resolveSource(source);
        if (!(url && isCurrent(token))) {
          return;
        }
        const current = prepareAudio(url);
        bounds.current = { end, start };
        const value =
          position.current >= start && position.current < end
            ? position.current
            : start;
        current.currentTime = value;
        position.current = value;
        setTime(value);
        await current.play();
        if (isCurrent(token)) {
          setPlaying(true);
        }
      } catch (error) {
        if (isCurrent(token)) {
          report(
            error instanceof Error
              ? error.message
              : "Não foi possível ouvir a prévia."
          );
        }
      }
    },
    [isCurrent, pause, prepareAudio, report, resolveSource]
  );

  return { pause, play, playing, reset, seek, time };
}
