import * as FileSystem from 'expo-file-system/legacy';
import { Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import { canDownloadOnCurrentNetwork, isDeviceOnline, loadAppSettings } from './appSettings';
import { upsertCachedDownload } from './offlineCache';
import type { Sound } from '../types/database';

export async function downloadSoundForOffline(
  userId: string,
  sound: Sound,
): Promise<{ ok: boolean; message: string }> {
  const settings = await loadAppSettings();
  const networkGate = await canDownloadOnCurrentNetwork(settings.downloadNetwork);
  if (!networkGate.ok) {
    return { ok: false, message: networkGate.reason ?? 'Network not allowed for downloads.' };
  }

  const { data: allowed, error: gateError } = await supabase.rpc('user_can_download_offline', {
    uid: userId,
  });
  if (gateError) return { ok: false, message: gateError.message };
  if (!allowed) {
    return { ok: false, message: 'Offline downloads require Premium or admin access.' };
  }

  if (!sound.audio_url) {
    return { ok: false, message: 'No audio URL for this sound' };
  }

  const dir = `${FileSystem.documentDirectory}downloads/`;
  const dirInfo = await FileSystem.getInfoAsync(dir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }

  const target = `${dir}${sound.id}.mp3`;
  const result = await FileSystem.downloadAsync(sound.audio_url, target);
  if (result.status !== 200) {
    return { ok: false, message: `Download failed (${result.status})` };
  }

  const { error } = await supabase.from('downloads').upsert(
    {
      user_id: userId,
      sound_id: sound.id,
      local_uri: result.uri,
    },
    { onConflict: 'user_id,sound_id' },
  );

  await upsertCachedDownload({
    sound: { ...sound, audio_url: result.uri },
    localUri: result.uri,
    downloadedAt: new Date().toISOString(),
  });

  if (error) {
    // Still usable offline even if remote row failed.
    return {
      ok: true,
      message: 'Saved on this device (cloud sync pending when online).',
    };
  }
  return { ok: true, message: 'Saved for offline playback' };
}

export function alertDownloadResult(result: { ok: boolean; message: string }) {
  Alert.alert(result.ok ? 'Downloaded' : 'Download failed', result.message);
}

export async function resolvePlayableUrl(sound: Sound): Promise<string | null> {
  const localPath = `${FileSystem.documentDirectory}downloads/${sound.id}.mp3`;
  try {
    const info = await FileSystem.getInfoAsync(localPath);
    if (info.exists) return localPath;
  } catch {
    /* ignore */
  }
  if (sound.audio_url?.startsWith('file://') || sound.audio_url?.startsWith('/')) {
    return sound.audio_url;
  }
  // Offline: never fall back to remote URLs — downloads only.
  if (!(await isDeviceOnline())) return null;
  return sound.audio_url ?? null;
}
