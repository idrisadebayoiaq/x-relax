'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Filter, Plus, Search, Star } from 'lucide-react';
import { CoverArt } from '@/components/CoverArt';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { usePlayer } from '@/lib/player-context';
import { useOffline } from '@/components/OfflineProvider';
import type { Playlist, Sound } from '@/types/database';
import { appAlert, appConfirm } from '@/components/AppDialog';
import { deleteDownload, removeFavorite } from '@/lib/library-actions';

type SortMode = 'recent' | 'alpha' | 'discover';

type ListRow =
  | { kind: 'favourites'; id: 'favourites' }
  | { kind: 'playlist'; id: string; playlist: Playlist };

export default function LibraryPage() {
  const router = useRouter();
  const { user, canDownloadOffline } = useAuth();
  const { playSound } = usePlayer();
  const { online } = useOffline();
  const [section, setSection] = useState<'hub' | 'playlists' | 'favourites' | 'downloads'>('hub');
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [discover, setDiscover] = useState<Playlist[]>([]);
  const [favourites, setFavourites] = useState<Sound[]>([]);
  const [downloads, setDownloads] = useState<Sound[]>([]);
  const [favCount, setFavCount] = useState(0);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortMode>('recent');
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'public'>('private');
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const supabase = createClient();

    if (!online) {
      const { listOfflineSounds, loadCachedWebLibrary } = await import('@/lib/offline-storage');
      const cached = loadCachedWebLibrary();
      setDownloads(await listOfflineSounds());
      setPlaylists(cached?.playlists ?? []);
      setFavourites(cached?.favourites ?? []);
      setFavCount(cached?.favourites.length ?? 0);
      setDiscover([]);
      setLoading(false);
      return;
    }

    const [{ data: pls }, { data: favs }, { data: dls }, { data: publicPls }] = await Promise.all([
      supabase
        .from('playlists')
        .select('*, items:playlist_items(position, sound:sounds(cover_url))')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false }),
      supabase
        .from('favourites')
        .select('sound:sounds(*), created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      canDownloadOffline
        ? supabase.from('downloads').select('sound:sounds(*)').eq('user_id', user.id)
        : Promise.resolve({ data: [] }),
      supabase
        .from('playlists')
        .select('*, items:playlist_items(position, sound:sounds(cover_url))')
        .eq('visibility', 'public')
        .neq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(40),
    ]);

    const normalize = (p: any): Playlist => {
      const items = [...(p.items ?? [])].sort(
        (a: any, b: any) => (a.position ?? 0) - (b.position ?? 0),
      );
      return {
        ...p,
        cover_url: p.cover_url ?? items[0]?.sound?.cover_url ?? null,
        item_count: items.length,
      } as Playlist;
    };

    setPlaylists(((pls as any[]) ?? []).map(normalize));
    setDiscover(((publicPls as any[]) ?? []).map(normalize));
    const favSounds = ((favs ?? []) as unknown as { sound: Sound | Sound[] }[])
      .map((f) => (Array.isArray(f.sound) ? f.sound[0] : f.sound))
      .filter(Boolean) as Sound[];
    setFavourites(favSounds);
    setFavCount(favSounds.length);
    const nextDownloads = ((dls ?? []) as unknown as { sound: Sound | Sound[] }[])
      .map((d) => (Array.isArray(d.sound) ? d.sound[0] : d.sound))
      .filter(Boolean) as Sound[];
    setDownloads(nextDownloads);
    const { cacheWebLibrary } = await import('@/lib/offline-storage');
    cacheWebLibrary({
      playlists: ((pls as any[]) ?? []).map(normalize),
      favourites: favSounds,
      updatedAt: new Date().toISOString(),
    });
    setLoading(false);
  }, [user, online, canDownloadOffline]);

  useEffect(() => {
    void load();
  }, [load]);

  const createPlaylist = async () => {
    if (!user || !newTitle.trim() || !online) return;
    setCreating(true);
    const { data, error } = await createClient()
      .from('playlists')
      .insert({
        user_id: user.id,
        title: newTitle.trim(),
        visibility,
      })
      .select('id')
      .single();
    setCreating(false);
    if (error) {
      appAlert(error.message);
      return;
    }
    setNewTitle('');
    setVisibility('private');
    setCreateOpen(false);
    await load();
    if (data?.id) router.push(`/library/playlist/${data.id}`);
  };

  const filteredPlaylists = useMemo(() => {
    const source = sort === 'discover' ? discover : playlists;
    const q = query.trim().toLowerCase();
    let list = q ? source.filter((p) => p.title.toLowerCase().includes(q)) : [...source];
    if (sort === 'alpha') list.sort((a, b) => a.title.localeCompare(b.title));
    return list;
  }, [playlists, discover, query, sort]);

  const rows: ListRow[] = useMemo(() => {
    const next: ListRow[] = [];
    const q = query.trim().toLowerCase();
    const showFavourites =
      sort !== 'discover' && (!q || 'favourite songs'.includes(q) || 'favorites'.includes(q));
    if (showFavourites) next.push({ kind: 'favourites', id: 'favourites' });
    for (const playlist of filteredPlaylists) {
      next.push({ kind: 'playlist', id: playlist.id, playlist });
    }
    return next;
  }, [filteredPlaylists, query, sort]);

  if (section === 'hub') {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-4xl font-serif font-bold tracking-tight">Library</h1>
        {!online ? <p className="text-sm text-muted">Offline · downloads only</p> : null}
        <div className="divide-y divide-border rounded-none">
          {[
            { key: 'playlists' as const, label: 'Playlists', count: playlists.length },
            { key: 'favourites' as const, label: 'Favourites', count: favourites.length },
            {
              key: 'downloads' as const,
              label: 'Downloaded',
              count: downloads.length,
            },
          ].map((row) => (
            <button
              key={row.key}
              type="button"
              className="w-full flex items-center justify-between py-4 text-left hover:opacity-80"
              onClick={() => setSection(row.key)}
            >
              <span className="text-lg">{row.label}</span>
              <span className="text-muted text-sm">{row.count} ›</span>
            </button>
          ))}
        </div>
        {loading ? <p className="text-muted text-sm">Loading…</p> : null}
      </div>
    );
  }

  if (section === 'playlists') {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-2">
          <button type="button" className="text-2xl leading-none px-1" onClick={() => setSection('hub')}>
            ‹
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="h-10 w-10 rounded-xl border border-border inline-flex items-center justify-center hover:bg-surface"
              onClick={() => setCreateOpen(true)}
              aria-label="New playlist"
            >
              <Plus size={20} />
            </button>
            <label className="inline-flex items-center gap-1.5 text-sm text-muted border border-border rounded-xl px-2.5 py-2">
              <Filter size={14} />
              <select
                className="bg-transparent outline-none"
                value={sort}
                onChange={(e) => setSort(e.target.value as SortMode)}
                aria-label="Sort playlists"
              >
                <option value="recent">Recently updated</option>
                <option value="alpha">Title A–Z</option>
                <option value="discover">For you (public)</option>
              </select>
            </label>
          </div>
        </div>

        <h1 className="text-4xl font-serif font-bold tracking-tight mb-4">Playlists</h1>

        <div className="flex items-center gap-2 rounded-xl bg-surface border border-border px-3 py-2.5 mb-3">
          <Search size={16} className="text-muted shrink-0" />
          <input
            className="bg-transparent flex-1 outline-none text-[16px]"
            placeholder="Search in Playlists"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {loading ? (
          <p className="text-muted text-sm py-8">Loading…</p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((row) => {
              if (row.kind === 'favourites') {
                return (
                  <li key={row.id}>
                    <button
                      type="button"
                      className="w-full flex items-center gap-3.5 py-3 text-left"
                      onClick={() => setSection('favourites')}
                    >
                      <span className="w-4 text-muted inline-flex justify-center">
                        <Star size={12} className="fill-current" />
                      </span>
                      <span className="w-14 h-14 rounded bg-foreground text-background flex items-center justify-center shrink-0">
                        <Star size={28} className="fill-current" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[17px]">Favourite Songs</span>
                        {favCount > 0 ? (
                          <span className="block text-sm text-muted">{favCount} liked</span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              }
              const pl = row.playlist;
              return (
                <li key={pl.id}>
                  <Link
                    href={`/library/playlist/${pl.id}`}
                    className="flex items-center gap-3.5 py-3"
                  >
                    <span className="w-4" />
                    <CoverArt title={pl.title} uri={pl.cover_url} size={56} rounded={4} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[17px] truncate">{pl.title}</span>
                      <span className="block text-sm text-muted truncate">
                        {pl.visibility === 'public' ? 'Public' : 'Private'}
                        {pl.item_count != null ? ` · ${pl.item_count}` : ''}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
            {!rows.length ? (
              <li className="text-center text-muted text-sm py-12">
                {sort === 'discover'
                  ? 'No public playlists to suggest yet.'
                  : query
                    ? 'No playlists match your search.'
                    : 'No playlists yet — tap + to create one.'}
              </li>
            ) : null}
          </ul>
        )}

        {createOpen ? (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4">
            <div className="w-full max-w-md rounded-2xl bg-surface border border-border p-5 space-y-4">
              <h2 className="text-xl font-serif font-bold">New Playlist</h2>
              <input
                className="input"
                placeholder="Playlist name"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                autoFocus
              />
              <div className="flex gap-2">
                {(['private', 'public'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    className={`chip ${visibility === v ? 'chip-active' : ''}`}
                    onClick={() => setVisibility(v)}
                  >
                    {v === 'private' ? 'Private' : 'Public'}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button type="button" className="btn btn-outline flex-1" onClick={() => setCreateOpen(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary flex-1"
                  disabled={creating}
                  onClick={() => void createPlaylist()}
                >
                  {creating ? 'Creating…' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  // favourites / downloads simple lists
  const list = section === 'favourites' ? favourites : downloads;
  const title = section === 'favourites' ? 'Favourite Songs' : 'Downloaded';

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <button type="button" className="text-2xl leading-none px-1" onClick={() => setSection('hub')}>
        ‹
      </button>
      <div className="flex flex-col items-center text-center gap-3 pb-4">
        {section === 'favourites' ? (
          <div className="w-48 h-48 rounded-lg bg-foreground text-background flex items-center justify-center text-6xl">
            ★
          </div>
        ) : null}
        <h1 className="text-3xl font-serif font-bold">{title}</h1>
        <p className="text-sm text-muted">
          {list.length} sound{list.length === 1 ? '' : 's'}
        </p>
      </div>
      <ul className="divide-y divide-border">
        {list.map((sound) => (
          <li key={sound.id} className="flex items-center gap-2">
            <button
              type="button"
              className="flex-1 flex items-center gap-3.5 py-3 text-left"
              onClick={() => {
                void (async () => {
                  const index = list.findIndex((s) => s.id === sound.id);
                  const started = await playSound(sound, {
                    queue: list,
                    queueIndex: index,
                    queueLabel: title,
                  });
                  if (started) router.push('/player');
                })();
              }}
            >
              <CoverArt title={sound.title} uri={sound.cover_url} size={48} rounded={4} />
              <span className="min-w-0 flex-1">
                <span className="block text-[16px] truncate">{sound.title}</span>
              </span>
            </button>
            {user ? (
              <button
                type="button"
                className="chip text-xs"
                onClick={async () => {
                  const label =
                    section === 'favourites' ? 'Remove favourite' : 'Delete download';
                  if (!(await appConfirm(label, `Remove "${sound.title}"?`))) return;
                  const { error } =
                    section === 'favourites'
                      ? await removeFavorite(user.id, sound.id)
                      : await deleteDownload(user.id, sound.id);
                  if (error) appAlert('Could not remove', error);
                  else void load();
                }}
              >
                Remove
              </button>
            ) : null}
          </li>
        ))}
        {!list.length ? (
          <li className="text-center text-muted text-sm py-10">
            {section === 'favourites'
              ? 'Like a sound on the player to save it here.'
              : canDownloadOffline
                ? 'No downloads yet.'
                : 'Downloads require Premium.'}
          </li>
        ) : null}
      </ul>
    </div>
  );
}
