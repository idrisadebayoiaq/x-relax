import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useEffect, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../lib/useAppTheme';
import { usePlayer } from '../features/player/PlayerProvider';
import { useMix } from '../features/mix/MixProvider';
import { CoverArt } from '../features/home/CoverArt';
import { supabase } from '../lib/supabase';
import type { RootStackParamList } from './types';

/** Mini-player above the tab bar — single sound or active Mix. */
export function MiniPlayer() {
  const { colors, isDark } = useAppTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {
    current,
    isPlaying,
    togglePlay,
    playNext,
    playPrevious,
    hasNext,
    hasPrevious,
    queueLabel,
  } = usePlayer();
  const {
    isMixActive,
    isMixPlaying,
    layers,
    mixTitle,
    mixId,
    toggleMixPlay,
  } = useMix();

  const [creatorName, setCreatorName] = useState<string | null>(null);

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

  const showingMix = isMixActive && (isMixPlaying || !current);
  if (!current && !showingMix) return null;

  if (showingMix) {
    const cover = layers[0]?.sound;
    const subtitle = `${layers.length} sound${layers.length === 1 ? '' : 's'}`;
    return (
      <View style={styles.wrap}>
        <Pressable
          onPress={() =>
            navigation.navigate('MixStudio', mixId ? { mixId } : undefined)
          }
          style={[
            styles.bar,
            {
              backgroundColor: isDark ? '#161616' : '#F4F4F4',
              borderColor: colors.border,
            },
          ]}
        >
          <Ionicons name="chevron-up" size={18} color={colors.textMuted} />
          <CoverArt
            title={cover?.title ?? mixTitle}
            uri={cover?.cover_url}
            size={44}
            rounded={10}
          />
          <View style={styles.copy}>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
              {mixTitle}
            </Text>
            <Text style={[styles.sub, { color: colors.textMuted }]} numberOfLines={1}>
              Mix · {subtitle}
            </Text>
          </View>
          <Pressable
            onPress={(e) => {
              e.stopPropagation?.();
              void toggleMixPlay();
            }}
            hitSlop={6}
            style={[styles.playBtn, { backgroundColor: colors.inverse }]}
          >
            <Ionicons
              name={isMixPlaying ? 'pause' : 'play'}
              size={18}
              color={colors.inverseText}
              style={isMixPlaying ? undefined : { marginLeft: 2 }}
            />
          </Pressable>
        </Pressable>
      </View>
    );
  }

  if (!current) return null;
  const subtitle =
    queueLabel?.trim() ||
    (creatorName && current.creator_id ? creatorName : 'Now playing');

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => navigation.navigate('Player', { soundId: current.id })}
        style={[
          styles.bar,
          {
            backgroundColor: isDark ? '#161616' : '#F4F4F4',
            borderColor: colors.border,
          },
        ]}
      >
        <Ionicons name="chevron-up" size={18} color={colors.textMuted} />
        <CoverArt title={current.title} uri={current.cover_url} size={44} rounded={10} />
        <View style={styles.copy}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {current.title}
          </Text>
          {creatorName && current.creator_id && !queueLabel?.trim() ? (
            <Pressable
              onPress={(e) => {
                e.stopPropagation?.();
                navigation.navigate('CreatorProfile', { creatorId: current.creator_id! });
              }}
              hitSlop={6}
            >
              <Text style={[styles.sub, { color: colors.textMuted }]} numberOfLines={1}>
                {subtitle}
              </Text>
            </Pressable>
          ) : (
            <Text style={[styles.sub, { color: colors.textMuted }]} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>
        <View style={styles.controls}>
          <Pressable
            onPress={(e) => {
              e.stopPropagation?.();
              void playPrevious();
            }}
            hitSlop={8}
            disabled={!hasPrevious}
            style={styles.ctrlHit}
          >
            <Ionicons
              name="play-skip-back"
              size={18}
              color={hasPrevious ? colors.text : colors.textMuted}
            />
          </Pressable>
          <Pressable
            onPress={(e) => {
              e.stopPropagation?.();
              void togglePlay();
            }}
            hitSlop={6}
            style={[styles.playBtn, { backgroundColor: colors.inverse }]}
          >
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={18}
              color={colors.inverseText}
              style={isPlaying ? undefined : { marginLeft: 2 }}
            />
          </Pressable>
          <Pressable
            onPress={(e) => {
              e.stopPropagation?.();
              void playNext();
            }}
            hitSlop={8}
            disabled={!hasNext}
            style={styles.ctrlHit}
          >
            <Ionicons
              name="play-skip-forward"
              size={18}
              color={hasNext ? colors.text : colors.textMuted}
            />
          </Pressable>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 12,
    paddingBottom: 8,
    backgroundColor: 'transparent',
  },
  bar: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  copy: { flex: 1, minWidth: 0 },
  title: { fontFamily: 'DMSans_700Bold', fontSize: 14 },
  sub: { fontFamily: 'DMSans_400Regular', fontSize: 12, marginTop: 2 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ctrlHit: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 2,
  },
});
