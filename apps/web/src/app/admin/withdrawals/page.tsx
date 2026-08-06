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

  const review = async (id: string, status: 'approved' | 'rejected') => {
    const { error } = await createClient()
      .from('withdrawal_requests')
      .update({ status, reviewed_at: new Date().toISOString() })
      .eq('id', id);
    if (error) alert(error.message);
    else void load();
  };

  if (!isAdmin) return <p className="text-muted">Admin only.</p>;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-3xl font-serif font-bold">Withdrawal queue</h1>
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.id} className="card p-4 flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold">{row.profile?.display_name ?? 'Creator'} · ${row.amount_usd}</p>
              <p className="text-sm text-muted">{new Date(row.created_at).toLocaleDateString()}</p>
            </div>
            <div className="flex gap-2">
              <button type="button" className="chip chip-active" onClick={() => void review(row.id, 'approved')}>Approve</button>
              <button type="button" className="chip" onClick={() => void review(row.id, 'rejected')}>Reject</button>
            </div>
          </div>
        ))}
        {!rows.length ? <p className="text-muted">No pending withdrawals.</p> : null}
      </div>
    </div>
  );
}
