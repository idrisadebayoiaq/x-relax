import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useAppTheme } from '../../lib/useAppTheme';
import { moodPaletteFor } from '../../lib/format';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import { usePlayer } from '../player/PlayerProvider';
import type { RootStackParamList } from '../../navigation/types';
import type { Sound } from '../../types/database';
import { EmptyBlock, PrimaryButton, ScreenScaffold, SectionLabel } from '../../ui/Screen';
import { SoundCard } from '../../ui/Cards';
import { VerifiedBadge } from '../../ui/VerifiedBadge';

type CreatorPublicProfile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  bio: string | null;
  is_verified: boolean;
  country_code: string | null;
  follower_count: number;
  monthly_listeners: number;
  is_following: boolean;
};

type Route = RouteProp<RootStackParamList, 'CreatorProfile'>;

function formatCount(n: number | null | undefined): string {
  const v = Number(n ?? 0);
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 10_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toLocaleString();
}

async function readImageBody(uri: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(uri);
    const body = await res.arrayBuffer();
    if (body.byteLength) return body;
  } catch {
    /* fall through */
  }
  try {
    const FileSystem = await import('expo-file-system/legacy');
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const binary = globalThis.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  } catch {
    return null;
  }
}

export function CreatorProfileScreen() {
  const { colors, isDark } = useAppTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<Route>();
  const { creatorId } = route.params;
  const { user, isCreator } = useAuth();
  const { playSound } = usePlayer();

  const [profile, setProfile] = useState<CreatorPublicProfile | null>(null);
  const [sounds, setSounds] = useState<Sound[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [bannerBusy, setBannerBusy] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);

  const isOwnProfile = !!user && user.id === creatorId;

  const load = useCallback(async () => {
    const [{ data: profileData, error: profileError }, { data: soundRows }] = await Promise.all([
      supabase.rpc('get_creator_public_profile', { p_creator_id: creatorId }),
      supabase
        .from('sounds')
        .select('*')
        .eq('creator_id', creatorId)
        .eq('status', 'published')
        .order('created_at', { ascending: false }),
    ]);

    if (profileError) {
      setProfile(null);
    } else {
      setProfile((profileData as CreatorPublicProfile | null) ?? null);
    }
    setSounds((soundRows as Sound[]) ?? []);
    setLoading(false);
    setRefreshing(false);
  }, [creatorId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load]),
  );

  const toggleFollow = async () => {
    if (!user) {
      Alert.alert('Sign in', 'Sign in to follow creators.');
      return;
    }
    if (isOwnProfile) return;
    if (!profile) return;

    setFollowBusy(true);
    if (profile.is_following) {
      const { error } = await supabase
        .from('creator_follows')
        .delete()
        .eq('follower_id', user.id)
        .eq('creator_id', creatorId);
      if (error) Alert.alert('Unfollow failed', error.message);
    } else {
      const { error } = await supabase.from('creator_follows').insert({
        follower_id: user.id,
        creator_id: creatorId,
      });
      if (error) Alert.alert('Follow failed', error.message);
    }
    setFollowBusy(false);
    await load();
  };

  const pickBanner = async () => {
    if (!isOwnProfile || !isCreator || !user) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]?.uri) return;

    setBannerBusy(true);
    const path = `${user.id}/banners/${Date.now()}.jpg`;
    const body = await readImageBody(result.assets[0].uri);
    if (!body?.byteLength) {
      setBannerBusy(false);
      Alert.alert('Upload failed', 'Could not read the selected image.');
      return;
    }

    const { error: uploadError } = await supabase.storage
      .from('covers')
      .upload(path, body, { upsert: true, contentType: 'image/jpeg', cacheControl: '3600' });
    if (uploadError) {
      setBannerBusy(false);
      Alert.alert('Upload failed', uploadError.message);
      return;
    }

    const { data: pub } = supabase.storage.from('covers').getPublicUrl(path);
    const bannerUrl = `${pub.publicUrl}?v=${Date.now()}`;

    const { error: updateError } = await supabase
      .from('creator_profiles')
      .update({ banner_url: bannerUrl, updated_at: new Date().toISOString() })
      .eq('user_id', user.id);

    setBannerBusy(false);
    if (updateError) {
      Alert.alert('Save failed', updateError.message);
      return;
    }
    await load();
  };

  const openSound = async (sound: Sound, index: number) => {
    const started = await playSound(sound, {
      queue: sounds,
      queueIndex: index,
      queueLabel: profile?.display_name ?? 'Creator',
    });
    if (started) navigation.navigate('Player', { soundId: sound.id });
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.icon} />
      </View>
    );
  }

  if (!profile) {
    return (
      <ScreenScaffold title="Creator" onBack={() => navigation.goBack()}>
        <EmptyBlock
          title="Profile not found"
          body="This creator profile is unavailable or does not exist."
        />
      </ScreenScaffold>
    );
  }

  const displayName = profile.display_name?.trim() || 'Creator';
  const initial = displayName[0]?.toUpperCase() ?? 'C';
  const [gradA, gradB] = moodPaletteFor(creatorId);
  const cardBg = colors.elevated;

  return (
    <ScreenScaffold
      title={displayName}
      onBack={() => navigation.goBack()}
      contentStyle={{ paddingBottom: 48 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void load();
          }}
          tintColor={colors.icon}
        />
      }
    >
      <View style={styles.bannerWrap}>
        <Pressable
          onPress={isOwnProfile && isCreator ? () => void pickBanner() : undefined}
          disabled={bannerBusy}
          style={styles.bannerPress}
        >
          {profile.banner_url ? (
            <Image
              source={{ uri: profile.banner_url }}
              style={styles.banner}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          ) : (
            <LinearGradient colors={[gradA, gradB]} style={styles.banner} />
          )}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.55)']}
            style={StyleSheet.absoluteFill}
          />
          {isOwnProfile && isCreator ? (
            <View style={styles.bannerEdit}>
              {bannerBusy ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="camera" size={16} color="#fff" />
                  <Text style={styles.bannerEditText}>Edit banner</Text>
                </>
              )}
            </View>
          ) : null}
        </Pressable>

        <View style={styles.avatarRow}>
          <View style={[styles.avatarRing, { borderColor: colors.background }]}>
            {profile.avatar_url && !avatarFailed ? (
              <Image
                source={{ uri: profile.avatar_url }}
                style={styles.avatar}
                contentFit="cover"
                onError={() => setAvatarFailed(true)}
              />
            ) : (
              <LinearGradient colors={[gradA, gradB]} style={styles.avatar}>
                <Text style={styles.avatarMark}>{initial}</Text>
              </LinearGradient>
            )}
          </View>
        </View>
      </View>

      <View style={styles.identity}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>
            {displayName}
          </Text>
          {profile.is_verified ? <VerifiedBadge size={18} tone="blue" /> : null}
        </View>
        {profile.country_code ? (
          <Text style={[styles.country, { color: colors.textMuted }]}>
            {profile.country_code}
          </Text>
        ) : null}
        {profile.bio?.trim() ? (
          <Text style={[styles.bio, { color: colors.text }]}>{profile.bio.trim()}</Text>
        ) : null}
        {isOwnProfile ? (
          <Text style={[styles.avatarHint, { color: colors.textMuted }]}>
            Edit your photo on the Profile tab.
          </Text>
        ) : null}
      </View>

      <View style={[styles.statsCard, { backgroundColor: cardBg, borderColor: colors.border }]}>
        <StatCell value={formatCount(profile.monthly_listeners)} label="Monthly listeners" colors={colors} />
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <StatCell value={formatCount(profile.follower_count)} label="Followers" colors={colors} />
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <StatCell value={String(sounds.length)} label="Sounds" colors={colors} />
      </View>

      {!isOwnProfile ? (
        <View style={styles.followWrap}>
          <PrimaryButton
            label={profile.is_following ? 'Following' : 'Follow'}
            onPress={() => void toggleFollow()}
            loading={followBusy}
          />
        </View>
      ) : null}

      <SectionLabel>Published sounds</SectionLabel>
      {sounds.length === 0 ? (
        <EmptyBlock
          title="No sounds yet"
          body={
            isOwnProfile
              ? 'Upload sounds from your Creator dashboard.'
              : 'This creator has not published any sounds yet.'
          }
        />
      ) : (
        <View style={styles.soundList}>
          {sounds.map((sound, index) => (
            <SoundCard
              key={sound.id}
              sound={sound}
              onPress={() => void openSound(sound, index)}
            />
          ))}
        </View>
      )}
    </ScreenScaffold>
  );
}

function StatCell({
  value,
  label,
  colors,
}: {
  value: string;
  label: string;
  colors: { text: string; textMuted: string };
}) {
  return (
    <View style={styles.statCell}>
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textMuted }]} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bannerWrap: { marginBottom: 8 },
  bannerPress: { position: 'relative' },
  banner: { width: '100%', height: 160 },
  bannerEdit: {
    position: 'absolute',
    right: 16,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  bannerEditText: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 12,
    color: '#fff',
  },
  avatarRow: {
    marginTop: -44,
    paddingHorizontal: 20,
  },
  avatarRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 4,
    overflow: 'hidden',
  },
  avatar: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarMark: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 32,
    color: 'rgba(255,255,255,0.92)',
  },
  identity: { paddingHorizontal: 20, marginTop: 10 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  name: { fontFamily: 'Fraunces_700Bold', fontSize: 26, letterSpacing: -0.4, flexShrink: 1 },
  country: { fontFamily: 'DMSans_400Regular', fontSize: 12, marginTop: 4 },
  bio: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 10,
  },
  avatarHint: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    marginTop: 8,
  },
  statsCard: {
    marginHorizontal: 16,
    marginTop: 18,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  statCell: { flex: 1, alignItems: 'center', gap: 4, paddingHorizontal: 4 },
  statDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', marginVertical: 4 },
  statValue: { fontFamily: 'Fraunces_600SemiBold', fontSize: 20 },
  statLabel: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 13,
  },
  followWrap: { paddingHorizontal: 20, marginTop: 16 },
  soundList: { paddingHorizontal: 16 },
});
