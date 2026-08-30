'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { appAlert } from '@/components/AppDialog';

type Row = {
  id: string;
  user_id: string;
  status: string;
  document_type?: string | null;
  created_at: string;
  profile?: { display_name: string | null };
};

export default function AdminVerificationsPage() {
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);

  const load = async () => {
    const { data } = await createClient()
      .from('creator_verifications')
      .select('id, user_id, status, document_type, document_path, created_at, profile:profiles(display_name)')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
    const normalized = ((data ?? []) as unknown as Row[]).map((row) => ({
      ...row,
      profile: Array.isArray(row.profile) ? row.profile[0] : row.profile,
    }));
    setRows(normalized);
  };

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin]);

  const review = async (id: string, status: 'approved' | 'rejected') => {
    const { error } = await createClient().rpc('review_creator_verification', {
      p_id: id,
      p_status: status,
      p_admin_note: status === 'approved' ? 'Earning approved' : 'Earning application rejected',
    });
    if (error) appAlert(error.message);
    else void load();
  };

  if (!isAdmin) return null;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Earning applications</h2>
      <p className="text-sm text-muted">Identity verification for creators applying to earn.</p>
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.id} className="card p-4 flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold">{row.profile?.display_name ?? row.user_id}</p>
              <p className="text-sm text-muted">
                {row.document_type ? `${row.document_type.replaceAll('_', ' ')} · ` : ''}
                {new Date(row.created_at).toLocaleDateString()}
              </p>
            </div>
            <div className="flex gap-2">
              <button type="button" className="chip chip-active" onClick={() => void review(row.id, 'approved')}>Approve</button>
              <button type="button" className="chip" onClick={() => void review(row.id, 'rejected')}>Reject</button>
            </div>
          </div>
        ))}
        {!rows.length ? <p className="text-muted">Queue empty.</p> : null}
      </div>
    </div>
  );
}
