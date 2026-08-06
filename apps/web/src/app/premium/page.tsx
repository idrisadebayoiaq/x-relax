'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { FREE_DAILY_SOUND_LIMIT } from '@/lib/daily-listen-limit';
import { useAuth } from '@/lib/auth-context';
import type { SubscriptionPlan } from '@/types/database';

export default function PremiumPage() {
  const { isPremium, isAdmin, hasPremiumAccess } = useAuth();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);

  useEffect(() => {
    createClient()
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }) => setPlans((data as SubscriptionPlan[]) ?? []));
  }, []);

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-serif font-bold">Premium</h1>
        <p className="text-muted mt-2">
          {isPremium
            ? 'You have Premium — unlimited calm, mixes, and offline downloads.'
            : 'Unlock unlimited listening, sleep timer, Mix Studio, and offline downloads.'}
        </p>
      </div>

      {!isPremium ? (
        <div className="card p-5 space-y-2">
          <p className="font-semibold">Free plan</p>
          <p className="text-sm text-muted whitespace-pre-line">{`· ${FREE_DAILY_SOUND_LIMIT} different sounds per day\n· Normal track length (no sleep timer)\n· Mix Studio locked\n· No offline downloads — internet required\n· Browse, search, and favourites`}</p>
        </div>
      ) : null}

      <div className="space-y-3">
        <h2 className="font-semibold">Plans</h2>
        {plans.map((plan) => (
          <Link key={plan.id} href={`/premium/checkout/${plan.id}`} className="card block p-4 hover:opacity-90">
            <p className="font-semibold">{plan.name}</p>
            <p className="text-sm text-muted">
              ${Number(plan.price_usd).toFixed(2)} · ₦{Number(plan.price_ngn).toLocaleString()}
              {plan.duration_days == null ? ' · Lifetime' : ` · ${plan.duration_days} days`}
            </p>
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href="/premium/payments" className="chip">My payment requests</Link>
        <Link href="/mix" className="chip">Mix Studio</Link>
        {isAdmin ? <Link href="/admin" className="chip">Admin dashboard</Link> : null}
      </div>

      {!hasPremiumAccess ? (
        <p className="text-sm text-muted">
          Creators get unlimited listening and uploads. Mix Studio and offline downloads are Premium or admin only.
        </p>
      ) : null}
    </div>
  );
}
