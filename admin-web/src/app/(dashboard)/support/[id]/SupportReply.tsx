'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export function SupportReply({ threadId }: { threadId: string }) {
  const [body, setBody] = useState('');
  const router = useRouter();

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || !body.trim()) return;
    await supabase.from('support_messages').insert({
      thread_id: threadId,
      sender_id: user.id,
      body: body.trim(),
    });
    await supabase
      .from('support_threads')
      .update({ status: 'pending', updated_at: new Date().toISOString() })
      .eq('id', threadId);
    setBody('');
    router.refresh();
  };

  return (
    <form onSubmit={onSubmit} className="flex gap-2">
      <input
        className="flex-1 border border-border rounded-lg px-3 py-2 bg-background"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Reply…"
      />
      <button className="rounded-lg bg-foreground text-background px-4 py-2 font-semibold">
        Send
      </button>
    </form>
  );
}
