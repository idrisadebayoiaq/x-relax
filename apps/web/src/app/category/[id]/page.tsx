'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { SoundCard } from '@/components/SoundCard';
import { createClient } from '@/lib/supabase/client';
import { usePlayer } from '@/lib/player-context';
import type { Category, Sound } from '@/types/database';

export default function CategoryPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { playSound } = usePlayer();
  const [category, setCategory] = useState<Category | null>(null);
  const [sounds, setSounds] = useState<Sound[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const supabase = createClient();
    void (async () => {
      const [{ data: cat }, { data: rows }] = await Promise.all([
        supabase.from('categories').select('*').eq('id', id).maybeSingle(),
        supabase
          .from('sound_categories')
          .select('sound:sounds(*)')
          .eq('category_id', id),
      ]);
      setCategory((cat as Category) ?? null);
      const list = ((rows ?? []) as unknown as { sound: Sound | Sound[] | null }[])
        .map((r) => (Array.isArray(r.sound) ? r.sound[0] : r.sound))
        .filter((s): s is Sound => !!s && s.status === 'published');
      setSounds(list);
      setLoading(false);
    })();
  }, [id]);

  const openSound = async (sound: Sound) => {
    const index = sounds.findIndex((s) => s.id === sound.id);
    const started = await playSound(sound, {
      queue: sounds,
      queueIndex: index >= 0 ? index : 0,
      queueLabel: category?.name ?? 'Category',
    });
    if (started) router.push('/player');
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link href="/" className="text-sm text-muted underline">← Home</Link>
      <div>
        <h1 className="text-3xl font-serif font-bold">{category?.name ?? 'Category'}</h1>
        <p className="text-muted mt-1">
          {loading ? 'Loading…' : `${sounds.length} sound${sounds.length === 1 ? '' : 's'} · plays only this category until finished`}
        </p>
      </div>
      <div className="grid gap-3">
        {sounds.map((sound) => (
          <SoundCard key={sound.id} sound={sound} onPlay={() => void openSound(sound)} />
        ))}
        {!loading && !sounds.length ? <p className="text-muted">No published sounds in this category.</p> : null}
      </div>
    </div>
  );
}
