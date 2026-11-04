import { z } from "zod";

const jobSchema = z.object({
  duration: z.number().finite().positive().nullable(),
  error: z.string().nullable(),
  filename: z.string().nullable(),
  id: z.string().min(1),
  message: z.string(),
  progress: z.number().finite().min(0).max(100),
  status: z.enum([
    "queued",
    "downloading",
    "processing",
    "ready",
    "error",
    "cancelled",
  ]),
});
const metadataSchema = z.object({
  duration: z.number().finite().positive(),
  title: z.string().min(1),
  url: z.string().url(),
});
const waveformSchema = z.object({
  duration: z.number().finite().positive(),
  peaks: z.array(z.number().finite().min(0).max(1)).min(1).max(8192),
});
const errorSchema = z.object({
  detail: z.union([z.string(), z.array(z.object({ msg: z.string() }))]),
});
const serviceUnavailable =
  "Não foi possível acessar o serviço local de áudio. Inicie o Soundbard com pnpm start e tente novamente.";

export type AudioJob = z.infer<typeof jobSchema>;
export type YouTubeMetadata = z.infer<typeof metadataSchema>;
export type AudioWaveform = z.infer<typeof waveformSchema>;
export interface AudioDownload {
  end: number | null;
  name: string;
  purpose?: "preview" | "clip";
  start: number;
  url: string;
}

export function audioRangeError(start: number, end: number, duration: number) {
  if (
    !(
      Number.isFinite(start) &&
      Number.isFinite(end) &&
      Number.isFinite(duration)
    ) ||
    duration <= 0 ||
    start < 0 ||
    end <= start ||
    end > duration
  ) {
    return "Escolha um início a partir de zero e um fim maior que o início, dentro da duração do áudio.";
  }
  return null;
}

async function serviceFetch(path: string, options: RequestInit = {}) {
  try {
    return await fetch(path, { ...options, cache: "no-store" });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    throw new Error(serviceUnavailable, { cause: error });
  }
}

async function responseData(response: Response): Promise<unknown> {
  if (!response.headers.get("content-type")?.includes("application/json")) {
    throw new Error(serviceUnavailable);
  }
  const data: unknown = await response.json();
  if (!response.ok) {
    const parsed = errorSchema.safeParse(data);
    const detail = parsed.success ? parsed.data.detail : null;
    throw new Error(
      typeof detail === "string"
        ? detail
        : (detail?.map((issue) => issue.msg).join(" ") ??
            "Não foi possível preparar o áudio. Tente novamente.")
    );
  }
  return data;
}

async function request<T extends z.ZodType>(
  path: string,
  schema: T,
  options?: RequestInit
): Promise<z.infer<T>> {
  const data = await responseData(await serviceFetch(path, options));
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw new Error(
      "O serviço local de áudio enviou uma resposta inválida. Reinicie o Soundbard e tente novamente."
    );
  }
  return parsed.data;
}

export function lookupYouTube(url: string, signal?: AbortSignal) {
  return request("/api/youtube/metadata", metadataSchema, {
    body: JSON.stringify({ url }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
    signal,
  });
}

export function createAudioDownload(value: AudioDownload) {
  return request("/api/audio-jobs", jobSchema, {
    body: JSON.stringify(value),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
}

export function createAudioClip(
  file: File,
  name: string,
  start: number,
  end: number | null,
  purpose: "preview" | "clip" = "clip"
) {
  const body = new FormData();
  body.set("file", file);
  body.set("name", name);
  body.set("start", String(start));
  if (end !== null) {
    body.set("end", String(end));
  }
  body.set("purpose", purpose);
  return request("/api/audio-jobs/upload", jobSchema, { body, method: "POST" });
}

export function createPreparedClip(
  sourceId: string,
  value: { name: string; start: number; end: number }
) {
  return request(
    `/api/audio-jobs/${encodeURIComponent(sourceId)}/clips`,
    jobSchema,
    {
      body: JSON.stringify(value),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    }
  );
}

export function getAudioWaveform(sourceId: string, signal?: AbortSignal) {
  return request(
    `/api/audio-jobs/${encodeURIComponent(sourceId)}/waveform`,
    waveformSchema,
    { signal }
  );
}

export function getAudioJob(id: string, signal?: AbortSignal) {
  return request(`/api/audio-jobs/${encodeURIComponent(id)}`, jobSchema, {
    signal,
  });
}

export function audioJobFileUrl(id: string) {
  return `/api/audio-jobs/${encodeURIComponent(id)}/file`;
}

export async function preparedAudioFile(
  id: string,
  name: string,
  signal?: AbortSignal
) {
  const response = await serviceFetch(audioJobFileUrl(id), { signal });
  if (!response.ok) {
    await responseData(response);
  }
  const type = response.headers.get("content-type")?.split(";")[0];
  if (!(type?.startsWith("audio/") || type === "application/octet-stream")) {
    throw new Error("O serviço local não entregou um arquivo de áudio válido.");
  }
  const blob = await response.blob();
  if (!blob.size) {
    throw new Error(
      "O arquivo de áudio preparado está vazio. Prepare o trecho novamente."
    );
  }
  return new File([blob], `${name.trim() || "Áudio"}.mp3`, {
    type: "audio/mpeg",
  });
}

export async function deleteAudioJob(id: string) {
  const response = await serviceFetch(
    `/api/audio-jobs/${encodeURIComponent(id)}`,
    {
      keepalive: true,
      method: "DELETE",
    }
  );
  if (!(response.ok || response.status === 404)) {
    await responseData(response);
  }
}
