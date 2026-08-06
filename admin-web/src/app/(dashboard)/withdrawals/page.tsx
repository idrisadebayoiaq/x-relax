import { createClient } from '@/lib/supabase/server';
import { WithdrawalActions } from './WithdrawalActions';
import { RunEarningsButton } from './RunEarningsButton';

export default async function WithdrawalsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('withdrawal_requests')
    .select('*')
    .in('status', ['pending', 'approved'])
    .order('created_at', { ascending: true });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-bold">Withdrawals</h1>
          <p className="text-muted mt-2">Approve, then mark paid after manual transfer</p>
        </div>
        <RunEarningsButton />
      </div>
      <div className="space-y-3">
        {(data ?? []).map((row) => (
          <div key={row.id} className="border border-border rounded-xl p-4 bg-surface">
            <div className="font-semibold">
              {row.currency} {row.amount} · {row.status}
            </div>
            <div className="text-sm text-muted mt-1">
              {row.payout_method ?? 'n/a'} · {row.user_id.slice(0, 8)}…
            </div>
            <div className="mt-3">
              <WithdrawalActions id={row.id} status={row.status} />
            </div>
          </div>
        ))}
        {!data?.length ? <p className="text-muted">No open withdrawals.</p> : null}
      </div>
    </div>
  );
}
