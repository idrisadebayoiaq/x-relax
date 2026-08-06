import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

async function count(table: string, filter?: { column: string; value: string }) {
  const supabase = await createClient();
  let q = supabase.from(table).select('*', { count: 'exact', head: true });
  if (filter) q = q.eq(filter.column, filter.value);
  const { count } = await q;
  return count ?? 0;
}

export default async function OverviewPage() {
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

  const cards = [
    { href: '/payments', label: 'Pending payments', value: pendingPayments },
    { href: '/moderation', label: 'Sounds to moderate', value: pendingSounds },
    { href: '/verifications', label: 'Verifications', value: pendingVerifications },
    { href: '/withdrawals', label: 'Withdrawals', value: pendingWithdrawals },
    { href: '/reports', label: 'Open reports', value: openReports },
    { href: '/support', label: 'Open support', value: openSupport },
    { href: '/releases', label: 'App releases', value: appReleases },
  ];

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
      <p className="text-muted mt-2 mb-8">
        Operate X-Relax without touching Supabase Studio for daily work.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="border border-border bg-surface rounded-xl p-5 hover:opacity-90"
          >
            <div className="text-sm text-muted">{card.label}</div>
            <div className="text-3xl font-bold mt-2">{card.value}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
