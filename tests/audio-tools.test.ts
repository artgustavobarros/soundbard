import { describe, expect, it, vi } from "vitest";
import {
  audioRangeError,
  createAudioDownload,
  createPreparedClip,
  getAudioWaveform,
  lookupYouTube,
  preparedAudioFile,
} from "../src/lib/audio-tools";

const readyJob = {
  duration: 3,
  error: null,
  filename: "Chuva.mp3",
  id: "job-1",
  message: "Áudio pronto",
  progress: 100,
  status: "ready",
};

describe("preparação de áudio", () => {
  it("prepara um novo trecho da fonte já carregada sem reenviar o link", async () => {
    const submitted: { path: string; body: unknown }[] = [];
    vi.stubGlobal("fetch", (path: string, options: RequestInit) => {
      submitted.push({ body: JSON.parse(String(options.body)), path });
      return Promise.resolve(Response.json(readyJob));
    });
    try {
      await createPreparedClip("fonte-1", { end: 3, name: "Trecho", start: 1 });
      expect(submitted).toEqual([
        {
          body: { end: 3, name: "Trecho", start: 1 },
          path: "/api/audio-jobs/fonte-1/clips",
        },
      ]);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("recusa amplitudes inválidas em vez de desenhar uma onda inventada", async () => {
    vi.stubGlobal("fetch", async () =>
      Response.json({ duration: 8, peaks: [0, -0.1, 1.1] })
    );
    try {
      await expect(getAudioWaveform("fonte-1")).rejects.toThrow(
        "resposta inválida"
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("preserva as amplitudes reais recebidas, incluindo silêncio", async () => {
    const waveform = { duration: 8, peaks: [0, 0, 0.25, 0.9, 0.1, 0] };
    vi.stubGlobal("fetch", async () => Response.json(waveform));
    try {
      expect(await getAudioWaveform("fonte-1")).toEqual(waveform);
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it("recusa intervalos inválidos antes de enviar um corte", () => {
    expect(audioRangeError(1, 3, 8)).toBeNull();
    for (const [start, end, length] of [
      [-1, 3, 8],
      [3, 3, 8],
      [4, 3, 8],
      [1, 9, 8],
      [Number.NaN, 3, 8],
      [1, Number.POSITIVE_INFINITY, 8],
      [0, 1, 0],
    ]) {
      expect(audioRangeError(start, end, length)).toEqual(expect.any(String));
    }
  });

  it("preserva erro útil de validação retornado pela API", async () => {
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response(
          JSON.stringify({
            detail: [
              { loc: ["body", "url"], msg: "Use um link de vídeo do YouTube." },
            ],
          }),
          { headers: { "Content-Type": "application/json" }, status: 422 }
        )
    );
    try {
      await expect(lookupYouTube("link inválido")).rejects.toThrow(
        "Use um link de vídeo do YouTube."
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("identifica servidor estático no lugar da API sem tentar importar HTML", async () => {
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response("<html>Soundbard</html>", {
          headers: { "Content-Type": "text/html" },
        })
    );
    try {
      await expect(
        lookupYouTube("https://youtu.be/abcdefghijk")
      ).rejects.toThrow("serviço local");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("não aceita tarefa malformada como download preparado", async () => {
    vi.stubGlobal("fetch", async () =>
      Response.json({ ...readyJob, status: "unexpected" })
    );
    try {
      await expect(
        createAudioDownload({
          end: 3,
          name: "Chuva",
          start: 0,
          url: "https://youtu.be/abcdefghijk",
        })
      ).rejects.toThrow("resposta inválida");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("recusa uma página HTML que tenha sido entregue como arquivo de áudio", async () => {
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response("<html>sem API</html>", {
          headers: { "Content-Type": "text/html" },
        })
    );
    try {
      await expect(preparedAudioFile(readyJob.id, "Chuva")).rejects.toThrow(
        "arquivo de áudio"
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
