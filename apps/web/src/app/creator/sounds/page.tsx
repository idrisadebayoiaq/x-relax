'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CoverArt } from '@/components/CoverArt';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import type { Sound } from '@/types/database';

export default function CreatorSoundsPage() {
  const { user, isCreator } = useAuth();
  const [sounds, setSounds] = useState<Sound[]>([]);

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

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link href="/creator" className="text-sm text-muted underline">← Creator</Link>
      <h1 className="text-3xl font-serif font-bold">My sounds</h1>
      <div className="space-y-3">
        {sounds.map((sound) => (
          <div key={sound.id} className="card p-4 flex gap-4 items-center">
            <CoverArt title={sound.title} uri={sound.cover_url} size={56} rounded={12} />
            <div className="flex-1">
              <p className="font-semibold">{sound.title}</p>
              <p className="text-sm text-muted capitalize">{sound.status} · {sound.play_count} plays</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
