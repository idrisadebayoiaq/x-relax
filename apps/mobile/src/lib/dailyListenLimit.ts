import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import type { Sound } from '../types/database';

export const FREE_DAILY_SOUND_LIMIT = 7;

export type DailyClaimResult = {
  allowed: boolean;
  remaining: number;
  played: number;
  reason?: string;
  unlimited?: boolean;
  replay?: boolean;
};

function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function guestStorageKey() {
  return `xrelax_daily_unlocks_${todayKey()}`;
}

async function getGuestUnlockedIds(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(guestStorageKey());
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? [...new Set(parsed)] : [];
  } catch {
    return [];
  }
}

async function setGuestUnlockedIds(ids: string[]) {
  await AsyncStorage.setItem(guestStorageKey(), JSON.stringify([...new Set(ids)]));
}

export async function getTodayPlayedSoundIds(userId: string | null): Promise<string[]> {
  if (userId) {
    const { data, error } = await supabase.rpc('get_daily_sound_play_status', {
      p_play_date: todayKey(),
    });
    if (error) {
      // Fallback: direct table read
      const { data: rows } = await supabase
        .from('daily_sound_unlocks')
        .select('sound_id')
        .eq('user_id', userId)
        .eq('play_date', todayKey());
      return [...new Set((rows ?? []).map((r) => r.sound_id as string))];
    }
    const ids = (data as { sound_ids?: string[] } | null)?.sound_ids ?? [];
    return [...new Set(ids.map(String))];
  }
  return getGuestUnlockedIds();
}

export async function getDailyPlayStatus(
  userId: string | null,
  unlimited: boolean,
): Promise<{ played: number; remaining: number; limit: number }> {
  if (unlimited) {
    return { played: 0, remaining: FREE_DAILY_SOUND_LIMIT, limit: FREE_DAILY_SOUND_LIMIT };
  }
  if (userId) {
    const { data, error } = await supabase.rpc('get_daily_sound_play_status', {
      p_play_date: todayKey(),
    });
    if (!error && data) {
      const row = data as { played?: number; remaining?: number; limit?: number };
      return {
        played: Number(row.played ?? 0),
        remaining: Number(row.remaining ?? 0),
        limit: Number(row.limit ?? FREE_DAILY_SOUND_LIMIT),
      };
    }
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

/** Atomically claim a daily unlock slot (or allow replay). */
export async function claimDailySoundPlay(
  userId: string | null,
  soundId: string,
  unlimited: boolean,
): Promise<DailyClaimResult> {
  if (unlimited) {
    return {
      allowed: true,
      unlimited: true,
      remaining: FREE_DAILY_SOUND_LIMIT,
      played: 0,
    };
  }

  if (userId) {
    const { data, error } = await supabase.rpc('claim_daily_sound_play', {
      p_sound_id: soundId,
      p_play_date: todayKey(),
    });
    if (error) {
      return { allowed: false, remaining: 0, played: FREE_DAILY_SOUND_LIMIT, reason: error.message };
    }
    const row = data as {
      allowed?: boolean;
      remaining?: number | null;
      played?: number;
      reason?: string;
      unlimited?: boolean;
      replay?: boolean;
    };
    return {
      allowed: !!row.allowed,
      remaining: Number(row.remaining ?? 0),
      played: Number(row.played ?? 0),
      reason: row.reason,
      unlimited: !!row.unlimited,
      replay: !!row.replay,
    };
  }

  // Guest (local only)
  const ids = await getGuestUnlockedIds();
  if (ids.includes(soundId)) {
    return {
      allowed: true,
      replay: true,
      remaining: Math.max(0, FREE_DAILY_SOUND_LIMIT - ids.length),
      played: ids.length,
    };
  }
  if (ids.length >= FREE_DAILY_SOUND_LIMIT) {
    return { allowed: false, remaining: 0, played: ids.length, reason: 'daily_limit' };
  }
  const next = [...ids, soundId];
  await setGuestUnlockedIds(next);
  return {
    allowed: true,
    remaining: Math.max(0, FREE_DAILY_SOUND_LIMIT - next.length),
    played: next.length,
  };
}

/**
 * Keep only sounds the free user may play today:
 * already unlocked + enough remaining new slots (in queue order).
 */
export function filterQueueForDailyLimit(
  queue: Sound[],
  unlockedIds: string[],
  unlimited: boolean,
): Sound[] {
  if (unlimited) return queue;
  const unlocked = new Set(unlockedIds);
  let slotsLeft = Math.max(0, FREE_DAILY_SOUND_LIMIT - unlocked.size);
  const out: Sound[] = [];
  for (const sound of queue) {
    if (unlocked.has(sound.id)) {
      out.push(sound);
      continue;
    }
    if (slotsLeft > 0) {
      out.push(sound);
      unlocked.add(sound.id);
      slotsLeft -= 1;
    }
  }
  return out;
}

export const DAILY_LIMIT_MESSAGE =
  `Free accounts can unlock ${FREE_DAILY_SOUND_LIMIT} different sounds per day. You can replay those ${FREE_DAILY_SOUND_LIMIT} as much as you want today, but no other sounds until tomorrow. Upgrade to Premium for unlimited listening.`;
