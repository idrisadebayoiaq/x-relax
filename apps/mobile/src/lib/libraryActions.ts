import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from './supabase';
import { removeCachedDownload } from './offlineCache';

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
  const { error } = await supabase
    .from('favourites')
    .delete()
    .eq('user_id', userId)
    .eq('sound_id', soundId);
  return { error: error?.message ?? null };
}

export async function deleteDownload(userId: string, soundId: string) {
  const localPath = `${FileSystem.documentDirectory}downloads/${soundId}.mp3`;
  try {
    const info = await FileSystem.getInfoAsync(localPath);
    if (info.exists) await FileSystem.deleteAsync(localPath, { idempotent: true });
  } catch {
    /* ignore */
  }
  await removeCachedDownload(soundId);
  const { error } = await supabase
    .from('downloads')
    .delete()
    .eq('user_id', userId)
    .eq('sound_id', soundId);
  return { error: error?.message ?? null };
}

export async function removePlaylistItem(playlistId: string, soundId: string) {
  const { error } = await supabase
    .from('playlist_items')
    .delete()
    .eq('playlist_id', playlistId)
    .eq('sound_id', soundId);
  return { error: error?.message ?? null };
}

export async function deletePlaylist(userId: string, playlistId: string) {
  const { error } = await supabase
    .from('playlists')
    .delete()
    .eq('id', playlistId)
    .eq('user_id', userId);
  return { error: error?.message ?? null };
}

export async function deleteMix(userId: string, mixId: string) {
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
