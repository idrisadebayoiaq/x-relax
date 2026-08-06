import type { ReactElement, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type RefreshControlProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../lib/useAppTheme';
import { moodPaletteFor } from '../lib/format';

export function ScreenScaffold({
  children,
  title,
  subtitle,
  scroll = true,
  onBack,
  right,
  contentStyle,
  refreshControl,
}: {
  children: ReactNode;
  title: string;
  subtitle?: string;
  scroll?: boolean;
  onBack?: () => void;
  right?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  refreshControl?: ReactElement<RefreshControlProps>;
}) {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const body = (
    <>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        {onBack ? (
          <Pressable onPress={onBack} hitSlop={10} style={styles.backRow}>
            <Ionicons name="chevron-back" size={20} color={colors.textMuted} />
            <Text style={[styles.back, { color: colors.textMuted }]}>Back</Text>
          </Pressable>
        ) : null}
        <View style={styles.titleRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
            {subtitle ? (
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text>
            ) : null}
          </View>
          {right}
        </View>
      </View>
      {children}
    </>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient
        colors={
          isDark ? ['#121212', '#000000', '#000000'] : ['#F3F0EA', '#FFFFFF', '#FFFFFF']
        }
        locations={[0, 0.3, 1]}
        style={StyleSheet.absoluteFill}
      />
      {scroll ? (
        <ScrollView
          contentContainerStyle={[{ paddingBottom: 40 }, contentStyle]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}
        >
          {body}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, contentStyle]}>{body}</View>
      )}
    </View>
  );
}

export function SectionLabel({ children }: { children: string }) {
  const { colors } = useAppTheme();
  return <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{children}</Text>;
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.primaryBtn,
        { backgroundColor: colors.inverse, opacity: disabled || loading ? 0.55 : 1 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.inverseText} />
      ) : (
        <Text style={[styles.primaryBtnText, { color: colors.inverseText }]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function OutlineRow({
  label,
  hint,
  onPress,
  icon,
}: {
  label: string;
  hint?: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.outlineRow, { borderColor: colors.border }]}
    >
      {icon ? (
        <Ionicons name={icon} size={20} color={colors.text} style={{ marginRight: 4 }} />
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={[styles.outlineLabel, { color: colors.text }]}>{label}</Text>
        {hint ? (
          <Text style={[styles.outlineHint, { color: colors.textMuted }]}>{hint}</Text>
        ) : null}
      </View>
      <Text style={{ color: colors.textMuted, fontSize: 18 }}>›</Text>
    </Pressable>
  );
}

export function EmptyBlock({ title, body }: { title: string; body: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.empty, { borderColor: colors.border }]}>
      <LinearGradient colors={moodPaletteFor(title)} style={styles.emptyOrb} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.emptyBody, { color: colors.textMuted }]}>{body}</Text>
    </View>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 8 },
  backRow: { marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 2 },
  back: { fontFamily: 'DMSans_500Medium', fontSize: 15 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  title: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 34,
    letterSpacing: -0.8,
    lineHeight: 38,
  },
  subtitle: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    marginTop: 6,
    lineHeight: 20,
  },
  sectionLabel: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 12,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    marginBottom: 10,
    marginTop: 8,
    paddingHorizontal: 20,
  },
  primaryBtn: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginHorizontal: 20,
  },
  primaryBtnText: { fontFamily: 'DMSans_700Bold', fontSize: 15 },
  outlineRow: {
    marginHorizontal: 20,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  outlineLabel: { fontFamily: 'DMSans_700Bold', fontSize: 15 },
  outlineHint: { fontFamily: 'DMSans_400Regular', fontSize: 12, marginTop: 3 },
  empty: {
    marginHorizontal: 20,
    marginTop: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
  },
  emptyOrb: { width: 72, height: 72, borderRadius: 36, marginBottom: 16 },
  emptyTitle: {
    fontFamily: 'Fraunces_600SemiBold',
    fontSize: 22,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyBody: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  fieldLabel: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
    paddingHorizontal: 20,
  },
});
