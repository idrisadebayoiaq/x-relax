import { createClient } from '@/lib/supabase/client';

const PREF_KEY = 'xrelax.push.enabled.v1';

export function readLocalPushPref(): boolean {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem(PREF_KEY) !== '0';
}

export function writeLocalPushPref(enabled: boolean) {
  localStorage.setItem(PREF_KEY, enabled ? '1' : '0');
}

export async function requestWebPushPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const status = await Notification.requestPermission();
  return status === 'granted';
}

export async function setWebPushEnabled(enabled: boolean): Promise<{ error: string | null }> {
  writeLocalPushPref(enabled);
  const { error } = await createClient().rpc('set_push_preference', { p_enabled: enabled });
  if (error) return { error: error.message };
  if (enabled) {
    const granted = await requestWebPushPermission();
    if (!granted) return { error: 'Notification permission denied in this browser' };
  }
  return { error: null };
}

export function showWebNotification(title: string, body?: string | null) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  if (!readLocalPushPref()) return;
  try {
    new Notification(title, {
      body: body ?? undefined,
      icon: '/favicon.ico',
    });
  } catch {
    /* ignore */
  }
}
