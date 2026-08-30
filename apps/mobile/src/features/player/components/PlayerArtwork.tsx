import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { CoverArt } from '../../home/CoverArt';
import type { Sound } from '../../../types/database';

type Props = {
  sound: Sound;
  artSize: number;
  categoryName: string | null;
  creatorName: string | null;
  avg: number;
  ratingCount: number;
  isFavourite: boolean;
  onToggleFavourite: () => void;
  onCreatorPress?: () => void;
};

export function PlayerArtwork({
  sound,
  artSize,
  categoryName,
  creatorName,
  avg,
  ratingCount,
  isFavourite,
  onToggleFavourite,
  onCreatorPress,
}: Props) {
  return (
    <View style={[styles.wrap, { width: artSize, alignSelf: 'center' }]}>
      <CoverArt
        title={sound.title}
        uri={sound.cover_url}
        size={artSize}
        rounded={20}
        style={{ width: artSize, height: artSize, borderRadius: 20 }}
      />
      <LinearGradient
        colors={['transparent', 'rgba(6,20,40,0.2)', 'rgba(6,20,40,0.88)']}
        locations={[0.3, 0.55, 1]}
        style={[StyleSheet.absoluteFill, { borderRadius: 20 }]}
      />
      <Pressable onPress={onToggleFavourite} style={styles.heart} hitSlop={10}>
        <Ionicons name={isFavourite ? 'heart' : 'heart-outline'} size={22} color="#FFFFFF" />
      </Pressable>
      <View style={styles.meta}>
        <Text style={styles.title} numberOfLines={2}>
          {sound.title}
        </Text>
        <Text style={styles.category} numberOfLines={1}>
          {categoryName ?? 'Ambient'}
        </Text>
        {sound.creator_id && creatorName ? (
          <Pressable onPress={onCreatorPress} hitSlop={8}>
            <Text style={styles.creator} numberOfLines={1}>
              {creatorName}
            </Text>
          </Pressable>
        ) : null}
        <View style={styles.stars}>
          {[1, 2, 3, 4, 5].map((s) => (
            <Ionicons
              key={s}
              name={avg >= s - 0.25 ? 'star' : 'star-outline'}
              size={13}
              color="#F5C542"
            />
          ))}
          {ratingCount ? (
            <Text style={styles.ratingText}>{avg.toFixed(1)} · {ratingCount}</Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 8,
    marginBottom: 20,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  heart: {
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
  meta: { position: 'absolute', left: 16, right: 16, bottom: 16 },
  title: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 24,
    color: '#FFFFFF',
    letterSpacing: -0.4,
  },
  category: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    color: 'rgba(255,255,255,0.78)',
    marginTop: 4,
  },
  creator: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 13,
    color: 'rgba(255,255,255,0.92)',
    marginTop: 4,
    textDecorationLine: 'underline',
  },
  stars: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 8 },
  ratingText: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    marginLeft: 6,
  },
});
