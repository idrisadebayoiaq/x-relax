import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export default async function SupportPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('support_threads')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(100);

  return (
    <div>
      <h1 className="text-3xl font-bold">Support</h1>
      <p className="text-muted mt-2 mb-6">User support threads and appeals</p>
      <div className="space-y-3">
        {(data ?? []).map((thread) => (
          <Link
            key={thread.id}
            href={`/support/${thread.id}`}
            className="block border border-border rounded-xl p-4 bg-surface hover:opacity-90"
          >
            <div className="font-semibold">{thread.subject}</div>
            <div className="text-sm text-muted mt-1">
              {thread.status} · {new Date(thread.updated_at).toLocaleString()}
            </div>
          </Link>
        ))}
        {!data?.length ? (
          <p className="text-muted">
            No support threads yet. Users can open threads from the mobile app in a later update;
            admins can still use this queue once threads exist.
          </p>
        ) : null}
      </div>
    </div>
  );
}
