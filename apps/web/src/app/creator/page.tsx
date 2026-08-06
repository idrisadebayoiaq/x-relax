'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';

type Analytics = {
  published_sounds?: number;
  pending_sounds?: number;
  total_plays?: number;
  earnings_usd?: number;
  earnings_ngn?: number;
};

export default function CreatorPage() {
  const { isCreator } = useAuth();
  const [stats, setStats] = useState<Analytics | null>(null);

  useEffect(() => {
    if (!isCreator) return;
    createClient().rpc('creator_analytics').then(({ data }) => setStats((data as Analytics) ?? null));
  }, [isCreator]);

  if (!isCreator) {
    return (
      <div className="max-w-lg mx-auto space-y-4 text-center py-16">
        <h1 className="text-3xl font-serif font-bold">Creator</h1>
        <p className="text-muted">Share original relaxation audio and earn from Premium listening.</p>
        <Link href="/creator/become" className="btn btn-primary inline-block">Become a Creator</Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-3xl font-serif font-bold">Creator dashboard</h1>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          ['Published', stats?.published_sounds ?? 0],
          ['Pending', stats?.pending_sounds ?? 0],
          ['Total plays', stats?.total_plays ?? 0],
          ['Earnings USD', `$${Number(stats?.earnings_usd ?? 0).toFixed(2)}`],
        ].map(([label, value]) => (
          <div key={label as string} className="card p-4">
            <p className="text-sm text-muted">{label}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
          </div>
        ))}
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <Link href="/creator/upload" className="card p-4">Upload sound</Link>
        <Link href="/creator/sounds" className="card p-4">My sounds</Link>
        <Link href="/creator/verification" className="card p-4">Verification</Link>
        <Link href="/creator/withdrawals" className="card p-4">Withdrawals</Link>
      </div>
    </div>
  );
}
