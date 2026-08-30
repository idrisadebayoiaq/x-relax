'use client';

import { useEffect, useState } from 'react';
import { CoverArt } from '@/components/CoverArt';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import type { Sound } from '@/types/database';
import { appAlert } from '@/components/AppDialog';

export default function AdminModerationPage() {
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState<Sound[]>([]);

  const load = async () => {
    const { data } = await createClient()
      .from('sounds')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
    setRows((data as Sound[]) ?? []);
  };

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin]);

  const review = async (id: string, status: 'published' | 'rejected') => {
    const supabase = createClient();
    const { error } = await supabase.rpc('moderate_sound', {
      p_sound_id: id,
      p_status: status,
      p_reason: status === 'rejected' ? 'Did not meet quality or policy guidelines' : null,
    });
    if (error) appAlert(error.message);
    else {
      await supabase.rpc('log_admin_action', {
        p_action: 'moderate_sound',
        p_entity_type: 'sound',
        p_entity_id: id,
        p_meta: { status },
      });
      void load();
    }
  };

  if (!isAdmin) return null;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Sound moderation</h2>
      <div className="space-y-3">
        {rows.map((item) => (
          <div key={item.id} className="card p-4">
            <div className="flex gap-4 items-center">
              <CoverArt title={item.title} uri={item.cover_url} size={56} rounded={12} />
              <div className="flex-1">
                <p className="font-semibold">{item.title}</p>
                <p className="text-sm text-muted line-clamp-2">{item.description}</p>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button type="button" className="chip chip-active" onClick={() => void review(item.id, 'published')}>Publish</button>
              <button type="button" className="chip" onClick={() => void review(item.id, 'rejected')}>Reject</button>
            </div>
          </div>
        ))}
        {!rows.length ? <p className="text-muted">No pending sounds.</p> : null}
      </div>
    </div>
  );
}
