import { Alert, Linking, Platform, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { supabase } from './supabase';

const FALLBACK_APK =
  'https://expo.dev/artifacts/eas/9Cpo9RDE3TIRP-bwfwC7GAJvQ9zFIBoaqrvfWp87Gu8.apk';

export async function fetchAppDownloadUrl(): Promise<string> {
  const { data } = await supabase
    .from('app_releases')
    .select('download_url, apk_path, status')
    .neq('status', 'archived')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(5);

  const rows = (data as { download_url?: string | null; apk_path?: string | null; status?: string }[]) ?? [];
  const available = rows.find((r) => r.status === 'available') ?? rows[0];
  if (available?.download_url?.startsWith('http')) return available.download_url;
  if (available?.apk_path?.startsWith('http')) return available.apk_path;
  if (available?.apk_path) {
    const { data: pub } = supabase.storage.from('app-releases').getPublicUrl(available.apk_path);
    if (pub.publicUrl) return pub.publicUrl;
  }
  return FALLBACK_APK;
}

export function shareAppMessage(url: string) {
  return `Relax with me on X-Relax — free calming sounds & sleep audio.\n\nDownload the app:\n${url}`;
}

export async function copyAppLink(url: string) {
  await Clipboard.setStringAsync(url);
  Alert.alert('Link copied', 'Paste it in WhatsApp Status, chats, or anywhere.');
}

export async function shareAppNative(url: string) {
  await Share.share({
    message: shareAppMessage(url),
    url: Platform.OS === 'ios' ? url : undefined,
    title: 'Share X-Relax',
  });
}

export async function shareAppWhatsApp(url: string) {
  const text = encodeURIComponent(shareAppMessage(url));
  const appUrl = `whatsapp://send?text=${text}`;
  const webUrl = `https://wa.me/?text=${text}`;
  const can = await Linking.canOpenURL(appUrl);
  await Linking.openURL(can ? appUrl : webUrl);
}

/** Opens WhatsApp so the user can post the download link to Status (or a chat). */
export async function shareAppWhatsAppStatus(url: string) {
  await copyAppLink(url);
  await shareAppWhatsApp(url);
}

export async function shareAppFacebook(url: string) {
  const shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
  await Linking.openURL(shareUrl);
}
