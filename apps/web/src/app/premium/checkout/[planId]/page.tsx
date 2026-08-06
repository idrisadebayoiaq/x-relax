'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import type { PaymentMethod, SubscriptionPlan } from '@/types/database';

type MethodInfo = {
  label: string;
  currency: 'USD' | 'NGN';
  account_name: string;
  bank_name: string;
  account_number: string;
};

export default function CheckoutPage() {
  const params = useParams<{ planId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [plan, setPlan] = useState<SubscriptionPlan | null>(null);
  const [methods, setMethods] = useState<Record<string, MethodInfo>>({});
  const [method, setMethod] = useState<PaymentMethod>('ngn_opay');
  const [proof, setProof] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      supabase.from('subscription_plans').select('*').eq('id', params.planId).maybeSingle(),
      supabase.from('app_settings').select('value').eq('key', 'payment_methods').maybeSingle(),
    ]).then(([{ data: planRow }, { data: settings }]) => {
      setPlan(planRow as SubscriptionPlan | null);
      setMethods((settings?.value as Record<string, MethodInfo>) ?? {});
    });
  }, [params.planId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !plan || !proof) {
      setError('Upload a payment proof screenshot.');
      return;
    }
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const info = methods[method];
    const currency = info?.currency ?? (method === 'usd_lead_bank' ? 'USD' : 'NGN');
    const amount = currency === 'USD' ? Number(plan.price_usd) : Number(plan.price_ngn);

    const { data: payment, error: payError } = await supabase
      .from('payment_requests')
      .insert({
        user_id: user.id,
        plan_id: plan.id,
        payment_method: method,
        amount,
        currency,
        status: 'pending',
      })
      .select('*')
      .single();

    if (payError || !payment) {
      setBusy(false);
      setError(payError?.message ?? 'Could not create payment');
      return;
    }

    const ext = proof.name.split('.').pop() || 'jpg';
    const path = `${user.id}/${payment.id}/proof.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from('payment-proofs')
      .upload(path, proof, { upsert: true });

    if (uploadError) {
      setBusy(false);
      setError(uploadError.message);
      return;
    }

    await supabase.from('payment_requests').update({ proof_path: path }).eq('id', payment.id);
    await supabase.from('payment_messages').insert({
      payment_request_id: payment.id,
      sender_id: user.id,
      body: 'Payment proof uploaded. Please review.',
    });

    setBusy(false);
    router.push('/premium/payments');
  };

  if (!plan) return <p className="text-muted">Loading plan…</p>;

  const info = methods[method];

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <Link href="/premium" className="text-sm text-muted underline">← Premium</Link>
      <h1 className="text-3xl font-serif font-bold">{plan.name}</h1>
      <form onSubmit={submit} className="card p-6 space-y-4">
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <div className="flex gap-2">
          {(['ngn_opay', 'usd_lead_bank'] as PaymentMethod[]).map((m) => (
            <button key={m} type="button" className={`chip ${method === m ? 'chip-active' : ''}`} onClick={() => setMethod(m)}>
              {m === 'ngn_opay' ? 'NGN · Opay' : 'USD · Bank'}
            </button>
          ))}
        </div>
        {info ? (
          <div className="text-sm space-y-1 text-muted">
            <p>{info.label}</p>
            <p>{info.account_name} · {info.bank_name}</p>
            <p>{info.account_number}</p>
          </div>
        ) : null}
        <input type="file" accept="image/*" onChange={(e) => setProof(e.target.files?.[0] ?? null)} />
        <button type="submit" className="btn btn-primary w-full" disabled={busy}>
          {busy ? 'Submitting…' : 'Submit payment proof'}
        </button>
      </form>
    </div>
  );
}
