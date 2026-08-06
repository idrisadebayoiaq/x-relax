import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppTheme } from '../../lib/useAppTheme';
import { moodPaletteFor } from '../../lib/format';
import { usePlayer } from './PlayerProvider';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../../lib/supabase';
import { CoverArt } from '../home/CoverArt';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Player'>;

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
  useEffect(() => {
    if (!sleepEndsAt) return;
    const id = setInterval(() => setSleepTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [sleepEndsAt]);

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
      Alert.alert('Premium required', 'Offline downloads are available for Premium users and admins.');
      return;
    }
    const { downloadSoundForOffline, alertDownloadResult } = await import('../../lib/downloads');
    const result = await downloadSoundForOffline(user.id, current);
    alertDownloadResult(result);
  };

  const rateSound = async (score: number) => {
    if (!user || !current) return;
    const { error } = await supabase.from('ratings').upsert({
      user_id: user.id,
      sound_id: current.id,
      score,
      updated_at: new Date().toISOString(),
    });
    if (error) Alert.alert('Rating failed', error.message);
    else Alert.alert('Thanks', `Rated ${score} stars`);
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
        {queue.length > 1 ? (
          <Text style={[styles.queueMeta, { color: colors.textMuted }]}>
            Track {queueIndex + 1} of {queue.length}
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
          <Chip icon="download-outline" label="Download" onPress={downloadCurrent} colors={colors} />
          <Chip
            icon="share-outline"
            label="Share"
            onPress={() => Share.share({ message: `Listen to ${current.title} on X-Relax` })}
            colors={colors}
          />
        </View>

        <Text style={[styles.label, { color: colors.textMuted }]}>Rate</Text>
        <View style={styles.chipRow}>
          {[1, 2, 3, 4, 5].map((score) => (
            <Chip key={score} label={`★${score}`} onPress={() => rateSound(score)} colors={colors} />
          ))}
        </View>
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
});
