import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ThemeColors } from '../../lib/theme';
import type { AudioOutputRoute } from 'expo-audio-route';
import { AudioOutputBadge } from './AudioOutputBadge';

type Props = {
  colors: ThemeColors;
  queueLabel?: string;
  audioRoute: AudioOutputRoute;
  onBack: () => void;
  onMenu: () => void;
};

export function PlayerHeader({ colors, queueLabel, audioRoute, onBack, onMenu }: Props) {
  return (
    <View>
      <View style={styles.row}>
        <Pressable onPress={onBack} hitSlop={12} style={styles.hit}>
          <Ionicons name="chevron-down" size={26} color={colors.text} />
        </Pressable>
        <View style={styles.center}>
          <Text style={[styles.kicker, { color: colors.textMuted }]}>NOW PLAYING</Text>
          {queueLabel ? (
            <Text style={[styles.queue, { color: colors.text }]} numberOfLines={1}>
              {queueLabel}
            </Text>
          ) : null}
        </View>
        <Pressable onPress={onMenu} hitSlop={12} style={styles.hit}>
          <Ionicons name="ellipsis-horizontal" size={22} color={colors.text} />
        </Pressable>
      </View>
      <View style={{ marginBottom: 10 }}>
        <AudioOutputBadge route={audioRoute} colors={colors} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  hit: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  kicker: { fontFamily: 'DMSans_500Medium', fontSize: 11, letterSpacing: 1.6 },
  queue: { fontFamily: 'DMSans_400Regular', fontSize: 12, marginTop: 2 },
});
