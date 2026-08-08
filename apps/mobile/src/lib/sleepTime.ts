import AsyncStorage from '@react-native-async-storage/async-storage';

export type SleepTimeSchedule = {
  enabled: boolean;
  hour: number;
  minute: number;
  soundIds: string[];
  loop: boolean;
  /** null = off */
  stopAfterMinutes: number | null;
  /** YYYY-MM-DD — prevents double trigger on the same local day */
  lastTriggeredDate: string | null;
};

export const STOP_AFTER_OPTIONS = [15, 30, 45, 60, 90] as const;

export const DEFAULT_SLEEP_TIME_SCHEDULE: SleepTimeSchedule = {
  enabled: false,
  hour: 22,
  minute: 0,
  soundIds: [],
  loop: false,
  stopAfterMinutes: null,
  lastTriggeredDate: null,
};

function storageKey(userId: string) {
  return `xrelax_sleep_time_${userId}`;
}

export function formatDateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatTimeLabel(hour: number, minute: number) {
  const h12 = hour % 12 || 12;
  const ampm = hour < 12 ? 'AM' : 'PM';
  return `${h12}:${String(minute).padStart(2, '0')} ${ampm}`;
}

/** Next local Date when hour:minute will occur (today if still ahead, else tomorrow). */
export function nextTriggerDate(hour: number, minute: number, from = new Date()) {
  const next = new Date(from);
  next.setSeconds(0, 0);
  next.setHours(hour, minute, 0, 0);
  if (next <= from) {
    next.setDate(next.getDate() + 1);
  }
  return next;
}

export function isScheduleDue(schedule: SleepTimeSchedule, now = new Date()) {
  if (!schedule.enabled || schedule.soundIds.length === 0) return false;
  const today = formatDateKey(now);
  if (schedule.lastTriggeredDate === today) return false;
  const trigger = new Date(now);
  trigger.setSeconds(0, 0);
  trigger.setHours(schedule.hour, schedule.minute, 0, 0);
  return now >= trigger;
}

export async function loadSleepTimeSchedule(userId: string): Promise<SleepTimeSchedule> {
  const raw = await AsyncStorage.getItem(storageKey(userId));
  if (!raw) return { ...DEFAULT_SLEEP_TIME_SCHEDULE };
  try {
    const parsed = JSON.parse(raw) as Partial<SleepTimeSchedule>;
    return {
      ...DEFAULT_SLEEP_TIME_SCHEDULE,
      ...parsed,
      hour: clampHour(parsed.hour ?? DEFAULT_SLEEP_TIME_SCHEDULE.hour),
      minute: clampMinute(parsed.minute ?? DEFAULT_SLEEP_TIME_SCHEDULE.minute),
      soundIds: Array.isArray(parsed.soundIds) ? parsed.soundIds.map(String) : [],
    };
  } catch {
    return { ...DEFAULT_SLEEP_TIME_SCHEDULE };
  }
}

export async function saveSleepTimeSchedule(userId: string, schedule: SleepTimeSchedule) {
  await AsyncStorage.setItem(storageKey(userId), JSON.stringify(schedule));
}

function clampHour(h: number) {
  return Math.min(23, Math.max(0, Math.floor(h)));
}

function clampMinute(m: number) {
  return Math.min(59, Math.max(0, Math.floor(m)));
}
