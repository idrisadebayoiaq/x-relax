'use client';

import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  formatDateKey,
  isScheduleDue,
  loadSleepTimeSchedule,
  saveSleepTimeSchedule,
} from '@/lib/sleep-time';
import { useAuth } from '@/lib/auth-context';
import { usePlayer } from '@/lib/player-context';
import type { Sound } from '@/types/database';

const POLL_MS = 25_000;

async function showSleepNotification(body: string) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  try {
    if (Notification.permission === 'default') {
      await Notification.requestPermission();
    }
    if (Notification.permission === 'granted') {
      new Notification('Sleep Time', { body, icon: '/favicon.ico' });
    }
  } catch (err) {
    console.warn('Sleep Time notification failed', err);
  }
}

export function SleepTimeWatcher() {
  const { user, hasUnlimitedListening, isPremium } = useAuth();
  const { playSound, setSleepTimerMinutes, toggleLoop, isLooping } = usePlayer();
  const firingRef = useRef(false);

  useEffect(() => {
    if (!user) return;

    const tick = async () => {
      if (firingRef.current) return;
      const schedule = loadSleepTimeSchedule(user.id);
      if (!isScheduleDue(schedule)) return;

      firingRef.current = true;
      try {
        const supabase = createClient();
        const { data: sounds } = await supabase
          .from('sounds')
          .select('*')
          .in('id', schedule.soundIds)
          .eq('status', 'published');

        const byId = new Map(((sounds as Sound[]) ?? []).map((s) => [s.id, s]));
        const queue = schedule.soundIds
          .map((id) => byId.get(id))
          .filter((s): s is Sound => !!s?.audio_url);

        if (!queue.length) {
          firingRef.current = false;
          return;
        }

        const today = formatDateKey();
        saveSleepTimeSchedule(user.id, {
          ...schedule,
          lastTriggeredDate: today,
        });

        await showSleepNotification(
          `Starting ${queue[0].title}${queue.length > 1 ? ` + ${queue.length - 1} more` : ''}`,
        );

        const started = await playSound(queue[0], {
          queue,
          queueIndex: 0,
          queueLabel: 'Sleep Time',
        });

        if (!started) {
          firingRef.current = false;
          return;
        }

        const premium = hasUnlimitedListening || isPremium;

        if (premium) {
          if (schedule.stopAfterMinutes != null) {
            setSleepTimerMinutes(schedule.stopAfterMinutes);
          } else if (schedule.loop && !isLooping) {
            toggleLoop();
          }
        }
      } catch (err) {
        console.warn('Sleep Time trigger failed', err);
      } finally {
        firingRef.current = false;
      }
    };

    void tick();
    const id = window.setInterval(() => void tick(), POLL_MS);
    return () => {
      window.clearInterval(id);
    };
  }, [
    user,
    hasUnlimitedListening,
    isPremium,
    playSound,
    setSleepTimerMinutes,
    toggleLoop,
    isLooping,
  ]);

  return null;
}
