'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { AnalyticsDashboard, type QueueCard } from '@/components/admin/AnalyticsDashboard';
import { emptyAnalyticsSummary, fetchAdminAnalytics, type AnalyticsSummary } from '@/lib/analytics';

async function count(table: string, filter?: { column: string; value: string }) {
  const supabase = createClient();
  let q = supabase.from(table).select('*', { count: 'exact', head: true });
  if (filter) q = q.eq(filter.column, filter.value);
  const { count: n } = await q;
  return n ?? 0;
}

export default function AdminOverviewPage() {
  const { isAdmin } = useAuth();
  const [summary, setSummary] = useState<AnalyticsSummary>(emptyAnalyticsSummary());
  const [queues, setQueues] = useState<QueueCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAdmin) return;
    void (async () => {
      const [
        analytics,
        pendingPayments,
        pendingSounds,
        pendingVerifications,
        pendingWithdrawals,
        openReports,
        openSupport,
        appReleases,
      ] = await Promise.all([
        fetchAdminAnalytics(30),
        count('payment_requests', { column: 'status', value: 'pending' }),
        count('sounds', { column: 'status', value: 'pending' }),
        count('creator_verifications', { column: 'status', value: 'pending' }),
        count('withdrawal_requests', { column: 'status', value: 'pending' }),
        count('reports', { column: 'status', value: 'open' }),
        count('support_threads', { column: 'status', value: 'open' }),
        count('app_releases'),
      ]);
      setSummary(analytics);
      setQueues([
        { href: '/admin/payments', label: 'Pending payments', value: pendingPayments, hint: 'Manual Premium proofs' },
        { href: '/admin/moderation', label: 'Sounds to moderate', value: pendingSounds, hint: 'Creator uploads' },
        { href: '/admin/verifications', label: 'Verifications', value: pendingVerifications, hint: 'Apply to earn' },
        { href: '/admin/withdrawals', label: 'Withdrawals', value: pendingWithdrawals, hint: 'Creator payouts' },
        { href: '/admin/reports', label: 'Open reports', value: openReports },
        { href: '/admin/support', label: 'Open support', value: openSupport },
        { href: '/admin/releases', label: 'App releases', value: appReleases, hint: 'APK versions on the download page' },
      ]);
      setLoading(false);
    })();
  }, [isAdmin]);

  if (!isAdmin) return null;

  if (loading) {
    return <p className="text-muted">Loading dashboard…</p>;
  }

  return <AnalyticsDashboard summary={summary} queues={queues} />;
}
