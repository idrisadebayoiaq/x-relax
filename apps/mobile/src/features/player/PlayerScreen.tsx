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
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppTheme } from '../../lib/useAppTheme';
import { moodPaletteFor } from '../../lib/format';
import { usePlayer } from './PlayerProvider';
import { useMix } from '../mix/MixProvider';
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
  const { width: screenW } = useWindowDimensions();
  const artSize = Math.min(340, screenW - 48);
  const { canDownloadOffline, user, isPremium, canUseMixes, hasUnlimitedListening } = useAuth();
  const {
    current,
    isPlaying,
    positionMs,
    durationMs,
    rate,
    isLooping,
    sleepEndsAt,
    hasNext,
    hasPrevious,
    togglePlay,
    playNext,
    playPrevious,
    seekTo,
    setRate,
    toggleLoop,
    setSleepTimerMinutes,
    toggleFavourite,
    isFavourite,
  } = usePlayer();
  const { isMixActive, layers, mixTitle, seedWithSound } = useMix();

  const [sleepTick, setSleepTick] = useState(0);
  const [avg, setAvg] = useState(0);
  const [ratingCount, setRatingCount] = useState(0);
  const [playCount, setPlayCount] = useState(0);
  const [myScore, setMyScore] = useState(0);
  const [comment, setComment] = useState('');
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [ratingBusy, setRatingBusy] = useState(false);
  const [categoryName, setCategoryName] = useState<string | null>(null);
  const [creatorName, setCreatorName] = useState<string | null>(null);
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

  useEffect(() => {
    if (!current?.creator_id) {
      setCreatorName(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase.rpc('get_creator_public_profile', {
        p_creator_id: current.creator_id,
      });
      if (cancelled) return;
      const profile = data as { display_name?: string | null } | null;
      setCreatorName(profile?.display_name?.trim() || null);
    })();
    return () => {
      cancelled = true;
    };
  }, [current?.creator_id]);

  useEffect(() => {
    if (!current?.id) {
      setCategoryName(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('sound_categories')
        .select('category:categories(name, slug)')
        .eq('sound_id', current.id)
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      const cat = (data as { category?: { name?: string } | { name?: string }[] | null } | null)
        ?.category;
      const row = Array.isArray(cat) ? cat[0] : cat;
      setCategoryName(row?.name ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [current?.id]);

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
          onPress: () => navigation.navigate('Premium'),
        },
      ],
    );
  };

  const promptLoopPremium = () => {
    Alert.alert(
      'Premium feature',
      'Loop is available on Premium so sounds can play continuously. Upgrade to unlock unlimited listening and loop.',
      [
        { text: 'Not now', style: 'cancel' },
        {
          text: 'View Premium',
          onPress: () => navigation.navigate('Premium'),
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
          onPress: () => navigation.navigate('Premium'),
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
      Alert.alert('No playlists', 'Create a playlist in Library first.', [
        { text: 'Not now', style: 'cancel' },
        {
          text: 'Create one',
          onPress: () => navigation.navigate('PlaylistsList'),
        },
      ]);
      return;
    }
    Alert.alert('Add to playlist', 'Choose a playlist', [
      ...data.map((pl) => ({
        text: pl.title,
        onPress: async () => {
          const { count } = await supabase
            .from('playlist_items')
            .select('id', { count: 'exact', head: true })
            .eq('playlist_id', pl.id);
          const position = Number(count ?? 0);
          const { error: insertError } = await supabase.from('playlist_items').upsert(
            {
              playlist_id: pl.id,
              sound_id: current.id,
              position,
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

  if (!current) {
    if (isMixActive) {
      return (
        <View style={[styles.empty, { backgroundColor: colors.background, paddingTop: insets.top + 24 }]}>
          <Text style={{ color: colors.text, fontFamily: 'Fraunces_700Bold', fontSize: 22 }}>
            {mixTitle}
          </Text>
          <Text style={{ color: colors.textMuted, fontFamily: 'DMSans_400Regular', marginTop: 8 }}>
            {layers.length} sound{layers.length === 1 ? '' : 's'} in this mix
          </Text>
          <Pressable
            onPress={() => navigation.replace('MixStudio')}
            style={{ marginTop: 20, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14, backgroundColor: colors.inverse }}
          >
            <Text style={{ color: colors.inverseText, fontFamily: 'DMSans_700Bold' }}>Open Mix Sounds</Text>
          </Pressable>
          <Pressable onPress={() => navigation.goBack()} style={{ marginTop: 16 }}>
            <Text style={{ color: colors.textMuted, fontFamily: 'DMSans_500Medium' }}>Close</Text>
          </Pressable>
        </View>
      );
    }
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
  void playCount;
  const [g0, g1] = moodPaletteFor(current.title);
  void g0;

  const openMixWithCurrent = () => {
    if (!canUseMixes) {
      Alert.alert('Premium feature', 'Mix Sounds is available for Premium listeners.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'View Premium', onPress: () => navigation.navigate('Premium') },
      ]);
      return;
    }
    void seedWithSound(current);
    navigation.navigate('MixStudio', { seedSoundId: current.id });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient
        colors={isDark ? ['#000000', '#0A0A0A', '#000'] : [g1, '#F3F0EA', '#FFF']}
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
          </View>
          <Pressable
            onPress={() =>
              Alert.alert(current.title, undefined, [
                {
                  text: 'Add to playlist',
                  onPress: () => void addToPlaylist(),
                },
                {
                  text: 'Download offline',
                  onPress: () => void downloadCurrent(),
                },
                {
                  text: 'Share',
                  onPress: () => Share.share({ message: `Listen to ${current.title} on X-Relax` }),
                },
                { text: 'Cancel', style: 'cancel' },
              ])
            }
            hitSlop={12}
            style={styles.iconHit}
          >
            <Ionicons name="ellipsis-horizontal" size={22} color={colors.text} />
          </Pressable>
        </View>

        <View style={[styles.artWrap, { width: artSize, alignSelf: 'center' }]}>
          <CoverArt
            title={current.title}
            uri={current.cover_url}
            size={artSize}
            rounded={18}
            style={{ width: artSize, height: artSize, borderRadius: 18 }}
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.15)', 'rgba(0,0,0,0.82)']}
            locations={[0.35, 0.6, 1]}
            style={[StyleSheet.absoluteFill, { borderRadius: 18 }]}
          />
          <Pressable
            onPress={() => void toggleFavourite()}
            style={styles.heartOnArt}
            hitSlop={10}
          >
            <Ionicons
              name={isFavourite ? 'heart' : 'heart-outline'}
              size={22}
              color="#FFFFFF"
            />
          </Pressable>
          <View style={styles.artMeta}>
            <Text style={styles.artTitle} numberOfLines={2}>
              {current.title}
            </Text>
            <Text style={styles.artCategory} numberOfLines={1}>
              {categoryName ?? 'Ambient'}
            </Text>
            {current.creator_id && creatorName ? (
              <Pressable
                onPress={() =>
                  navigation.navigate('CreatorProfile', { creatorId: current.creator_id! })
                }
                hitSlop={8}
              >
                <Text style={styles.artCreator} numberOfLines={1}>
                  {creatorName}
                </Text>
              </Pressable>
            ) : null}
            <View style={styles.artStars}>
              {[1, 2, 3, 4, 5].map((s) => (
                <Ionicons
                  key={s}
                  name={avg >= s - 0.25 ? 'star' : 'star-outline'}
                  size={14}
                  color="#F5C542"
                />
              ))}
              <Text style={styles.artRating}>
                {ratingCount ? `(${avg.toFixed(1)})` : ''}
              </Text>
            </View>
            {current.description?.trim() ? (
              <Text style={styles.artDesc} numberOfLines={3}>
                {current.description.trim()}
              </Text>
            ) : null}
          </View>
        </View>

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
                backgroundColor: '#FFFFFF',
              },
            ]}
          />
          <View
            style={[
              styles.trackKnob,
              {
                left: `${Math.min(98, Math.max(0, progress * 100))}%` as `${number}%`,
                backgroundColor: '#FFFFFF',
              },
            ]}
          />
        </Pressable>
        <View style={styles.timeRow}>
          <Text style={[styles.time, { color: colors.textMuted }]}>{formatMs(positionMs)}</Text>
          <Text style={[styles.time, { color: colors.textMuted }]}>{formatMs(durationMs)}</Text>
        </View>

        <View style={styles.controls}>
          <Pressable
            onPress={() => {
              const next = rate >= 1.5 ? 0.75 : Number((rate + 0.25).toFixed(2));
              void setRate(next);
            }}
            style={styles.sideCtrl}
            hitSlop={10}
          >
            <Ionicons name="shuffle-outline" size={22} color={colors.textMuted} />
          </Pressable>
          <Pressable
            onPress={() => void playPrevious()}
            style={[styles.seek, { opacity: hasPrevious ? 1 : 0.35 }]}
            disabled={!hasPrevious}
          >
            <Ionicons name="play-skip-back" size={30} color={colors.text} />
          </Pressable>
          <Pressable
            style={[styles.playBtn, { backgroundColor: '#FFFFFF' }]}
            onPress={() => void togglePlay()}
          >
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={32}
              color="#000000"
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
          <View style={styles.sideCtrl} />
        </View>

        {/* Timer · Mix · Loop · Share */}
        <View style={styles.bottomActions}>
          <BottomAction
            icon={sleepEndsAt ? 'timer' : 'timer-outline'}
            label={
              sleepRemainingSec != null ? formatSleepRemaining(sleepRemainingSec) : 'Timer'
            }
            active={!!sleepEndsAt}
            onPress={openSleepPicker}
            colors={colors}
          />
          <BottomAction
            icon="git-compare-outline"
            label="Mix"
            onPress={openMixWithCurrent}
            colors={colors}
          />
          <BottomAction
            icon={
              !isPremium
                ? 'lock-closed-outline'
                : isLooping || sleepEndsAt
                  ? 'repeat'
                  : 'repeat-outline'
            }
            label="Loop"
            active={isLooping || !!sleepEndsAt}
            onPress={() => {
              if (!isPremium) {
                promptLoopPremium();
                return;
              }
              void toggleLoop();
            }}
            colors={colors}
          />
          <BottomAction
            icon="share-outline"
            label="Share"
            onPress={() => Share.share({ message: `Listen to ${current.title} on X-Relax` })}
            colors={colors}
          />
        </View>

        {!hasUnlimitedListening ? (
          <Pressable
            onPress={() => navigation.navigate('Premium')}
            style={[
              styles.upgradeBanner,
              {
                borderColor: colors.border,
                backgroundColor: isDark ? 'rgba(201,162,39,0.12)' : 'rgba(201,162,39,0.14)',
              },
            ]}
          >
            <Ionicons name="diamond-outline" size={18} color="#C9A227" />
            <Text style={[styles.upgradeText, { color: colors.text }]}>
              Upgrade to Premium for unlimited listening, loop, downloads, and Sleep Time
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </Pressable>
        ) : null}

        {/* Like · Rate */}
        <View style={[styles.engageCard, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <Pressable
            onPress={() => void toggleFavourite()}
            style={[
              styles.likeRow,
              {
                backgroundColor: isFavourite
                  ? isDark
                    ? 'rgba(239,68,68,0.14)'
                    : 'rgba(239,68,68,0.1)'
                  : isDark
                    ? 'rgba(255,255,255,0.04)'
                    : 'rgba(0,0,0,0.03)',
              },
            ]}
          >
            <Ionicons
              name={isFavourite ? 'heart' : 'heart-outline'}
              size={22}
              color={isFavourite ? '#EF4444' : colors.text}
            />
            <View style={{ flex: 1 }}>
              <Text style={[styles.likeTitle, { color: colors.text }]}>
                {isFavourite ? 'Liked' : 'Like this sound'}
              </Text>
              <Text style={[styles.likeHint, { color: colors.textMuted }]}>
                Saves to Favourites and shapes Recommended
              </Text>
            </View>
            <Ionicons
              name={isFavourite ? 'checkmark-circle' : 'add-circle-outline'}
              size={22}
              color={isFavourite ? '#EF4444' : colors.textMuted}
            />
          </Pressable>

          <View style={[styles.rateDivider, { backgroundColor: colors.border }]} />

          <View style={styles.rateBlock}>
            <View style={styles.rateHeader}>
              <View>
                <Text style={[styles.rateLabel, { color: colors.textMuted }]}>Community rating</Text>
                <View style={styles.communityScore}>
                  <Text style={[styles.ratingAvg, { color: colors.text }]}>
                    {ratingCount ? avg.toFixed(1) : '—'}
                  </Text>
                  <View style={styles.starRow}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Ionicons
                        key={s}
                        name={ratingCount && avg >= s - 0.25 ? 'star' : 'star-outline'}
                        size={14}
                        color="#F5C542"
                      />
                    ))}
                  </View>
                </View>
                <Text style={[styles.ratingCount, { color: colors.textMuted }]}>
                  {ratingCount
                    ? `${ratingCount} rating${ratingCount === 1 ? '' : 's'} · ${playCount.toLocaleString()} plays`
                    : 'No ratings yet — be the first'}
                </Text>
              </View>
            </View>

            <Text style={[styles.yourRateLabel, { color: colors.textMuted }]}>Your rating</Text>
            <View style={styles.myStarRow}>
              {[1, 2, 3, 4, 5].map((score) => (
                <Pressable
                  key={score}
                  onPress={() => setMyScore(score)}
                  hitSlop={6}
                  style={styles.myStarHit}
                >
                  <Ionicons
                    name={myScore >= score ? 'star' : 'star-outline'}
                    size={32}
                    color={myScore >= score ? '#F5C542' : colors.textMuted}
                  />
                </Pressable>
              ))}
            </View>
            <TextInput
              value={comment}
              onChangeText={setComment}
              placeholder="Add a short review (optional)"
              placeholderTextColor={colors.textMuted}
              multiline
              style={[
                styles.reviewInput,
                {
                  color: colors.text,
                  borderColor: colors.border,
                  backgroundColor: isDark ? '#0A0A0A' : colors.background,
                },
              ]}
            />
            <Pressable
              onPress={() => void submitRating()}
              disabled={ratingBusy || myScore < 1}
              style={[
                styles.submitBtn,
                {
                  backgroundColor: colors.inverse,
                  opacity: ratingBusy || myScore < 1 ? 0.45 : 1,
                },
              ]}
            >
              <Text style={[styles.submitText, { color: colors.inverseText }]}>
                {ratingBusy ? 'Saving…' : comment.trim() ? 'Save rating & review' : 'Save rating'}
              </Text>
            </Pressable>
          </View>
        </View>

        {reviews.length > 0 ? (
          <>
            <Text style={[styles.subLabel, { color: colors.textMuted, marginTop: 20 }]}>
              Reviews
            </Text>
            {reviews.map((row) => (
              <View
                key={row.id}
                style={[styles.reviewCard, { borderColor: colors.border, backgroundColor: colors.surface }]}
              >
                <View style={styles.reviewTop}>
                  <Text style={[styles.reviewName, { color: colors.text }]}>
                    {row.profile?.display_name ?? 'Listener'}
                  </Text>
                  <View style={styles.starRow}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Ionicons
                        key={s}
                        name={(row.score ?? 0) >= s ? 'star' : 'star-outline'}
                        size={12}
                        color="#F5C542"
                      />
                    ))}
                  </View>
                </View>
                <Text style={[styles.reviewBody, { color: colors.text }]}>{row.body}</Text>
                <Text style={[styles.reviewDate, { color: colors.textMuted }]}>
                  {new Date(row.created_at).toLocaleDateString()}
                </Text>
              </View>
            ))}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function BottomAction({
  icon,
  label,
  onPress,
  colors,
  active,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  colors: { text: string; textMuted: string };
  active?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={styles.bottomAction}>
      <Ionicons name={icon} size={22} color={active ? colors.text : colors.textMuted} />
      <Text style={[styles.bottomActionLabel, { color: active ? colors.text : colors.textMuted }]}>
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
    fontSize: 11,
    letterSpacing: 1.6,
  },
  artWrap: {
    marginTop: 12,
    marginBottom: 22,
    borderRadius: 18,
    overflow: 'hidden',
    position: 'relative',
  },
  heartOnArt: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  artMeta: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
  },
  artTitle: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 24,
    color: '#FFFFFF',
    letterSpacing: -0.4,
  },
  artCategory: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 4,
  },
  artCreator: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 13,
    color: 'rgba(255,255,255,0.92)',
    marginTop: 4,
    textDecorationLine: 'underline',
  },
  artStars: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 8 },
  artRating: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginLeft: 4,
  },
  artDesc: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: 'rgba(255,255,255,0.78)',
    marginTop: 8,
    lineHeight: 18,
  },
  track: { height: 4, borderRadius: 2, marginTop: 8, justifyContent: 'center' },
  trackFill: { height: 4, borderRadius: 2 },
  trackKnob: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    marginLeft: -7,
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
  bottomActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 18,
    marginBottom: 8,
    paddingVertical: 8,
  },
  bottomAction: { alignItems: 'center', gap: 6, minWidth: 64 },
  bottomActionLabel: { fontFamily: 'DMSans_500Medium', fontSize: 12 },
  upgradeBanner: {
    marginTop: 12,
    marginBottom: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  upgradeText: {
    flex: 1,
    fontFamily: 'DMSans_500Medium',
    fontSize: 13,
    lineHeight: 18,
  },
  subLabel: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 12,
    marginTop: 14,
    marginBottom: 8,
  },
  engageCard: {
    marginTop: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    overflow: 'hidden',
  },
  likeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  likeTitle: { fontFamily: 'DMSans_700Bold', fontSize: 15 },
  likeHint: { fontFamily: 'DMSans_400Regular', fontSize: 12, marginTop: 2 },
  rateDivider: { height: StyleSheet.hairlineWidth, marginHorizontal: 16 },
  rateBlock: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16 },
  rateHeader: { marginBottom: 4 },
  rateLabel: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  communityScore: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ratingAvg: { fontFamily: 'Fraunces_700Bold', fontSize: 36, letterSpacing: -0.8 },
  ratingCount: { fontFamily: 'DMSans_400Regular', fontSize: 13, marginTop: 6 },
  starRow: { flexDirection: 'row', gap: 2, alignItems: 'center' },
  yourRateLabel: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 12,
    marginTop: 16,
    marginBottom: 8,
  },
  myStarRow: { flexDirection: 'row', gap: 6, marginBottom: 4 },
  myStarHit: { padding: 2 },
  reviewInput: {
    marginTop: 12,
    minHeight: 80,
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
