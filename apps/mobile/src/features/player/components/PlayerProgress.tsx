import { useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ThemeColors } from '../../../lib/theme';

type Props = {
  colors: ThemeColors;
  positionMs: number;
  durationMs: number;
  onSeek: (ms: number) => void;
};

function formatMs(ms: number) {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function PlayerProgress({ colors, positionMs, durationMs, onSeek }: Props) {
  const scrubWidthRef = useRef(1);
  const progress = durationMs > 0 ? positionMs / durationMs : 0;

  return (
    <View>
      <Pressable
        style={[styles.track, { backgroundColor: colors.elevated }]}
        onLayout={(e) => {
          scrubWidthRef.current = e.nativeEvent.layout.width || 1;
        }}
        onPress={(e) => {
          if (!durationMs) return;
          const w = scrubWidthRef.current || 1;
          const ratio = Math.min(1, Math.max(0, e.nativeEvent.locationX / w));
          onSeek(ratio * durationMs);
        }}
      >
        <View
          style={[
            styles.fill,
            {
              width: `${Math.min(100, progress * 100)}%` as `${number}%`,
              backgroundColor: colors.accent,
            },
          ]}
        />
        <View
          style={[
            styles.knob,
            {
              left: `${Math.min(98, Math.max(0, progress * 100))}%` as `${number}%`,
              backgroundColor: colors.accent,
              borderColor: colors.background,
            },
          ]}
        />
      </Pressable>
      <View style={styles.timeRow}>
        <Text style={[styles.time, { color: colors.textMuted }]}>{formatMs(positionMs)}</Text>
        <Text style={[styles.time, { color: colors.textMuted }]}>{formatMs(durationMs)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 6,
    borderRadius: 3,
    overflow: 'visible',
    position: 'relative',
  },
  fill: { height: '100%', borderRadius: 3 },
  knob: {
    position: 'absolute',
    top: -5,
    width: 16,
    height: 16,
    borderRadius: 8,
    marginLeft: -8,
    borderWidth: 2,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 4,
  },
  time: { fontFamily: 'DMSans_500Medium', fontSize: 12 },
});
