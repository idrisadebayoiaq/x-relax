import { createClient } from '@/lib/supabase/server';
import { SupportReply } from './SupportReply';
import { CloseThreadButton } from './CloseThreadButton';

export default async function SupportThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: thread } = await supabase
    .from('support_threads')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  const { data: messages } = await supabase
    .from('support_messages')
    .select('*')
    .eq('thread_id', id)
    .order('created_at', { ascending: true });

  if (!thread) return <p>Thread not found.</p>;

  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-bold">{thread.subject}</h1>
      <p className="text-muted mt-2 mb-4">Status: {thread.status}</p>
      {thread.status !== 'closed' ? <CloseThreadButton id={id} /> : null}
      <div className="space-y-2 my-6">
        {(messages ?? []).map((m) => (
          <div key={m.id} className="border border-border rounded-lg p-3 text-sm">
            <div className="text-xs text-muted mb-1">
              {new Date(m.created_at).toLocaleString()}
            </div>
            {m.body}
          </div>
        ))}
      </div>
      {thread.status !== 'closed' ? <SupportReply threadId={id} /> : null}
    </div>
  );
}
