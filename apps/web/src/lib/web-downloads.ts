import { createClient } from '@/lib/supabase/client';
import { removeOfflineSound, saveOfflineSound } from '@/lib/offline-storage';
import type { Sound } from '@/types/database';

async function assertCanDownload(userId: string): Promise<string | null> {
  const { data, error } = await createClient().rpc('user_can_download_offline', { uid: userId });
  if (error) return error.message;
  if (!data) return 'Offline downloads require Premium or admin access.';
  return null;
}

export async function downloadSoundForWeb(
  userId: string,
  sound: Sound,
): Promise<{ ok: boolean; message: string }> {
  try {
    const raw = localStorage.getItem('xrelax.web.settings.v1');
    const mode = raw
      ? ((JSON.parse(raw) as { downloadNetwork?: string }).downloadNetwork ?? 'cellular')
      : 'cellular';
    // Browser cannot always distinguish Wi‑Fi vs cellular; respect offline and a soft hint.
    if (!navigator.onLine) {
      return { ok: false, message: 'No internet connection.' };
    }
    if (mode === 'wifi') {
      // Network Information API when available
      const conn = (navigator as Navigator & { connection?: { type?: string; effectiveType?: string } })
        .connection;
      if (conn?.type === 'cellular' || conn?.effectiveType === '2g' || conn?.effectiveType === '3g') {
        return {
          ok: false,
          message: 'Downloads are set to Wi‑Fi only. Connect to Wi‑Fi or change Download settings.',
        };
      }
    }
  } catch {
    /* ignore */
  }

  const gate = await assertCanDownload(userId);
  if (gate) return { ok: false, message: gate };

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
