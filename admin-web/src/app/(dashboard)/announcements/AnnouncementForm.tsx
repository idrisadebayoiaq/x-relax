'use client';

import { useEffect, useState, useTransition } from 'react';
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
  const [verified, setVerified] = useState(true);
  const [pending, start] = useTransition();

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.rpc('admin_has_verified_badge', { uid: user.id });
      setVerified(!!data);
    })();
  }, []);

  return (
    <form
      className="space-y-4 max-w-xl"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          if (!verified) {
            const ok = confirm(
              'Warning: your admin account is not blue-verified. Recipients will see a warning. Continue?',
            );
            if (!ok) return;
          }
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
      {!verified ? (
        <div className="border border-amber-500/40 bg-amber-500/5 rounded-xl p-3 text-sm">
          Unverified admin — announcements will show a warning to users until a super admin grants
          your blue badge.
        </div>
      ) : null}
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
    </form>
  );
}
