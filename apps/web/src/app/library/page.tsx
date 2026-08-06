'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CoverArt } from '@/components/CoverArt';
import { SoundCard } from '@/components/SoundCard';
import { useOffline } from '@/components/OfflineProvider';
import { formatDuration } from '@/lib/format';
import { listOfflineSounds } from '@/lib/offline-storage';
import { createClient } from '@/lib/supabase/client';
import { removeDownloadForWeb } from '@/lib/web-downloads';
import { useAuth } from '@/lib/auth-context';
import { usePlayer } from '@/lib/player-context';
import type { Playlist, Sound } from '@/types/database';

type Tab = 'playlists' | 'favourites' | 'downloads';

export default function LibraryPage() {
  const router = useRouter();
  const { user, canDownloadOffline } = useAuth();
  const { online } = useOffline();
  const { playSound } = usePlayer();
  const [tab, setTab] = useState<Tab>('playlists');
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [favourites, setFavourites] = useState<Sound[]>([]);
  const [downloads, setDownloads] = useState<Sound[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    setLoading(true);

    if (!online && canDownloadOffline) {
      const offline = await listOfflineSounds();
      setDownloads(offline);
      setPlaylists([]);
      setFavourites([]);
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const [{ data: pls }, { data: favs }, { data: dls }] = await Promise.all([
      supabase.from('playlists').select('*').eq('user_id', user.id).order('updated_at', { ascending: false }),
      supabase.from('favourites').select('sound:sounds(*)').eq('user_id', user.id),
      canDownloadOffline
        ? supabase.from('downloads').select('sound:sounds(*)').eq('user_id', user.id)
        : Promise.resolve({ data: [] }),
    ]);
    setPlaylists((pls as Playlist[]) ?? []);
    setFavourites(
      ((favs ?? []) as unknown as { sound: Sound | Sound[] }[])
        .map((f) => (Array.isArray(f.sound) ? f.sound[0] : f.sound))
        .filter(Boolean) as Sound[],
    );
    setDownloads(
      ((dls ?? []) as unknown as { sound: Sound | Sound[] }[])
        .map((d) => (Array.isArray(d.sound) ? d.sound[0] : d.sound))
        .filter(Boolean) as Sound[],
    );
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, [user?.id, online, canDownloadOffline]);

  const createPlaylist = async () => {
    if (!user || !newTitle.trim() || !online) return;
    await createClient().from('playlists').insert({ user_id: user.id, title: newTitle.trim() });
    setNewTitle('');
    void load();
  };

  const openSound = async (sound: Sound, list: Sound[]) => {
    const index = list.findIndex((s) => s.id === sound.id);
    const started = await playSound(sound, { queue: list, queueIndex: index >= 0 ? index : 0 });
    if (started) router.push('/player');
  };

  const removeDownload = async (soundId: string) => {
    if (!user) return;
    const result = await removeDownloadForWeb(user.id, soundId);
    if (!result.ok) alert(result.message);
    else void load();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-3xl font-serif font-bold">Library</h1>
      {!online ? (
        <p className="text-sm text-muted">Offline · showing downloaded sounds only</p>
      ) : null}
      <div className="flex gap-2 flex-wrap">
        {(['playlists', 'favourites', 'downloads'] as Tab[]).map((t) => (
          <button key={t} type="button" className={`chip ${tab === t ? 'chip-active' : ''}`} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {loading ? <p className="text-muted">Loading…</p> : null}

      {tab === 'playlists' && online ? (
        <div className="space-y-4">
          <div className="flex gap-2">
            <input className="input flex-1" placeholder="New playlist title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
            <button type="button" className="btn btn-primary" onClick={() => void createPlaylist()}>Create</button>
          </div>
          {playlists.map((pl) => (
            <Link key={pl.id} href={`/library/playlist/${pl.id}`} className="card block p-4">
              <p className="font-semibold">{pl.title}</p>
              <p className="text-sm text-muted">Open playlist →</p>
            </Link>
          ))}
        </div>
      ) : null}

      {tab === 'playlists' && !online ? (
        <p className="text-muted text-sm">Playlists are unavailable offline.</p>
      ) : null}

      {tab === 'favourites' && online ? (
        <div className="grid gap-3">
          {favourites.map((sound) => (
            <SoundCard key={sound.id} sound={sound} onPlay={() => void openSound(sound, favourites)} />
          ))}
        </div>
      ) : null}

      {tab === 'favourites' && !online ? (
        <p className="text-muted text-sm">Favourites are unavailable offline.</p>
      ) : null}

      {tab === 'downloads' ? (
        <div className="space-y-4">
          {!canDownloadOffline ? (
            <div className="card p-4">
              <p className="font-semibold">Downloads require Premium</p>
              <p className="text-sm text-muted mt-1">
                Free accounts must stay online. Premium and admin users can download sounds for offline playback.
              </p>
              <Link href="/premium" className="underline text-sm">Upgrade</Link>
            </div>
          ) : null}
          {canDownloadOffline && downloads.length === 0 && !loading ? (
            <p className="text-sm text-muted">No downloads yet. Save sounds from the player while online.</p>
          ) : null}
          <div className="grid gap-3">
            {downloads.map((sound) => (
              <div key={sound.id} className="card p-4 flex gap-4 items-center">
                <CoverArt title={sound.title} uri={sound.cover_url} size={56} rounded={12} />
                <div className="flex-1">
                  <p className="font-semibold">{sound.title}</p>
                  <p className="text-sm text-muted">{formatDuration(sound.duration_seconds)} · Offline ready</p>
                </div>
                <button type="button" className="btn btn-outline" onClick={() => void openSound(sound, downloads)}>Play</button>
                {online ? (
                  <button type="button" className="chip" onClick={() => void removeDownload(sound.id)}>Remove</button>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
