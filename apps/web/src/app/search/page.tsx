'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SoundCard } from '@/components/SoundCard';
import { createClient } from '@/lib/supabase/client';
import { usePlayer } from '@/lib/player-context';
import type { Sound } from '@/types/database';

type SortKey = 'newest' | 'popular' | 'rating';

export default function SearchPage() {
  const router = useRouter();
  const { playSound } = usePlayer();
  const [sounds, setSounds] = useState<Sound[]>([]);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('newest');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    createClient()
      .from('sounds')
      .select('*')
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setSounds((data as Sound[]) ?? []);
        setLoading(false);
      });
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = sounds;
    if (q) {
      list = list.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          (s.description ?? '').toLowerCase().includes(q),
      );
    }
    if (sort === 'popular') list = [...list].sort((a, b) => b.play_count - a.play_count);
    if (sort === 'rating')
      list = [...list].sort((a, b) => (b.average_rating ?? 0) - (a.average_rating ?? 0));
    return list;
  }, [sounds, query, sort]);

  const open = async (sound: Sound) => {
    const index = filtered.findIndex((s) => s.id === sound.id);
    const started = await playSound(sound, {
      queue: filtered,
      queueIndex: index,
      queueLabel: query.trim() ? 'Search results' : 'Catalog',
    });
    if (started) router.push('/player');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-3xl font-serif font-bold">Search</h1>
      <input className="input" placeholder="Find rain, ocean, focus…" value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="flex gap-2 flex-wrap">
        {(['newest', 'popular', 'rating'] as SortKey[]).map((key) => (
          <button key={key} type="button" className={`chip ${sort === key ? 'chip-active' : ''}`} onClick={() => setSort(key)}>
            {key}
          </button>
        ))}
      </div>
      {loading ? (
        <p className="text-muted">Loading catalog…</p>
      ) : (
        <div className="grid gap-3">
          {filtered.map((sound) => (
            <SoundCard key={sound.id} sound={sound} onPlay={() => void open(sound)} />
          ))}
        </div>
      )}
    </div>
  );
}
