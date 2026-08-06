'use client';

import { ActionButton } from '@/components/ActionButton';
import { createClient } from '@/lib/supabase/client';

export function CloseThreadButton({ id }: { id: string }) {
  return (
    <ActionButton
      label="Close thread"
      onAction={async () => {
        const supabase = createClient();
        await supabase.from('support_threads').update({ status: 'closed' }).eq('id', id);
        await supabase.rpc('log_admin_action', {
          p_action: 'close_support_thread',
          p_entity_type: 'support_thread',
          p_entity_id: id,
          p_meta: {},
        });
      }}
    />
  );
}
