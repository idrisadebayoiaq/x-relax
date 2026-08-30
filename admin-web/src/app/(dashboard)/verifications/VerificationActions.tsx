'use client';

import { ActionButton } from '@/components/ActionButton';
import { createClient } from '@/lib/supabase/client';
import { appAlert } from '@/components/AppDialog';

export function VerificationActions({ id }: { id: string }) {
  const review = async (status: 'approved' | 'rejected') => {
    const supabase = createClient();
    const { error } = await supabase.rpc('review_creator_verification', {
      p_id: id,
      p_status: status,
      p_admin_note: status === 'approved' ? 'Verified' : 'Requirements not met',
    });
    if (error) appAlert(error.message);
    else {
      await supabase.rpc('log_admin_action', {
        p_action: 'review_verification',
        p_entity_type: 'creator_verification',
        p_entity_id: id,
        p_meta: { status },
      });
    }
  };

  return (
    <div className="flex gap-2">
      <ActionButton label="Approve" primary onAction={() => review('approved')} />
      <ActionButton label="Reject" onAction={() => review('rejected')} />
    </div>
  );
}
