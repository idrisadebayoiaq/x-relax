'use client';

import { ActionButton } from '@/components/ActionButton';
import { createClient } from '@/lib/supabase/client';
import { appAlert } from '@/components/AppDialog';

export function PaymentActions({ id }: { id: string }) {
  const review = async (status: string) => {
    const supabase = createClient();
    const { error } = await supabase.rpc('admin_review_payment', {
      p_payment_id: id,
      p_status: status,
      p_note: null,
    });
    if (error) appAlert(error.message);
    else {
      await supabase.rpc('log_admin_action', {
        p_action: 'review_payment',
        p_entity_type: 'payment_request',
        p_entity_id: id,
        p_meta: { status },
      });
    }
  };

  return (
    <div className="flex gap-2 flex-wrap">
      <ActionButton label="Approve" primary onAction={() => review('approved')} />
      <ActionButton label="Need info" onAction={() => review('need_more_info')} />
      <ActionButton label="Reject" onAction={() => review('rejected')} />
    </div>
  );
}
