import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../lib/useAppTheme';
import { COUNTRIES, countryName } from '../../lib/countries';
import { moodPaletteFor } from '../../lib/format';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import type { RootStackParamList } from '../../navigation/types';
import { ScreenScaffold } from '../../ui/Screen';
import { VerifiedBadge } from '../../ui/VerifiedBadge';
import { ShareAppSheet } from '../../navigation/ShareAppSheet';

const GOLD = '#C9A227';
const GOLD_SOFT = 'rgba(201, 162, 39, 0.18)';

type ProfileStats = {
  soundsSaved: number;
  favourites: number;
  downloads: number;
  listeningHours: number;
};

export function ProfileScreen() {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {
    profile,
    adminProfile,
    user,
    isPremium,
    isCreator,
    isAdmin,
    canDownloadOffline,
    signOut,
    updateProfile,
    refreshProfile,
  } = useAuth();

  const [name, setName] = useState(profile?.display_name ?? '');
  const [countryCode, setCountryCode] = useState(profile?.country_code ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [city, setCity] = useState(profile?.city ?? '');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [bannerUri, setBannerUri] = useState<string | null>(null);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [isVerifiedCreator, setIsVerifiedCreator] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [stats, setStats] = useState<ProfileStats>({
    soundsSaved: 0,
    favourites: 0,
    downloads: 0,
    listeningHours: 0,
  });

  useEffect(() => {
    setName(profile?.display_name ?? '');
    setCountryCode(profile?.country_code ?? '');
    setBio(profile?.bio ?? '');
    setCity(profile?.city ?? '');
    setAvatarUri(null);
    setBannerUri(null);
    setAvatarFailed(false);
  }, [
    profile?.display_name,
    profile?.avatar_url,
    profile?.banner_url,
    profile?.bio,
    profile?.city,
    profile?.country_code,
  ]);

  const loadCreator = useCallback(async () => {
    if (!user || !isCreator) {
      setIsVerifiedCreator(false);
      return;
    }
    const { data } = await supabase
      .from('creator_profiles')
      .select('is_verified, can_earn')
      .eq('user_id', user.id)
      .maybeSingle();
    setIsVerifiedCreator(!!data?.is_verified || !!data?.can_earn);
  }, [user, isCreator]);

  const loadStats = useCallback(async () => {
    if (!user) return;
    const [{ count: favCount }, { count: dlCount }, { data: playlistItems }, { data: history }] =
      await Promise.all([
        supabase
          .from('favourites')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id),
        canDownloadOffline
          ? supabase
              .from('downloads')
              .select('id', { count: 'exact', head: true })
              .eq('user_id', user.id)
          : Promise.resolve({ count: 0 }),
        supabase
          .from('playlists')
          .select('id, items:playlist_items(id)')
          .eq('user_id', user.id),
        supabase
          .from('listening_history')
          .select('progress_seconds')
          .eq('user_id', user.id)
          .limit(500),
      ]);

    const savedInPlaylists = ((playlistItems as { items?: { id: string }[] }[]) ?? []).reduce(
      (sum, pl) => sum + (pl.items?.length ?? 0),
      0,
    );
    const listeningSeconds = ((history as { progress_seconds?: number }[]) ?? []).reduce(
      (sum, row) => sum + Number(row.progress_seconds ?? 0),
      0,
    );

    setStats({
      soundsSaved: savedInPlaylists,
      favourites: Number(favCount ?? 0),
      downloads: Number(dlCount ?? 0),
      listeningHours: Math.max(0, Math.round(listeningSeconds / 3600)),
    });
  }, [user, canDownloadOffline]);

  useFocusEffect(
    useCallback(() => {
      void refreshProfile();
      void loadCreator();
      void loadStats();
    }, [refreshProfile, loadCreator, loadStats]),
  );

  const showBlueBadge =
    (isCreator || isAdmin) &&
    (isVerifiedCreator || !!adminProfile?.has_verified_badge || adminProfile?.role === 'super');
  /** White badge: verified Premium listeners only — never on creators/admins. */
  const showWhiteBadge = !isCreator && !isAdmin && isPremium;

  /** Paid Premium that is still valid (not creator/admin perk alone). */
  const premiumActive = isPremium;

  const pickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      setAvatarFailed(false);
      setAvatarUri(result.assets[0].uri);
      setEditOpen(true);
    }
  };

  const pickBanner = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      setBannerUri(result.assets[0].uri);
      setEditOpen(true);
    }
  };

  const onSave = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      Alert.alert('Name required', 'Enter at least 2 characters.');
      return;
    }
    if (!countryCode) {
      Alert.alert('Country required', 'Select your country for payments and analytics.');
      return;
    }
    setBusy(true);
    const result = await updateProfile({
      displayName: trimmed,
      avatarUri: avatarUri ?? undefined,
      bannerUri: bannerUri ?? undefined,
      bio,
      city,
      countryCode,
    });
    setBusy(false);
    if (result.error) {
      Alert.alert('Could not save', result.error);
      return;
    }
    setAvatarUri(null);
    setBannerUri(null);
    setEditOpen(false);
    Alert.alert('Saved', 'Your profile was updated.');
  };

  const initial = (profile?.display_name?.trim()?.[0] ?? user?.email?.[0] ?? 'X').toUpperCase();
  const avatarSource = avatarUri ?? profile?.avatar_url ?? null;
  const showRemoteAvatar = !!avatarSource && !avatarFailed;
  const cardBg = isDark ? '#141414' : colors.surface;
  const roleLabel =
    profile?.role === 'admin'
      ? 'Admin'
      : profile?.role === 'creator'
        ? 'Creator'
        : 'Listener';

  return (
    <ScreenScaffold
      title="Profile"
      subtitle="Manage your account, sounds, and preferences."
      right={
        <Pressable onPress={() => setEditOpen(true)} hitSlop={10} style={styles.gearBtn}>
          <Ionicons name="create-outline" size={22} color={colors.text} />
        </Pressable>
      }
      contentStyle={{ paddingBottom: 48 }}
    >
      {/* Hero */}
      <View style={styles.heroWrap}>
        <Pressable onPress={pickBanner} style={styles.profileBannerPress}>
          {bannerUri || profile?.banner_url ? (
            <Image
              source={{ uri: bannerUri ?? profile?.banner_url ?? undefined }}
              style={styles.profileBanner}
              contentFit="cover"
            />
          ) : (
            <LinearGradient
              colors={
                isDark
                  ? ['#1A1A1A', 'rgba(201,162,39,0.2)', '#121212']
                  : ['#EDEAE4', 'rgba(201,162,39,0.25)', '#F7F4EE']
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.profileBanner}
            />
          )}
          <View style={styles.bannerChip}>
            <Ionicons name="image-outline" size={12} color="#fff" />
            <Text style={styles.bannerChipText}>Edit banner</Text>
          </View>
        </Pressable>

        <Pressable onPress={pickAvatar} style={styles.avatarPress}>
          <LinearGradient
            colors={[GOLD, '#8B6914', GOLD]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.avatarRing}
          >
            <View style={[styles.avatarInner, { backgroundColor: colors.background }]}>
              {showRemoteAvatar ? (
                <Image
                  source={{ uri: avatarSource }}
                  style={styles.avatarImage}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  recyclingKey={avatarSource}
                  onError={() => setAvatarFailed(true)}
                />
              ) : (
                <LinearGradient
                  colors={moodPaletteFor(user?.email ?? 'profile')}
                  style={styles.avatarFallback}
                >
                  <Text style={styles.avatarMark}>{initial}</Text>
                </LinearGradient>
              )}
            </View>
          </LinearGradient>
          <View style={[styles.cameraBtn, { backgroundColor: colors.inverse }]}>
            <Ionicons name="camera" size={13} color={colors.inverseText} />
          </View>
        </Pressable>

        <View style={styles.nameRow}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {profile?.display_name ?? 'Listener'}
          </Text>
          {showWhiteBadge ? <VerifiedBadge size={18} tone="white" /> : null}
          {showBlueBadge ? <VerifiedBadge size={18} tone="blue" /> : null}
        </View>
        {profile?.bio?.trim() ? (
          <Text style={[styles.bioText, { color: colors.textMuted }]} numberOfLines={3}>
            {profile.bio.trim()}
          </Text>
        ) : null}
        {(profile?.city || profile?.country_code) ? (
          <Text style={[styles.locationText, { color: colors.textMuted }]} numberOfLines={1}>
            {[profile?.city, countryName(profile?.country_code)].filter(Boolean).join(' · ')}
          </Text>
        ) : null}

        <View style={styles.badgeRow}>
          <View style={[styles.rolePill, { backgroundColor: isDark ? '#1C1C1C' : '#EDEAE4' }]}>
            <Text style={[styles.rolePillText, { color: colors.text }]}>{roleLabel}</Text>
          </View>
          {premiumActive ? (
            <View style={[styles.premiumPill, { borderColor: GOLD, backgroundColor: GOLD_SOFT }]}>
              <Ionicons name="diamond" size={12} color={GOLD} />
              <Text style={[styles.premiumPillText, { color: GOLD }]}>Premium</Text>
            </View>
          ) : (
            <View style={[styles.rolePill, { backgroundColor: isDark ? '#1C1C1C' : '#EDEAE4' }]}>
              <Text style={[styles.rolePillText, { color: colors.textMuted }]}>Free</Text>
            </View>
          )}
          {isVerifiedCreator ? (
            <View style={[styles.rolePill, { backgroundColor: isDark ? '#1C1C1C' : '#EDEAE4' }]}>
              <Text style={[styles.rolePillText, { color: colors.text }]}>Verified creator</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Stats */}
      <View style={[styles.statsCard, { backgroundColor: cardBg, borderColor: colors.border }]}>
        <StatCell
          icon="musical-notes"
          iconColor={GOLD}
          value={String(stats.soundsSaved)}
          label="Sounds Saved"
          colors={colors}
        />
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <StatCell
          icon="heart"
          iconColor="#EF4444"
          value={String(stats.favourites)}
          label="Favorites"
          colors={colors}
        />
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <StatCell
          icon="arrow-down-circle"
          iconColor="#22C55E"
          value={String(stats.downloads)}
          label="Downloads"
          colors={colors}
        />
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <StatCell
          icon="time"
          iconColor="#60A5FA"
          value={`${stats.listeningHours}h`}
          label="Listening Time"
          colors={colors}
        />
      </View>

      {/* Account */}
      <SectionTitle>Account</SectionTitle>
      <View style={[styles.groupCard, { backgroundColor: cardBg, borderColor: colors.border }]}>
        <MenuRow
          icon="create"
          iconBg={GOLD_SOFT}
          iconColor={GOLD}
          label="Edit profile"
          hint="Banner, photo, bio, city, and country."
          onPress={() => setEditOpen(true)}
          colors={colors}
          showDivider
        />
        <MenuRow
          icon="share-social"
          iconBg="rgba(34,197,94,0.16)"
          iconColor="#22C55E"
          label="Share app"
          hint="Send the APK download link to friends."
          onPress={() => setShareOpen(true)}
          colors={colors}
          showDivider
        />
        {!isCreator ? (
          <MenuRow
            icon="mic"
            iconBg={GOLD_SOFT}
            iconColor={GOLD}
            label="Become a Creator"
            hint="Upload sounds and earn from Premium."
            onPress={() => navigation.navigate('BecomeCreator')}
            colors={colors}
            showDivider
          />
        ) : (
          <MenuRow
            icon="mic"
            iconBg={GOLD_SOFT}
            iconColor={GOLD}
            label="Creator dashboard"
            hint="Uploads, earnings, and verification."
            onPress={() => navigation.navigate('Creator')}
            colors={colors}
            showDivider
          />
        )}
        <MenuRow
          icon="notifications"
          iconBg="rgba(168,85,247,0.16)"
          iconColor="#A855F7"
          label="Notifications"
          hint="Updates, welcome notes and more."
          onPress={() => navigation.navigate('Notifications')}
          colors={colors}
          showDivider
        />
        <MenuRow
          icon="shield-checkmark"
          iconBg="rgba(34,197,94,0.16)"
          iconColor="#22C55E"
          label="Subscription"
          hint="Manage your Premium plan."
          onPress={() => navigation.navigate('Premium')}
          colors={colors}
          trailing={
            premiumActive ? (
              <View style={[styles.activeBadge, { backgroundColor: GOLD_SOFT, borderColor: GOLD }]}>
                <Text style={[styles.activeBadgeText, { color: GOLD }]}>Active</Text>
              </View>
            ) : null
          }
        />
        {isAdmin ? (
          <MenuRow
            icon="shield"
            iconBg="rgba(96,165,250,0.16)"
            iconColor="#60A5FA"
            label="Admin hub"
            hint="Moderation, payments, and queues."
            onPress={() => navigation.navigate('AdminHub')}
            colors={colors}
            showDivider={false}
            style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }}
          />
        ) : null}
      </View>

      {/* Preferences */}
      <SectionTitle>Preferences</SectionTitle>
      <View style={[styles.groupCard, { backgroundColor: cardBg, borderColor: colors.border }]}>
        <MenuRow
          icon="settings"
          iconBg="rgba(59,130,246,0.16)"
          iconColor="#3B82F6"
          label="Settings"
          hint="Theme, volume, downloads, privacy, and more."
          onPress={() => navigation.navigate('Settings')}
          colors={colors}
        />
      </View>

      {/* Legal */}
      <SectionTitle>Legal</SectionTitle>
      <View style={[styles.groupCard, { backgroundColor: cardBg, borderColor: colors.border }]}>
        <MenuRow
          icon="document-text"
          iconBg={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}
          iconColor={colors.text}
          label="Privacy Policy"
          onPress={() => navigation.navigate('Legal', { doc: 'privacy' })}
          colors={colors}
          showDivider
        />
        <MenuRow
          icon="reader"
          iconBg={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}
          iconColor={colors.text}
          label="Terms of Use"
          onPress={() => navigation.navigate('Legal', { doc: 'terms' })}
          colors={colors}
        />
      </View>

      <Pressable
        style={[styles.signOut, { borderColor: colors.danger === '#FFFFFF' ? '#EF4444' : '#EF4444' }]}
        onPress={() =>
          Alert.alert('Sign out', 'Sign out of X-Relax?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
          ])
        }
      >
        <Ionicons name="log-out-outline" size={18} color="#EF4444" />
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>

      {/* Edit sheet */}
      <Modal visible={editOpen} transparent animationType="slide" onRequestClose={() => setEditOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setEditOpen(false)}>
          <Pressable
            style={[
              styles.editSheet,
              {
                backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
                paddingBottom: insets.bottom + 20,
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.editTitle, { color: colors.text }]}>Edit profile</Text>
            <ScrollView
              style={{ maxHeight: 420 }}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Pressable onPress={pickBanner} style={styles.editBannerRow}>
                {bannerUri || profile?.banner_url ? (
                  <Image
                    source={{ uri: bannerUri ?? profile?.banner_url! }}
                    style={styles.editBanner}
                    contentFit="cover"
                  />
                ) : (
                  <View style={[styles.editBanner, { backgroundColor: isDark ? '#2C2C2E' : '#EDEAE4', alignItems: 'center', justifyContent: 'center' }]}>
                    <Text style={{ color: GOLD, fontFamily: 'DMSans_500Medium' }}>Add banner</Text>
                  </View>
                )}
              </Pressable>
              <Pressable onPress={pickAvatar} style={styles.editAvatarRow}>
                {showRemoteAvatar ? (
                  <Image source={{ uri: avatarSource! }} style={styles.editAvatar} contentFit="cover" />
                ) : (
                  <View style={[styles.editAvatar, { backgroundColor: '#333', alignItems: 'center', justifyContent: 'center' }]}>
                    <Text style={{ color: '#fff', fontSize: 22, fontFamily: 'Fraunces_700Bold' }}>
                      {initial}
                    </Text>
                  </View>
                )}
                <Text style={{ color: GOLD, fontFamily: 'DMSans_500Medium' }}>Change photo</Text>
              </Pressable>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Display name"
                placeholderTextColor={colors.textMuted}
                style={[
                  styles.editInput,
                  {
                    color: colors.text,
                    borderColor: colors.border,
                    backgroundColor: isDark ? '#2C2C2E' : '#F3F0EA',
                  },
                ]}
              />
              <TextInput
                value={bio}
                onChangeText={setBio}
                placeholder="Bio"
                placeholderTextColor={colors.textMuted}
                multiline
                style={[
                  styles.editInput,
                  styles.editBio,
                  {
                    color: colors.text,
                    borderColor: colors.border,
                    backgroundColor: isDark ? '#2C2C2E' : '#F3F0EA',
                  },
                ]}
              />
              <TextInput
                value={city}
                onChangeText={setCity}
                placeholder="City"
                placeholderTextColor={colors.textMuted}
                style={[
                  styles.editInput,
                  {
                    color: colors.text,
                    borderColor: colors.border,
                    backgroundColor: isDark ? '#2C2C2E' : '#F3F0EA',
                  },
                ]}
              />
              <Text style={{ color: colors.textMuted, fontSize: 12, fontFamily: 'DMSans_500Medium', marginBottom: 6 }}>
                Country / region · {countryName(countryCode || profile?.country_code)}
              </Text>
              {COUNTRIES.map((c) => {
                const selected = countryCode === c.code;
                return (
                  <Pressable
                    key={c.code}
                    onPress={() => setCountryCode(c.code)}
                    style={{ paddingVertical: 8 }}
                  >
                    <Text
                      style={{
                        color: selected ? GOLD : colors.text,
                        fontFamily: selected ? 'DMSans_700Bold' : 'DMSans_400Regular',
                      }}
                    >
                      {c.name}
                      {selected ? ' ✓' : ''}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Pressable
              onPress={() => void onSave()}
              disabled={busy}
              style={[styles.saveBtn, { backgroundColor: colors.inverse, opacity: busy ? 0.6 : 1 }]}
            >
              <Text style={{ color: colors.inverseText, fontFamily: 'DMSans_700Bold', fontSize: 16 }}>
                {busy ? 'Saving…' : 'Save'}
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
      <ShareAppSheet visible={shareOpen} onClose={() => setShareOpen(false)} />
    </ScreenScaffold>
  );
}

function SectionTitle({ children }: { children: string }) {
  const { colors } = useAppTheme();
  return <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{children}</Text>;
}

function StatCell({
  icon,
  iconColor,
  value,
  label,
  colors,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  value: string;
  label: string;
  colors: { text: string; textMuted: string };
}) {
  return (
    <View style={styles.statCell}>
      <Ionicons name={icon} size={16} color={iconColor} />
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textMuted }]} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

function MenuRow({
  icon,
  iconBg,
  iconColor,
  label,
  hint,
  onPress,
  colors,
  showDivider,
  trailing,
  style,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  iconColor: string;
  label: string;
  hint?: string;
  onPress: () => void;
  colors: { text: string; textMuted: string };
  showDivider?: boolean;
  trailing?: ReactNode;
  style?: object;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.menuRow,
        showDivider ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(128,128,128,0.25)' } : null,
        style,
      ]}
    >
      <View style={[styles.menuIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.menuLabel, { color: colors.text }]}>{label}</Text>
        {hint ? (
          <Text style={[styles.menuHint, { color: colors.textMuted }]} numberOfLines={2}>
            {hint}
          </Text>
        ) : null}
      </View>
      {trailing}
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  gearBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  heroWrap: {
    alignItems: 'center',
    paddingHorizontal: 0,
    marginBottom: 18,
    marginTop: 4,
    position: 'relative',
  },
  profileBannerPress: {
    width: '100%',
    marginBottom: -40,
    position: 'relative',
  },
  profileBanner: {
    width: '100%',
    height: 120,
    borderRadius: 16,
  },
  bannerChip: {
    position: 'absolute',
    right: 10,
    bottom: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  bannerChipText: {
    color: '#fff',
    fontFamily: 'DMSans_500Medium',
    fontSize: 11,
  },
  waveBehind: {
    ...StyleSheet.absoluteFill,
    top: 20,
    bottom: 40,
  },
  avatarPress: { marginBottom: 14, marginTop: 8 },
  bioText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 24,
    lineHeight: 18,
  },
  locationText: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 12,
    marginTop: 6,
  },
  editBannerRow: { marginBottom: 14 },
  editBanner: { width: '100%', height: 96, borderRadius: 12 },
  editBio: { minHeight: 72, textAlignVertical: 'top' },
  avatarRing: {
    width: 104,
    height: 104,
    borderRadius: 52,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 3,
  },
  avatarInner: {
    width: '100%',
    height: '100%',
    borderRadius: 50,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBtn: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarMark: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 40,
    color: 'rgba(255,255,255,0.92)',
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '90%' },
  name: { fontFamily: 'Fraunces_600SemiBold', fontSize: 24, letterSpacing: -0.3 },
  email: { fontFamily: 'DMSans_400Regular', fontSize: 13, marginTop: 4 },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
    justifyContent: 'center',
  },
  rolePill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  rolePillText: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 12,
  },
  premiumPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  premiumPillText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 12,
  },
  statsCard: {
    marginHorizontal: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 2,
  },
  statDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', marginVertical: 4 },
  statValue: { fontFamily: 'DMSans_700Bold', fontSize: 16 },
  statLabel: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 13,
  },
  sectionTitle: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: 22,
    marginBottom: 10,
    marginHorizontal: 20,
  },
  groupCard: {
    marginHorizontal: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: { fontFamily: 'DMSans_700Bold', fontSize: 15 },
  menuHint: { fontFamily: 'DMSans_400Regular', fontSize: 12, marginTop: 2, lineHeight: 16 },
  activeBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 4,
  },
  activeBadgeText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 11,
  },
  signOut: {
    marginHorizontal: 16,
    marginTop: 28,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  signOutText: {
    color: '#EF4444',
    fontFamily: 'DMSans_700Bold',
    fontSize: 15,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  editSheet: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 14,
  },
  editTitle: { fontFamily: 'Fraunces_700Bold', fontSize: 22 },
  editAvatarRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  editAvatar: { width: 56, height: 56, borderRadius: 28 },
  editInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
  },
  saveBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
});
