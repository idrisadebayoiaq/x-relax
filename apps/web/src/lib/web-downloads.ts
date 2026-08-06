import { createClient } from '@/lib/supabase/client';
import { removeOfflineSound, saveOfflineSound } from '@/lib/offline-storage';
import type { Sound } from '@/types/database';

export async function downloadSoundForWeb(
  userId: string,
  sound: Sound,
): Promise<{ ok: boolean; message: string }> {
  if (!sound.audio_url) {
    return { ok: false, message: 'No audio URL for this sound' };
  }

  try {
    const response = await fetch(sound.audio_url);
    if (!response.ok) {
      return { ok: false, message: `Download failed (${response.status})` };
    }
    const blob = await response.blob();
    await saveOfflineSound(sound, blob);

    const { error } = await createClient().from('downloads').upsert(
      {
        user_id: userId,
        sound_id: sound.id,
        local_uri: `indexeddb://${sound.id}`,
      },
      { onConflict: 'user_id,sound_id' },
    );

    if (error) return { ok: false, message: error.message };
    return { ok: true, message: 'Saved for offline playback' };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Download failed' };
  }
}

export async function removeDownloadForWeb(
  userId: string,
  soundId: string,
): Promise<{ ok: boolean; message: string }> {
  try {
    await removeOfflineSound(soundId);
    const { error } = await createClient()
      .from('downloads')
      .delete()
      .eq('user_id', userId)
      .eq('sound_id', soundId);
    if (error) return { ok: false, message: error.message };
    return { ok: true, message: 'Removed from downloads' };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Remove failed' };
  }
}
