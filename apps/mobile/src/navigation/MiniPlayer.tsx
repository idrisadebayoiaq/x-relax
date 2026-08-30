import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../lib/useAppTheme';
import { usePlayer } from '../features/player/PlayerProvider';
import { useMix } from '../features/mix/MixProvider';
import { CoverArt } from '../features/home/CoverArt';
import { supabase } from '../lib/supabase';
import { navigationRef } from './navigationRef';
import { useAudioOutputRoute } from '../lib/useAudioOutputRoute';
import { AudioOutputBadge } from '../features/player/components/AudioOutputBadge';
import type { RootStackParamList } from './types';

type Props = {
  bottomOffset?: number;
  floating?: boolean;
};

function navigateTo<Name extends keyof RootStackParamList>(
  name: Name,
  params?: RootStackParamList[Name],
) {
  if (!navigationRef.isReady()) return;
  // @ts-expect-error flexible navigate
  navigationRef.navigate(name, params);
}

/** Mini-player — expandable, minimizable; resumes paused position after app reopen. */
export function MiniPlayer({ bottomOffset = 0, floating = false }: Props) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const audioRoute = useAudioOutputRoute();
  const {
    current,
    isPlaying,
    togglePlay,
    playNext,
    playPrevious,
    hasNext,
    hasPrevious,
    queueLabel,
    dismissMiniPlayer,
    isMiniPlayerMinimized,
    minimizeMiniPlayer,
  } = usePlayer();
  const { isMixActive, isMixPlaying, layers, mixTitle, mixId, toggleMixPlay } = useMix();
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

  const wrapStyle = [
    styles.wrap,
    floating
      ? {
          position: 'absolute' as const,
          left: 0,
          right: 0,
          bottom: bottomOffset + Math.max(insets.bottom, 8),
          zIndex: 50,
        }
      : null,
  ];

  const renderMinimized = (title: string, onExpand: () => void, onToggle: () => void, playing: boolean) => (
    <View style={wrapStyle} pointerEvents="box-none">
      <View style={[styles.miniChip, { backgroundColor: colors.elevated, borderColor: colors.border }]}>
        <Pressable onPress={onExpand} style={styles.miniMain}>
          <CoverArt title={title} uri={current?.cover_url ?? layers[0]?.sound.cover_url} size={32} rounded={8} />
          <View style={styles.miniCopy}>
            <Text style={[styles.miniTitle, { color: colors.text }]} numberOfLines={1}>
              {title}
            </Text>
            <AudioOutputBadge route={audioRoute} colors={colors} compact />
          </View>
        </Pressable>
        <Pressable
          onPress={() => void onToggle()}
          hitSlop={6}
          style={[styles.miniPlay, { backgroundColor: colors.inverse }]}
        >
          <Ionicons
            name={playing ? 'pause' : 'play'}
            size={16}
            color={colors.inverseText}
            style={playing ? undefined : { marginLeft: 2 }}
          />
        </Pressable>
        <Pressable onPress={onExpand} hitSlop={8} style={styles.ctrlHit}>
          <Ionicons name="chevron-up" size={18} color={colors.textMuted} />
        </Pressable>
      </View>
    </View>
  );

  if (showingMix) {
    const cover = layers[0]?.sound;
    const subtitle = `${layers.length} sound${layers.length === 1 ? '' : 's'}`;

    if (isMiniPlayerMinimized) {
      return renderMinimized(
        mixTitle,
        () => navigateTo('MixStudio', mixId ? { mixId } : undefined),
        () => void toggleMixPlay(),
        isMixPlaying,
      );
    }

    return (
      <View style={wrapStyle} pointerEvents="box-none">
        <View style={[styles.bar, { backgroundColor: colors.elevated, borderColor: colors.border }]}>
          <Pressable
            onPress={() => navigateTo('MixStudio', mixId ? { mixId } : undefined)}
            style={styles.mainHit}
          >
            <Pressable onPress={minimizeMiniPlayer} hitSlop={8} style={styles.ctrlHit}>
              <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
            </Pressable>
            <CoverArt title={cover?.title ?? mixTitle} uri={cover?.cover_url} size={44} rounded={10} />
            <View style={styles.copy}>
              <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                {mixTitle}
              </Text>
              <Text style={[styles.sub, { color: colors.textMuted }]} numberOfLines={1}>
                Mix · {subtitle}
              </Text>
              <AudioOutputBadge route={audioRoute} colors={colors} compact />
            </View>
          </Pressable>
          <Pressable
            onPress={() => void toggleMixPlay()}
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
          <Pressable
            onPress={() => void dismissMiniPlayer()}
            hitSlop={8}
            style={styles.ctrlHit}
            accessibilityLabel="Stop and close"
          >
            <Ionicons name="close" size={18} color={colors.textMuted} />
          </Pressable>
        </View>
      </View>
    );
  }

  if (!current) return null;

  if (isMiniPlayerMinimized) {
    return renderMinimized(
      current.title,
      () => navigateTo('Player', { soundId: current.id }),
      () => void togglePlay(),
      isPlaying,
    );
  }

  const subtitle =
    queueLabel?.trim() ||
    (creatorName && current.creator_id ? creatorName : 'Now playing');

  return (
    <View style={wrapStyle} pointerEvents="box-none">
      <View style={[styles.bar, { backgroundColor: colors.elevated, borderColor: colors.border }]}>
        <Pressable
          onPress={() => navigateTo('Player', { soundId: current.id })}
          style={styles.mainHit}
        >
          <Pressable onPress={minimizeMiniPlayer} hitSlop={8} style={styles.ctrlHit}>
            <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
          </Pressable>
          <CoverArt title={current.title} uri={current.cover_url} size={44} rounded={10} />
          <View style={styles.copy}>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
              {current.title}
            </Text>
            {creatorName && current.creator_id && !queueLabel?.trim() ? (
              <Pressable
                onPress={() =>
                  navigateTo('CreatorProfile', { creatorId: current.creator_id! })
                }
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
            <AudioOutputBadge route={audioRoute} colors={colors} compact />
          </View>
        </Pressable>
        <View style={styles.controls}>
          <Pressable
            onPress={() => void playPrevious()}
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
            onPress={() => void togglePlay()}
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
            onPress={() => void playNext()}
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
          <Pressable
            onPress={() => void dismissMiniPlayer()}
            hitSlop={8}
            style={styles.ctrlHit}
            accessibilityLabel="Stop and close"
          >
            <Ionicons name="close" size={18} color={colors.textMuted} />
          </Pressable>
        </View>
      </View>
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
    gap: 6,
  },
  miniChip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-end',
    maxWidth: '92%',
  },
  miniMain: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 },
  miniCopy: { flex: 1, minWidth: 0, gap: 2 },
  miniTitle: { fontFamily: 'DMSans_700Bold', fontSize: 13 },
  miniPlay: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainHit: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontFamily: 'DMSans_700Bold', fontSize: 14 },
  sub: { fontFamily: 'DMSans_400Regular', fontSize: 12 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 2 },
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
