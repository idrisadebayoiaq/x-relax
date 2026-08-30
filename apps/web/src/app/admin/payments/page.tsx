'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import type { PaymentRequest, PaymentStatus } from '@/types/database';
import { appAlert } from '@/components/AppDialog';

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
    const supabase = createClient();
    const { error } = await supabase.rpc('admin_review_payment', {
      p_payment_id: id,
      p_status: status,
      p_note: null,
    });
    if (!error) {
      await supabase.rpc('log_admin_action', {
        p_action: 'review_payment',
        p_entity_type: 'payment_request',
        p_entity_id: id,
        p_meta: { status },
      });
      await refreshProfile();
      void load();
    } else appAlert(error.message);
    setBusyId(null);
  };

  if (!isAdmin) return null;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Payment review</h2>
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.id} className="card p-4 space-y-2">
            <div className="flex flex-wrap justify-between gap-2">
              <div>
                <p className="font-semibold">{(row.plan as { name?: string })?.name ?? 'Plan'}</p>
                <p className="text-sm text-muted">
                  {row.currency} {row.amount} · {row.status}
                </p>
              </div>
              <Link href={`/admin/payments/${row.id}`} className="chip">
                Open
              </Link>
            </div>
            {row.status === 'pending' ? (
              <div className="flex gap-2 flex-wrap">
                <button type="button" className="chip chip-active" disabled={busyId === row.id} onClick={() => void review(row.id, 'approved')}>Approve</button>
                <button type="button" className="chip" disabled={busyId === row.id} onClick={() => void review(row.id, 'need_more_info')}>Need info</button>
                <button type="button" className="chip" disabled={busyId === row.id} onClick={() => void review(row.id, 'rejected')}>Reject</button>
              </div>
            ) : null}
          </div>
        ))}
        {!rows.length ? <p className="text-muted">No payment requests.</p> : null}
      </div>
    </div>
  );
}
