import { createClient } from '@/lib/supabase/server';
import { AnalyticsDashboard } from '@/components/AnalyticsDashboard';
import { parseAnalyticsSummary, type QueueStat } from '@/lib/analytics';

async function count(table: string, filter?: { column: string; value: string }) {
  const supabase = await createClient();
  let q = supabase.from(table).select('*', { count: 'exact', head: true });
  if (filter) q = q.eq(filter.column, filter.value);
  const { count } = await q;
  return count ?? 0;
}

export default async function OverviewPage() {
  const supabase = await createClient();
  const [
    analyticsResult,
    pendingPayments,
    pendingSounds,
    pendingVerifications,
    pendingWithdrawals,
    openReports,
    openSupport,
    appReleases,
  ] = await Promise.all([
    supabase.rpc('admin_analytics_summary', { p_days: 30 }),
    count('payment_requests', { column: 'status', value: 'pending' }),
    count('sounds', { column: 'status', value: 'pending' }),
    count('creator_verifications', { column: 'status', value: 'pending' }),
    count('withdrawal_requests', { column: 'status', value: 'pending' }),
    count('reports', { column: 'status', value: 'open' }),
    count('support_threads', { column: 'status', value: 'open' }),
    count('app_releases'),
  ]);

  const summary = parseAnalyticsSummary(analyticsResult.data, 30);
  const queues: QueueStat[] = [
    { href: '/payments', label: 'Pending payments', value: pendingPayments, hint: 'Manual Premium proofs' },
    { href: '/moderation', label: 'Sounds to moderate', value: pendingSounds, hint: 'Creator uploads' },
    { href: '/verifications', label: 'Verifications', value: pendingVerifications, hint: 'Apply to earn' },
    { href: '/withdrawals', label: 'Withdrawals', value: pendingWithdrawals, hint: 'Creator payouts' },
    { href: '/reports', label: 'Open reports', value: openReports },
    { href: '/support', label: 'Open support', value: openSupport },
    { href: '/releases', label: 'App releases', value: appReleases, hint: 'APK versions on the download page' },
  ];

  return <AnalyticsDashboard summary={summary} queues={queues} />;
}
