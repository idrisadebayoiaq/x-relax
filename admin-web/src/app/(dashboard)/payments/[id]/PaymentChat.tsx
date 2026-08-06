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

export function PaymentChat({ paymentId }: { paymentId: string }) {
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [verified, setVerified] = useState(true);
  const router = useRouter();

  useEffect(() => {
    void loadVerified().then(setVerified);
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    if (!verified) {
      const ok = confirm(
        'Warning: your admin account is not blue-verified. The user will see a warning on this message. Continue?',
      );
      if (!ok) return;
    }
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
      sender_verified: verified,
    });
    setBody('');
    setBusy(false);
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
    </div>
  );
}
