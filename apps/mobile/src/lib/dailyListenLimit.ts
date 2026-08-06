import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

export const FREE_DAILY_SOUND_LIMIT = 7;

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function guestStorageKey() {
  return `xrelax_daily_plays_${todayKey()}`;
}

export async function getTodayPlayedSoundIds(userId: string | null): Promise<string[]> {
  if (userId) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const { data } = await supabase
      .from('listening_history')
      .select('sound_id')
      .eq('user_id', userId)
      .gte('played_at', start.toISOString());
    return [...new Set((data ?? []).map((row) => row.sound_id as string))];
  }

  const raw = await AsyncStorage.getItem(guestStorageKey());
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function getDailyPlayStatus(
  userId: string | null,
  unlimited: boolean,
): Promise<{ played: number; remaining: number; limit: number }> {
  if (unlimited) {
    return { played: 0, remaining: FREE_DAILY_SOUND_LIMIT, limit: FREE_DAILY_SOUND_LIMIT };
  }
  const ids = await getTodayPlayedSoundIds(userId);
  const played = ids.length;
  return {
    played,
    remaining: Math.max(0, FREE_DAILY_SOUND_LIMIT - played),
    limit: FREE_DAILY_SOUND_LIMIT,
  };
}

export async function canStartSound(
  userId: string | null,
  soundId: string,
  unlimited: boolean,
): Promise<{ allowed: boolean; remaining: number }> {
  if (unlimited) return { allowed: true, remaining: FREE_DAILY_SOUND_LIMIT };

  const playedIds = await getTodayPlayedSoundIds(userId);
  if (playedIds.includes(soundId)) {
    return {
      allowed: true,
      remaining: Math.max(0, FREE_DAILY_SOUND_LIMIT - playedIds.length),
    };
  }
  if (playedIds.length >= FREE_DAILY_SOUND_LIMIT) {
    return { allowed: false, remaining: 0 };
  }
  return {
    allowed: true,
    remaining: FREE_DAILY_SOUND_LIMIT - playedIds.length - 1,
  };
}

export async function markSoundPlayedToday(userId: string | null, soundId: string) {
  if (userId) {
    await supabase.from('listening_history').upsert(
      {
        user_id: userId,
        sound_id: soundId,
        progress_seconds: 0,
        completed: false,
        played_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,sound_id' },
    );
    return;
  }

  const ids = await getTodayPlayedSoundIds(null);
  if (ids.includes(soundId)) return;
  await AsyncStorage.setItem(guestStorageKey(), JSON.stringify([...ids, soundId]));
}
