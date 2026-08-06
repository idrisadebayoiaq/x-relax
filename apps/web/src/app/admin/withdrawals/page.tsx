'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';

type Row = {
  id: string;
  user_id: string;
  amount_usd: number;
  status: string;
  created_at: string;
  profile?: { display_name: string | null };
};

export default function AdminWithdrawalsPage() {
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [earningsBusy, setEarningsBusy] = useState(false);

  const load = async () => {
    const { data } = await createClient()
      .from('withdrawal_requests')
      .select('id, user_id, amount_usd, status, created_at, profile:profiles(display_name)')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
    const normalized = ((data ?? []) as unknown as Row[]).map((row) => ({
      ...row,
      profile: Array.isArray(row.profile) ? row.profile[0] : row.profile,
    }));
    setRows(normalized);
  };

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin]);

  const review = async (id: string, status: 'approved' | 'rejected' | 'paid') => {
    const { error } = await createClient().rpc('review_withdrawal', {
      p_id: id,
      p_status: status,
      p_admin_note: null,
    });
    if (error) alert(error.message);
    else void load();
  };

  const runEarnings = async () => {
    setEarningsBusy(true);
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
    const { error } = await createClient().rpc('calculate_creator_earnings', {
      p_period_start: start.toISOString().slice(0, 10),
      p_period_end: end.toISOString().slice(0, 10),
    });
    setEarningsBusy(false);
    if (error) alert(error.message);
    else alert('Earnings calculation finished.');
  };

  if (!isAdmin) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Withdrawal queue</h2>
        <button type="button" className="chip" disabled={earningsBusy} onClick={() => void runEarnings()}>
          {earningsBusy ? 'Running…' : 'Run earnings'}
        </button>
      </div>
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.id} className="card p-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-semibold">{row.profile?.display_name ?? 'Creator'} · ${row.amount_usd}</p>
              <p className="text-sm text-muted">{new Date(row.created_at).toLocaleDateString()}</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button type="button" className="chip chip-active" onClick={() => void review(row.id, 'approved')}>Approve</button>
              <button type="button" className="chip" onClick={() => void review(row.id, 'paid')}>Mark paid</button>
              <button type="button" className="chip" onClick={() => void review(row.id, 'rejected')}>Reject</button>
            </div>
          </div>
        ))}
        {!rows.length ? <p className="text-muted">No pending withdrawals.</p> : null}
      </div>
    </div>
  );
}
