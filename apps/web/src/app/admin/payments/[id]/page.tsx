'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import type { PaymentStatus } from '@/types/database';

type PaymentDetail = {
  id: string;
  status: PaymentStatus;
  amount: number;
  currency: string;
  proof_path: string | null;
  user_note: string | null;
  plan?: { name?: string } | null;
};

type Message = {
  id: string;
  body: string;
  created_at: string;
  sender_id: string;
};

export default function AdminPaymentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { isAdmin, user, refreshProfile } = useAuth();
  const [row, setRow] = useState<PaymentDetail | null>(null);
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('payment_requests')
      .select('id, status, amount, currency, proof_path, user_note, plan:subscription_plans(name)')
      .eq('id', id)
      .maybeSingle();
    const payment = data as PaymentDetail | null;
    setRow(payment);

    if (payment?.proof_path) {
      const { data: signed } = await supabase.storage
        .from('payment-proofs')
        .createSignedUrl(payment.proof_path, 3600);
      setProofUrl(signed?.signedUrl ?? null);
    }

    const { data: msgs } = await supabase
      .from('payment_messages')
      .select('id, body, created_at, sender_id')
      .eq('payment_request_id', id)
      .order('created_at', { ascending: true });
    setMessages((msgs as Message[]) ?? []);
  };

  useEffect(() => {
    if (isAdmin && id) void load();
  }, [isAdmin, id]);

  const review = async (status: PaymentStatus) => {
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.rpc('admin_review_payment', {
      p_payment_id: id,
      p_status: status,
      p_note: null,
    });
    setBusy(false);
    if (error) alert(error.message);
    else {
      await refreshProfile();
      void load();
    }
  };

  const sendReply = async () => {
    if (!user || !reply.trim()) return;
    const { error } = await createClient().from('payment_messages').insert({
      payment_request_id: id,
      sender_id: user.id,
      body: reply.trim(),
    });
    if (error) alert(error.message);
    else {
      setReply('');
      void load();
    }
  };

  if (!isAdmin) return null;
  if (!row) return <p className="text-muted">Loading…</p>;

  return (
    <div className="space-y-6 max-w-2xl">
      <Link href="/admin/payments" className="text-sm text-muted underline">
        ← Payments
      </Link>
      <div>
        <h2 className="text-xl font-semibold">{row.plan?.name ?? 'Payment'}</h2>
        <p className="text-muted text-sm mt-1">
          {row.currency} {row.amount} · {row.status}
        </p>
      </div>
      {row.user_note ? <p className="card p-3 text-sm">{row.user_note}</p> : null}
      {proofUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={proofUrl} alt="Payment proof" className="rounded-xl border border-border max-h-96 object-contain" />
      ) : (
        <p className="text-sm text-muted">No proof uploaded.</p>
      )}
      {row.status === 'pending' || row.status === 'need_more_info' ? (
        <div className="flex gap-2 flex-wrap">
          <button type="button" className="chip chip-active" disabled={busy} onClick={() => void review('approved')}>Approve</button>
          <button type="button" className="chip" disabled={busy} onClick={() => void review('need_more_info')}>Need info</button>
          <button type="button" className="chip" disabled={busy} onClick={() => void review('rejected')}>Reject</button>
        </div>
      ) : null}
      <div className="space-y-3">
        <h3 className="font-semibold">Chat</h3>
        {messages.map((m) => (
          <div key={m.id} className="card p-3 text-sm">
            <p>{m.body}</p>
            <p className="text-xs text-muted mt-1">{new Date(m.created_at).toLocaleString()}</p>
          </div>
        ))}
        <div className="flex gap-2">
          <input className="input flex-1" value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply…" />
          <button type="button" className="btn btn-primary" onClick={() => void sendReply()}>Send</button>
        </div>
      </div>
    </div>
  );
}
