import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type VerifiedBadgeTone = 'white' | 'blue';

/** White = Premium listener. Blue = verified creator or verified admin. */
export function VerifiedBadge({
  size = 16,
  tone = 'white',
}: {
  size?: number;
  tone?: VerifiedBadgeTone;
}) {
  const color = tone === 'blue' ? '#1D4ED8' : '#FFFFFF';
  return (
    <View style={[styles.wrap, { width: size, height: size, borderRadius: size / 2 }]}>
      <Ionicons name="checkmark-circle" size={size} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
});
