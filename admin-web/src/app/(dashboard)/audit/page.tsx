import { createClient } from '@/lib/supabase/server';

export default async function AuditPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  return (
    <div>
      <h1 className="text-3xl font-bold">Audit log</h1>
      <p className="text-muted mt-2 mb-6">Admin actions trail</p>
      <div className="space-y-2">
        {(data ?? []).map((row) => (
          <div key={row.id} className="border border-border rounded-lg p-3 text-sm bg-surface">
            <div className="font-medium">{row.action}</div>
            <div className="text-muted mt-1">
              {row.entity_type ?? '—'} {row.entity_id ? `· ${String(row.entity_id).slice(0, 8)}…` : ''} ·{' '}
              {new Date(row.created_at).toLocaleString()}
            </div>
          </div>
        ))}
        {!data?.length ? <p className="text-muted">No audit events yet.</p> : null}
      </div>
    </div>
  );
}
