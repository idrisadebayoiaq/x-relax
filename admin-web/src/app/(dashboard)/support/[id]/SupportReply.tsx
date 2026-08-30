'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

async function loadVerified(): Promise<boolean> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase.rpc('admin_has_verified_badge', { uid: user.id });
  return !!data;
}

export function SupportReply({ threadId }: { threadId: string }) {
  const [body, setBody] = useState('');
  const [verified, setVerified] = useState(true);
  const router = useRouter();

  useEffect(() => {
    void loadVerified().then(setVerified);
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!verified) {
      const ok = confirm(
        'Warning: your admin account is not blue-verified. The user will see a warning on this message. Continue?',
      );
      if (!ok) return;
    }
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || !body.trim()) return;
    await supabase.from('support_messages').insert({
      thread_id: threadId,
      sender_id: user.id,
      body: body.trim(),
      sender_verified: verified,
    });
    await supabase
      .from('support_threads')
      .update({ status: 'pending', updated_at: new Date().toISOString() })
      .eq('id', threadId);
    setBody('');
    router.refresh();
  };

  return (
    <div className="space-y-2">
      {!verified ? (
        <p className="text-sm text-amber-700">
          Unverified admin — users will see a warning on your replies.
        </p>
      ) : null}
      <form onSubmit={onSubmit} className="flex gap-2">
        <input
          className="flex-1 border border-border rounded-lg px-3 py-2 bg-background"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Reply…"
        />
        <button className="rounded-lg bg-accent text-on-accent px-4 py-2 font-semibold">
          Send
        </button>
      </form>
    </div>
  );
}
