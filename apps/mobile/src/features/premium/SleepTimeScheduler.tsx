import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { supabase } from '../../lib/supabase';
import {
  formatDateKey,
  isScheduleDue,
  loadSleepTimeSchedule,
  saveSleepTimeSchedule,
} from '../../lib/sleepTime';
import { useAuth } from '../auth/AuthProvider';
import { usePlayer } from '../player/PlayerProvider';
import type { Sound } from '../../types/database';

const POLL_MS = 25_000;

let handlerReady = false;

function ensureNotificationHandler() {
  if (handlerReady) return;
  handlerReady = true;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch {
    /* ignore */
  }
}

async function showSleepNotification(title: string) {
  ensureNotificationHandler();
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('sleep-time', {
        name: 'Sleep Time',
        importance: Notifications.AndroidImportance.HIGH,
        description: 'Bedtime sound reminders',
      });
    }
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      const asked = await Notifications.requestPermissionsAsync();
      if (asked.status !== 'granted') return;
    }
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Sleep Time',
        body: title,
        sound: true,
        data: { type: 'sleep_time' },
        ...(Platform.OS === 'android' ? { channelId: 'sleep-time' } : {}),
      },
      trigger: null,
    });
  } catch (err) {
    console.warn('Sleep Time notification failed', err);
  }
}

export function SleepTimeScheduler() {
  const { user, hasUnlimitedListening, isPremium } = useAuth();
  const { playSound, setSleepTimerMinutes, toggleLoop, isLooping } = usePlayer();
  const firingRef = useRef(false);

  useEffect(() => {
    if (!user) return;

    const tick = async () => {
      if (firingRef.current) return;
      const schedule = await loadSleepTimeSchedule(user.id);
      if (!isScheduleDue(schedule)) return;

      firingRef.current = true;
      try {
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
        await saveSleepTimeSchedule(user.id, {
          ...schedule,
          lastTriggeredDate: today,
        });

        await showSleepNotification(`Starting ${queue[0].title}${queue.length > 1 ? ` + ${queue.length - 1} more` : ''}`);

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
            await toggleLoop();
          }
        }
      } catch (err) {
        console.warn('Sleep Time trigger failed', err);
      } finally {
        firingRef.current = false;
      }
    };

    void tick();
    const id = setInterval(() => void tick(), POLL_MS);
    return () => {
      clearInterval(id);
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
