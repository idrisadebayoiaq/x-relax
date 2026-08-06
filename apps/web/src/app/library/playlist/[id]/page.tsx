'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { SoundCard } from '@/components/SoundCard';
import { createClient } from '@/lib/supabase/client';
import { usePlayer } from '@/lib/player-context';
import type { Sound } from '@/types/database';

export default function PlaylistDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { playSound } = usePlayer();
  const [title, setTitle] = useState('Playlist');
  const [sounds, setSounds] = useState<Sound[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = params.id;
    const supabase = createClient();
    Promise.all([
      supabase.from('playlists').select('title').eq('id', id).maybeSingle(),
      supabase
        .from('playlist_items')
        .select('position, sound:sounds(*)')
        .eq('playlist_id', id)
        .order('position', { ascending: true }),
    ]).then(([{ data: pl }, { data: items }]) => {
      setTitle(pl?.title ?? 'Playlist');
      setSounds(
        ((items ?? []) as unknown as { sound: Sound | Sound[] }[])
          .map((i) => (Array.isArray(i.sound) ? i.sound[0] : i.sound))
          .filter(Boolean) as Sound[],
      );
      setLoading(false);
    });
  }, [params.id]);

  const open = async (sound: Sound) => {
    const index = sounds.findIndex((s) => s.id === sound.id);
    const started = await playSound(sound, { queue: sounds, queueIndex: index });
    if (started) router.push('/player');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link href="/library" className="text-sm text-muted underline">← Library</Link>
      <h1 className="text-3xl font-serif font-bold">{title}</h1>
      <p className="text-muted">{loading ? 'Loading…' : `${sounds.length} sounds`}</p>
      <div className="grid gap-3">
        {sounds.map((sound) => (
          <SoundCard key={sound.id} sound={sound} onPlay={() => void open(sound)} />
        ))}
      </div>
    </div>
  );
}
