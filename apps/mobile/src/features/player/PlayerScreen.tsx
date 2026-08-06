import { useCallback, useEffect, useRef, useState } from 'react';
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
    seekTo,
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
  const scrubWidthRef = useRef(1);

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
    const { error: ratingError } = await supabase.from('ratings').upsert(
      {
        user_id: user.id,
        sound_id: current.id,
        score: myScore,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,sound_id' },
    );
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

  const openSleepPicker = () => {
    if (!isPremium) {
      promptSleepTimerPremium();
      return;
    }
    Alert.alert('Sleep timer', 'Sound keeps looping until the timer ends.', [
      ...[10, 20, 30, 45, 60].map((m) => ({
        text: `${m} minutes`,
        onPress: () => applySleepTimer(m),
      })),
      ...(sleepEndsAt
        ? [{ text: 'Clear timer', style: 'destructive' as const, onPress: () => applySleepTimer(null) }]
        : []),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  const cycleRate = () => {
    const next = rate >= 1.5 ? 0.75 : Number((rate + 0.25).toFixed(2));
    void setRate(next);
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
  const subtitle = queueLabel || 'X-Relax';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient
        colors={isDark ? [g0, '#0A0A0A', '#000'] : [g1, '#F3F0EA', '#FFF']}
        locations={[0, 0.42, 1]}
        style={StyleSheet.absoluteFill}
      />
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 4,
          paddingHorizontal: 22,
          paddingBottom: insets.bottom + 36,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.topBar}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.iconHit}>
            <Ionicons name="chevron-down" size={26} color={colors.text} />
          </Pressable>
          <View style={styles.topCenter}>
            <Text style={[styles.playingFrom, { color: colors.textMuted }]}>NOW PLAYING</Text>
            <Text style={[styles.playingTitle, { color: colors.text }]} numberOfLines={1}>
              {subtitle}
            </Text>
          </View>
          <Pressable
            onPress={() => Share.share({ message: `Listen to ${current.title} on X-Relax` })}
            hitSlop={12}
            style={styles.iconHit}
          >
            <Ionicons name="ellipsis-vertical" size={20} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.artWrap}>
          <CoverArt title={current.title} uri={current.cover_url} size={300} rounded={18} />
        </View>

        <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
          {current.title}
        </Text>
        <Text style={[styles.artist, { color: colors.textMuted }]} numberOfLines={1}>
          {current.description?.split('.')[0] || 'Ambient sound · X-Relax'}
        </Text>
        <Text style={[styles.statsLine, { color: colors.textMuted }]}>
          {formatPlayCount(playCount)}
          {ratingLine ? ` · ${ratingLine}` : ''}
          {queue.length > 1 ? ` · ${queueIndex + 1}/${queue.length}` : ''}
        </Text>

        {/* Action row — sleep / loop / speed / favourite / playlist (replaces lyrics/likes style) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.actionRow}
        >
          <ActionPill
            icon={sleepEndsAt ? 'moon' : 'moon-outline'}
            label={
              sleepRemainingSec != null
                ? formatSleepRemaining(sleepRemainingSec)
                : isPremium
                  ? 'Sleep'
                  : 'Sleep'
            }
            active={!!sleepEndsAt}
            onPress={openSleepPicker}
            colors={colors}
            locked={!isPremium && !sleepEndsAt}
          />
          <ActionPill
            icon={isLooping || sleepEndsAt ? 'repeat' : 'repeat-outline'}
            label="Loop"
            active={isLooping || !!sleepEndsAt}
            onPress={() => toggleLoop()}
            colors={colors}
          />
          <ActionPill
            icon="speedometer-outline"
            label={`${rate.toFixed(2)}×`}
            onPress={cycleRate}
            colors={colors}
          />
          <ActionPill
            icon={isFavourite ? 'heart' : 'heart-outline'}
            label="Save"
            active={isFavourite}
            onPress={() => void toggleFavourite()}
            colors={colors}
          />
          <ActionPill
            icon="list-outline"
            label="Playlist"
            onPress={addToPlaylist}
            colors={colors}
          />
          <ActionPill
            icon={canDownloadOffline ? 'download-outline' : 'lock-closed-outline'}
            label="Offline"
            onPress={() => void downloadCurrent()}
            colors={colors}
          />
          <ActionPill
            icon="share-outline"
            label="Share"
            onPress={() => Share.share({ message: `Listen to ${current.title} on X-Relax` })}
            colors={colors}
          />
        </ScrollView>

        <Pressable
          style={[styles.track, { backgroundColor: 'rgba(128,128,128,0.28)' }]}
          onLayout={(e) => {
            scrubWidthRef.current = e.nativeEvent.layout.width || 1;
          }}
          onPress={(e) => {
            if (!durationMs) return;
            const w = scrubWidthRef.current || 1;
            const ratio = Math.min(1, Math.max(0, e.nativeEvent.locationX / w));
            void seekTo(ratio * durationMs);
          }}
        >
          <View
            style={[
              styles.trackFill,
              {
                width: `${Math.min(100, progress * 100)}%` as `${number}%`,
                backgroundColor: colors.text,
              },
            ]}
          />
          <View
            style={[
              styles.trackKnob,
              {
                left: `${Math.min(98, Math.max(0, progress * 100))}%` as `${number}%`,
                backgroundColor: colors.text,
              },
            ]}
          />
        </Pressable>
        <View style={styles.timeRow}>
          <Text style={[styles.time, { color: colors.textMuted }]}>{formatMs(positionMs)}</Text>
          <Text style={[styles.time, { color: colors.textMuted }]}>{formatMs(durationMs)}</Text>
        </View>

        <View style={styles.controls}>
          <Pressable onPress={cycleRate} style={styles.sideCtrl} hitSlop={10}>
            <Ionicons name="shuffle-outline" size={22} color={colors.textMuted} />
            <Text style={[styles.rateBadge, { color: colors.textMuted }]}>{rate.toFixed(2)}×</Text>
          </Pressable>
          <Pressable
            onPress={() => void playPrevious()}
            style={[styles.seek, { opacity: hasPrevious ? 1 : 0.35 }]}
            disabled={!hasPrevious}
          >
            <Ionicons name="play-skip-back" size={30} color={colors.text} />
          </Pressable>
          <Pressable
            style={[styles.playBtn, { backgroundColor: isDark ? '#FFF' : colors.inverse }]}
            onPress={() => void togglePlay()}
          >
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={32}
              color={isDark ? '#000' : colors.inverseText}
              style={!isPlaying ? { marginLeft: 3 } : undefined}
            />
          </Pressable>
          <Pressable
            onPress={() => void playNext()}
            style={[styles.seek, { opacity: hasNext ? 1 : 0.35 }]}
            disabled={!hasNext}
          >
            <Ionicons name="play-skip-forward" size={30} color={colors.text} />
          </Pressable>
          <Pressable
            onPress={() => toggleLoop()}
            style={styles.sideCtrl}
            hitSlop={10}
          >
            <Ionicons
              name={isLooping || sleepEndsAt ? 'repeat' : 'repeat-outline'}
              size={24}
              color={isLooping || sleepEndsAt ? colors.text : colors.textMuted}
            />
          </Pressable>
        </View>

        <View style={styles.seekChipRow}>
          <Pressable
            onPress={() => void seekBy(-15000)}
            style={[styles.seekChip, { borderColor: colors.border }]}
          >
            <Text style={{ color: colors.text, fontFamily: 'DMSans_500Medium', fontSize: 13 }}>-15s</Text>
          </Pressable>
          <Pressable
            onPress={() => void seekBy(15000)}
            style={[styles.seekChip, { borderColor: colors.border }]}
          >
            <Text style={{ color: colors.text, fontFamily: 'DMSans_500Medium', fontSize: 13 }}>+15s</Text>
          </Pressable>
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

function ActionPill({
  icon,
  label,
  onPress,
  colors,
  active,
  locked,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  colors: {
    text: string;
    textMuted: string;
    border: string;
    inverse: string;
    inverseText: string;
    surface: string;
  };
  active?: boolean;
  locked?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.actionPill,
        {
          borderColor: active ? colors.text : colors.border,
          backgroundColor: active
            ? colors.inverse === '#FFF'
              ? 'rgba(255,255,255,0.12)'
              : 'rgba(0,0,0,0.06)'
            : colors.surface,
        },
      ]}
    >
      <Ionicons name={icon} size={18} color={active ? colors.text : colors.textMuted} />
      {locked ? (
        <Ionicons
          name="lock-closed"
          size={10}
          color={colors.textMuted}
          style={{ position: 'absolute', top: 6, right: 6 }}
        />
      ) : null}
      <Text style={[styles.actionLabel, { color: colors.text }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  iconHit: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topCenter: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  playingFrom: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 10,
    letterSpacing: 1.4,
  },
  playingTitle: { fontFamily: 'DMSans_700Bold', fontSize: 13, marginTop: 2 },
  artWrap: { alignItems: 'center', marginTop: 12, marginBottom: 22 },
  title: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 26,
    letterSpacing: -0.5,
    textAlign: 'left',
  },
  artist: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    marginTop: 6,
  },
  statsLine: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 12,
    marginTop: 6,
    marginBottom: 14,
  },
  actionRow: { gap: 10, paddingVertical: 4, paddingRight: 8 },
  actionPill: {
    width: 76,
    height: 64,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 6,
  },
  actionLabel: { fontFamily: 'DMSans_500Medium', fontSize: 11 },
  track: { height: 4, borderRadius: 2, marginTop: 18, justifyContent: 'center' },
  trackFill: { height: 4, borderRadius: 2 },
  trackKnob: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    marginLeft: -6,
  },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  time: { fontFamily: 'DMSans_400Regular', fontSize: 12 },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 22,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sideCtrl: { width: 44, alignItems: 'center', justifyContent: 'center', gap: 2 },
  rateBadge: { fontFamily: 'DMSans_500Medium', fontSize: 10 },
  seek: {
    width: 48,
    height: 48,
    borderRadius: 24,
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
  seekChipRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 10,
    marginBottom: 8,
  },
  seekChip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 8,
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
