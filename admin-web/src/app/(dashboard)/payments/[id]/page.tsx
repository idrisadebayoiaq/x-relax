import { createClient } from '@/lib/supabase/server';
import { PaymentActions } from '../PaymentActions';
import { PaymentChat } from './PaymentChat';

export default async function PaymentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: payment } = await supabase
    .from('payment_requests')
    .select('*, plan:subscription_plans(name)')
    .eq('id', id)
    .maybeSingle();

  const { data: messages } = await supabase
    .from('payment_messages')
    .select('*')
    .eq('payment_request_id', id)
    .order('created_at', { ascending: true });

  let proofUrl: string | null = null;
  if (payment?.proof_path) {
    const { data } = await supabase.storage
      .from('payment-proofs')
      .createSignedUrl(payment.proof_path, 3600);
    proofUrl = data?.signedUrl ?? null;
  }

  if (!payment) {
    return <p>Payment not found.</p>;
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-bold">Payment detail</h1>
      <div className="mt-4 border border-border rounded-xl p-4 bg-surface space-y-2">
        <div>
          {(payment as any).plan?.name} · {payment.currency} {payment.amount}
        </div>
        <div className="text-sm text-muted">
          {payment.payment_method} · {payment.status}
        </div>
        {proofUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={proofUrl} alt="Payment proof" className="mt-3 max-h-80 rounded-lg border border-border" />
        ) : (
          <p className="text-sm text-muted">No proof uploaded.</p>
        )}
        {(payment.status === 'pending' || payment.status === 'need_more_info') && (
          <div className="pt-3">
            <PaymentActions id={payment.id} />
          </div>
        )}
      </div>

      <h2 className="text-xl font-semibold mt-8 mb-3">Conversation</h2>
      <div className="space-y-2 mb-4">
        {(messages ?? []).map((m) => (
          <div key={m.id} className="border border-border rounded-lg p-3 text-sm">
            <div className="text-muted text-xs mb-1">
              {new Date(m.created_at).toLocaleString()}
            </div>
            {m.body}
          </div>
        ))}
        {!messages?.length ? <p className="text-muted text-sm">No messages yet.</p> : null}
      </div>
      <PaymentChat paymentId={id} />
    </div>
  );
}
