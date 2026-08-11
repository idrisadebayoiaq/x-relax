import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Sound } from '../types/database';

export const PLAYBACK_SESSION_KEY = 'xrelax.playback.session.v1';

export type PersistedPlayback = {
  sound: Sound;
  queue: Sound[];
  queueIndex: number;
  queueLabel: string | null;
  positionMs: number;
  updatedAt: number;
};

export async function savePlaybackSession(session: PersistedPlayback | null) {
  if (!session) {
    await AsyncStorage.removeItem(PLAYBACK_SESSION_KEY);
    return;
  }
  await AsyncStorage.setItem(PLAYBACK_SESSION_KEY, JSON.stringify(session));
}

export async function loadPlaybackSession(): Promise<PersistedPlayback | null> {
  try {
    const raw = await AsyncStorage.getItem(PLAYBACK_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedPlayback;
    if (!parsed?.sound?.id || !parsed.sound.audio_url) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function clearPlaybackSession() {
  await AsyncStorage.removeItem(PLAYBACK_SESSION_KEY);
}
