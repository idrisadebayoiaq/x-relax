import Constants from 'expo-constants';
import type { MixLayer } from './mixPlayback';
import { renderMixToArrayBuffer as renderLocal } from './mixRender.web';

type MixRenderTrack = { url: string; volume: number };

function webBaseUrl(): string {
  const extra = Constants.expoConfig?.extra as { webUrl?: string } | undefined;
  return (
    process.env.EXPO_PUBLIC_WEB_URL ??
    extra?.webUrl ??
    'https://x-relax.vercel.app'
  );
}

async function renderViaApi(tracks: MixRenderTrack[], durationSeconds: number): Promise<ArrayBuffer> {
  const res = await fetch(`${webBaseUrl()}/api/mix-render`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tracks, durationSeconds }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `Mix render failed (${res.status})`);
  }
  return res.arrayBuffer();
}

/** Render mix layers to WAV bytes (API on native, local on web). */
export async function renderMixLayersToWav(
  layers: MixLayer[],
  durationSeconds: number,
): Promise<ArrayBuffer> {
  const tracks = layers
    .filter((l) => l.sound.audio_url)
    .map((l) => ({ url: l.sound.audio_url as string, volume: l.volume }));

  if (!tracks.length) throw new Error('No playable sounds in mix');

  if (typeof document !== 'undefined') {
    return renderLocal(tracks, durationSeconds);
  }
  return renderViaApi(tracks, durationSeconds);
}
