import type { Kind, Layer, Library, Scene } from "./model";
import { Queue, transition } from "./model";
import type { Repository } from "./repository";

type Role = "music" | "layer" | "effect" | "preview";
const roles: Record<Kind, Role> = {
  ambience: "layer",
  effect: "effect",
  music: "preview",
};
const voiceKinds: Record<Role, Kind> = {
  effect: "effect",
  layer: "ambience",
  music: "music",
  preview: "music",
};
interface Voice {
  audio: HTMLAudioElement;
  gain: GainNode;
  id: string;
  paused: boolean;
  retireAt: number | null;
  role: Role;
  soundId: string;
  source: MediaElementAudioSourceNode;
  url: string;
  volume: number;
}
export interface AudioView {
  duration: number;
  id: string;
  loop: boolean;
  paused: boolean;
  retiring: boolean;
  role: Role;
  soundId: string;
  time: number;
  volume: number;
}
export interface Playback {
  master: number;
  musicVolume: number;
  paused: boolean;
  playlistId: string | null;
  sceneId: string | null;
  voices: AudioView[];
}

export class AudioEngine {
  private readonly repository: Pick<Repository, "file">;
  private library: Library;
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private readonly voices = new Map<string, Voice>();
  private readonly listeners = new Set<() => void>();
  private readonly timer: ReturnType<typeof setInterval>;
  private queue: Queue | null = null;
  private musicId: string | null = null;
  private musicGeneration = 0;
  private musicRequest = 0;
  private sceneGeneration = 0;
  private epoch = 0;
  private transportGeneration = 0;
  private readonly pendingLayers = new Set<string>();
  private sceneId: string | null = null;
  private playlistId: string | null = null;
  private paused: Playback["paused"] = false;
  private master: number;
  private musicVolume = 0.7;
  private view: Playback;

  private readonly report: (message: string) => void;

  constructor(
    repository: Pick<Repository, "file">,
    library: Library,
    report: (message: string) => void
  ) {
    this.report = report;
    this.repository = repository;
    this.library = library;
    this.master = library.master;
    this.view = {
      master: this.master,
      musicVolume: this.musicVolume,
      paused: false,
      playlistId: null,
      sceneId: null,
      voices: [],
    };
    this.timer = setInterval(() => {
      if (!this.voices.size || this.paused) {
        return;
      }
      for (const voice of this.voices.values()) {
        if (
          voice.retireAt !== null &&
          this.context &&
          this.context.currentTime >= voice.retireAt
        ) {
          this.remove(voice);
        }
      }
      this.publish();
    }, 200);
  }
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  snapshot = () => this.view;
  private publish() {
    this.view = {
      master: this.master,
      musicVolume: this.musicVolume,
      paused: this.paused,
      playlistId: this.playlistId,
      sceneId: this.sceneId,
      voices: [...this.voices.values()].map((v) => ({
        duration: Number.isFinite(v.audio.duration) ? v.audio.duration : 0,
        id: v.id,
        loop: v.audio.loop,
        paused: v.audio.paused,
        retiring: v.retireAt !== null,
        role: v.role,
        soundId: v.soundId,
        time: v.audio.currentTime,
        volume: v.volume,
      })),
    };
    for (const listener of this.listeners) {
      listener();
    }
  }
  private async ready() {
    const { transportGeneration: generation } = this;
    if (!this.context) {
      this.context = new AudioContext();
      this.masterGain = this.context.createGain();
      this.masterGain.gain.value = this.master;
      this.masterGain.connect(this.context.destination);
    }
    await this.context.resume();
    if (generation !== this.transportGeneration) {
      return false;
    }
    if (this.paused) {
      this.paused = false;
      for (const voice of this.voices.values()) {
        if (!voice.paused) {
          voice.audio.play().catch((error) => this.failure(voice, error));
        }
      }
    }
    return true;
  }
  private failure(voice: Voice, error: unknown) {
    if (!this.voices.has(voice.id)) {
      return;
    }
    this.remove(voice);
    this.publish();
    this.report(
      `Não foi possível reproduzir o áudio. ${error instanceof Error ? error.message : "Verifique o arquivo e tente novamente."}`
    );
  }
  private remove(voice: Voice) {
    voice.audio.onended = null;
    voice.audio.onerror = null;
    voice.audio.pause();
    voice.audio.removeAttribute("src");
    voice.audio.load();
    voice.audio.remove();
    voice.source.disconnect();
    voice.gain.disconnect();
    URL.revokeObjectURL(voice.url);
    this.voices.delete(voice.id);
    if (this.musicId === voice.id) {
      this.musicId = null;
    }
  }
  private ramp(voice: Voice, volume: number, seconds: number, retire = false) {
    if (!this.context) {
      return;
    }
    const now = this.context.currentTime;
    voice.gain.gain.cancelAndHoldAtTime(now);
    voice.gain.gain.linearRampToValueAtTime(volume, now + seconds);
    voice.volume = volume;
    voice.retireAt = retire ? now + seconds : null;
    if (retire && !seconds) {
      this.remove(voice);
    }
  }
  private create(
    soundId: string,
    file: Blob,
    role: Role,
    volume: number,
    loop: boolean,
    fade = 0
  ) {
    if (!(this.context && this.masterGain)) {
      throw new Error("O áudio ainda não foi ativado.");
    }
    const audio = new Audio();
    const url = URL.createObjectURL(file);
    audio.src = url;
    audio.loop = loop;
    audio.preload = "auto";
    audio.hidden = true;
    audio.dataset.soundId = soundId;
    audio.dataset.role = role;
    document.body.append(audio);
    const source = this.context.createMediaElementSource(audio);
    const gain = this.context.createGain();
    gain.gain.value = fade ? 0 : volume;
    source.connect(gain);
    gain.connect(this.masterGain);
    const voice: Voice = {
      audio,
      gain,
      id: crypto.randomUUID(),
      paused: false,
      retireAt: null,
      role,
      soundId,
      source,
      url,
      volume,
    };
    this.voices.set(voice.id, voice);
    if (fade) {
      this.ramp(voice, volume, fade);
    }
    audio.onerror = () =>
      this.failure(voice, new Error("Arquivo incompatível ou danificado."));
    audio.onended = () => {
      const advance = voice.id === this.musicId;
      this.remove(voice);
      if (advance) {
        const next = this.queue?.next();
        this.replaceMusic(next ?? null, 0).catch((error) =>
          this.report(String(error))
        );
      }
      this.publish();
    };
    if (!this.paused) {
      audio.play().catch((error) => this.failure(voice, error));
    }
    return voice;
  }
  private async replaceMusic(soundId: string | null, fade: number) {
    this.musicGeneration += 1;
    const generation = this.musicGeneration;
    const { epoch } = this;
    const file = soundId ? await this.repository.file(soundId) : null;
    if (generation !== this.musicGeneration || epoch !== this.epoch) {
      return;
    }
    if (this.musicId) {
      const previous = this.voices.get(this.musicId);
      if (previous) {
        this.ramp(previous, 0, fade, true);
      }
      this.musicId = null;
    }
    const sound = this.library.sounds.find(
      (candidate) => candidate.id === soundId
    );
    if (sound && file) {
      const voice = this.create(
        sound.id,
        file,
        "music",
        this.musicVolume * sound.volume,
        this.queue?.repeat === "one",
        fade
      );
      this.musicId = voice.id;
    }
    this.publish();
  }
  async playPlaylist(id: string, fade = 0) {
    this.musicRequest += 1;
    const { musicRequest: request } = this;
    const { epoch } = this;
    if (
      !(await this.ready()) ||
      epoch !== this.epoch ||
      request !== this.musicRequest
    ) {
      return;
    }
    await this.startPlaylist(id, fade);
  }
  private async startPlaylist(id: string, fade: number) {
    const playlist = this.library.playlists.find(
      (candidate) => candidate.id === id
    );
    if (!playlist) {
      throw new Error("Playlist não encontrada.");
    }
    if (!playlist.soundIds.length) {
      throw new Error("Adicione músicas à playlist antes de tocar.");
    }
    if (this.playlistId === id && this.musicId) {
      this.publish();
      return;
    }
    this.playlistId = id;
    this.queue = new Queue(playlist);
    await this.replaceMusic(this.queue.current, fade);
  }
  async activateScene(scene: Scene) {
    this.sceneGeneration += 1;
    const generation = this.sceneGeneration;
    const { epoch } = this;
    const { musicRequest } = this;
    if (
      !(await this.ready()) ||
      generation !== this.sceneGeneration ||
      epoch !== this.epoch
    ) {
      return;
    }
    if (this.sceneId === scene.id) {
      this.publish();
      return;
    }
    const files = await Promise.all(
      scene.layers.map(
        async (layer) =>
          [layer.soundId, await this.repository.file(layer.soundId)] as const
      )
    );
    if (generation !== this.sceneGeneration || epoch !== this.epoch) {
      return;
    }
    const current = [...this.voices.values()].filter((v) => v.role === "layer");
    const diff = transition(
      current.map((v) => ({
        loop: v.audio.loop,
        soundId: v.soundId,
        volume: v.volume,
      })),
      scene.layers
    );
    for (const layer of diff.stop) {
      for (const voice of current.filter((v) => v.soundId === layer.soundId)) {
        this.ramp(voice, 0, 2, true);
      }
    }
    for (const layer of diff.keep) {
      const voice = current.find((v) => v.soundId === layer.soundId);
      if (voice) {
        voice.audio.loop = layer.loop;
        this.ramp(voice, layer.volume, 2);
      }
    }
    for (const layer of diff.start) {
      const file = files.find(([id]) => id === layer.soundId)?.[1];
      if (file) {
        this.create(layer.soundId, file, "layer", layer.volume, layer.loop, 2);
      }
    }
    this.sceneId = scene.id;
    if (musicRequest === this.musicRequest) {
      await this.playSceneMusic(scene);
    }
    this.publish();
  }
  private async playSceneMusic(scene: Scene) {
    this.setMusicVolume(scene.musicVolume, 2);
    if (scene.playlistId) {
      const playlist = this.library.playlists.find(
        (p) => p.id === scene.playlistId
      );
      if (playlist?.soundIds.length) {
        await this.startPlaylist(scene.playlistId, 2);
      } else {
        this.playlistId = scene.playlistId;
        this.queue = playlist ? new Queue(playlist) : null;
        await this.replaceMusic(null, 2);
      }
    } else {
      this.playlistId = null;
      this.queue = null;
      await this.replaceMusic(null, 2);
    }
  }
  async trigger(soundId: string) {
    const sound = this.library.sounds.find(
      (candidate) => candidate.id === soundId
    );
    if (!sound) {
      return;
    }
    const existing = [...this.voices.values()].find(
      (v) => v.soundId === soundId && v.role === "layer"
    );
    if (sound.kind === "ambience" && existing) {
      this.remove(existing);
      this.publish();
      return;
    }
    if (sound.kind === "ambience" && this.pendingLayers.has(soundId)) {
      return;
    }
    const { epoch } = this;
    if (sound.kind === "ambience") {
      this.pendingLayers.add(soundId);
    }
    try {
      if (!(await this.ready())) {
        return;
      }
      const file = await this.repository.file(soundId);
      if (epoch !== this.epoch) {
        return;
      }
      this.create(soundId, file, roles[sound.kind], sound.volume, sound.loop);
      this.publish();
    } finally {
      this.pendingLayers.delete(soundId);
    }
  }
  stopVoice(id: string) {
    const voice = this.voices.get(id);
    if (voice) {
      this.remove(voice);
    }
    this.publish();
  }
  pauseVoice(id: string) {
    const voice = this.voices.get(id);
    if (voice) {
      voice.paused = true;
      voice.audio.pause();
    }
    this.publish();
  }
  async resumeVoice(id: string) {
    const voice = this.voices.get(id);
    if (!voice) {
      return;
    }
    voice.paused = false;
    if (
      !(await this.ready()) ||
      this.voices.get(id) !== voice ||
      voice.paused
    ) {
      return;
    }
    await voice.audio.play().catch((error) => this.failure(voice, error));
    this.publish();
  }
  stopMusic() {
    this.musicRequest += 1;
    this.musicGeneration += 1;
    this.playlistId = null;
    this.queue = null;
    for (const voice of this.voices.values()) {
      if (voice.role === "music") {
        this.remove(voice);
      }
    }
    this.publish();
  }
  setVolume(id: string, volume: number) {
    const voice = this.voices.get(id);
    if (voice) {
      this.ramp(voice, volume, 0.02);
    }
    this.publish();
  }
  setLoop(id: string, loop: boolean) {
    const voice = this.voices.get(id);
    if (voice) {
      voice.audio.loop = loop;
    }
    this.publish();
  }
  setMusicVolume(volume: number, fade = 0.02) {
    this.musicVolume = volume;
    const voice = this.musicId ? this.voices.get(this.musicId) : null;
    const sound = this.library.sounds.find(
      (candidate) => candidate.id === voice?.soundId
    );
    if (voice && sound) {
      this.ramp(voice, volume * sound.volume, fade);
    }
    this.publish();
  }
  setMaster(volume: number) {
    this.master = volume;
    if (this.masterGain && this.context) {
      this.masterGain.gain.setTargetAtTime(
        volume,
        this.context.currentTime,
        0.01
      );
    }
    this.publish();
  }
  async pause() {
    this.transportGeneration += 1;
    this.paused = true;
    for (const voice of this.voices.values()) {
      voice.audio.pause();
    }
    this.publish();
    const { context } = this;
    if (context === null) {
      return;
    }
    await context.suspend();
  }
  async resume() {
    await this.ready();
    this.publish();
  }
  async next() {
    this.musicRequest += 1;
    const { musicRequest: request } = this;
    const { epoch } = this;
    if (
      !(await this.ready()) ||
      epoch !== this.epoch ||
      request !== this.musicRequest
    ) {
      return;
    }
    await this.replaceMusic(this.queue?.next(true) ?? null, 0);
  }
  async previous() {
    const voice = this.musicId ? this.voices.get(this.musicId) : null;
    if (voice && voice.audio.currentTime > 3) {
      voice.audio.currentTime = 0;
      this.publish();
      return;
    }
    const { epoch } = this;
    this.musicRequest += 1;
    const { musicRequest: request } = this;
    if (
      !(await this.ready()) ||
      epoch !== this.epoch ||
      request !== this.musicRequest
    ) {
      return;
    }
    await this.replaceMusic(this.queue?.previous() ?? null, 0);
  }
  seek(time: number) {
    const voice = this.musicId ? this.voices.get(this.musicId) : null;
    if (voice && Number.isFinite(voice.audio.duration)) {
      voice.audio.currentTime = Math.max(
        0,
        Math.min(time, voice.audio.duration)
      );
    }
    this.publish();
  }
  stopAll() {
    this.epoch += 1;
    this.transportGeneration += 1;
    this.sceneGeneration += 1;
    this.musicGeneration += 1;
    this.pendingLayers.clear();
    for (const voice of this.voices.values()) {
      this.remove(voice);
    }
    this.sceneId = null;
    this.playlistId = null;
    this.queue = null;
    this.paused = false;
    this.publish();
  }
  updateLibrary(library: Library) {
    if (this.library.master !== library.master) {
      this.setMaster(library.master);
    }
    this.library = library;
    const kinds = new Map(
      library.sounds.map((sound) => [sound.id, sound.kind])
    );
    for (const voice of this.voices.values()) {
      if (kinds.get(voice.soundId) !== voiceKinds[voice.role]) {
        this.remove(voice);
      }
    }
    if (
      this.sceneId &&
      !library.scenes.some((scene) => scene.id === this.sceneId)
    ) {
      this.stopAll();
      return;
    }
    const playlist = library.playlists.find(
      (candidate) => candidate.id === this.playlistId
    );
    if (playlist && this.queue) {
      const before = this.queue.current;
      this.queue.update(playlist);
      const voice = this.musicId ? this.voices.get(this.musicId) : null;
      if (voice) {
        voice.audio.loop = playlist.repeat === "one";
      }
      if (before !== this.queue.current) {
        this.replaceMusic(this.queue.current, 0).catch((error) =>
          this.report(String(error))
        );
      }
    } else if (this.playlistId) {
      this.playlistId = null;
      this.queue = null;
      this.replaceMusic(null, 0);
    }
    this.publish();
  }
  sceneMix(): {
    layers: Layer[];
    musicVolume: number;
    playlistId: string | null;
  } {
    return {
      layers: [...this.voices.values()]
        .filter((v) => v.role === "layer" && v.retireAt === null)
        .map((v) => ({
          loop: v.audio.loop,
          soundId: v.soundId,
          volume: v.volume,
        })),
      musicVolume: this.musicVolume,
      playlistId: this.playlistId,
    };
  }
  dispose() {
    clearInterval(this.timer);
    this.stopAll();
    if (this.context) {
      this.context.close();
    }
  }
}
