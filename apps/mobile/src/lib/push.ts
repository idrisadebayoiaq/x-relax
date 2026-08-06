import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { supabase } from './supabase';

let handlerReady = false;

const WELCOME_LOCAL_KEY = (id: string) => `xrelax:welcome_local_push:${id}`;

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
    importance: Notifications.AndroidImportance.DEFAULT,
  });
  await Notifications.setNotificationChannelAsync('welcome', {
    name: 'Welcome',
    importance: Notifications.AndroidImportance.HIGH,
    description: 'Welcome messages after you join X-Relax',
  });
}

/**
 * Show the signup welcome as a system notification once
 * (covers the gap before FCM can deliver — no token at signup time).
 */
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

/** Register for FCM/APNs device push and store token for the signed-in user. */
export async function registerForPushNotifications(): Promise<{
  token: string | null;
  error: string | null;
}> {
  ensureNotificationHandler();

  if (!Device.isDevice) {
    return { token: null, error: 'Push requires a physical device' };
  }

  try {
    await ensureChannels();

    const current = await Notifications.getPermissionsAsync();
    let status = current.status;
    if (status !== 'granted') {
      const asked = await Notifications.requestPermissionsAsync();
      status = asked.status;
    }
    if (status !== 'granted') {
      return { token: null, error: 'Notification permission denied' };
    }

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

    // Local tray notification for unread welcome (FCM may also fire from DB)
    await presentWelcomePushIfNeeded();

    return { token, error: null };
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : 'Push registration failed (use a custom/dev build, not Expo Go)';
    if (Constants.appOwnership === 'expo') {
      return {
        token: null,
        error: 'Push needs a development or preview build (not Expo Go)',
      };
    }
    return { token: null, error: message };
  }
}
