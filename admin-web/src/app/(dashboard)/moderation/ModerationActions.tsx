'use client';

import { ActionButton } from '@/components/ActionButton';
import { createClient } from '@/lib/supabase/client';

export function ModerationActions({ id }: { id: string }) {
  const review = async (status: 'published' | 'rejected') => {
    const supabase = createClient();
    const { error } = await supabase.rpc('moderate_sound', {
      p_sound_id: id,
      p_status: status,
      p_reason: status === 'rejected' ? 'Did not meet quality or policy guidelines' : null,
    });
    if (error) alert(error.message);
    else {
      await supabase.rpc('log_admin_action', {
        p_action: 'moderate_sound',
        p_entity_type: 'sound',
        p_entity_id: id,
        p_meta: { status },
      });
    }
  };

  return (
    <div className="flex gap-2">
      <ActionButton label="Publish" primary onAction={() => review('published')} />
      <ActionButton label="Reject" onAction={() => review('rejected')} />
    </div>
  );
}
