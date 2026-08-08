'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';

type WelcomeRow = {
  id: string;
  title: string;
  body: string | null;
};

/** Shows once for unread welcome notifications after signup. */
export function WelcomeBanner() {
  const { user } = useAuth();
  const [welcome, setWelcome] = useState<WelcomeRow | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      setWelcome(null);
      return;
    }
    const { data } = await createClient()
      .from('notifications')
      .select('id, title, body')
      .eq('user_id', user.id)
      .filter('data->>type', 'eq', 'welcome')
      .is('read_at', null)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    setWelcome((data as WelcomeRow) ?? null);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const dismiss = async () => {
    if (!welcome) return;
    await createClient()
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', welcome.id);
    setWelcome(null);
  };

  if (!welcome) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
      <div className="card max-w-md w-full p-6 text-center space-y-4">
        <p className="text-xs uppercase tracking-widest text-muted">X-Relax</p>
        <h2 className="text-2xl font-serif font-bold">{welcome.title}</h2>
        {welcome.body ? <p className="text-muted">{welcome.body}</p> : null}
        <div className="text-left rounded-2xl border border-border p-4 space-y-1 text-sm">
          <p className="font-semibold mb-1">Premium benefits</p>
          <p className="text-muted">• Unlimited listening every day</p>
          <p className="text-muted">• Loop, Sleep Time, and sleep timer</p>
          <p className="text-muted">• Offline downloads and Mix Studio</p>
          <p className="text-muted">• Ad-free calm experience</p>
        </div>
        <div className="flex flex-col gap-2">
          <Link href="/premium" className="btn btn-primary w-full" onClick={() => void dismiss()}>
            Explore Premium
          </Link>
          <button type="button" className="btn btn-outline w-full" onClick={() => void dismiss()}>
            Get started
          </button>
        </div>
      </div>
    </div>
  );
}
