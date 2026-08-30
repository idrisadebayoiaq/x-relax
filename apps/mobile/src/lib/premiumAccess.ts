import { supabase } from './supabase';

export type PremiumAccess = {
  isPremium: boolean;
  isLifetime: boolean;
  canPurchase: boolean;
  endsAt: string | null;
  planName: string | null;
  planCode: string | null;
  pendingPayment: boolean;
  reason: 'lifetime' | 'active' | 'pending_payment' | 'none';
};

const EMPTY: PremiumAccess = {
  isPremium: false,
  isLifetime: false,
  canPurchase: true,
  endsAt: null,
  planName: null,
  planCode: null,
  pendingPayment: false,
  reason: 'none',
};

export function parsePremiumAccess(raw: unknown): PremiumAccess {
  const row = (raw ?? {}) as Record<string, unknown>;
  const reason = row.reason;
  return {
    isPremium: Boolean(row.is_premium),
    isLifetime: Boolean(row.is_lifetime),
    canPurchase: Boolean(row.can_purchase),
    endsAt: typeof row.ends_at === 'string' ? row.ends_at : null,
    planName: typeof row.plan_name === 'string' ? row.plan_name : null,
    planCode: typeof row.plan_code === 'string' ? row.plan_code : null,
    pendingPayment: Boolean(row.pending_payment),
    reason:
      reason === 'lifetime' || reason === 'active' || reason === 'pending_payment'
        ? reason
        : 'none',
  };
}

export async function fetchPremiumAccess(uid?: string | null): Promise<PremiumAccess> {
  const { data, error } = uid
    ? await supabase.rpc('user_premium_access', { uid })
    : await supabase.rpc('user_premium_access');
  if (error || !data) return EMPTY;
  return parsePremiumAccess(data);
}

export function formatPremiumCoverage(access: PremiumAccess): string {
  if (access.isLifetime) return 'Lifetime Premium · you never need to pay again.';
  if (access.isPremium && access.endsAt) {
    const when = new Date(access.endsAt).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    return `${access.planName ?? 'Premium'} is active until ${when}. Plans open again when it is due.`;
  }
  if (access.isPremium) return `${access.planName ?? 'Premium'} is active.`;
  if (access.pendingPayment) {
    return 'You already have a Premium payment waiting for admin approval.';
  }
  return 'Choose a plan to unlock Premium.';
}
