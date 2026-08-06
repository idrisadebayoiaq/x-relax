'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';

type NotificationRow = {
  id: string;
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
};

export default function NotificationsPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<NotificationRow[]>([]);

  const load = async () => {
    if (!user) return;
    const { data } = await createClient()
      .from('notifications')
      .select('id, title, body, data, read_at, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    setRows((data as NotificationRow[]) ?? []);
  };

  useEffect(() => {
    void load();
  }, [user?.id]);

  const markRead = async (id: string) => {
    await createClient()
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id);
    void load();
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-3xl font-serif font-bold">Notifications</h1>
      <div className="space-y-3">
        {rows.map((row) => {
          const fromUnverified =
            row.data?.from_unverified_admin === true || row.data?.admin_verified === false;
          return (
            <button
              key={row.id}
              type="button"
              className={`card w-full text-left p-4 ${row.read_at ? 'opacity-70' : ''}`}
              onClick={() => void markRead(row.id)}
            >
              {fromUnverified ? (
                <p className="text-xs text-amber-700 dark:text-amber-300 mb-1">
                  ⚠ From an unverified admin
                </p>
              ) : null}
              <p className="font-semibold">{row.title}</p>
              {row.body ? <p className="text-sm text-muted mt-1">{row.body}</p> : null}
              <p className="text-xs text-muted mt-2">{new Date(row.created_at).toLocaleString()}</p>
            </button>
          );
        })}
        {!rows.length ? <p className="text-muted">No notifications yet.</p> : null}
      </div>
    </div>
  );
}
