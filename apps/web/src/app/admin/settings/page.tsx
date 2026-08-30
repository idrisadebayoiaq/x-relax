'use client';

import { FormEvent, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import type { SubscriptionPlan } from '@/types/database';
import { appAlert } from '@/components/AppDialog';

export default function AdminSettingsPage() {
  const { isAdmin } = useAuth();
  const [featureFlags, setFeatureFlags] = useState('{}');
  const [paymentMethods, setPaymentMethods] = useState('{}');
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);

  const load = async () => {
    const supabase = createClient();
    const [{ data: flags }, { data: methods }, { data: planRows }] = await Promise.all([
      supabase.from('app_settings').select('value').eq('key', 'feature_flags').maybeSingle(),
      supabase.from('app_settings').select('value').eq('key', 'payment_methods').maybeSingle(),
      supabase.from('subscription_plans').select('*').order('sort_order'),
    ]);
    setFeatureFlags(JSON.stringify(flags?.value ?? {}, null, 2));
    setPaymentMethods(JSON.stringify(methods?.value ?? {}, null, 2));
    setPlans((planRows as SubscriptionPlan[]) ?? []);
  };

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin]);

  const saveSetting = async (key: string, raw: string) => {
    try {
      const parsed = JSON.parse(raw);
      const { error } = await createClient().from('app_settings').upsert({
        key,
        value: parsed,
        updated_at: new Date().toISOString(),
      });
      if (error) appAlert(error.message);
      else appAlert(`Saved ${key}`);
    } catch {
      appAlert('Invalid JSON');
    }
  };

  const savePlan = async (plan: SubscriptionPlan) => {
    const { error } = await createClient()
      .from('subscription_plans')
      .update({
        name: plan.name,
        price_usd: plan.price_usd,
        price_ngn: plan.price_ngn,
        is_active: plan.is_active,
      })
      .eq('id', plan.id);
    if (error) appAlert(error.message);
    else appAlert('Plan saved');
  };

  if (!isAdmin) return null;

  return (
    <div className="space-y-8 max-w-2xl">
      <h2 className="text-xl font-semibold">Settings</h2>

      <form
        className="card p-4 space-y-3"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          void saveSetting('feature_flags', featureFlags);
        }}
      >
        <p className="font-semibold">Feature flags (JSON)</p>
        <textarea className="input min-h-[140px] font-mono text-sm" value={featureFlags} onChange={(e) => setFeatureFlags(e.target.value)} />
        <button type="submit" className="btn btn-primary">Save feature flags</button>
      </form>

      <form
        className="card p-4 space-y-3"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          void saveSetting('payment_methods', paymentMethods);
        }}
      >
        <p className="font-semibold">Payment methods (JSON)</p>
        <textarea className="input min-h-[140px] font-mono text-sm" value={paymentMethods} onChange={(e) => setPaymentMethods(e.target.value)} />
        <button type="submit" className="btn btn-primary">Save payment methods</button>
      </form>

      <div className="space-y-3">
        <p className="font-semibold">Subscription plans</p>
        {plans.map((plan, index) => (
          <div key={plan.id} className="card p-4 space-y-2">
            <p className="text-sm text-muted">{plan.code}</p>
            <input
              className="input"
              value={plan.name}
              onChange={(e) => {
                const next = [...plans];
                next[index] = { ...plan, name: e.target.value };
                setPlans(next);
              }}
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                className="input"
                type="number"
                step="0.01"
                value={plan.price_usd}
                onChange={(e) => {
                  const next = [...plans];
                  next[index] = { ...plan, price_usd: Number(e.target.value) };
                  setPlans(next);
                }}
              />
              <input
                className="input"
                type="number"
                value={plan.price_ngn}
                onChange={(e) => {
                  const next = [...plans];
                  next[index] = { ...plan, price_ngn: Number(e.target.value) };
                  setPlans(next);
                }}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={plan.is_active}
                onChange={(e) => {
                  const next = [...plans];
                  next[index] = { ...plan, is_active: e.target.checked };
                  setPlans(next);
                }}
              />
              Active
            </label>
            <button type="button" className="chip" onClick={() => void savePlan(plans[index])}>Save plan</button>
          </div>
        ))}
      </div>
    </div>
  );
}
