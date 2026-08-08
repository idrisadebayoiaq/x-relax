import type { Playlist, Sound } from '../types/database';
import { supabase } from './supabase';

type PlaylistRow = Playlist & {
  items?: { sound_id: string; position: number; sound?: Sound | null }[];
  owner?: { display_name: string | null } | null;
};

/**
 * Suggest public playlists based on categories the user listens to most.
 * Falls back to recently updated public playlists.
 */
export async function loadSuggestedPlaylists(opts: {
  userId?: string | null;
  limit?: number;
}): Promise<Playlist[]> {
  const limit = opts.limit ?? 12;

  const { data: publicRows } = await supabase
    .from('playlists')
    .select(
      'id, user_id, title, description, is_favourite, visibility, cover_url, created_at, updated_at, items:playlist_items(sound_id, position, sound:sounds(id, cover_url))',
    )
    .eq('visibility', 'public')
    .order('updated_at', { ascending: false })
    .limit(80);

  let rows = (((publicRows as unknown) as PlaylistRow[]) ?? []).map(normalizePlaylist);

  if (opts.userId) {
    rows = rows.filter((p) => p.user_id !== opts.userId);
  }

  // Attach owner names (best-effort)
  const ownerIds = [...new Set(rows.map((r) => r.user_id))];
  if (ownerIds.length) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name')
      .in('id', ownerIds);
    const nameMap = new Map(
      ((profiles as { id: string; display_name: string | null }[]) ?? []).map((p) => [
        p.id,
        p.display_name,
      ]),
    );
    rows = rows.map((r) => ({
      ...r,
      owner: { display_name: nameMap.get(r.user_id) ?? null },
    }));
  }

  if (!opts.userId || rows.length <= limit) {
    return rows.slice(0, limit);
  }

  const { data: history } = await supabase
    .from('listening_history')
    .select('sound_id')
    .eq('user_id', opts.userId)
    .order('played_at', { ascending: false })
    .limit(60);

  const recentIds = [
    ...new Set(((history as { sound_id: string }[]) ?? []).map((h) => h.sound_id).filter(Boolean)),
  ];
  if (!recentIds.length) return rows.slice(0, limit);

  const { data: links } = await supabase
    .from('sound_categories')
    .select('sound_id, category_id')
    .in('sound_id', recentIds);

  const preferredCats = new Set(
    ((links as { category_id: string }[]) ?? []).map((l) => l.category_id),
  );
  if (!preferredCats.size) return rows.slice(0, limit);

  const allSoundIds = [
    ...new Set(
      rows.flatMap((p) => (p as PlaylistRow).items?.map((i) => i.sound_id) ?? []).filter(Boolean),
    ),
  ];

  const { data: playlistLinks } = allSoundIds.length
    ? await supabase
        .from('sound_categories')
        .select('sound_id, category_id')
        .in('sound_id', allSoundIds)
    : { data: [] as { sound_id: string; category_id: string }[] };

  const soundCats = new Map<string, string[]>();
  for (const row of (playlistLinks as { sound_id: string; category_id: string }[]) ?? []) {
    const list = soundCats.get(row.sound_id) ?? [];
    list.push(row.category_id);
    soundCats.set(row.sound_id, list);
  }

  const scored = rows
    .map((playlist) => {
      const itemIds = ((playlist as PlaylistRow).items ?? []).map((i) => i.sound_id);
      let score = 0;
      for (const sid of itemIds) {
        for (const cat of soundCats.get(sid) ?? []) {
          if (preferredCats.has(cat)) score += 1;
        }
      }
      return { playlist, score };
    })
    .sort((a, b) => b.score - a.score || b.playlist.updated_at.localeCompare(a.playlist.updated_at));

  const withOverlap = scored.filter((s) => s.score > 0).map((s) => s.playlist);
  if (withOverlap.length >= Math.min(4, limit)) {
    return withOverlap.slice(0, limit);
  }
  return scored.map((s) => s.playlist).slice(0, limit);
}

function normalizePlaylist(row: PlaylistRow): Playlist {
  const owner = Array.isArray(row.owner) ? row.owner[0] : row.owner;
  const items = [...(row.items ?? [])].sort((a, b) => a.position - b.position);
  const cover =
    row.cover_url ??
    items.find((i) => i.sound?.cover_url)?.sound?.cover_url ??
    null;
  return {
    ...row,
    owner: owner ?? null,
    cover_url: cover,
    item_count: items.length,
    items,
  } as Playlist;
}
