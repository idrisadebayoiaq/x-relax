import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { AudioOutputRoute } from 'expo-audio-route';
import type { ThemeColors } from '../../lib/theme';

type Props = {
  route: AudioOutputRoute;
  colors: ThemeColors;
  compact?: boolean;
};

function iconFor(route: AudioOutputRoute): keyof typeof Ionicons.glyphMap {
  switch (route.kind) {
    case 'bluetooth':
      return 'bluetooth';
    case 'wired':
      return 'headset';
    case 'earpiece':
      return 'ear';
    case 'speaker':
      return 'volume-high-outline';
    default:
      return 'volume-medium-outline';
  }
}

function labelFor(route: AudioOutputRoute): string {
  switch (route.kind) {
    case 'bluetooth':
      return route.name ? `Connected · ${route.name}` : 'Bluetooth connected';
    case 'wired':
      return route.name ? `Connected · ${route.name}` : 'Headset connected';
    case 'earpiece':
      return 'Earpiece';
    case 'speaker':
      return 'Phone speaker';
    default:
      return '';
  }
}

export function AudioOutputBadge({ route, colors, compact }: Props) {
  if (route.kind === 'unknown' || route.kind === 'speaker') return null;

  const label = labelFor(route);
  if (!label) return null;

  return (
    <View
      style={[
        styles.wrap,
        compact ? styles.compact : null,
        { backgroundColor: colors.accentSoft, borderColor: colors.border },
      ]}
    >
      <Ionicons name={iconFor(route)} size={compact ? 14 : 16} color={colors.accent} />
      <Text style={[styles.text, { color: colors.text }, compact ? styles.textCompact : null]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: '100%',
  },
  compact: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  text: { fontFamily: 'DMSans_500Medium', fontSize: 12, flexShrink: 1 },
  textCompact: { fontSize: 11 },
});
