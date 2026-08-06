'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';

type AuditRow = {
  id: string;
  action: string;
  entity_type: string | null;
  created_at: string;
  meta: Record<string, unknown> | null;
};

export default function AdminAuditPage() {
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState<AuditRow[]>([]);

  useEffect(() => {
    if (!isAdmin) return;
    createClient()
      .from('audit_logs')
      .select('id, action, entity_type, created_at, meta')
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data }) => setRows((data as AuditRow[]) ?? []));
  }, [isAdmin]);

  if (!isAdmin) return null;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Audit log</h2>
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.id} className="card p-3 text-sm">
            <p className="font-semibold">{row.action}</p>
            <p className="text-muted">
              {row.entity_type ?? '—'} · {new Date(row.created_at).toLocaleString()}
            </p>
          </div>
        ))}
        {!rows.length ? <p className="text-muted">No audit entries yet.</p> : null}
      </div>
    </div>
  );
}
