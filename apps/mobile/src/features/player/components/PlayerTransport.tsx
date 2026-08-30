import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ThemeColors } from '../../../lib/theme';

type Props = {
  colors: ThemeColors;
  isPlaying: boolean;
  rate: number;
  hasPrevious: boolean;
  hasNext: boolean;
  onTogglePlay: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onCycleRate: () => void;
};

export function PlayerTransport({
  colors,
  isPlaying,
  rate,
  hasPrevious,
  hasNext,
  onTogglePlay,
  onPrevious,
  onNext,
  onCycleRate,
}: Props) {
  return (
    <View style={styles.row}>
      <Pressable onPress={onCycleRate} style={styles.side} hitSlop={10}>
        <Ionicons name="speedometer-outline" size={22} color={colors.textMuted} />
        <Text style={[styles.rate, { color: colors.textMuted }]}>{rate.toFixed(2)}×</Text>
      </Pressable>
      <Pressable
        onPress={onPrevious}
        style={[styles.seek, { opacity: hasPrevious ? 1 : 0.35 }]}
        disabled={!hasPrevious}
      >
        <Ionicons name="play-skip-back" size={30} color={colors.text} />
      </Pressable>
      <Pressable
        style={[styles.play, { backgroundColor: colors.inverse }]}
        onPress={onTogglePlay}
      >
        <Ionicons
          name={isPlaying ? 'pause' : 'play'}
          size={32}
          color={colors.inverseText}
          style={!isPlaying ? { marginLeft: 3 } : undefined}
        />
      </Pressable>
      <Pressable
        onPress={onNext}
        style={[styles.seek, { opacity: hasNext ? 1 : 0.35 }]}
        disabled={!hasNext}
      >
        <Ionicons name="play-skip-forward" size={30} color={colors.text} />
      </Pressable>
      <View style={styles.side} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
    marginBottom: 16,
  },
  side: { width: 52, alignItems: 'center', justifyContent: 'center' },
  rate: { fontFamily: 'DMSans_500Medium', fontSize: 10, marginTop: 2 },
  seek: { padding: 10 },
  play: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 6,
  },
});
