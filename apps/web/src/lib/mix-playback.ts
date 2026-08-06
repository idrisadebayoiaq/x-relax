import type { Sound } from '@/types/database';

export type MixLayer = {
  sound: Sound;
  volume: number;
  audio?: HTMLAudioElement;
};

let mixStopHandler: (() => void) | null = null;

export function registerMixStopHandler(handler: (() => void) | null) {
  mixStopHandler = handler;
}

export function stopExternalMixPlayback() {
  mixStopHandler?.();
}

export function releaseMixLayers(layers: MixLayer[]) {
  for (const layer of layers) {
    try {
      layer.audio?.pause();
      layer.audio!.src = '';
    } catch {
      /* ignore */
    }
  }
}

export async function startMixLayers(layers: MixLayer[]): Promise<MixLayer[]> {
  const started: MixLayer[] = [];
  for (const layer of layers) {
    if (!layer.sound.audio_url) continue;
    try {
      const audio = new Audio(layer.sound.audio_url);
      audio.loop = true;
      audio.volume = layer.volume;
      await audio.play();
      started.push({ ...layer, audio });
    } catch {
      /* skip */
    }
  }
  return started;
}

export function pauseMixLayers(layers: MixLayer[]) {
  layers.forEach((layer) => layer.audio?.pause());
}

export function resumeMixLayers(layers: MixLayer[]) {
  layers.forEach((layer) => {
    if (layer.audio?.paused) void layer.audio.play();
  });
}

export function isMixPlaying(layers: MixLayer[]) {
  return layers.some((layer) => layer.audio && !layer.audio.paused);
}

export function setMixLayerVolume(layers: MixLayer[], soundId: string, volume: number) {
  return layers.map((layer) => {
    if (layer.sound.id !== soundId) return layer;
    const clamped = Math.min(1, Math.max(0, volume));
    if (layer.audio) layer.audio.volume = clamped;
    return { ...layer, volume: clamped };
  });
}
