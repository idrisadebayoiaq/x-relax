import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { moodPaletteFor } from '../../lib/format';

type Props = {
  title: string;
  uri?: string | null;
  size?: number;
  style?: StyleProp<ViewStyle>;
  rounded?: number;
};

export function CoverArt({ title, uri, size = 120, style, rounded = 14 }: Props) {
  const [a, b] = moodPaletteFor(title || 'x');
  const initial = (title?.trim()?.[0] ?? 'X').toUpperCase();

  return (
    <View style={[{ width: size, height: size, borderRadius: rounded, overflow: 'hidden' }, style]}>
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
      ) : (
        <LinearGradient colors={[a, b]} start={{ x: 0.1, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill}>
          <View style={styles.markWrap}>
            <Text style={styles.mark}>{initial}</Text>
          </View>
        </LinearGradient>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  markWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  mark: {
    fontFamily: 'Fraunces_600SemiBold',
    fontSize: 42,
    color: 'rgba(255,255,255,0.88)',
  },
});
