import * as FileSystem from 'expo-file-system/legacy';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { canDownloadOnCurrentNetwork, isDeviceOnline, loadAppSettings } from './appSettings';
import { upsertCachedDownload } from './offlineCache';
import type { Sound } from '../types/database';
import { appAlert } from '../ui/appAlert';

export type DownloadProgressCallback = (progress: number) => void;

async function ensureDownloadChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('downloads', {
    name: 'Downloads',
    importance: Notifications.AndroidImportance.DEFAULT,
    description: 'Offline download progress and completion',
    vibrationPattern: [0, 120],
    lightColor: '#F5C400',
  });
}

export async function notifyDownloadComplete(title: string) {
  try {
    await ensureDownloadChannel();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Download complete',
        body: `"${title}" is ready for offline listening.`,
        sound: true,
        ...(Platform.OS === 'android' ? { channelId: 'downloads' } : {}),
      },
      trigger: null,
    });
  } catch (err) {
    console.warn('Download notification failed', err);
  }
}

export async function downloadSoundForOffline(
  userId: string,
  sound: Sound,
  onProgress?: DownloadProgressCallback,
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
  onProgress?.(0);

  const downloadResumable = FileSystem.createDownloadResumable(
    sound.audio_url,
    target,
    {},
    (progress) => {
      const total = progress.totalBytesExpectedToWrite;
      if (total > 0) {
        onProgress?.(Math.min(1, progress.totalBytesWritten / total));
      }
    },
  );

  const result = await downloadResumable.downloadAsync();
  if (!result || result.status !== 200) {
    return { ok: false, message: `Download failed (${result?.status ?? 'unknown'})` };
  }

  onProgress?.(1);

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
    return {
      ok: true,
      message: 'Saved on this device (cloud sync pending when online).',
    };
  }
  return { ok: true, message: 'Saved for offline playback' };
}

export function alertDownloadResult(result: { ok: boolean; message: string }) {
  if (!result.ok) {
    appAlert('Download failed', result.message);
  }
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
  if (!(await isDeviceOnline())) return null;
  return sound.audio_url ?? null;
}
