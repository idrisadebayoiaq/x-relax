import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppTheme } from '../../lib/useAppTheme';
import { moodPaletteFor } from '../../lib/format';
import { usePlayer } from './PlayerProvider';
import { useMix } from '../mix/MixProvider';
import { useAuth } from '../auth/AuthProvider';
import { useDownloads } from '../downloads/DownloadProvider';
import { supabase } from '../../lib/supabase';
import type { RootStackParamList } from '../../navigation/types';
import { appAlert } from '../../ui/appAlert';
import { useAudioOutputRoute } from '../../lib/useAudioOutputRoute';
import { PlayerHeader } from './components/PlayerHeader';
import { PlayerArtwork } from './components/PlayerArtwork';
import { PlayerProgress } from './components/PlayerProgress';
import { PlayerTransport } from './components/PlayerTransport';
import { PlayerQuickActions } from './components/PlayerQuickActions';
import { PlayerReviewsSection, type ReviewRow } from './components/PlayerReviewsSection';

type Props = NativeStackScreenProps<RootStackParamList, 'Player'>;

function formatSleepRemaining(totalSec: number) {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function PlayerScreen({ navigation }: Props) {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const artSize = Math.min(340, screenW - 48);
  const { canDownloadOffline, user, isPremium, canUseMixes, hasUnlimitedListening } = useAuth();
  const { startDownload, isDownloading } = useDownloads();
  const audioRoute = useAudioOutputRoute();
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
    queueLabel,
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
    appAlert(
      'Premium feature',
      'Sleep timer keeps sounds playing until you drift off. Upgrade to Premium to use it.',
      [
        { text: 'Not now', style: 'cancel' },
        { text: 'View Premium', onPress: () => navigation.navigate('Premium') },
      ],
    );
  };

  const promptLoopPremium = () => {
    appAlert(
      'Premium feature',
      'Loop is available on Premium so sounds can play continuously.',
      [
        { text: 'Not now', style: 'cancel' },
        { text: 'View Premium', onPress: () => navigation.navigate('Premium') },
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
      appAlert('Premium required', 'Offline downloads are available for Premium users and admins.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'View Premium', onPress: () => navigation.navigate('Premium') },
      ]);
      return;
    }
    await startDownload(user.id, current);
  };

  const submitRating = async () => {
    if (!user || !current) {
      appAlert('Sign in', 'Sign in to rate sounds.');
      return;
    }
    if (myScore < 1) {
      appAlert('Pick a rating', 'Choose how many stars this sound deserves.');
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
      appAlert('Rating failed', ratingError.message);
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
        appAlert('Review failed', reviewError.message);
        return;
      }
    }

    setRatingBusy(false);
    await loadRatings();
    appAlert('Thanks', 'Your rating was saved.');
  };

  const addToPlaylist = async () => {
    if (!user || !current) return;
    const { data, error } = await supabase
      .from('playlists')
      .select('id, title')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });
    if (error) {
      appAlert('Playlists', error.message);
      return;
    }
    if (!data?.length) {
      appAlert('No playlists', 'Create a playlist in Library first.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Create one', onPress: () => navigation.navigate('PlaylistsList') },
      ]);
      return;
    }
    appAlert('Add to playlist', 'Choose a playlist', [
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
          if (insertError) appAlert('Failed', insertError.message);
          else appAlert('Added', `Saved to ${pl.title}`);
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
    appAlert('Sleep timer', 'Sound keeps looping until the timer ends.', [
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

  const openPlayerMenu = () => {
    if (!current) return;
    appAlert(current.title, undefined, [
      { text: 'Add to playlist', onPress: () => void addToPlaylist() },
      { text: 'Download offline', onPress: () => void downloadCurrent() },
      {
        text: 'Share',
        onPress: () => Share.share({ message: `Listen to ${current.title} on X-Relax` }),
      },
      { text: 'Cancel', style: 'cancel' },
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
            style={{
              marginTop: 20,
              paddingHorizontal: 20,
              paddingVertical: 12,
              borderRadius: 14,
              backgroundColor: colors.inverse,
            }}
          >
            <Text style={{ color: colors.inverseText, fontFamily: 'DMSans_700Bold' }}>
              Open Mix Sounds
            </Text>
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

  const sleepRemainingSec =
    sleepEndsAt != null ? Math.max(0, Math.floor((sleepEndsAt - Date.now()) / 1000)) : null;
  void sleepTick;
  const [, g1] = moodPaletteFor(current.title);

  const openMixWithCurrent = () => {
    if (!canUseMixes) {
      appAlert('Premium feature', 'Mix Sounds is available for Premium listeners.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'View Premium', onPress: () => navigation.navigate('Premium') },
      ]);
      return;
    }
    void seedWithSound(current);
    navigation.navigate('MixStudio', { seedSoundId: current.id });
  };

  const cycleRate = () => {
    const next = rate >= 1.5 ? 0.75 : Number((rate + 0.25).toFixed(2));
    void setRate(next);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient
        colors={
          isDark
            ? [colors.background, colors.gradientTop, colors.background]
            : [g1, colors.gradientTop, colors.background]
        }
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
        <PlayerHeader
          colors={colors}
          queueLabel={queueLabel ?? undefined}
          audioRoute={audioRoute}
          onBack={() => navigation.goBack()}
          onMenu={openPlayerMenu}
        />

        <PlayerArtwork
          sound={current}
          artSize={artSize}
          categoryName={categoryName}
          creatorName={creatorName}
          avg={avg}
          ratingCount={ratingCount}
          isFavourite={isFavourite}
          onToggleFavourite={() => void toggleFavourite()}
          onCreatorPress={
            current.creator_id
              ? () => navigation.navigate('CreatorProfile', { creatorId: current.creator_id! })
              : undefined
          }
        />

        <PlayerProgress
          colors={colors}
          positionMs={positionMs}
          durationMs={durationMs}
          onSeek={(ms) => void seekTo(ms)}
        />

        <PlayerTransport
          colors={colors}
          isPlaying={isPlaying}
          rate={rate}
          hasPrevious={hasPrevious}
          hasNext={hasNext}
          onTogglePlay={() => void togglePlay()}
          onPrevious={() => void playPrevious()}
          onNext={() => void playNext()}
          onCycleRate={cycleRate}
        />

        <PlayerQuickActions
          colors={colors}
          isPremium={isPremium}
          isLooping={isLooping}
          sleepEndsAt={sleepEndsAt}
          sleepLabel={
            sleepRemainingSec != null ? formatSleepRemaining(sleepRemainingSec) : 'Timer'
          }
          isDownloading={isDownloading(current.id)}
          shareTitle={current.title}
          onTimer={openSleepPicker}
          onMix={openMixWithCurrent}
          onLoop={() => {
            if (!isPremium) {
              promptLoopPremium();
              return;
            }
            void toggleLoop();
          }}
          onDownload={() => void downloadCurrent()}
        />

        {!hasUnlimitedListening ? (
          <Pressable
            onPress={() => navigation.navigate('Premium')}
            style={[
              styles.upgradeBanner,
              { borderColor: colors.border, backgroundColor: colors.accentSoft },
            ]}
          >
            <Text style={[styles.upgradeText, { color: colors.text }]}>
              Upgrade for unlimited listening, loop, downloads & Sleep Time
            </Text>
          </Pressable>
        ) : null}

        <PlayerReviewsSection
          colors={colors}
          isDark={isDark}
          avg={avg}
          ratingCount={ratingCount}
          playCount={playCount}
          myScore={myScore}
          comment={comment}
          reviews={reviews}
          ratingBusy={ratingBusy}
          isFavourite={isFavourite}
          onToggleFavourite={() => void toggleFavourite()}
          onSetScore={setMyScore}
          onChangeComment={setComment}
          onSubmit={() => void submitRating()}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  upgradeBanner: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  upgradeText: { fontFamily: 'DMSans_500Medium', fontSize: 13, lineHeight: 18 },
});
