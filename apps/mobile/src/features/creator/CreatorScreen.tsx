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

export function CreatorScreen() {
  const { colors } = useAppTheme();
  const { isCreator, isAdmin, refreshProfile } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [stats, setStats] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!isCreator) {
      setLoading(false);
      return;
    }
    const { data, error } = await supabase.rpc('creator_analytics');
    if (!error) setStats((data as Analytics) ?? null);
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

      <PrimaryButton
        label="Upload sound"
        onPress={() => navigation.navigate('CreatorUpload')}
      />

      <SectionLabel>Workspace</SectionLabel>
      <OutlineRow
        label="My sounds"
        hint="Status, rejections, and catalog"
        icon="musical-notes-outline"
        onPress={() => navigation.navigate('CreatorSounds')}
      />
      <OutlineRow
        label="Verification"
        hint="Unlock verified creator status"
        icon="shield-checkmark-outline"
        onPress={() => navigation.navigate('CreatorVerification')}
      />
      <OutlineRow
        label="Earnings & withdrawals"
        hint="History and payout requests"
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
});
