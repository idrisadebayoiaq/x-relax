import * as FileSystem from 'expo-file-system/legacy';
import { Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import type { Sound } from '../types/database';

export async function downloadSoundForOffline(
  userId: string,
  sound: Sound,
): Promise<{ ok: boolean; message: string }> {
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

  if (error) return { ok: false, message: error.message };
  return { ok: true, message: 'Saved for offline playback' };
}

export function alertDownloadResult(result: { ok: boolean; message: string }) {
  Alert.alert(result.ok ? 'Downloaded' : 'Download failed', result.message);
}
