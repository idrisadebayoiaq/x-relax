import { createClient } from '@/lib/supabase/server';
import { VerificationActions } from './VerificationActions';

export default async function VerificationsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('creator_verifications')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  return (
    <div>
      <h1 className="text-3xl font-bold">Verifications</h1>
      <p className="text-muted mt-2 mb-6">Creator identity / level reviews</p>
      <div className="space-y-3">
        {(data ?? []).map((row) => (
          <div key={row.id} className="border border-border rounded-xl p-4 bg-surface">
            <div className="font-semibold">User {row.user_id.slice(0, 8)}…</div>
            <div className="text-sm text-muted mt-1">{row.note ?? 'No note'}</div>
            <div className="mt-3">
              <VerificationActions id={row.id} />
            </div>
          </div>
        ))}
        {!data?.length ? <p className="text-muted">No pending verifications.</p> : null}
      </div>
    </div>
  );
}
