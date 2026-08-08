import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../lib/useAppTheme';
import { formatDuration, formatPlayCount, formatRatingSummary, moodPaletteFor } from '../lib/format';
import { CoverArt } from '../features/home/CoverArt';
import type { Sound } from '../types/database';

export function SoundCard({
  sound,
  onPress,
  compact,
}: {
  sound: Sound;
  onPress: () => void;
  compact?: boolean;
}) {
  const { colors } = useAppTheme();
  const size = compact ? 120 : 148;
  const rating = formatRatingSummary(sound.average_rating, sound.rating_count);
  const meta = [formatDuration(sound.duration_seconds), formatPlayCount(sound.play_count), rating]
    .filter((part) => part && part !== '—')
    .join(' · ');

  if (compact) {
    return (
      <Pressable style={styles.compact} onPress={onPress}>
        <CoverArt title={sound.title} uri={sound.cover_url} size={size} rounded={16} />
        <Text style={[styles.compactTitle, { color: colors.text }]} numberOfLines={2}>
          {sound.title}
        </Text>
        <Text style={[styles.meta, { color: colors.textMuted }]} numberOfLines={1}>
          {meta}
        </Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      style={[styles.rowCard, { borderColor: colors.border, backgroundColor: colors.surface }]}
      onPress={onPress}
    >
      <CoverArt title={sound.title} uri={sound.cover_url} size={56} rounded={12} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
          {sound.title}
        </Text>
        <Text style={[styles.meta, { color: colors.textMuted }]} numberOfLines={1}>
          {meta}
        </Text>
      </View>
      <View style={[styles.play, { backgroundColor: colors.inverse }]}>
        <Ionicons name="play" size={14} color={colors.inverseText} />
      </View>
    </Pressable>
  );
}

export function CategoryCard({
  name,
  slug,
  coverUrl,
  onPress,
}: {
  name: string;
  slug?: string;
  coverUrl?: string | null;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  const [a, b] = moodPaletteFor(slug || name);

  return (
    <Pressable style={styles.cat} onPress={onPress}>
      <View style={styles.catArt}>
        {coverUrl ? (
          <Image source={{ uri: coverUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <LinearGradient colors={[a, b]} style={StyleSheet.absoluteFill} />
        )}
      </View>
      <Text style={[styles.catLabel, { color: colors.text }]} numberOfLines={1}>
        {name}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  compact: { width: 120 },
  compactTitle: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 13,
    marginTop: 8,
    lineHeight: 17,
  },
  meta: { fontFamily: 'DMSans_400Regular', fontSize: 11, marginTop: 4 },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
  },
  rowTitle: { fontFamily: 'DMSans_700Bold', fontSize: 15, marginBottom: 3 },
  play: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cat: { width: 88, alignItems: 'center' },
  catArt: {
    width: 76,
    height: 76,
    borderRadius: 38,
    overflow: 'hidden',
    marginBottom: 8,
  },
  catLabel: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 12,
    textAlign: 'center',
  },
});
