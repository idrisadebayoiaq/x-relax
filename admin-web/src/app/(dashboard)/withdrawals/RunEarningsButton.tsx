'use client';

import { ActionButton } from '@/components/ActionButton';
import { createClient } from '@/lib/supabase/client';

export function RunEarningsButton() {
  return (
    <ActionButton
      label="Run monthly earnings"
      onAction={async () => {
        const supabase = createClient();
        const now = new Date();
        const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
        const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
        const { error } = await supabase.rpc('calculate_creator_earnings', {
          p_period_start: start.toISOString().slice(0, 10),
          p_period_end: end.toISOString().slice(0, 10),
        });
        if (error) alert(error.message);
        else {
          await supabase.rpc('log_admin_action', {
            p_action: 'calculate_earnings',
            p_entity_type: 'creator_earnings',
            p_meta: {
              period_start: start.toISOString().slice(0, 10),
              period_end: end.toISOString().slice(0, 10),
            },
          });
          alert('Earnings calculated for previous month.');
        }
      }}
    />
  );
}
