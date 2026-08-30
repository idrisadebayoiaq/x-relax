'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { appConfirm } from '@/components/AppDialog';

type Message = {
  id: string;
  body: string;
  created_at: string;
  sender_id: string;
  sender_verified?: boolean | null;
};
type Thread = { id: string; subject: string | null; status: string };

export default function AdminSupportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { isAdmin, user, adminProfile } = useAuth();
  const [thread, setThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState('');
  const isVerifiedAdmin =
    !!adminProfile?.has_verified_badge || adminProfile?.role === 'super';

  const load = async () => {
    const supabase = createClient();
    const { data: t } = await supabase
      .from('support_threads')
      .select('id, subject, status')
      .eq('id', id)
      .maybeSingle();
    setThread(t as Thread | null);
    const { data: msgs } = await supabase
      .from('support_messages')
      .select('id, body, created_at, sender_id, sender_verified')
      .eq('thread_id', id)
      .order('created_at', { ascending: true });
    setMessages((msgs as Message[]) ?? []);
  };

  useEffect(() => {
    if (isAdmin && id) void load();
  }, [isAdmin, id]);

  const sendReply = async () => {
    if (!user || !reply.trim()) return;
    if (!isVerifiedAdmin) {
      const ok = await appConfirm(
        'Warning: your admin account is not blue-verified. The user will see a warning on this message. Continue?',
      );
      if (!ok) return;
    }
    const supabase = createClient();
    await supabase.from('support_messages').insert({
      thread_id: id,
      sender_id: user.id,
      body: reply.trim(),
      sender_verified: isVerifiedAdmin,
    });
    await supabase
      .from('support_threads')
      .update({ status: 'pending', updated_at: new Date().toISOString() })
      .eq('id', id);
    setReply('');
    void load();
  };

  const closeThread = async () => {
    await createClient()
      .from('support_threads')
      .update({ status: 'closed', updated_at: new Date().toISOString() })
      .eq('id', id);
    void load();
  };

  if (!isAdmin) return null;
  if (!thread) return <p className="text-muted">Loading…</p>;

  return (
    <div className="space-y-6 max-w-2xl">
      <Link href="/admin/support" className="text-sm text-muted underline">← Support</Link>
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{thread.subject ?? 'Support thread'}</h2>
          <p className="text-sm text-muted">{thread.status}</p>
        </div>
        {thread.status !== 'closed' ? (
          <button type="button" className="chip" onClick={() => void closeThread()}>Close</button>
        ) : null}
      </div>
      {!isVerifiedAdmin ? (
        <div className="card p-4 border-amber-500/40 bg-amber-500/5 space-y-1">
          <p className="font-semibold text-amber-800 dark:text-amber-200">Unverified admin</p>
          <p className="text-sm text-muted">
            Users will see a warning that your reply is from an unverified admin until a super admin
            grants your blue badge.
          </p>
        </div>
      ) : null}
      <div className="space-y-3">
        {messages.map((m) => (
          <div key={m.id} className="card p-3 text-sm space-y-1">
            {m.sender_verified === false ? (
              <p className="text-xs text-amber-700 dark:text-amber-300">
                ⚠ Sent by an unverified admin
              </p>
            ) : null}
            <p>{m.body}</p>
            <p className="text-xs text-muted mt-1">{new Date(m.created_at).toLocaleString()}</p>
          </div>
        ))}
      </div>
      {thread.status !== 'closed' ? (
        <div className="flex gap-2">
          <input className="input flex-1" value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply…" />
          <button type="button" className="btn btn-primary" onClick={() => void sendReply()}>Send</button>
        </div>
      ) : null}
    </div>
  );
}
