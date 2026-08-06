'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import type { PaymentRequest, PaymentStatus } from '@/types/database';

export default function AdminPaymentsPage() {
  const { isAdmin, refreshProfile } = useAuth();
  const [rows, setRows] = useState<PaymentRequest[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    const { data } = await createClient()
      .from('payment_requests')
      .select('*, plan:subscription_plans(name)')
      .order('created_at', { ascending: false });
    setRows((data as PaymentRequest[]) ?? []);
  };

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin]);

  const review = async (id: string, status: PaymentStatus) => {
    setBusyId(id);
    const { error } = await createClient().rpc('admin_review_payment', {
      p_payment_id: id,
      p_status: status,
      p_note: null,
    });
    setBusyId(null);
    if (error) alert(error.message);
    else {
      await refreshProfile();
      void load();
    }
  };

  if (!isAdmin) return <p className="text-muted">Admin only.</p>;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link href="/premium" className="text-sm text-muted underline">← Premium</Link>
      <h1 className="text-3xl font-serif font-bold">Payment review</h1>
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.id} className="card p-4 space-y-2">
            <p className="font-semibold">{(row.plan as { name?: string })?.name ?? 'Plan'}</p>
            <p className="text-sm text-muted">{row.currency} {row.amount} · {row.status}</p>
            {row.status === 'pending' ? (
              <div className="flex gap-2">
                <button type="button" className="chip chip-active" disabled={busyId === row.id} onClick={() => void review(row.id, 'approved')}>Approve</button>
                <button type="button" className="chip" disabled={busyId === row.id} onClick={() => void review(row.id, 'rejected')}>Reject</button>
                <button type="button" className="chip" disabled={busyId === row.id} onClick={() => void review(row.id, 'need_more_info')}>Need info</button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
