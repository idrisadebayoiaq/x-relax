'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const AUDIENCES = [
  { value: 'all', label: 'Everyone' },
  { value: 'listeners', label: 'Listeners' },
  { value: 'creators', label: 'Creators' },
  { value: 'admins', label: 'Admins' },
] as const;

export function AnnouncementForm() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<(typeof AUDIENCES)[number]['value']>('all');
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="space-y-4 max-w-xl"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          setMessage(null);
          const supabase = createClient();
          const { data, error } = await supabase.rpc('admin_broadcast_announcement', {
            p_title: title.trim(),
            p_body: body.trim(),
            p_audience: audience,
            p_data: { type: 'announcement' },
          });
          if (error) {
            setMessage(error.message);
            return;
          }
          setMessage(`Sent in-app + push queued for ${data ?? 0} users.`);
          setTitle('');
          setBody('');
          router.refresh();
        });
      }}
    >
      <div>
        <label className="block text-sm text-muted mb-1">Audience</label>
        <select
          className="w-full border border-border bg-background rounded-lg px-3 py-2"
          value={audience}
          onChange={(e) => setAudience(e.target.value as typeof audience)}
        >
          {AUDIENCES.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm text-muted mb-1">Title</label>
        <input
          required
          className="w-full border border-border bg-background rounded-lg px-3 py-2"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Announcement title"
        />
      </div>
      <div>
        <label className="block text-sm text-muted mb-1">Body</label>
        <textarea
          required
          rows={4}
          className="w-full border border-border bg-background rounded-lg px-3 py-2"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Message shown in-app and on the lock screen"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-foreground text-background px-4 py-2 text-sm font-semibold disabled:opacity-50"
      >
        {pending ? 'Sending…' : 'Send announcement'}
      </button>
      {message ? <p className="text-sm text-muted">{message}</p> : null}
      <p className="text-xs text-muted">
        Creates in-app notifications; FCM is dispatched automatically when devices have registered
        tokens (dev/preview build required — not Expo Go).
      </p>
    </form>
  );
}
