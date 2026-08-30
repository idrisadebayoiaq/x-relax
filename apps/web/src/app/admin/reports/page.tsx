'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { appAlert } from '@/components/AppDialog';

type Report = {
  id: string;
  reason: string | null;
  status: string;
  created_at: string;
  target_type: string | null;
};

export default function AdminReportsPage() {
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState<Report[]>([]);

  const load = async () => {
    const { data } = await createClient()
      .from('reports')
      .select('id, reason, status, created_at, target_type')
      .in('status', ['open', 'reviewing'])
      .order('created_at', { ascending: true });
    setRows((data as Report[]) ?? []);
  };

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin]);

  const resolve = async (id: string, status: string) => {
    const { error } = await createClient().rpc('resolve_report', {
      p_id: id,
      p_status: status,
      p_admin_note: null,
    });
    if (error) appAlert(error.message);
    else void load();
  };

  if (!isAdmin) return null;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Reports</h2>
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.id} className="card p-4 space-y-2">
            <p className="font-semibold">{row.target_type ?? 'Report'} · {row.status}</p>
            <p className="text-sm text-muted">{row.reason ?? 'No reason given'}</p>
            <div className="flex gap-2 flex-wrap">
              <button type="button" className="chip" onClick={() => void resolve(row.id, 'reviewing')}>Reviewing</button>
              <button type="button" className="chip chip-active" onClick={() => void resolve(row.id, 'resolved')}>Resolve</button>
              <button type="button" className="chip" onClick={() => void resolve(row.id, 'dismissed')}>Dismiss</button>
            </div>
          </div>
        ))}
        {!rows.length ? <p className="text-muted">No open reports.</p> : null}
      </div>
    </div>
  );
}
