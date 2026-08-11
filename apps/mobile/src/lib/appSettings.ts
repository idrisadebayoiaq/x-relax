import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

const SETTINGS_KEY = 'xrelax.app.settings.v1';

export type DownloadNetworkMode = 'wifi' | 'cellular';
export type AudioQuality = 'auto' | 'high' | 'data_saver';

export type AppSettings = {
  downloadNetwork: DownloadNetworkMode;
  volume: number;
  audioQuality: AudioQuality;
};

export const DEFAULT_APP_SETTINGS: AppSettings = {
  downloadNetwork: 'cellular',
  volume: 1,
  audioQuality: 'auto',
};

export async function loadAppSettings(): Promise<AppSettings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_APP_SETTINGS };
    return { ...DEFAULT_APP_SETTINGS, ...(JSON.parse(raw) as Partial<AppSettings>) };
  } catch {
    return { ...DEFAULT_APP_SETTINGS };
  }
}

export async function saveAppSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const current = await loadAppSettings();
  const next = { ...current, ...patch };
  if (typeof next.volume === 'number') {
    next.volume = Math.min(1, Math.max(0, next.volume));
  }
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  return next;
}

/** True when downloads are allowed on the current connection. */
export async function canDownloadOnCurrentNetwork(
  mode: DownloadNetworkMode = 'cellular',
): Promise<{ ok: boolean; reason?: string }> {
  const state = await NetInfo.fetch();
  if (!state.isConnected) {
    return { ok: false, reason: 'No internet connection.' };
  }
  if (mode === 'wifi') {
    const type = state.type;
    const isWifi = type === 'wifi' || type === 'ethernet';
    if (!isWifi) {
      return {
        ok: false,
        reason: 'Downloads are set to Wi‑Fi only. Connect to Wi‑Fi or change Download settings.',
      };
    }
  }
  return { ok: true };
}

export async function isDeviceOnline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return !!state.isConnected && state.isInternetReachable !== false;
}
