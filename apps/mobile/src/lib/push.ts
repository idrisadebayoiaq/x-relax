import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { supabase } from './supabase';

let handlerReady = false;

const WELCOME_LOCAL_KEY = (id: string) => `xrelax:welcome_local_push:${id}`;
const PUSH_PREF_KEY = 'xrelax.push.enabled.v1';

function ensureNotificationHandler() {
  if (handlerReady) return;
  handlerReady = true;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch (err) {
    console.warn('Notification handler setup failed', err);
  }
}

function resolvePlatform(): 'android' | 'ios' | 'web' | 'unknown' {
  if (Platform.OS === 'android') return 'android';
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'web') return 'web';
  return 'unknown';
}

async function ensureChannels() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Default',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 180, 120, 180],
    lightColor: '#F5C400',
  });
  await Notifications.setNotificationChannelAsync('welcome', {
    name: 'Welcome',
    importance: Notifications.AndroidImportance.HIGH,
    description: 'Welcome messages after you join X-Relax',
    vibrationPattern: [0, 180, 120, 180],
    lightColor: '#F5C400',
  });
}

let askOnNextSync = false;

export function markPushAskOnNextSync() {
  askOnNextSync = true;
}

export function consumePushAsk() {
  const next = askOnNextSync;
  askOnNextSync = false;
  return next;
}

export async function readLocalPushPref(): Promise<boolean | null> {
  const raw = await AsyncStorage.getItem(PUSH_PREF_KEY);
  if (raw === '1') return true;
  if (raw === '0') return false;
  return null;
}

export async function writeLocalPushPref(enabled: boolean) {
  await AsyncStorage.setItem(PUSH_PREF_KEY, enabled ? '1' : '0');
}

export async function presentWelcomePushIfNeeded(): Promise<void> {
  ensureNotificationHandler();
  try {
    await ensureChannels();

    const { data: welcome } = await supabase
      .from('notifications')
      .select('id, title, body, data')
      .filter('data->>type', 'eq', 'welcome')
      .is('read_at', null)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!welcome?.id || !welcome.title) return;

    const key = WELCOME_LOCAL_KEY(welcome.id);
    const already = await AsyncStorage.getItem(key);
    if (already) return;

    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: welcome.title,
        body: welcome.body ?? 'Welcome to X-Relax — explore calming sounds anytime.',
        data: {
          type: 'welcome',
          notification_id: welcome.id,
          ...(typeof welcome.data === 'object' && welcome.data ? welcome.data : {}),
        },
        sound: true,
        ...(Platform.OS === 'android' ? { channelId: 'welcome' } : {}),
      },
      trigger: null,
    });

    await AsyncStorage.setItem(key, new Date().toISOString());
  } catch (err) {
    console.warn('Welcome local push failed', err);
  }
}

async function upsertCurrentToken(): Promise<{ token: string | null; error: string | null }> {
  const devicePush = await Notifications.getDevicePushTokenAsync();
  const token = devicePush.data;
  if (!token || typeof token !== 'string') {
    return { token: null, error: 'No device push token returned' };
  }
  const { error } = await supabase.rpc('upsert_push_token', {
    p_token: token,
    p_platform: resolvePlatform(),
  });
  if (error) return { token: null, error: error.message };
  return { token, error: null };
}

/**
 * Keep the FCM/APNs token fresh.
 * ask=false: never prompt again — only refresh if already granted and not turned off.
 * ask=true: request OS permission (signup / settings toggle on).
 */
export async function syncPushRegistration(opts?: {
  ask?: boolean;
  enabled?: boolean | null;
}): Promise<{ token: string | null; error: string | null; enabled: boolean }> {
  ensureNotificationHandler();
  const ask = opts?.ask === true;
  const localPref = opts?.enabled ?? (await readLocalPushPref());
  const enabled = localPref !== false;

  if (!enabled) {
    return { token: null, error: null, enabled: false };
  }

  if (!Device.isDevice) {
    return { token: null, error: 'Push requires a physical device', enabled };
  }

  try {
    await ensureChannels();
    const current = await Notifications.getPermissionsAsync();
    let status = current.status;

    if (status !== 'granted' && (ask || status === 'undetermined')) {
      const asked = await Notifications.requestPermissionsAsync();
      status = asked.status;
    }

    if (status !== 'granted') {
      return {
        token: null,
        error: ask ? 'Notification permission denied' : null,
        enabled,
      };
    }

    const saved = await upsertCurrentToken();
    await writeLocalPushPref(true);
    await presentWelcomePushIfNeeded();
    return { ...saved, enabled: true };
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : 'Push registration failed (use a custom/dev build, not Expo Go)';
    if (Constants.appOwnership === 'expo') {
      return {
        token: null,
        error: 'Push needs a development or preview build (not Expo Go)',
        enabled,
      };
    }
    return { token: null, error: message, enabled };
  }
}

/** @deprecated use syncPushRegistration — kept for older call sites */
export async function registerForPushNotifications() {
  return syncPushRegistration({ ask: true });
}

export async function setPushEnabled(enabled: boolean): Promise<{ error: string | null }> {
  await writeLocalPushPref(enabled);
  const { error } = await supabase.rpc('set_push_preference', { p_enabled: enabled });
  if (error) return { error: error.message };
  if (!enabled) return { error: null };
  const result = await syncPushRegistration({ ask: true, enabled: true });
  return { error: result.error };
}
