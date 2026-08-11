'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CoverArt } from '@/components/CoverArt';
import { formatDuration } from '@/lib/format';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { usePlayer } from '@/lib/player-context';
import type { Playlist, Sound } from '@/types/database';

const MIX_SOUND_PREFIX = '__xrelax_mix__:';

function mixIdFromSound(sound: Sound): string | null {
  const desc = sound.description ?? '';
  if (!desc.startsWith(MIX_SOUND_PREFIX)) return null;
  const id = desc.slice(MIX_SOUND_PREFIX.length).trim();
  return id || null;
}

export default function PlaylistDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { playSound, current, isPlaying, togglePlay } = usePlayer();
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [ownerName, setOwnerName] = useState<string | null>(null);
  const [sounds, setSounds] = useState<Sound[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const isOwner = !!user && playlist?.user_id === user.id;

  useEffect(() => {
    const id = params.id;
    const supabase = createClient();
    Promise.all([
      supabase.from('playlists').select('*').eq('id', id).maybeSingle(),
      supabase
        .from('playlist_items')
        .select('position, sound:sounds(*)')
        .eq('playlist_id', id)
        .order('position', { ascending: true }),
    ]).then(async ([{ data: pl }, { data: items }]) => {
      const nextSounds = ((items ?? []) as unknown as { sound: Sound | Sound[] }[])
        .map((i) => (Array.isArray(i.sound) ? i.sound[0] : i.sound))
        .filter(Boolean) as Sound[];
      setSounds(nextSounds);
      if (pl) {
        const cover = pl.cover_url ?? nextSounds[0]?.cover_url ?? null;
        setPlaylist({ ...(pl as Playlist), cover_url: cover });
        const { data: owner } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('id', pl.user_id)
          .maybeSingle();
        setOwnerName(owner?.display_name ?? null);
      }
      setLoading(false);
    });
  }, [params.id]);

  const toggleVisibility = async () => {
    if (!playlist || !isOwner) return;
    const next = playlist.visibility === 'public' ? 'private' : 'public';
    setBusy(true);
    const { error } = await createClient()
      .from('playlists')
      .update({ visibility: next, updated_at: new Date().toISOString() })
      .eq('id', playlist.id);
    setBusy(false);
    if (error) alert(error.message);
    else setPlaylist({ ...playlist, visibility: next });
  };

  const openOrPlay = async (sound: Sound, index: number) => {
    const mixId = mixIdFromSound(sound);
    if (mixId) {
      router.push(`/mix?mixId=${encodeURIComponent(mixId)}`);
      return;
    }
    if (current?.id === sound.id) {
      await togglePlay();
      return;
    }
    const started = await playSound(sound, {
      queue: sounds,
      queueIndex: index,
      queueLabel: playlist?.title ?? 'Playlist',
    });
    if (started) router.push('/player');
  };

  const playAll = async () => {
    if (!sounds.length) return;
    await openOrPlay(sounds[0], 0);
  };

  const cover = playlist?.cover_url ?? sounds[0]?.cover_url;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <Link href="/library" className="text-2xl leading-none px-1">
          ‹
        </Link>
        {isOwner ? (
          <button
            type="button"
            className="chip"
            disabled={busy}
            onClick={() => void toggleVisibility()}
          >
            {playlist?.visibility === 'public' ? 'Public' : 'Private'}
          </button>
        ) : (
          <span />
        )}
      </div>

      <div className="flex flex-col items-center text-center gap-3 pb-6">
        <CoverArt title={playlist?.title ?? 'Playlist'} uri={cover} size={220} rounded={8} />
        <h1 className="text-3xl font-serif font-bold tracking-tight">
          {playlist?.title ?? 'Playlist'}
        </h1>
        <p className="text-sm text-muted">
          {loading
            ? 'Loading…'
            : `${ownerName ?? 'Playlist'} · ${sounds.length} sound${
                sounds.length === 1 ? '' : 's'
              } · ${playlist?.visibility === 'public' ? 'Public' : 'Private'}`}
        </p>
        <button
          type="button"
          className="btn btn-primary w-full max-w-sm"
          disabled={!sounds.length}
          onClick={() => void playAll()}
        >
          Play
        </button>
      </div>

      <ul className="divide-y divide-border">
        {sounds.map((sound, index) => {
          const active = current?.id === sound.id;
          const isMix = !!mixIdFromSound(sound);
          return (
            <li key={sound.id}>
              <button
                type="button"
                className="w-full flex items-center gap-3.5 py-3 text-left"
                onClick={() => void openOrPlay(sound, index)}
              >
                <CoverArt title={sound.title} uri={sound.cover_url} size={48} rounded={4} />
                <span className="min-w-0 flex-1">
                  <span className={`block text-[16px] truncate ${active ? 'font-bold' : ''}`}>
                    {sound.title}
                  </span>
                  <span className="block text-sm text-muted">
                    {formatDuration(sound.duration_seconds)}
                    {isMix ? ' · Mix' : ''}
                  </span>
                </span>
                {active && isPlaying ? <span className="text-muted pr-1">❚❚</span> : null}
              </button>
            </li>
          );
        })}
        {!loading && !sounds.length ? (
          <li className="text-center text-muted text-sm py-10">
            {isOwner
              ? 'Empty playlist — open a sound and add it from the player.'
              : 'This playlist has no sounds yet.'}
          </li>
        ) : null}
      </ul>
    </div>
  );
}
