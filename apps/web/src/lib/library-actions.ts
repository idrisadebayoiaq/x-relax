import { createClient } from '@/lib/supabase/client';
import { removeDownloadForWeb } from '@/lib/web-downloads';

export const MIX_SOUND_PREFIX = '__xrelax_mix__:';

export function mixIdFromSound(description: string | null | undefined): string | null {
  if (!description?.startsWith(MIX_SOUND_PREFIX)) return null;
  const id = description.slice(MIX_SOUND_PREFIX.length).trim();
  return id || null;
}

export function isRenderedMixSound(sound: { description?: string | null; audio_path?: string | null }) {
  return (
    !!mixIdFromSound(sound.description) &&
    (sound.audio_path?.includes('/mix-renders/') ?? false)
  );
}

export async function removeFavorite(userId: string, soundId: string) {
  const { error } = await createClient()
    .from('favourites')
    .delete()
    .eq('user_id', userId)
    .eq('sound_id', soundId);
  return { error: error?.message ?? null };
}

export async function deleteDownload(userId: string, soundId: string) {
  await removeDownloadForWeb(userId, soundId);
  return { error: null };
}

export async function removePlaylistItem(playlistId: string, soundId: string) {
  const { error } = await createClient()
    .from('playlist_items')
    .delete()
    .eq('playlist_id', playlistId)
    .eq('sound_id', soundId);
  return { error: error?.message ?? null };
}

export async function deletePlaylist(userId: string, playlistId: string) {
  const { error } = await createClient()
    .from('playlists')
    .delete()
    .eq('id', playlistId)
    .eq('user_id', userId);
  return { error: error?.message ?? null };
}

export async function deleteMix(userId: string, mixId: string) {
  const supabase = createClient();
  const { data: mix } = await supabase
    .from('mixes')
    .select('id, sound_id')
    .eq('id', mixId)
    .eq('user_id', userId)
    .maybeSingle();

  if (mix?.sound_id) {
    const { data: sound } = await supabase
      .from('sounds')
      .select('audio_path')
      .eq('id', mix.sound_id)
      .maybeSingle();
    if (sound?.audio_path) {
      await supabase.storage.from('sounds').remove([sound.audio_path]);
    }
    await supabase.from('playlist_items').delete().eq('sound_id', mix.sound_id);
    await supabase.from('sounds').delete().eq('id', mix.sound_id).eq('creator_id', userId);
  }

  const { error } = await supabase.from('mixes').delete().eq('id', mixId).eq('user_id', userId);
  return { error: error?.message ?? null };
}
