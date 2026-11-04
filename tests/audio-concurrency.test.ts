import { afterEach, beforeEach, expect, it as test, vi } from "vitest";
import { AudioEngine } from "../src/lib/audio";
import type { Library, Scene } from "../src/lib/model";
import { emptyLibrary } from "../src/lib/model";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

class PlatformAudio {
  dataset: Record<string, string> = {};
  src = "";
  loop = false;
  preload = "";
  hidden = false;
  currentTime = 0;
  duration = 10;
  paused = true;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  play() {
    this.paused = false;
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
  load() {
    this.currentTime = 0;
  }
  remove = vi.fn();
  removeAttribute() {
    this.src = "";
  }
}

function gain() {
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
    gain: {
      cancelAndHoldAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      setTargetAtTime: vi.fn(),
      value: 1,
    },
  };
}

let resume: () => Promise<void>;
let suspend: () => Promise<void>;
const engines: AudioEngine[] = [];

beforeEach(() => {
  resume = () => Promise.resolve();
  suspend = () => Promise.resolve();
  vi.stubGlobal("Audio", PlatformAudio);
  vi.stubGlobal("document", { body: { append: vi.fn() } });
  vi.stubGlobal(
    "AudioContext",
    class {
      destination = {};
      currentTime = 0;
      createGain = gain;
      createMediaElementSource = vi.fn(() => ({
        connect: vi.fn(),
        disconnect: vi.fn(),
      }));
      resume = vi.fn(() => resume());
      suspend = vi.fn(() => suspend());
      close = vi.fn(() => Promise.resolve());
    }
  );
});
afterEach(() => {
  for (const active of engines.splice(0)) {
    active.dispose();
  }
  vi.unstubAllGlobals();
});

const scene = (id: string, layers: string[]): Scene => ({
  effectIds: [],
  id,
  layers: layers.map((soundId) => ({ loop: true, soundId, volume: 0.5 })),
  musicVolume: 0.6,
  name: id,
  playlistId: null,
});
function engine(
  file: (id: string) => Promise<Blob> = () =>
    Promise.resolve(new Blob(["audio"])),
  scenes: Scene[] = []
) {
  const library: Library = {
    ...emptyLibrary(),
    playlists: [
      {
        id: "playlist",
        name: "Jornada",
        repeat: "off",
        shuffle: false,
        soundIds: ["music"],
      },
    ],
    scenes,
    sounds: ["music", "theme", "rain", "wind"].map((id) => ({
      duration: 10,
      id,
      kind: id === "music" || id === "theme" ? "music" : "ambience",
      loop: id !== "music",
      mime: "audio/wav",
      name: id,
      size: 5,
      tags: [],
      volume: 0.75,
    })),
  };
  const instance = new AudioEngine({ file }, library, vi.fn());
  engines.push(instance);
  return instance;
}

test("parar tudo cancela o início de uma playlist enquanto o contexto de áudio desperta", async () => {
  const waking = deferred<void>();
  resume = () => waking.promise;
  const audio = engine();
  const pending = audio.playPlaylist("playlist");
  audio.stopAll();
  waking.resolve();
  await pending;
  expect(audio.snapshot().voices).toEqual([]);
  expect(audio.snapshot().playlistId).toBeNull();
});

test("escolher novamente a cena ativa cancela uma troca de cena ainda pendente", async () => {
  const wind = deferred<Blob>();
  const road = scene("road", ["rain"]);
  const forest = scene("forest", ["rain", "wind"]);
  const audio = engine(
    (id) =>
      id === "wind" ? wind.promise : Promise.resolve(new Blob(["audio"])),
    [road, forest]
  );
  await audio.activateScene(road);
  const rainId = audio.snapshot().voices[0].id;
  const pending = audio.activateScene(forest);
  await audio.activateScene(road);
  wind.resolve(new Blob(["wind"]));
  await pending;
  expect(audio.snapshot().sceneId).toBe("road");
  expect(audio.snapshot().voices.map((voice) => voice.soundId)).toEqual([
    "rain",
  ]);
  expect(audio.snapshot().voices[0].id).toBe(rainId);
});

test("pausar durante o despertar cancela a reprodução que ainda não começou", async () => {
  const waking = deferred<void>();
  resume = () => waking.promise;
  const audio = engine();
  const pending = audio.trigger("rain");
  await audio.pause();
  waking.resolve();
  await pending;
  expect(audio.snapshot().paused).toBe(true);
  expect(audio.snapshot().voices).toEqual([]);
});

test("retomar antes da conclusão da pausa preserva a intenção mais recente", async () => {
  const pausing = deferred<void>();
  const audio = engine();
  await audio.trigger("rain");
  suspend = () => pausing.promise;
  const pending = audio.pause();
  await audio.resume();
  pausing.resolve();
  await pending;
  expect(audio.snapshot().paused).toBe(false);
});

test("alterar o tipo de um ambiente retira a camada incompatível da mistura", async () => {
  const audio = engine();
  await audio.trigger("rain");
  const changed: Library = {
    ...emptyLibrary(),
    sounds: [
      {
        duration: 10,
        id: "rain",
        kind: "effect",
        loop: false,
        mime: "audio/wav",
        name: "Chuva",
        size: 5,
        tags: [],
        volume: 0.75,
      },
    ],
  };
  audio.updateLibrary(changed);
  expect(audio.sceneMix().layers).toEqual([]);
  expect(audio.snapshot().voices).toEqual([]);
});

test("pausa um pad sem interromper outro e mantém essa pausa após o transporte global", async () => {
  const audio = engine();
  await audio.trigger("rain");
  await audio.trigger("wind");
  const rain = audio
    .snapshot()
    .voices.find((voice) => voice.soundId === "rain");
  expect(rain).toBeDefined();
  if (!rain) {
    throw new Error("Chuva não começou.");
  }
  audio.pauseVoice(rain.id);
  expect(
    audio.snapshot().voices.map((voice) => [voice.soundId, voice.paused])
  ).toEqual([
    ["rain", true],
    ["wind", false],
  ]);
  await audio.pause();
  await audio.resume();
  expect(
    audio.snapshot().voices.map((voice) => [voice.soundId, voice.paused])
  ).toEqual([
    ["rain", true],
    ["wind", false],
  ]);
  await audio.resumeVoice(rain.id);
  expect(audio.snapshot().voices.every((voice) => !voice.paused)).toBe(true);
});

test("parar a música cancela a playlist pendente sem parar os ambientes", async () => {
  const music = deferred<Blob>();
  const audio = engine((id) =>
    id === "music" ? music.promise : Promise.resolve(new Blob(["audio"]))
  );
  await audio.trigger("rain");
  const pending = audio.playPlaylist("playlist");
  await Promise.resolve();
  await Promise.resolve();
  audio.stopMusic();
  music.resolve(new Blob(["music"]));
  await pending;
  expect(audio.snapshot().playlistId).toBeNull();
  expect(audio.snapshot().voices.map((voice) => voice.soundId)).toEqual([
    "rain",
  ]);
});

test("parar a música cancela uma playlist que aguarda o contexto despertar", async () => {
  const waking = deferred<void>();
  resume = () => waking.promise;
  const audio = engine();
  const pending = audio.playPlaylist("playlist");
  audio.stopMusic();
  waking.resolve();
  await pending;
  expect(audio.snapshot().voices).toEqual([]);
  expect(audio.snapshot().playlistId).toBeNull();
});

test("parar um pad impede que sua retomada pendente o recrie", async () => {
  const audio = engine();
  await audio.trigger("rain");
  const [voice] = audio.snapshot().voices;
  audio.pauseVoice(voice.id);
  const waking = deferred<void>();
  resume = () => waking.promise;
  const pending = audio.resumeVoice(voice.id);
  audio.stopVoice(voice.id);
  waking.resolve();
  await pending;
  expect(audio.snapshot().voices).toEqual([]);
});

test("sobrepõe dois pads de música e pausa um sem interromper o outro", async () => {
  const audio = engine();
  await audio.trigger("music");
  await audio.trigger("theme");
  expect(audio.snapshot().voices.map((voice) => voice.soundId)).toEqual([
    "music",
    "theme",
  ]);
  const [first] = audio.snapshot().voices;
  audio.pauseVoice(first.id);
  expect(
    audio.snapshot().voices.map((voice) => [voice.soundId, voice.paused])
  ).toEqual([
    ["music", true],
    ["theme", false],
  ]);
});
