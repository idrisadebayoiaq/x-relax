'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { paymentMethodForCountry } from '@/lib/countries';
import { fetchPremiumAccess, formatPremiumCoverage } from '@/lib/premium-access';
import type { PaymentMethod, SubscriptionPlan } from '@/types/database';

type MethodInfo = {
  label: string;
  currency: 'USD' | 'NGN';
  account_name: string;
  bank_name: string;
  account_number: string;
  account_type?: string;
  routing_number?: string;
  bank_address?: string;
};

export default function CheckoutPage() {
  const params = useParams<{ planId: string }>();
  const router = useRouter();
  const { user, profile } = useAuth();
  const allowedMethod = paymentMethodForCountry(profile?.country_code);
  const [plan, setPlan] = useState<SubscriptionPlan | null>(null);
  const [methods, setMethods] = useState<Record<string, MethodInfo>>({});
  const [method, setMethod] = useState<PaymentMethod>(allowedMethod);
  const [proof, setProof] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blockedReason, setBlockedReason] = useState<string | null>(null);

  useEffect(() => {
    setMethod(allowedMethod);
  }, [allowedMethod]);

  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      supabase.from('subscription_plans').select('*').eq('id', params.planId).maybeSingle(),
      supabase.from('app_settings').select('value').eq('key', 'payment_methods').maybeSingle(),
    ]).then(async ([{ data: planRow }, { data: settings }]) => {
      const nextPlan = planRow as SubscriptionPlan | null;
      setPlan(nextPlan);
      setMethods((settings?.value as Record<string, MethodInfo>) ?? {});
      if (nextPlan && nextPlan.code !== 'creator_blue_badge') {
        const access = await fetchPremiumAccess();
        if (!access.canPurchase) setBlockedReason(formatPremiumCoverage(access));
      }
    });
  }, [params.planId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (blockedReason) {
      setError(blockedReason);
      return;
    }
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
      const denied = /row-level security|violates/i.test(payError?.message ?? '');
      setError(
        denied
          ? 'You already have Premium or a payment waiting for approval.'
          : (payError?.message ?? 'Could not create payment'),
      );
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
    await supabase.rpc('notify_admins', {
      p_title: 'New payment request',
      p_body: `${user.email ?? 'User'} submitted a ${plan.name} payment`,
      p_data: { payment_id: payment.id },
    });

    setBusy(false);
    router.push('/premium/payments');
  };

  if (!plan) return <p className="text-muted">Loading plan…</p>;

  const info = methods[method];
  const amountLabel =
    info?.currency === 'USD' || method === 'usd_lead_bank'
      ? `$${Number(plan.price_usd).toFixed(2)}`
      : `₦${Number(plan.price_ngn).toLocaleString()}`;

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <Link href={plan.code === 'creator_blue_badge' ? '/creator' : '/premium'} className="text-sm text-muted underline">
        ← Back
      </Link>
      <h1 className="text-3xl font-serif font-bold">{plan.name}</h1>
      {blockedReason ? (
        <div className="card p-6 space-y-2">
          <p className="font-semibold">Plans are closed</p>
          <p className="text-sm text-muted">{blockedReason}</p>
          <Link href="/premium/payments" className="chip inline-flex">My payment requests</Link>
        </div>
      ) : (
      <form onSubmit={submit} className="card p-6 space-y-4">
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {!profile?.country_code ? (
          <p className="text-sm text-muted">
            Set your country in Profile so we show the correct payment details.
          </p>
        ) : null}
        <div className="flex gap-2">
          {([allowedMethod] as PaymentMethod[]).map((m) => (
            <button
              key={m}
              type="button"
              className={`chip ${method === m ? 'chip-active' : ''}`}
              onClick={() => setMethod(m)}
            >
              {m === 'ngn_opay' ? 'NGN · Opay' : 'USD · Bank'}
            </button>
          ))}
        </div>
        {info ? (
          <div className="rounded-2xl border border-border p-4 space-y-2 text-sm">
            <p className="font-semibold text-foreground">{info.label}</p>
            <p className="text-2xl font-serif font-bold">{amountLabel}</p>
            <p className="text-muted">Account name: {info.account_name}</p>
            <p className="text-muted">Bank: {info.bank_name}</p>
            <p className="text-muted">Account number: {info.account_number}</p>
            {info.routing_number ? (
              <p className="text-muted">Routing: {info.routing_number}</p>
            ) : null}
            {info.account_type ? <p className="text-muted">Type: {info.account_type}</p> : null}
            {info.bank_address ? <p className="text-muted">Address: {info.bank_address}</p> : null}
            <p className="text-muted pt-2">
              Include your X-Relax email in the transfer memo if possible.
            </p>
          </div>
        ) : (
          <p className="text-sm text-red-600">
            Payment details for this method are missing. Ask an admin to update Settings → payment_methods.
          </p>
        )}
        <input type="file" accept="image/*" onChange={(e) => setProof(e.target.files?.[0] ?? null)} />
        <button type="submit" className="btn btn-primary w-full" disabled={busy || !info}>
          {busy ? 'Submitting…' : 'Submit payment proof'}
        </button>
      </form>
      )}
    </div>
  );
}
