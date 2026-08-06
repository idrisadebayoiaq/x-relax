'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export function PaymentChat({ paymentId }: { paymentId: string }) {
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('payment_messages').insert({
      payment_request_id: paymentId,
      sender_id: user.id,
      body: body.trim(),
    });
    setBody('');
    setBusy(false);
    router.refresh();
  };

  return (
    <form onSubmit={onSubmit} className="flex gap-2">
      <input
        className="flex-1 border border-border rounded-lg px-3 py-2 bg-background"
        placeholder="Reply to user…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <button
        disabled={busy}
        className="rounded-lg bg-foreground text-background px-4 py-2 font-semibold disabled:opacity-50"
      >
        Send
      </button>
    </form>
  );
}
