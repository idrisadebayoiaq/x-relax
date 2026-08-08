import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAppTheme } from '../../lib/useAppTheme';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../../lib/supabase';
import type { RootStackParamList } from '../../navigation/types';
import {
  EmptyBlock,
  OutlineRow,
  PrimaryButton,
  ScreenScaffold,
  SectionLabel,
} from '../../ui/Screen';

type Analytics = {
  published_sounds?: number;
  pending_sounds?: number;
  total_plays?: number;
  listening_seconds?: number;
  favourites?: number;
  downloads?: number;
  avg_rating?: number | null;
  earnings_usd?: number;
  earnings_ngn?: number;
  top_sound?: { id: string; title: string; play_count: number } | null;
};

type ProfileAnalytics = {
  follower_count?: number;
  new_followers_7d?: number;
  monthly_listeners?: number;
  total_likes?: number;
  new_likes_7d?: number;
  plays_7d?: number;
  total_saves?: number;
  top_countries?: { country_code: string; plays: number }[];
  sounds?: {
    id: string;
    title: string;
    play_count: number;
    likes: number;
    saves: number;
    status: string;
  }[];
};

type EarnRequirement = {
  key: string;
  label: string;
  required: number;
  current: number;
  met: boolean;
};

type EarnStatus = {
  can_earn?: boolean;
  eligible?: boolean;
  requirements?: EarnRequirement[];
};

export function CreatorScreen() {
  const { colors } = useAppTheme();
  const { user, isCreator, isAdmin, refreshProfile } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [stats, setStats] = useState<Analytics | null>(null);
  const [profileStats, setProfileStats] = useState<ProfileAnalytics | null>(null);
  const [earnStatus, setEarnStatus] = useState<EarnStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!isCreator) {
      setLoading(false);
      return;
    }
    const [{ data, error }, { data: profileData }, { data: earnData }] = await Promise.all([
      supabase.rpc('creator_analytics'),
      supabase.rpc('creator_profile_analytics'),
      supabase.rpc('get_creator_earn_requirements'),
    ]);
    if (!error) setStats((data as Analytics) ?? null);
    setProfileStats((profileData as ProfileAnalytics) ?? null);
    setEarnStatus((earnData as EarnStatus) ?? null);
    setLoading(false);
    setRefreshing(false);
  }, [isCreator]);

  useFocusEffect(
    useCallback(() => {
      load();
      refreshProfile();
    }, [load, refreshProfile]),
  );

  if (!isCreator) {
    return (
      <ScreenScaffold
        title="Creator"
        onBack={() => navigation.goBack()}
        subtitle="Share original relaxation audio and earn from Premium listening."
      >
        <EmptyBlock
          title="Not a creator yet"
          body="Set up a short bio and payout preference, then start uploading."
        />
        <View style={{ height: 16 }} />
        <PrimaryButton
          label="Become a Creator"
          onPress={() => navigation.navigate('BecomeCreator')}
        />
      </ScreenScaffold>
    );
  }

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.icon} />
      </View>
    );
  }

  return (
    <ScreenScaffold
      title="Creator"
      onBack={() => navigation.goBack()}
      subtitle="Dashboard · pull to refresh"
      contentStyle={{ paddingBottom: 48 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            load();
          }}
          tintColor={colors.icon}
        />
      }
    >
      <View style={styles.heroWrap}>
        <LinearGradient colors={['#1A1410', '#6B5344']} style={styles.hero}>
          <Text style={styles.heroEyebrow}>Earnings</Text>
          <Text style={styles.heroAmount}>
            ${Number(stats?.earnings_usd ?? 0).toFixed(2)}
          </Text>
          <Text style={styles.heroSub}>
            ₦{Number(stats?.earnings_ngn ?? 0).toLocaleString()}
            {stats?.top_sound
              ? ` · Top: ${stats.top_sound.title} (${stats.top_sound.play_count})`
              : ''}
          </Text>
        </LinearGradient>
      </View>

      <SectionLabel>Overview</SectionLabel>
      <View style={styles.grid}>
        {(
          [
            ['Published', String(stats?.published_sounds ?? 0)],
            ['Pending', String(stats?.pending_sounds ?? 0)],
            ['Plays', String(stats?.total_plays ?? 0)],
            ['Favourites', String(stats?.favourites ?? 0)],
            ['Downloads', String(stats?.downloads ?? 0)],
            ['Avg rating', String(stats?.avg_rating ?? '—')],
          ] as const
        ).map(([label, value]) => (
          <View key={label} style={[styles.stat, { borderColor: colors.border }]}>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>{label}</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
          </View>
        ))}
      </View>

      <SectionLabel>Audience</SectionLabel>
      <View style={styles.grid}>
        {(
          [
            ['Followers', String(profileStats?.follower_count ?? 0)],
            ['New · 7d', String(profileStats?.new_followers_7d ?? 0)],
            ['Monthly listeners', String(profileStats?.monthly_listeners ?? 0)],
            ['Likes', String(profileStats?.total_likes ?? 0)],
            ['New likes · 7d', String(profileStats?.new_likes_7d ?? 0)],
            ['Plays · 7d', String(profileStats?.plays_7d ?? 0)],
            ['Saves', String(profileStats?.total_saves ?? 0)],
          ] as const
        ).map(([label, value]) => (
          <View key={label} style={[styles.stat, { borderColor: colors.border }]}>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>{label}</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
          </View>
        ))}
      </View>

      {!earnStatus?.can_earn && earnStatus?.requirements?.length ? (
        <>
          <SectionLabel>Path to earning</SectionLabel>
          <Text
            style={{
              marginHorizontal: 20,
              marginBottom: 10,
              color: colors.textMuted,
              fontFamily: 'DMSans_400Regular',
              fontSize: 13,
            }}
          >
            Track how close you are to Apply to Earn (includes 1,000 likes).
          </Text>
          {earnStatus.requirements
            .filter((r) => r.key !== 'identity')
            .map((req) => {
              const pct = Math.min(
                100,
                Math.round((Number(req.current) / Math.max(1, Number(req.required))) * 100),
              );
              return (
                <View key={req.key} style={[styles.progressCard, { borderColor: colors.border }]}>
                  <View style={styles.progressHead}>
                    <Text style={{ color: colors.text, fontFamily: 'DMSans_700Bold', flex: 1 }}>
                      {req.label}
                    </Text>
                    <Text style={{ color: colors.textMuted, fontFamily: 'DMSans_400Regular', fontSize: 12 }}>
                      {req.current}/{req.required}
                    </Text>
                  </View>
                  <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${pct}%`,
                          backgroundColor: req.met ? '#22C55E' : '#C9A227',
                        },
                      ]}
                    />
                  </View>
                </View>
              );
            })}
        </>
      ) : null}

      {profileStats?.top_countries?.length ? (
        <>
          <SectionLabel>Top listening countries</SectionLabel>
          {profileStats.top_countries.map((row) => (
            <View
              key={row.country_code}
              style={[styles.countryRow, { borderColor: colors.border }]}
            >
              <Text style={{ color: colors.text, fontFamily: 'DMSans_700Bold' }}>
                {row.country_code === 'XX' ? 'Unknown' : row.country_code}
              </Text>
              <Text style={{ color: colors.textMuted, fontFamily: 'DMSans_400Regular' }}>
                {row.plays} plays
              </Text>
            </View>
          ))}
        </>
      ) : null}

      {profileStats?.sounds?.length ? (
        <>
          <SectionLabel>Sound performance</SectionLabel>
          {profileStats.sounds.slice(0, 12).map((s) => (
            <View key={s.id} style={[styles.countryRow, { borderColor: colors.border }]}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={{ color: colors.text, fontFamily: 'DMSans_700Bold' }} numberOfLines={1}>
                  {s.title}
                </Text>
                <Text style={{ color: colors.textMuted, fontFamily: 'DMSans_400Regular', fontSize: 12 }}>
                  {s.status}
                </Text>
              </View>
              <Text style={{ color: colors.textMuted, fontFamily: 'DMSans_400Regular', fontSize: 12 }}>
                {s.play_count} plays · {s.likes} likes · {s.saves} saves
              </Text>
            </View>
          ))}
        </>
      ) : null}

      <PrimaryButton
        label="Upload sound"
        onPress={() => navigation.navigate('CreatorUpload')}
      />
      {user ? (
        <OutlineRow
          label="Public creator profile"
          hint="Banner, followers, and your catalog"
          icon="person-circle-outline"
          onPress={() => navigation.navigate('CreatorProfile', { creatorId: user.id })}
        />
      ) : null}

      <SectionLabel>Listening</SectionLabel>
      <OutlineRow
        label="Playlists"
        hint="Same Library playlists as listeners"
        icon="list-outline"
        onPress={() => navigation.navigate('PlaylistsList')}
      />
      <OutlineRow
        label="Favourite Songs"
        hint="Liked sounds that shape Recommended"
        icon="heart-outline"
        onPress={() => navigation.navigate('FavouritesList')}
      />

      <SectionLabel>Workspace</SectionLabel>
      <OutlineRow
        label="My sounds"
        hint="Status, rejections, and catalog"
        icon="musical-notes-outline"
        onPress={() => navigation.navigate('CreatorSounds')}
      />
      <OutlineRow
        label="Apply to earn"
        hint="Requirements, identity verify, admin approval"
        icon="shield-checkmark-outline"
        onPress={() => navigation.navigate('CreatorVerification')}
      />
      <OutlineRow
        label="Earnings & withdrawals"
        hint="Requires approved Apply to Earn"
        icon="wallet-outline"
        onPress={() => navigation.navigate('CreatorWithdrawals')}
      />

      {isAdmin ? (
        <>
          <SectionLabel>Admin</SectionLabel>
          <OutlineRow
            label="Admin dashboard"
            hint="Payments, moderation, verifications, withdrawals"
            icon="shield-checkmark-outline"
            onPress={() => navigation.navigate('AdminHub')}
          />
          <Pressable
            style={[styles.runBtn, { borderColor: colors.border }]}
            onPress={async () => {
              const { error } = await supabase.functions.invoke('calculate-earnings', {
                body: {},
              });
              if (error) {
                const now = new Date();
                const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
                const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
                await supabase.rpc('calculate_creator_earnings', {
                  p_period_start: start.toISOString().slice(0, 10),
                  p_period_end: end.toISOString().slice(0, 10),
                });
              }
              load();
            }}
          >
            <Text style={{ color: colors.text, fontFamily: 'DMSans_700Bold' }}>
              Run earnings calculation
            </Text>
          </Pressable>
        </>
      ) : null}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  heroWrap: { paddingHorizontal: 20, marginTop: 8, marginBottom: 8 },
  hero: { borderRadius: 22, padding: 22, minHeight: 140, justifyContent: 'flex-end' },
  heroEyebrow: {
    fontFamily: 'DMSans_500Medium',
    color: 'rgba(255,255,255,0.65)',
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  heroAmount: {
    fontFamily: 'Fraunces_700Bold',
    color: '#fff',
    fontSize: 36,
    letterSpacing: -1,
  },
  heroSub: {
    fontFamily: 'DMSans_400Regular',
    color: 'rgba(255,255,255,0.72)',
    fontSize: 13,
    marginTop: 6,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  stat: {
    width: '47%',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 14,
  },
  statLabel: { fontFamily: 'DMSans_400Regular', fontSize: 12 },
  statValue: { fontFamily: 'Fraunces_600SemiBold', fontSize: 22, marginTop: 6 },
  runBtn: {
    marginHorizontal: 20,
    marginTop: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  countryRow: {
    marginHorizontal: 20,
    marginBottom: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  progressCard: {
    marginHorizontal: 20,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 12,
  },
  progressHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: 8,
    borderRadius: 999,
  },
});
