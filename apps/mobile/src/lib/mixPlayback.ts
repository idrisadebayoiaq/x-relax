import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import type { Sound } from '../types/database';

export type MixLayer = {
  sound: Sound;
  volume: number;
  player?: AudioPlayer;
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
      layer.player?.pause();
      layer.player?.remove();
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
      const player = createAudioPlayer({ uri: layer.sound.audio_url }, { updateInterval: 1000 });
      player.loop = true;
      player.volume = layer.volume;
      player.play();
      started.push({ ...layer, player });
    } catch {
      /* skip broken layer */
    }
  }
  return started;
}

export function pauseMixLayers(layers: MixLayer[]) {
  for (const layer of layers) {
    try {
      layer.player?.pause();
    } catch {
      /* ignore */
    }
  }
}

export function resumeMixLayers(layers: MixLayer[]) {
  for (const layer of layers) {
    try {
      if (layer.player && !layer.player.playing) layer.player.play();
    } catch {
      /* ignore */
    }
  }
}

export function isMixPlaying(layers: MixLayer[]) {
  return layers.some((layer) => layer.player?.playing);
}

export function setMixLayerVolume(layers: MixLayer[], soundId: string, volume: number) {
  return layers.map((layer) => {
    if (layer.sound.id !== soundId) return layer;
    const clamped = Math.min(1, Math.max(0, volume));
    try {
      if (layer.player) layer.player.volume = clamped;
    } catch {
      /* ignore */
    }
    return { ...layer, volume: clamped };
  });
}
