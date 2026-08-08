import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { claimExclusiveAudioFocus } from './audioSession';
import type { Sound } from '../types/database';

export type MixLayer = {
  sound: Sound;
  volume: number;
  player?: AudioPlayer;
};

export type MixSessionMeta = {
  id: string | null;
  title: string;
};

let mixStopHandler: (() => void) | null = null;
let activeLayers: MixLayer[] = [];
let sessionMeta: MixSessionMeta = { id: null, title: 'My Mix' };

export function registerMixStopHandler(handler: (() => void) | null) {
  mixStopHandler = handler;
}

/** Called by single-sound PlayerProvider before starting a track. */
export function stopExternalMixPlayback() {
  mixStopHandler?.();
}

export function getActiveMixLayers(): MixLayer[] {
  return activeLayers;
}

export function getMixSessionMeta(): MixSessionMeta {
  return sessionMeta;
}

export function setMixSessionMeta(meta: Partial<MixSessionMeta>) {
  sessionMeta = { ...sessionMeta, ...meta };
}

export async function ensureMixAudioMode() {
  await claimExclusiveAudioFocus();
}

function updateLockScreen(layers: MixLayer[], title: string) {
  const first = layers.find((l) => l.player);
  if (!first?.player) return;
  try {
    first.player.setActiveForLockScreen(
      true,
      {
        title,
        artist: `${layers.length} sound${layers.length === 1 ? '' : 's'} · X-Relax Mix`,
        albumTitle: 'Mix Studio',
        artworkUrl: first.sound.cover_url ?? undefined,
      },
      { showSeekForward: false, showSeekBackward: false },
    );
  } catch {
    /* ignore */
  }
}

function releasePlayer(player?: AudioPlayer) {
  if (!player) return;
  try {
    player.clearLockScreenControls();
  } catch {
    /* ignore */
  }
  try {
    player.pause();
  } catch {
    /* ignore */
  }
  try {
    player.remove();
  } catch {
    /* ignore */
  }
}

export function releaseMixLayers(layers: MixLayer[] = activeLayers) {
  for (const layer of layers) {
    releasePlayer(layer.player);
  }
  if (layers === activeLayers || layers.length === activeLayers.length) {
    activeLayers = [];
  }
}

async function createLayerPlayer(sound: Sound, volume: number): Promise<AudioPlayer | undefined> {
  if (!sound.audio_url) return undefined;
  try {
    const player = createAudioPlayer({ uri: sound.audio_url }, { updateInterval: 1000 });
    player.loop = true;
    player.volume = Math.min(1, Math.max(0, volume));
    return player;
  } catch {
    return undefined;
  }
}

/** Start (or restart) all layers concurrently. Each gets its own AudioPlayer. */
export async function startMixLayers(
  layers: MixLayer[],
  title = sessionMeta.title,
): Promise<MixLayer[]> {
  releaseMixLayers(activeLayers);
  await ensureMixAudioMode();

  const started: MixLayer[] = [];
  for (const layer of layers) {
    const player = await createLayerPlayer(layer.sound, layer.volume);
    if (!player) continue;
    try {
      player.play();
    } catch {
      releasePlayer(player);
      continue;
    }
    started.push({ sound: layer.sound, volume: layer.volume, player });
  }

  activeLayers = started;
  sessionMeta = { ...sessionMeta, title };
  updateLockScreen(started, title);
  return started;
}

export function pauseMixLayers(layers: MixLayer[] = activeLayers) {
  for (const layer of layers) {
    try {
      layer.player?.pause();
    } catch {
      /* ignore */
    }
  }
  // Keep exclusive focus so other apps do not auto-resume.
  void claimExclusiveAudioFocus();
}

export function resumeMixLayers(layers: MixLayer[] = activeLayers) {
  void claimExclusiveAudioFocus();
  for (const layer of layers) {
    try {
      if (layer.player && !layer.player.playing) layer.player.play();
    } catch {
      /* ignore */
    }
  }
}

export function isMixPlaying(layers: MixLayer[] = activeLayers) {
  return layers.some((layer) => !!layer.player?.playing);
}

export function setMixLayerVolume(layers: MixLayer[], soundId: string, volume: number): MixLayer[] {
  const clamped = Math.min(1, Math.max(0, volume));
  const next = layers.map((layer) => {
    if (layer.sound.id !== soundId) return layer;
    try {
      if (layer.player) layer.player.volume = clamped;
    } catch {
      /* ignore */
    }
    return { ...layer, volume: clamped };
  });
  activeLayers = activeLayers.map((layer) => {
    if (layer.sound.id !== soundId) return layer;
    try {
      if (layer.player) layer.player.volume = clamped;
    } catch {
      /* ignore */
    }
    return { ...layer, volume: clamped };
  });
  return next;
}

/** Add a track to a live mix and start its audio if the mix is playing. */
export async function addMixTrackLive(
  layers: MixLayer[],
  sound: Sound,
  volume: number,
  shouldPlay: boolean,
  title = sessionMeta.title,
): Promise<MixLayer[]> {
  if (layers.some((l) => l.sound.id === sound.id)) return layers;
  let player: AudioPlayer | undefined;
  if (shouldPlay) {
    await ensureMixAudioMode();
    player = await createLayerPlayer(sound, volume);
    if (player) {
      try {
        player.play();
      } catch {
        releasePlayer(player);
        player = undefined;
      }
    }
  }
  const next = [...layers, { sound, volume, player }];
  activeLayers = next;
  updateLockScreen(next, title);
  return next;
}

/** Remove one track; other tracks keep playing. */
export function removeMixTrackLive(
  layers: MixLayer[],
  soundId: string,
  title = sessionMeta.title,
): MixLayer[] {
  const target = layers.find((l) => l.sound.id === soundId);
  releasePlayer(target?.player);
  const next = layers.filter((l) => l.sound.id !== soundId);
  activeLayers = next;
  if (next.length) updateLockScreen(next, title);
  return next;
}

export function stopMixCompletely() {
  releaseMixLayers(activeLayers);
  activeLayers = [];
}
