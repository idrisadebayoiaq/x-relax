'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import {
  readLocalPushPref,
  requestWebPushPermission,
  showWebNotification,
} from '@/lib/web-push';

export function WebNotificationListener() {
  const { user, profile } = useAuth();

  useEffect(() => {
    if (!user) return;
    const enabled = profile?.push_enabled !== false && readLocalPushPref();
    if (!enabled) return;

    void requestWebPushPermission();

    const supabase = createClient();
    const channel = supabase
      .channel(`web-push-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as { title?: string; body?: string | null };
          if (row?.title) showWebNotification(row.title, row.body);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, profile?.push_enabled]);

  return null;
}
