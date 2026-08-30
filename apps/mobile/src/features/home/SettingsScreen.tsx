import { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Constants from 'expo-constants';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme } from '../../lib/useAppTheme';
import { useTheme } from '../../lib/ThemeProvider';
import { useAppSettings } from '../../lib/AppSettingsProvider';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../../lib/supabase';
import { clearOfflineUserCache } from '../../lib/offlineCache';
import { ShareAppSheet } from '../../navigation/ShareAppSheet';
import type { RootStackParamList } from '../../navigation/types';
import type { ThemePreference } from '../../lib/theme';
import type { AudioQuality, DownloadNetworkMode } from '../../lib/appSettings';

export function SettingsScreen() {
  const { colors, isDark } = useAppTheme();
  const { preference, setPreference } = useTheme();
  const { settings, online, isWifi, setDownloadNetwork, setVolume, setAudioQuality } =
    useAppSettings();
  const { signOut, isPremium, isCreator, isAdmin, user, profile } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const [shareOpen, setShareOpen] = useState(false);
  const [busyDelete, setBusyDelete] = useState(false);

  const version =
    Constants.expoConfig?.version ??
    Constants.nativeAppVersion ??
    '1.0.0';

  const cardBg = colors.elevated;

  const onDeleteAccount = useCallback(() => {
    Alert.alert(
      'Delete account',
      'This permanently deletes your account and data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Confirm delete', 'Are you sure you want to delete your account?', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete forever',
                style: 'destructive',
                onPress: async () => {
                  setBusyDelete(true);
                  const { data, error } = await supabase.rpc('delete_own_account');
                  setBusyDelete(false);
                  const payload = data as { ok?: boolean; error?: string } | null;
                  if (error || !payload?.ok) {
                    Alert.alert(
                      'Could not delete',
                      payload?.error ?? error?.message ?? 'Try again or contact support.',
                    );
                    return;
                  }
                  await clearOfflineUserCache();
                  await signOut();
                },
              },
            ]);
          },
        },
      ],
    );
  }, [signOut]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient
        colors={[colors.gradientTop, colors.background]}
        style={StyleSheet.absoluteFill}
      />
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 40,
          paddingHorizontal: 20,
        }}
      >
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
          <Text style={[styles.backText, { color: colors.text }]}>Back</Text>
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]}>Settings</Text>
        <Text style={[styles.sub, { color: colors.textMuted }]}>
          {online ? (isWifi ? 'Online · Wi‑Fi' : 'Online · Cellular') : 'Offline mode'}
        </Text>

        <SectionLabel colors={colors}>Appearance</SectionLabel>
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: colors.border }]}>
          {([
            { key: 'system', label: 'System' },
            { key: 'light', label: 'Light' },
            { key: 'dark', label: 'Dark' },
          ] as { key: ThemePreference; label: string }[]).map((opt, idx, arr) => (
            <SettingRow
              key={opt.key}
              label={opt.label}
              selected={preference === opt.key}
              onPress={() => void setPreference(opt.key)}
              colors={colors}
              showDivider={idx < arr.length - 1}
            />
          ))}
        </View>

        <SectionLabel colors={colors}>Playback</SectionLabel>
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: colors.border }]}>
          <Text style={[styles.rowLabel, { color: colors.text, paddingHorizontal: 14, paddingTop: 14 }]}>
            Volume
          </Text>
          <View style={styles.sliderRow}>
            <Ionicons name="volume-low" size={18} color={colors.textMuted} />
            <Slider
              style={{ flex: 1 }}
              minimumValue={0}
              maximumValue={1}
              value={settings.volume}
              onSlidingComplete={(v) => void setVolume(v)}
              minimumTrackTintColor={colors.accent}
              maximumTrackTintColor={colors.border}
              thumbTintColor={colors.accent}
            />
            <Ionicons name="volume-high" size={18} color={colors.textMuted} />
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Text style={[styles.rowLabel, { color: colors.text, paddingHorizontal: 14, paddingTop: 14 }]}>
            Audio quality
          </Text>
          {([
            { key: 'auto', label: 'Auto' },
            { key: 'high', label: 'High' },
            { key: 'data_saver', label: 'Data saver' },
          ] as { key: AudioQuality; label: string }[]).map((opt, idx, arr) => (
            <SettingRow
              key={opt.key}
              label={opt.label}
              selected={settings.audioQuality === opt.key}
              onPress={() => void setAudioQuality(opt.key)}
              colors={colors}
              showDivider={idx < arr.length - 1}
            />
          ))}
        </View>

        <SectionLabel colors={colors}>Downloads</SectionLabel>
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: colors.border }]}>
          <Text style={[styles.hint, { color: colors.textMuted }]}>
            Wi‑Fi only blocks downloads on mobile data. Cellular allows Wi‑Fi and mobile data.
          </Text>
          {([
            { key: 'wifi', label: 'Over Wi‑Fi only' },
            { key: 'cellular', label: 'Wi‑Fi + cellular data' },
          ] as { key: DownloadNetworkMode; label: string }[]).map((opt, idx, arr) => (
            <SettingRow
              key={opt.key}
              label={opt.label}
              selected={settings.downloadNetwork === opt.key}
              onPress={() => void setDownloadNetwork(opt.key)}
              colors={colors}
              showDivider={idx < arr.length - 1}
            />
          ))}
        </View>

        <SectionLabel colors={colors}>Account</SectionLabel>
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: colors.border }]}>
          <NavRow
            icon="diamond-outline"
            label="Premium & plan"
            hint={isPremium ? 'Premium active' : 'Upgrade or manage plan'}
            onPress={() => navigation.navigate('Premium')}
            colors={colors}
          />
          <NavRow
            icon="card-outline"
            label="My payments"
            onPress={() => navigation.navigate('MyPayments')}
            colors={colors}
          />
          {isCreator ? (
            <NavRow
              icon="shield-checkmark-outline"
              label="Verification"
              hint="Apply to earn / blue badge"
              onPress={() => navigation.navigate('CreatorVerification')}
              colors={colors}
            />
          ) : (
            <NavRow
              icon="mic-outline"
              label="Become a creator"
              onPress={() => navigation.navigate('BecomeCreator')}
              colors={colors}
            />
          )}
          {isAdmin ? (
            <NavRow
              icon="shield-outline"
              label="Admin hub"
              onPress={() => navigation.navigate('AdminHub')}
              colors={colors}
              showDivider={false}
            />
          ) : null}
        </View>

        <SectionLabel colors={colors}>Share & legal</SectionLabel>
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: colors.border }]}>
          <NavRow
            icon="share-social-outline"
            label="Share app"
            onPress={() => setShareOpen(true)}
            colors={colors}
          />
          <NavRow
            icon="document-text-outline"
            label="Privacy policy"
            onPress={() => navigation.navigate('Legal', { doc: 'privacy' })}
            colors={colors}
          />
          <NavRow
            icon="reader-outline"
            label="Terms of use"
            onPress={() => navigation.navigate('Legal', { doc: 'terms' })}
            colors={colors}
            showDivider={false}
          />
        </View>

        <SectionLabel colors={colors}>About</SectionLabel>
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: colors.border }]}>
          <View style={styles.aboutRow}>
            <Text style={[styles.rowLabel, { color: colors.text }]}>Version</Text>
            <Text style={{ color: colors.textMuted, fontFamily: 'DMSans_500Medium' }}>{version}</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.aboutRow}>
            <Text style={[styles.rowLabel, { color: colors.text }]}>Signed in as</Text>
            <Text style={{ color: colors.textMuted, fontFamily: 'DMSans_500Medium', maxWidth: '55%' }} numberOfLines={1}>
              {profile?.display_name ?? 'Listener'}
            </Text>
          </View>
        </View>

        <Pressable
          style={[styles.dangerBtn, { borderColor: '#EF4444', opacity: busyDelete ? 0.6 : 1 }]}
          disabled={busyDelete}
          onPress={onDeleteAccount}
        >
          <Ionicons name="trash-outline" size={18} color="#EF4444" />
          <Text style={styles.dangerText}>{busyDelete ? 'Deleting…' : 'Delete account'}</Text>
        </Pressable>

        <Pressable
          style={[styles.dangerBtn, { borderColor: colors.border, marginTop: 10 }]}
          onPress={() =>
            Alert.alert('Sign out', 'Sign out of X-Relax?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
            ])
          }
        >
          <Ionicons name="log-out-outline" size={18} color={colors.text} />
          <Text style={[styles.dangerText, { color: colors.text }]}>Sign out</Text>
        </Pressable>

        {user ? null : null}
      </ScrollView>
      <ShareAppSheet visible={shareOpen} onClose={() => setShareOpen(false)} />
    </View>
  );
}

function SectionLabel({
  children,
  colors,
}: {
  children: string;
  colors: { textMuted: string };
}) {
  return (
    <Text style={[styles.section, { color: colors.textMuted }]}>{children}</Text>
  );
}

function SettingRow({
  label,
  selected,
  onPress,
  colors,
  showDivider = true,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  colors: { text: string; border: string; accent: string };
  showDivider?: boolean;
}) {
  return (
    <>
      <Pressable onPress={onPress} style={styles.settingRow}>
        <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
        {selected ? <Ionicons name="checkmark-circle" size={20} color={colors.accent} /> : null}
      </Pressable>
      {showDivider ? <View style={[styles.divider, { backgroundColor: colors.border }]} /> : null}
    </>
  );
}

function NavRow({
  icon,
  label,
  hint,
  onPress,
  colors,
  showDivider = true,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint?: string;
  onPress: () => void;
  colors: { text: string; textMuted: string; border: string };
  showDivider?: boolean;
}) {
  return (
    <>
      <Pressable onPress={onPress} style={styles.navRow}>
        <Ionicons name={icon} size={20} color={colors.text} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
          {hint ? (
            <Text style={{ color: colors.textMuted, fontSize: 12, fontFamily: 'DMSans_400Regular' }}>
              {hint}
            </Text>
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      </Pressable>
      {showDivider ? <View style={[styles.divider, { backgroundColor: colors.border }]} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  back: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  backText: { fontFamily: 'DMSans_500Medium', fontSize: 15 },
  title: { fontFamily: 'Fraunces_700Bold', fontSize: 34, letterSpacing: -0.8 },
  sub: { fontFamily: 'DMSans_400Regular', fontSize: 13, marginTop: 4, marginBottom: 8 },
  section: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: 18,
    marginBottom: 8,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  rowLabel: { fontFamily: 'DMSans_500Medium', fontSize: 15 },
  hint: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 4,
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 14 },
  aboutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  dangerBtn: {
    marginTop: 20,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dangerText: { color: '#EF4444', fontFamily: 'DMSans_700Bold', fontSize: 15 },
});
