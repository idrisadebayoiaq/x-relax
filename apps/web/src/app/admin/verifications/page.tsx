'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';

type Row = {
  user_id: string;
  status: string;
  submitted_at: string;
  profile?: { display_name: string | null };
};

export default function AdminVerificationsPage() {
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);

  const load = async () => {
    const { data } = await createClient()
      .from('creator_verifications')
      .select('user_id, status, submitted_at, profile:profiles(display_name)')
      .eq('status', 'pending')
      .order('submitted_at', { ascending: true });
    const normalized = ((data ?? []) as unknown as Row[]).map((row) => ({
      ...row,
      profile: Array.isArray(row.profile) ? row.profile[0] : row.profile,
    }));
    setRows(normalized);
  };

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin]);

  const review = async (userId: string, status: 'approved' | 'rejected') => {
    const { error } = await createClient()
      .from('creator_verifications')
      .update({ status, reviewed_at: new Date().toISOString() })
      .eq('user_id', userId);
    if (error) alert(error.message);
    else void load();
  };

  if (!isAdmin) return <p className="text-muted">Admin only.</p>;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-3xl font-serif font-bold">Verification queue</h1>
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.user_id} className="card p-4 flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold">{row.profile?.display_name ?? row.user_id}</p>
              <p className="text-sm text-muted">{new Date(row.submitted_at).toLocaleDateString()}</p>
            </div>
            <div className="flex gap-2">
              <button type="button" className="chip chip-active" onClick={() => void review(row.user_id, 'approved')}>Approve</button>
              <button type="button" className="chip" onClick={() => void review(row.user_id, 'rejected')}>Reject</button>
            </div>
          </div>
        ))}
        {!rows.length ? <p className="text-muted">Queue empty.</p> : null}
      </div>
    </div>
  );
}
