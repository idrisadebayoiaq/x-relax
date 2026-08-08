'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { CoverArt } from '@/components/CoverArt';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import type { Sound } from '@/types/database';

export default function CreatorSoundsPage() {
  const { user, isCreator } = useAuth();
  const [sounds, setSounds] = useState<Sound[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!user || !isCreator) return;
    createClient()
      .from('sounds')
      .select('*')
      .eq('creator_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setSounds((data as Sound[]) ?? []));
  }, [user?.id, isCreator]);

  if (!isCreator) return <p className="text-muted">Creator access required.</p>;

  const filtered = query.trim()
    ? sounds.filter((s) => s.title.toLowerCase().includes(query.trim().toLowerCase()))
    : sounds;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-2">
        <Link href="/creator" className="text-2xl leading-none px-1">
          ‹
        </Link>
        <Link
          href="/creator/upload"
          className="h-10 w-10 rounded-xl border border-border inline-flex items-center justify-center"
          aria-label="Upload"
        >
          <Plus size={20} />
        </Link>
      </div>
      <h1 className="text-4xl font-serif font-bold tracking-tight mb-4">My sounds</h1>
      <div className="flex items-center gap-2 rounded-xl bg-surface border border-border px-3 py-2.5 mb-3">
        <Search size={16} className="text-muted shrink-0" />
        <input
          className="bg-transparent flex-1 outline-none text-[16px]"
          placeholder="Search in My sounds"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <ul className="divide-y divide-border">
        {filtered.map((sound) => (
          <li key={sound.id} className="flex items-center gap-3.5 py-3">
            <CoverArt title={sound.title} uri={sound.cover_url} size={56} rounded={4} />
            <div className="min-w-0 flex-1">
              <p className="text-[17px] truncate">{sound.title}</p>
              <p className="text-sm text-muted capitalize">
                {sound.status} · {sound.play_count} plays
                {sound.average_rating ? ` · ${Number(sound.average_rating).toFixed(1)}★` : ''}
              </p>
            </div>
          </li>
        ))}
        {!filtered.length ? (
          <li className="text-center text-muted text-sm py-12">No uploads yet.</li>
        ) : null}
      </ul>
    </div>
  );
}
