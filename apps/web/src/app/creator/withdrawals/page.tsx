'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { appAlert } from '@/components/AppDialog';

type Withdrawal = {
  id: string;
  amount_usd: number;
  amount_ngn: number;
  status: string;
  created_at: string;
};

export default function CreatorWithdrawalsPage() {
  const { user, isCreator } = useAuth();
  const [rows, setRows] = useState<Withdrawal[]>([]);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data } = await createClient()
      .from('withdrawal_requests')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setRows((data as Withdrawal[]) ?? []);
  };

  useEffect(() => {
    void load();
  }, [user?.id]);

  if (!isCreator) return <p className="text-muted">Creator access required.</p>;

  const request = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    const value = Number(amount);
    const { error } = await createClient().from('withdrawal_requests').insert({
      user_id: user.id,
      amount_usd: value,
      amount_ngn: value * 1500,
      status: 'pending',
    });
    setBusy(false);
    if (error) appAlert(error.message);
    else {
      setAmount('');
      void load();
    }
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <Link href="/creator" className="text-sm text-muted underline">← Creator</Link>
      <h1 className="text-3xl font-serif font-bold">Withdrawals</h1>
      <form onSubmit={request} className="card p-6 space-y-4">
        <input className="input" type="number" step="0.01" placeholder="Amount USD" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <button type="submit" className="btn btn-primary w-full" disabled={busy}>Request withdrawal</button>
      </form>
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.id} className="card p-4">
            <p className="font-semibold">${row.amount_usd} · {row.status}</p>
            <p className="text-sm text-muted">{new Date(row.created_at).toLocaleDateString()}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
