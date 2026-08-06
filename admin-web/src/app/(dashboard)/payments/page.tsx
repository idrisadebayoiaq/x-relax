import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PaymentActions } from './PaymentActions';

export default async function PaymentsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('payment_requests')
    .select('*, plan:subscription_plans(name)')
    .order('created_at', { ascending: false })
    .limit(100);

  return (
    <div>
      <h1 className="text-3xl font-bold">Payments</h1>
      <p className="text-muted mt-2 mb-6">Manual Premium verification queue</p>
      <div className="space-y-3">
        {(data ?? []).map((row: any) => (
          <div key={row.id} className="border border-border rounded-xl p-4 bg-surface">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-semibold">
                  {row.plan?.name ?? 'Plan'} · {row.currency} {row.amount}
                </div>
                <div className="text-sm text-muted mt-1">
                  {row.user_id.slice(0, 8)}… · {row.payment_method} · {row.status}
                </div>
              </div>
              <Link className="text-sm underline" href={`/payments/${row.id}`}>
                Open
              </Link>
            </div>
            {(row.status === 'pending' || row.status === 'need_more_info') && (
              <div className="mt-3">
                <PaymentActions id={row.id} />
              </div>
            )}
          </div>
        ))}
        {!data?.length ? <p className="text-muted">No payment requests.</p> : null}
      </div>
    </div>
  );
}
