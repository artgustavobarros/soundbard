// Estudos visuais descartáveis: estado em memória, sem acesso à biblioteca ou ao áudio real.
export type HardwareVariant = "A" | "B" | "C";

export interface HardwareSound {
  id: string;
  kind: "Ambiente" | "Efeito" | "Playlist";
  loop: boolean;
  name: string;
  status: "idle" | "paused" | "playing";
  volume: number;
}

export interface HardwareLayoutProps {
  onLoop: (id: string, loop: boolean) => void;
  onSelect: (id: string) => void;
  onStop: (id: string) => void;
  onTrigger: (id: string) => void;
  onVolume: (id: string, volume: number) => void;
  selectedId: string;
  sounds: HardwareSound[];
}

export const hardwareSounds: HardwareSound[] = [
  {
    id: "fire",
    kind: "Ambiente",
    loop: true,
    name: "Lareira",
    status: "idle",
    volume: 48,
  },
  {
    id: "talk",
    kind: "Ambiente",
    loop: true,
    name: "Conversas",
    status: "idle",
    volume: 32,
  },
  {
    id: "rain",
    kind: "Ambiente",
    loop: true,
    name: "Chuva no telhado",
    status: "playing",
    volume: 56,
  },
  {
    id: "night",
    kind: "Playlist",
    loop: true,
    name: "Caminhada à noite",
    status: "playing",
    volume: 68,
  },
  {
    id: "door",
    kind: "Efeito",
    loop: false,
    name: "Porta de madeira",
    status: "idle",
    volume: 72,
  },
  {
    id: "steps",
    kind: "Efeito",
    loop: false,
    name: "Passos no corredor",
    status: "idle",
    volume: 44,
  },
  {
    id: "swords",
    kind: "Efeito",
    loop: false,
    name: "Espadas",
    status: "idle",
    volume: 76,
  },
  {
    id: "thunder",
    kind: "Efeito",
    loop: false,
    name: "Trovão",
    status: "idle",
    volume: 64,
  },
];
