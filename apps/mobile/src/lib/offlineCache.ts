import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Playlist, Profile, Sound } from '../types/database';

const PROFILE_KEY = 'xrelax.offline.profile.v1';
const PREMIUM_KEY = 'xrelax.offline.premium.v1';
const DOWNLOADS_KEY = 'xrelax.offline.downloads.v1';
const HISTORY_KEY = 'xrelax.offline.history.v1';
const LIBRARY_KEY = 'xrelax.offline.library.v1';
const PLAYLIST_DETAILS_KEY = 'xrelax.offline.playlistDetails.v1';

export type OfflineDownload = {
  sound: Sound;
  localUri: string;
  downloadedAt: string;
};

export type OfflineHistoryItem = {
  soundId: string;
  progressSeconds: number;
  completed: boolean;
  playedAt: string;
  sound?: Sound | null;
};

export type OfflineMixSummary = {
  id: string;
  title: string;
  durationSeconds: number;
  trackCount: number;
  cover?: string | null;
  tracks?: { volume: number; position: number; sound: Sound }[];
};

export type OfflineLibrarySnapshot = {
  playlists: Playlist[];
  favourites: Sound[];
  mixes: OfflineMixSummary[];
  downloadCount: number;
  updatedAt: string;
};

export type OfflinePlaylistDetail = {
  playlist: Playlist;
  ownerName: string | null;
  sounds: Sound[];
  updatedAt: string;
};

export async function cacheProfileSnapshot(profile: Profile | null, isPremium: boolean) {
  try {
    if (profile) await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    await AsyncStorage.setItem(PREMIUM_KEY, isPremium ? '1' : '0');
  } catch {
    /* ignore */
  }
}

export async function loadCachedProfile(): Promise<{
  profile: Profile | null;
  isPremium: boolean;
}> {
  try {
    const [raw, premium] = await Promise.all([
      AsyncStorage.getItem(PROFILE_KEY),
      AsyncStorage.getItem(PREMIUM_KEY),
    ]);
    return {
      profile: raw ? (JSON.parse(raw) as Profile) : null,
      isPremium: premium === '1',
    };
  } catch {
    return { profile: null, isPremium: false };
  }
}

export async function cacheOfflineDownloads(items: OfflineDownload[]) {
  try {
    await AsyncStorage.setItem(DOWNLOADS_KEY, JSON.stringify(items));
  } catch {
    /* ignore */
  }
}

export async function loadCachedDownloads(): Promise<OfflineDownload[]> {
  try {
    const raw = await AsyncStorage.getItem(DOWNLOADS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as OfflineDownload[];
  } catch {
    return [];
  }
}

export async function upsertCachedDownload(item: OfflineDownload) {
  const existing = await loadCachedDownloads();
  const next = [item, ...existing.filter((d) => d.sound.id !== item.sound.id)];
  await cacheOfflineDownloads(next);
}

export async function removeCachedDownload(soundId: string) {
  const existing = await loadCachedDownloads();
  await cacheOfflineDownloads(existing.filter((d) => d.sound.id !== soundId));
}

export async function getLocalUriForSound(soundId: string): Promise<string | null> {
  const items = await loadCachedDownloads();
  return items.find((d) => d.sound.id === soundId)?.localUri ?? null;
}

export async function cacheContinueHistory(items: OfflineHistoryItem[]) {
  try {
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(items));
  } catch {
    /* ignore */
  }
}

export async function loadCachedContinueHistory(): Promise<OfflineHistoryItem[]> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as OfflineHistoryItem[];
  } catch {
    return [];
  }
}

export async function cacheLibrarySnapshot(snapshot: OfflineLibrarySnapshot) {
  try {
    await AsyncStorage.setItem(LIBRARY_KEY, JSON.stringify(snapshot));
  } catch {
    /* ignore */
  }
}

export async function loadCachedLibrarySnapshot(): Promise<OfflineLibrarySnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(LIBRARY_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as OfflineLibrarySnapshot;
  } catch {
    return null;
  }
}

export async function cachePlaylistDetail(detail: OfflinePlaylistDetail) {
  try {
    const raw = await AsyncStorage.getItem(PLAYLIST_DETAILS_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, OfflinePlaylistDetail>) : {};
    map[detail.playlist.id] = detail;
    await AsyncStorage.setItem(PLAYLIST_DETAILS_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export async function loadCachedPlaylistDetail(
  playlistId: string,
): Promise<OfflinePlaylistDetail | null> {
  try {
    const raw = await AsyncStorage.getItem(PLAYLIST_DETAILS_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, OfflinePlaylistDetail>;
    return map[playlistId] ?? null;
  } catch {
    return null;
  }
}

export async function clearOfflineUserCache() {
  await AsyncStorage.multiRemove([
    PROFILE_KEY,
    PREMIUM_KEY,
    DOWNLOADS_KEY,
    HISTORY_KEY,
    LIBRARY_KEY,
    PLAYLIST_DETAILS_KEY,
  ]);
}
