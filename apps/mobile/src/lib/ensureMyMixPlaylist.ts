import { supabase } from './supabase';

export async function ensureMyMixPlaylist(): Promise<string> {
  const { data, error } = await supabase.rpc('ensure_my_mix_playlist');
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Could not resolve My Mix playlist');
  return data as string;
}
