'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';

async function count(table: string, filter?: { column: string; value: string }) {
  const supabase = createClient();
  let q = supabase.from(table).select('*', { count: 'exact', head: true });
  if (filter) q = q.eq(filter.column, filter.value);
  const { count: n } = await q;
  return n ?? 0;
}

export default function AdminOverviewPage() {
  const { isAdmin } = useAuth();
  const [cards, setCards] = useState<{ href: string; label: string; value: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAdmin) return;
    void (async () => {
      const [
        pendingPayments,
        pendingSounds,
        pendingVerifications,
        pendingWithdrawals,
        openReports,
        openSupport,
        appReleases,
      ] = await Promise.all([
        count('payment_requests', { column: 'status', value: 'pending' }),
        count('sounds', { column: 'status', value: 'pending' }),
        count('creator_verifications', { column: 'status', value: 'pending' }),
        count('withdrawal_requests', { column: 'status', value: 'pending' }),
        count('reports', { column: 'status', value: 'open' }),
        count('support_threads', { column: 'status', value: 'open' }),
        count('app_releases'),
      ]);
      setCards([
        { href: '/admin/payments', label: 'Pending payments', value: pendingPayments },
        { href: '/admin/moderation', label: 'Sounds to moderate', value: pendingSounds },
        { href: '/admin/verifications', label: 'Verifications', value: pendingVerifications },
        { href: '/admin/withdrawals', label: 'Withdrawals', value: pendingWithdrawals },
        { href: '/admin/reports', label: 'Open reports', value: openReports },
        { href: '/admin/support', label: 'Open support', value: openSupport },
        { href: '/admin/releases', label: 'App releases', value: appReleases },
      ]);
      setLoading(false);
    })();
  }, [isAdmin]);

  if (!isAdmin) return null;

  return (
    <div className="space-y-6">
      <p className="text-muted">Operate X-Relax from the website — payments, moderation, APK uploads, and more.</p>
      {loading ? <p className="text-muted">Loading queues…</p> : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <Link key={card.href} href={card.href} className="card p-5 hover:opacity-90">
            <p className="text-sm text-muted">{card.label}</p>
            <p className="text-3xl font-bold mt-2">{card.value}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
