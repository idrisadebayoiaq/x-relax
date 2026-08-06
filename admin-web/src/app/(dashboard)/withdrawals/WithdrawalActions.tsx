'use client';

import { ActionButton } from '@/components/ActionButton';
import { createClient } from '@/lib/supabase/client';

export function WithdrawalActions({ id, status }: { id: string; status: string }) {
  const review = async (next: 'approved' | 'rejected' | 'paid') => {
    const supabase = createClient();
    const { error } = await supabase.rpc('review_withdrawal', {
      p_id: id,
      p_status: next,
      p_admin_note: null,
    });
    if (error) alert(error.message);
    else {
      await supabase.rpc('log_admin_action', {
        p_action: 'review_withdrawal',
        p_entity_type: 'withdrawal_request',
        p_entity_id: id,
        p_meta: { status: next },
      });
    }
  };

  if (status === 'pending') {
    return (
      <div className="flex gap-2">
        <ActionButton label="Approve" primary onAction={() => review('approved')} />
        <ActionButton label="Reject" onAction={() => review('rejected')} />
      </div>
    );
  }

  return <ActionButton label="Mark paid" primary onAction={() => review('paid')} />;
}
