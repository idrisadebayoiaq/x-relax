'use client';

import { ActionButton } from '@/components/ActionButton';
import { createClient } from '@/lib/supabase/client';
import { appAlert } from '@/components/AppDialog';

export function ReportActions({ id }: { id: string }) {
  const resolve = async (status: string) => {
    const supabase = createClient();
    const { error } = await supabase.rpc('resolve_report', {
      p_id: id,
      p_status: status,
      p_admin_note: null,
    });
    if (error) appAlert(error.message);
  };

  return (
    <div className="flex gap-2 flex-wrap">
      <ActionButton label="Reviewing" onAction={() => resolve('reviewing')} />
      <ActionButton label="Resolve" primary onAction={() => resolve('resolved')} />
      <ActionButton label="Dismiss" onAction={() => resolve('dismissed')} />
    </div>
  );
}
