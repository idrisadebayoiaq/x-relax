'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { appAlert } from '@/components/AppDialog';

type Plan = {
  id: string;
  name: string;
  code: string;
  price_usd: number;
  price_ngn: number;
  duration_days: number | null;
  is_active: boolean;
};

export function PlansEditor({ plans }: { plans: Plan[] }) {
  const [rows, setRows] = useState(plans);
  const router = useRouter();

  const save = async (plan: Plan) => {
    const supabase = createClient();
    const { error } = await supabase
      .from('subscription_plans')
      .update({
        name: plan.name,
        price_usd: plan.price_usd,
        price_ngn: plan.price_ngn,
        is_active: plan.is_active,
      })
      .eq('id', plan.id);
    if (error) appAlert(error.message);
    else {
      await supabase.rpc('log_admin_action', {
        p_action: 'update_plan',
        p_entity_type: 'subscription_plan',
        p_entity_id: plan.id,
        p_meta: { name: plan.name },
      });
      router.refresh();
      appAlert('Plan saved');
    }
  };

  return (
    <div className="space-y-3">
      {rows.map((plan, index) => (
        <div key={plan.id} className="border border-border rounded-xl p-4 bg-surface space-y-2">
          <div className="text-sm text-muted">{plan.code}</div>
          <input
            className="w-full border border-border rounded-lg px-3 py-2 bg-background"
            value={plan.name}
            onChange={(e) => {
              const next = [...rows];
              next[index] = { ...plan, name: e.target.value };
              setRows(next);
            }}
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              step="0.01"
              className="border border-border rounded-lg px-3 py-2 bg-background"
              value={plan.price_usd}
              onChange={(e) => {
                const next = [...rows];
                next[index] = { ...plan, price_usd: Number(e.target.value) };
                setRows(next);
              }}
            />
            <input
              type="number"
              step="1"
              className="border border-border rounded-lg px-3 py-2 bg-background"
              value={plan.price_ngn}
              onChange={(e) => {
                const next = [...rows];
                next[index] = { ...plan, price_ngn: Number(e.target.value) };
                setRows(next);
              }}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={plan.is_active}
              onChange={(e) => {
                const next = [...rows];
                next[index] = { ...plan, is_active: e.target.checked };
                setRows(next);
              }}
            />
            Active
          </label>
          <button
            className="rounded-lg border border-border px-3 py-1.5 text-sm"
            onClick={() => save(rows[index])}
          >
            Save plan
          </button>
        </div>
      ))}
    </div>
  );
}
