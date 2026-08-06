'use client';

import { FormEvent, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';

const AUDIENCES = [
  { value: 'all', label: 'Everyone' },
  { value: 'listeners', label: 'Listeners' },
  { value: 'creators', label: 'Creators' },
  { value: 'admins', label: 'Admins' },
] as const;

export default function AdminAnnouncementsPage() {
  const { isAdmin, adminProfile } = useAuth();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<(typeof AUDIENCES)[number]['value']>('all');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isVerifiedAdmin =
    !!adminProfile?.has_verified_badge || adminProfile?.role === 'super';

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isVerifiedAdmin) {
      const ok = confirm(
        'Warning: your admin account is not blue-verified. Recipients will see a warning that this announcement is from an unverified admin. Continue?',
      );
      if (!ok) return;
    }
    setBusy(true);
    setMessage(null);
    const { data, error } = await createClient().rpc('admin_broadcast_announcement', {
      p_title: title.trim(),
      p_body: body.trim(),
      p_audience: audience,
      p_data: { type: 'announcement' },
    });
    setBusy(false);
    if (error) setMessage(error.message);
    else {
      setMessage(`Sent in-app + push queued for ${data ?? 0} users.`);
      setTitle('');
      setBody('');
    }
  };

  if (!isAdmin) return null;

  return (
    <div className="space-y-6 max-w-xl">
      <h2 className="text-xl font-semibold">Announcements</h2>
      {!isVerifiedAdmin ? (
        <div className="card p-4 border-amber-500/40 bg-amber-500/5 space-y-1">
          <p className="font-semibold text-amber-800 dark:text-amber-200">Unverified admin</p>
          <p className="text-sm text-muted">
            Ask a super admin to grant your blue verified badge. Until then, announcements show a
            warning to users.
          </p>
        </div>
      ) : null}
      <form onSubmit={onSubmit} className="card p-4 space-y-4">
        <select
          className="input"
          value={audience}
          onChange={(e) => setAudience(e.target.value as typeof audience)}
        >
          {AUDIENCES.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>
        <input
          className="input"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
        />
        <textarea
          className="input min-h-[100px]"
          required
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Message"
        />
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Sending…' : 'Send announcement'}
        </button>
        {message ? <p className="text-sm text-muted">{message}</p> : null}
      </form>
    </div>
  );
}
