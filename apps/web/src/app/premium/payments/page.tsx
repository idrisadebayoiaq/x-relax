'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import type { PaymentRequest } from '@/types/database';

export default function MyPaymentsPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<PaymentRequest[]>([]);

  useEffect(() => {
    if (!user) return;
    createClient()
      .from('payment_requests')
      .select('*, plan:subscription_plans(name)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setRows((data as PaymentRequest[]) ?? []));
  }, [user?.id]);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link href="/premium" className="text-sm text-muted underline">← Premium</Link>
      <h1 className="text-3xl font-serif font-bold">My payments</h1>
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.id} className="card p-4">
            <p className="font-semibold">{(row.plan as { name?: string })?.name ?? 'Plan'}</p>
            <p className="text-sm text-muted">
              {row.currency} {row.amount} · {row.status} · {new Date(row.created_at).toLocaleDateString()}
            </p>
          </div>
        ))}
        {!rows.length ? <p className="text-muted">No payment requests yet.</p> : null}
      </div>
    </div>
  );
}
