import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ThemeColors } from '../../../lib/theme';

type ActionProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  colors: ThemeColors;
  active?: boolean;
  disabled?: boolean;
};

function QuickAction({ icon, label, onPress, colors, active, disabled }: ActionProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.action, { opacity: disabled ? 0.45 : 1 }]}
    >
      <Ionicons name={icon} size={22} color={active ? colors.accent : colors.textMuted} />
      <Text style={[styles.label, { color: active ? colors.text : colors.textMuted }]}>{label}</Text>
    </Pressable>
  );
}

type Props = {
  colors: ThemeColors;
  isPremium: boolean;
  isLooping: boolean;
  sleepEndsAt: number | null;
  sleepLabel: string;
  isDownloading: boolean;
  shareTitle: string;
  onTimer: () => void;
  onMix: () => void;
  onLoop: () => void;
  onDownload: () => void;
  onShare: () => void;
};

export function PlayerQuickActions({
  colors,
  isPremium,
  isLooping,
  sleepEndsAt,
  sleepLabel,
  isDownloading,
  shareTitle,
  onTimer,
  onMix,
  onLoop,
  onDownload,
  onShare,
}: Props) {
  return (
    <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <QuickAction
        icon={sleepEndsAt ? 'timer' : 'timer-outline'}
        label={sleepLabel}
        active={!!sleepEndsAt}
        onPress={onTimer}
        colors={colors}
      />
      <QuickAction icon="git-compare-outline" label="Mix" onPress={onMix} colors={colors} />
      <QuickAction
        icon={
          !isPremium
            ? 'lock-closed-outline'
            : isLooping || sleepEndsAt
              ? 'repeat'
              : 'repeat-outline'
        }
        label="Loop"
        active={isLooping || !!sleepEndsAt}
        onPress={onLoop}
        colors={colors}
      />
      <QuickAction
        icon={isDownloading ? 'cloud-download' : 'cloud-download-outline'}
        label={isDownloading ? 'Saving…' : 'Save'}
        active={isDownloading}
        onPress={onDownload}
        colors={colors}
        disabled={isDownloading}
      />
      <QuickAction
        icon="share-outline"
        label="Share"
        onPress={() => void Share.share({ message: `Listen to ${shareTitle} on X-Relax` })}
        colors={colors}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 6,
    marginBottom: 16,
  },
  action: { flex: 1, alignItems: 'center', gap: 4 },
  label: { fontFamily: 'DMSans_500Medium', fontSize: 10, textAlign: 'center' },
});
