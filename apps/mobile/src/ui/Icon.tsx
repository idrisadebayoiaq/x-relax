import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../lib/useAppTheme';

type IconName = keyof typeof Ionicons.glyphMap;

export function Icon({
  name,
  size = 22,
  color,
  style,
}: {
  name: IconName;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useAppTheme();
  return <Ionicons name={name} size={size} color={color ?? colors.icon} style={style} />;
}

export function IconButton({
  name,
  onPress,
  size = 22,
  color,
  background,
  style,
}: {
  name: IconName;
  onPress?: () => void;
  size?: number;
  color?: string;
  background?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={[
        styles.btn,
        {
          backgroundColor: background ?? 'transparent',
          width: size + 18,
          height: size + 18,
        },
        style,
      ]}
    >
      <Ionicons name={name} size={size} color={color ?? colors.text} />
    </Pressable>
  );
}

export function SectionIconTitle({ icon, title }: { icon: IconName; title: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.sectionRow}>
      <Ionicons name={icon} size={16} color={colors.textMuted} />
      <Text style={[styles.sectionText, { color: colors.text }]}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  btn: { borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: 12,
    marginTop: 8,
  },
  sectionText: {
    fontFamily: 'Fraunces_600SemiBold',
    fontSize: 20,
    letterSpacing: -0.3,
  },
});
