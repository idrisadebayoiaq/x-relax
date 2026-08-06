import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppTheme } from '../../lib/useAppTheme';
import { formatPlayCount, formatRatingSummary, moodPaletteFor } from '../../lib/format';
import { usePlayer } from './PlayerProvider';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../../lib/supabase';
import { CoverArt } from '../home/CoverArt';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Player'>;

type ReviewRow = {
  id: string;
  body: string;
  created_at: string;
  user_id: string;
  profile?: { display_name: string | null } | null;
  score?: number | null;
};

function formatSleepRemaining(totalSec: number) {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatMs(ms: number) {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function PlayerScreen({ navigation }: Props) {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { canDownloadOffline, user, isPremium } = useAuth();
  const {
    current,
    isPlaying,
    positionMs,
    durationMs,
    rate,
    isLooping,
    sleepEndsAt,
    queue,
    queueIndex,
    queueLabel,
    hasNext,
    hasPrevious,
    togglePlay,
    playNext,
    playPrevious,
    seekBy,
    setRate,
    toggleLoop,
    setSleepTimerMinutes,
    toggleFavourite,
    isFavourite,
  } = usePlayer();

  const [sleepTick, setSleepTick] = useState(0);
  const [avg, setAvg] = useState(0);
  const [ratingCount, setRatingCount] = useState(0);
  const [playCount, setPlayCount] = useState(0);
  const [myScore, setMyScore] = useState(0);
  const [comment, setComment] = useState('');
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [ratingBusy, setRatingBusy] = useState(false);

  useEffect(() => {
    if (!sleepEndsAt) return;
    const id = setInterval(() => setSleepTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [sleepEndsAt]);

  useEffect(() => {
    if (!current) return;
    setAvg(Number(current.average_rating ?? 0));
    setRatingCount(Number(current.rating_count ?? 0));
    setPlayCount(Number(current.play_count ?? 0));
  }, [current?.id, current?.average_rating, current?.rating_count, current?.play_count]);

  const loadRatings = useCallback(async () => {
    if (!current) return;
    const [{ data: rating }, { data: myReview }, { data: reviewRows }, { data: fresh }] =
      await Promise.all([
        user
          ? supabase
              .from('ratings')
              .select('score')
              .eq('user_id', user.id)
              .eq('sound_id', current.id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        user
          ? supabase
              .from('reviews')
              .select('body')
              .eq('user_id', user.id)
              .eq('sound_id', current.id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        supabase
          .from('reviews')
          .select('id, body, created_at, user_id, profile:profiles(display_name)')
          .eq('sound_id', current.id)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('sounds')
          .select('average_rating, rating_count, play_count')
          .eq('id', current.id)
          .maybeSingle(),
      ]);

    setMyScore(Number((rating as { score?: number } | null)?.score ?? 0));
    setComment((myReview as { body?: string } | null)?.body ?? '');
    if (fresh) {
      setAvg(Number(fresh.average_rating ?? 0));
      setRatingCount(Number(fresh.rating_count ?? 0));
      setPlayCount(Number(fresh.play_count ?? 0));
    }

    const normalized = ((reviewRows ?? []) as unknown as ReviewRow[]).map((row) => ({
      ...row,
      profile: Array.isArray(row.profile) ? row.profile[0] : row.profile,
    }));

    if (normalized.length) {
      const { data: scores } = await supabase
        .from('ratings')
        .select('user_id, score')
        .eq('sound_id', current.id)
        .in(
          'user_id',
          normalized.map((r) => r.user_id),
        );
      const scoreMap = new Map(
        ((scores as { user_id: string; score: number }[]) ?? []).map((s) => [s.user_id, s.score]),
      );
      setReviews(normalized.map((r) => ({ ...r, score: scoreMap.get(r.user_id) ?? null })));
    } else {
      setReviews([]);
    }
  }, [current?.id, user?.id]);

  useEffect(() => {
    void loadRatings();
  }, [loadRatings]);

  const promptSleepTimerPremium = () => {
    Alert.alert(
      'Premium feature',
      'Sleep timer keeps sounds playing until you drift off. Upgrade to Premium to use it.',
      [
        { text: 'Not now', style: 'cancel' },
        {
          text: 'View Premium',
          onPress: () => navigation.navigate('Tabs', { screen: 'Premium' }),
        },
      ],
    );
  };

  const applySleepTimer = (minutes: number | null) => {
    if (minutes != null && !isPremium) {
      promptSleepTimerPremium();
      return;
    }
    setSleepTimerMinutes(minutes);
  };

  const downloadCurrent = async () => {
    if (!user || !current) return;
    if (!canDownloadOffline) {
      Alert.alert('Premium required', 'Offline downloads are available for Premium users and admins.', [
        { text: 'Not now', style: 'cancel' },
        {
          text: 'View Premium',
          onPress: () => navigation.navigate('Tabs', { screen: 'Premium' }),
        },
      ]);
      return;
    }
    const { downloadSoundForOffline, alertDownloadResult } = await import('../../lib/downloads');
    const result = await downloadSoundForOffline(user.id, current);
    alertDownloadResult(result);
  };

  const submitRating = async () => {
    if (!user || !current) {
      Alert.alert('Sign in', 'Sign in to rate sounds.');
      return;
    }
    if (myScore < 1) {
      Alert.alert('Pick a rating', 'Choose how many stars this sound deserves.');
      return;
    }
    setRatingBusy(true);
    const { error: ratingError } = await supabase.from('ratings').upsert({
      user_id: user.id,
      sound_id: current.id,
      score: myScore,
      updated_at: new Date().toISOString(),
    });
    if (ratingError) {
      setRatingBusy(false);
      Alert.alert('Rating failed', ratingError.message);
      return;
    }

    const trimmed = comment.trim();
    if (trimmed) {
      const { error: reviewError } = await supabase.from('reviews').upsert(
        {
          user_id: user.id,
          sound_id: current.id,
          body: trimmed,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,sound_id' },
      );
      if (reviewError) {
        setRatingBusy(false);
        Alert.alert('Review failed', reviewError.message);
        return;
      }
    }

    setRatingBusy(false);
    await loadRatings();
    Alert.alert('Thanks', 'Your rating was saved.');
  };

  const addToPlaylist = async () => {
    if (!user || !current) return;
    const { data, error } = await supabase
      .from('playlists')
      .select('id, title')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });
    if (error) {
      Alert.alert('Playlists', error.message);
      return;
    }
    if (!data?.length) {
      Alert.alert('No playlists', 'Create a playlist in Library first.');
      return;
    }
    Alert.alert('Add to playlist', 'Choose a playlist', [
      ...data.map((pl) => ({
        text: pl.title,
        onPress: async () => {
          const { error: insertError } = await supabase.from('playlist_items').upsert(
            {
              playlist_id: pl.id,
              sound_id: current.id,
              position: 0,
            },
            { onConflict: 'playlist_id,sound_id' },
          );
          if (insertError) Alert.alert('Failed', insertError.message);
          else Alert.alert('Added', `Saved to ${pl.title}`);
        },
      })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  if (!current) {
    return (
      <View style={[styles.empty, { backgroundColor: colors.background, paddingTop: insets.top + 24 }]}>
        <Text style={{ color: colors.textMuted, fontFamily: 'DMSans_400Regular' }}>
          No sound selected
        </Text>
        <Pressable onPress={() => navigation.goBack()} style={{ marginTop: 16 }}>
          <Text style={{ color: colors.text, fontFamily: 'DMSans_700Bold' }}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const progress = durationMs > 0 ? positionMs / durationMs : 0;
  const sleepRemainingSec =
    sleepEndsAt != null ? Math.max(0, Math.floor((sleepEndsAt - Date.now()) / 1000)) : null;
  void sleepTick;
  const [g0, g1] = moodPaletteFor(current.title);
  const ratingLine = formatRatingSummary(avg, ratingCount);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient
        colors={isDark ? [g0, '#000', '#000'] : [g1, '#F3F0EA', '#FFF']}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 24,
          paddingBottom: insets.bottom + 40,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.backRow}>
          <Ionicons name="chevron-down" size={22} color={colors.textMuted} />
          <Text style={[styles.back, { color: colors.textMuted }]}>Close</Text>
        </Pressable>

        <View style={styles.artWrap}>
          <CoverArt title={current.title} uri={current.cover_url} size={280} rounded={24} />
        </View>

        <Text style={[styles.title, { color: colors.text }]}>{current.title}</Text>
        <Text style={[styles.sub, { color: colors.textMuted }]} numberOfLines={3}>
          {current.description ?? 'X-Relax'}
        </Text>
        <Text style={[styles.statsLine, { color: colors.textMuted }]}>
          {formatPlayCount(playCount)}
          {ratingLine ? ` · ${ratingLine}` : ''}
        </Text>
        {queue.length > 1 ? (
          <Text style={[styles.queueMeta, { color: colors.textMuted }]}>
            {queueLabel ? `${queueLabel} · ` : ''}Track {queueIndex + 1} of {queue.length}
          </Text>
        ) : null}

        <View style={[styles.track, { backgroundColor: 'rgba(128,128,128,0.25)' }]}>
          <View
            style={[
              styles.trackFill,
              {
                width: `${Math.min(100, progress * 100)}%` as `${number}%`,
                backgroundColor: colors.text,
              },
            ]}
          />
        </View>
        <View style={styles.timeRow}>
          <Text style={[styles.time, { color: colors.textMuted }]}>{formatMs(positionMs)}</Text>
          <Text style={[styles.time, { color: colors.textMuted }]}>{formatMs(durationMs)}</Text>
        </View>

        <View style={styles.controls}>
          <Pressable
            onPress={() => playPrevious()}
            style={[styles.seek, { opacity: hasPrevious ? 1 : 0.35 }]}
            disabled={!hasPrevious}
          >
            <Ionicons name="play-skip-back" size={26} color={colors.text} />
          </Pressable>
          <Pressable
            style={[styles.playBtn, { backgroundColor: colors.inverse }]}
            onPress={() => togglePlay()}
          >
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={28}
              color={colors.inverseText}
            />
          </Pressable>
          <Pressable
            onPress={() => playNext()}
            style={[styles.seek, { opacity: hasNext ? 1 : 0.35 }]}
            disabled={!hasNext}
          >
            <Ionicons name="play-skip-forward" size={26} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.chipRow}>
          <Chip
            icon="play-back"
            label="-15s"
            onPress={() => seekBy(-15000)}
            colors={colors}
          />
          <Chip
            icon="play-forward"
            label="+15s"
            onPress={() => seekBy(15000)}
            colors={colors}
          />
        </View>

        <View style={styles.chipRow}>
          <Chip
            icon={isLooping || sleepEndsAt ? 'repeat' : 'repeat-outline'}
            label={sleepEndsAt ? 'Loop · sleep' : `Loop ${isLooping ? 'on' : 'off'}`}
            onPress={() => toggleLoop()}
            colors={colors}
            active={isLooping || !!sleepEndsAt}
          />
          <Chip
            icon="speedometer-outline"
            label={`${rate.toFixed(2)}×`}
            onPress={() => setRate(rate >= 1.5 ? 0.75 : Number((rate + 0.25).toFixed(2)))}
            colors={colors}
          />
        </View>

        <Text style={[styles.label, { color: colors.textMuted }]}>Sleep timer</Text>
        {isPremium ? (
          <>
            <View style={styles.chipRow}>
              {[10, 20, 30, 45, 60].map((m) => (
                <Chip
                  key={m}
                  icon="moon-outline"
                  label={`${m}m`}
                  onPress={() => applySleepTimer(m)}
                  colors={colors}
                />
              ))}
              <Chip label="Clear" onPress={() => applySleepTimer(null)} colors={colors} />
            </View>
            {sleepRemainingSec != null ? (
              <Text style={[styles.sleepHint, { color: colors.textMuted }]}>
                Sleep timer · {formatSleepRemaining(sleepRemainingSec)} remaining · sound loops until
                then
              </Text>
            ) : null}
          </>
        ) : (
          <Pressable
            onPress={promptSleepTimerPremium}
            style={[styles.lockedSleep, { borderColor: colors.border }]}
          >
            <Ionicons name="lock-closed-outline" size={16} color={colors.textMuted} />
            <Text style={[styles.lockedSleepText, { color: colors.textMuted }]}>
              Premium only · loops playback until the timer ends
            </Text>
          </Pressable>
        )}

        <Text style={[styles.label, { color: colors.textMuted }]}>Actions</Text>
        <View style={styles.chipRow}>
          <Chip
            icon={isFavourite ? 'heart' : 'heart-outline'}
            label={isFavourite ? 'Saved' : 'Favourite'}
            onPress={() => toggleFavourite()}
            colors={colors}
            active={isFavourite}
          />
          <Chip icon="list-outline" label="Playlist" onPress={addToPlaylist} colors={colors} />
          {canDownloadOffline ? (
            <Chip icon="download-outline" label="Download" onPress={downloadCurrent} colors={colors} />
          ) : (
            <Chip
              icon="lock-closed-outline"
              label="Download · Premium"
              onPress={downloadCurrent}
              colors={colors}
            />
          )}
          <Chip
            icon="share-outline"
            label="Share"
            onPress={() => Share.share({ message: `Listen to ${current.title} on X-Relax` })}
            colors={colors}
          />
        </View>

        <Text style={[styles.label, { color: colors.textMuted }]}>Ratings & reviews</Text>
        <View style={[styles.ratingCard, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <View style={styles.ratingHeader}>
            <View>
              <Text style={[styles.ratingAvg, { color: colors.text }]}>
                {ratingCount ? avg.toFixed(1) : '—'}
              </Text>
              <Text style={[styles.ratingCount, { color: colors.textMuted }]}>
                {ratingCount
                  ? `${ratingCount} rating${ratingCount === 1 ? '' : 's'}`
                  : 'No ratings yet'}
              </Text>
            </View>
            <View style={styles.starRow}>
              {[1, 2, 3, 4, 5].map((s) => (
                <Text
                  key={s}
                  style={{
                    fontSize: 18,
                    color: colors.text,
                    opacity: ratingCount && avg >= s - 0.25 ? 1 : 0.25,
                  }}
                >
                  ★
                </Text>
              ))}
            </View>
          </View>
        </View>

        <Text style={[styles.subLabel, { color: colors.textMuted }]}>Your rating</Text>
        <View style={styles.chipRow}>
          {[1, 2, 3, 4, 5].map((score) => (
            <Chip
              key={score}
              label={'★'.repeat(score)}
              onPress={() => setMyScore(score)}
              colors={colors}
              active={myScore === score}
            />
          ))}
        </View>
        <TextInput
          value={comment}
          onChangeText={setComment}
          placeholder="Write a review (optional)"
          placeholderTextColor={colors.textMuted}
          multiline
          style={[
            styles.reviewInput,
            {
              color: colors.text,
              borderColor: colors.border,
              backgroundColor: colors.surface,
            },
          ]}
        />
        <Pressable
          onPress={() => void submitRating()}
          disabled={ratingBusy}
          style={[styles.submitBtn, { backgroundColor: colors.inverse, opacity: ratingBusy ? 0.6 : 1 }]}
        >
          <Text style={[styles.submitText, { color: colors.inverseText }]}>
            {ratingBusy ? 'Saving…' : 'Submit review'}
          </Text>
        </Pressable>

        <Text style={[styles.subLabel, { color: colors.textMuted, marginTop: 20 }]}>Reviews</Text>
        {reviews.map((row) => (
          <View
            key={row.id}
            style={[styles.reviewCard, { borderColor: colors.border, backgroundColor: colors.surface }]}
          >
            <View style={styles.reviewTop}>
              <Text style={[styles.reviewName, { color: colors.text }]}>
                {row.profile?.display_name ?? 'Listener'}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                {row.score ? '★'.repeat(row.score) : ''}
              </Text>
            </View>
            <Text style={[styles.reviewBody, { color: colors.text }]}>{row.body}</Text>
            <Text style={[styles.reviewDate, { color: colors.textMuted }]}>
              {new Date(row.created_at).toLocaleDateString()}
            </Text>
          </View>
        ))}
        {!reviews.length ? (
          <Text style={{ color: colors.textMuted, fontFamily: 'DMSans_400Regular', fontSize: 13 }}>
            Be the first to leave a review.
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Chip({
  label,
  onPress,
  colors,
  active,
  icon,
}: {
  label: string;
  onPress: () => void;
  colors: { text: string; textMuted: string; border: string; inverse: string; inverseText: string };
  active?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          borderColor: colors.border,
          backgroundColor: active ? colors.inverse : 'transparent',
        },
      ]}
    >
      {icon ? (
        <Ionicons
          name={icon}
          size={14}
          color={active ? colors.inverseText : colors.text}
          style={{ marginRight: 6 }}
        />
      ) : null}
      <Text
        style={{
          color: active ? colors.inverseText : colors.text,
          fontFamily: 'DMSans_500Medium',
          fontSize: 13,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 12 },
  back: { fontFamily: 'DMSans_500Medium', fontSize: 15 },
  artWrap: { alignItems: 'center', marginVertical: 16 },
  title: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 28,
    letterSpacing: -0.6,
    textAlign: 'center',
  },
  sub: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  statsLine: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 8,
  },
  queueMeta: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 16,
  },
  track: { height: 4, borderRadius: 2, overflow: 'hidden' },
  trackFill: { height: 4 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  time: { fontFamily: 'DMSans_400Regular', fontSize: 12 },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 28,
    marginTop: 28,
    marginBottom: 8,
  },
  seek: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 22,
    marginBottom: 10,
  },
  subLabel: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 12,
    marginTop: 14,
    marginBottom: 8,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sleepHint: { fontFamily: 'DMSans_400Regular', fontSize: 12, marginTop: 8 },
  lockedSleep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  lockedSleepText: { flex: 1, fontFamily: 'DMSans_400Regular', fontSize: 13, lineHeight: 18 },
  ratingCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 16,
  },
  ratingHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ratingAvg: { fontFamily: 'Fraunces_700Bold', fontSize: 32, letterSpacing: -0.8 },
  ratingCount: { fontFamily: 'DMSans_400Regular', fontSize: 13, marginTop: 2 },
  starRow: { flexDirection: 'row', gap: 2 },
  reviewInput: {
    marginTop: 12,
    minHeight: 90,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    textAlignVertical: 'top',
  },
  submitBtn: {
    marginTop: 12,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitText: { fontFamily: 'DMSans_700Bold', fontSize: 15 },
  reviewCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  reviewTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginBottom: 6 },
  reviewName: { fontFamily: 'DMSans_700Bold', fontSize: 14 },
  reviewBody: { fontFamily: 'DMSans_400Regular', fontSize: 14, lineHeight: 20 },
  reviewDate: { fontFamily: 'DMSans_400Regular', fontSize: 11, marginTop: 8 },
});
