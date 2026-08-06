import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/** White verified badge for premium / verified users. */
export function VerifiedBadge({ size = 16 }: { size?: number }) {
  return (
    <View style={[styles.wrap, { width: size, height: size, borderRadius: size / 2 }]}>
      <Ionicons name="checkmark-circle" size={size} color="#FFFFFF" />
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
