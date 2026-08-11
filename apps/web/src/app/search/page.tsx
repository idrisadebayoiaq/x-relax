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
  const [debounced, setDebounced] = useState('');
  const [sort, setSort] = useState<SortKey>('newest');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(query.trim()), 250);
    return () => window.clearTimeout(id);
  }, [query]);

  useEffect(() => {
    if (!debounced) {
      setSounds([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    let req = createClient()
      .from('sounds')
      .select('*')
      .eq('status', 'published')
      .or(`title.ilike.%${debounced}%,description.ilike.%${debounced}%`)
      .limit(40);
    if (sort === 'newest') req = req.order('created_at', { ascending: false });
    if (sort === 'popular') req = req.order('play_count', { ascending: false });
    if (sort === 'rating') req = req.order('average_rating', { ascending: false });
    void req.then(({ data }) => {
      setSounds((data as Sound[]) ?? []);
      setLoading(false);
    });
  }, [debounced, sort]);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return sounds
      .filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          (s.description ?? '').toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [sounds, query]);

  const open = async (sound: Sound) => {
    const index = sounds.findIndex((s) => s.id === sound.id);
    const started = await playSound(sound, {
      queue: sounds,
      queueIndex: index,
      queueLabel: 'Search results',
    });
    if (started) router.push('/player');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-3xl font-serif font-bold">Search</h1>
      <p className="text-muted text-sm">Start typing to find sounds. Nothing loads until you search.</p>
      <input
        className="input"
        placeholder="Find rain, ocean, focus…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {query.trim() && suggestions.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button
              key={s.id}
              type="button"
              className="chip"
              onClick={() => setQuery(s.title)}
            >
              {s.title}
            </button>
          ))}
        </div>
      ) : null}
      {debounced ? (
        <div className="flex gap-2 flex-wrap">
          {(['newest', 'popular', 'rating'] as SortKey[]).map((key) => (
            <button
              key={key}
              type="button"
              className={`chip ${sort === key ? 'chip-active' : ''}`}
              onClick={() => setSort(key)}
            >
              {key}
            </button>
          ))}
        </div>
      ) : null}
      {!debounced ? (
        <p className="text-muted">Type a title or mood to see results.</p>
      ) : loading ? (
        <p className="text-muted">Searching…</p>
      ) : (
        <div className="grid gap-3">
          {sounds.length === 0 ? (
            <p className="text-muted">No matches.</p>
          ) : (
            sounds.map((sound) => (
              <SoundCard key={sound.id} sound={sound} onPlay={() => void open(sound)} />
            ))
          )}
        </div>
      )}
    </div>
  );
}
