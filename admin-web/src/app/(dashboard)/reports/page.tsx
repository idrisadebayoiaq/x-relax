import { createClient } from '@/lib/supabase/server';
import { ReportActions } from './ReportActions';

export default async function ReportsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('reports')
    .select('*')
    .in('status', ['open', 'reviewing'])
    .order('created_at', { ascending: true });

  return (
    <div>
      <h1 className="text-3xl font-bold">Reports</h1>
      <p className="text-muted mt-2 mb-6">User-submitted content / safety reports</p>
      <div className="space-y-3">
        {(data ?? []).map((row) => (
          <div key={row.id} className="border border-border rounded-xl p-4 bg-surface">
            <div className="font-semibold">
              {row.target_type} · {row.reason}
            </div>
            <div className="text-sm text-muted mt-1">{row.details ?? 'No details'}</div>
            <div className="mt-3">
              <ReportActions id={row.id} />
            </div>
          </div>
        ))}
        {!data?.length ? <p className="text-muted">No open reports.</p> : null}
      </div>
    </div>
  );
}
