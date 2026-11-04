import { useCallback, useEffect, useRef, useState } from "react";
import { audioDuration } from "../lib/repository";

export interface AudioFile {
  duration: number;
  file: File;
  id: string;
}

const AUDIO_EXTENSION = /\.(?:mp3|wav|ogg)$/iu;

async function validateFile(file: File) {
  try {
    if (!(AUDIO_EXTENSION.test(file.name) && file.size)) {
      throw new Error("Use um arquivo MP3, WAV ou OGG válido.");
    }
    return {
      duration: await audioDuration(file),
      file,
      id: crypto.randomUUID(),
    };
  } catch (error) {
    return `${file.name}: ${error instanceof Error ? error.message : "Não foi possível ler o áudio."}`;
  }
}

export function useAudioFiles() {
  const [files, setFiles] = useState<AudioFile[]>([]);
  const [index, setIndex] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [validating, setValidating] = useState(false);
  const generation = useRef(0);

  useEffect(
    () => () => {
      generation.current += 1;
    },
    []
  );

  const pick = useCallback(async (input: File[]) => {
    generation.current += 1;
    const token = generation.current;
    setFiles([]);
    setErrors([]);
    setIndex(0);
    setValidating(true);
    try {
      const results = await Promise.all(input.map(validateFile));
      if (generation.current !== token) {
        return null;
      }
      const valid = results.filter((result) => typeof result !== "string");
      setErrors([
        ...new Set(results.filter((result) => typeof result === "string")),
      ]);
      setFiles(valid);
      return valid[0] ?? null;
    } finally {
      if (generation.current === token) {
        setValidating(false);
      }
    }
  }, []);
  const select = useCallback(
    (next: number) => {
      const selected = files[next];
      if (selected) {
        setIndex(next);
      }
      return selected;
    },
    [files]
  );

  const cancelValidation = useCallback(() => {
    generation.current += 1;
    setValidating(false);
  }, []);

  return {
    cancelValidation,
    errors,
    files,
    index,
    pick,
    select,
    selected: files[index],
    validating,
  };
}
