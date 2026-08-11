import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../lib/useAppTheme';
import { useAuth } from '../features/auth/AuthProvider';
import { VerifiedBadge } from '../ui/VerifiedBadge';
import { ShareAppSheet } from './ShareAppSheet';
import type { RootStackParamList } from './types';

export function AppMenu({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { profile, isPremium, isCreator, isAdmin, signOut } = useAuth();
  const [shareOpen, setShareOpen] = useState(false);

  const go = (route: keyof RootStackParamList, params?: object) => {
    onClose();
    // @ts-expect-error flexible menu navigation
    navigation.navigate(route, params);
  };

  const name = profile?.display_name?.trim() || 'Listener';
  const showWhiteBadge = !isCreator && !isAdmin && isPremium;

  const items: {
    key: string;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    onPress: () => void;
    hidden?: boolean;
  }[] = [
    {
      key: 'premium',
      label: isPremium ? 'Premium' : 'Upgrade to Premium',
      icon: 'diamond-outline',
      onPress: () => go('Premium'),
    },
    {
      key: 'mix',
      label: 'Mix Studio',
      icon: 'layers-outline',
      onPress: () => go('MixStudio'),
    },
    {
      key: 'sleep',
      label: 'Sleep Time',
      icon: 'moon-outline',
      onPress: () => go('SleepTime'),
    },
    {
      key: 'payments',
      label: 'My payments',
      icon: 'card-outline',
      onPress: () => go('MyPayments'),
    },
    {
      key: 'creator',
      label: isCreator ? 'Creator dashboard' : 'Become a creator',
      icon: 'mic-outline',
      onPress: () => (isCreator ? go('Creator') : go('BecomeCreator')),
    },
    {
      key: 'admin',
      label: 'Admin hub',
      icon: 'shield-checkmark-outline',
      onPress: () => go('AdminHub'),
      hidden: !isAdmin,
    },
    {
      key: 'settings',
      label: 'Settings',
      icon: 'settings-outline',
      onPress: () => go('Settings'),
    },
    {
      key: 'share',
      label: 'Share app',
      icon: 'share-social-outline',
      onPress: () => {
        onClose();
        setShareOpen(true);
      },
    },
    {
      key: 'notifications',
      label: 'Notifications',
      icon: 'notifications-outline',
      onPress: () => go('Notifications'),
    },
    {
      key: 'privacy',
      label: 'Privacy policy',
      icon: 'document-text-outline',
      onPress: () => go('Legal', { doc: 'privacy' }),
    },
    {
      key: 'terms',
      label: 'Terms of use',
      icon: 'reader-outline',
      onPress: () => go('Legal', { doc: 'terms' }),
    },
  ];

  return (
    <>
      <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: isDark ? '#0C0C0C' : colors.background,
                borderColor: colors.border,
                paddingTop: insets.top + 12,
                paddingBottom: insets.bottom + 16,
              },
            ]}
          >
            <View style={styles.sheetHead}>
              <View>
                <Text style={[styles.brand, { color: colors.textMuted }]}>X-Relax</Text>
                <View style={styles.nameRow}>
                  <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                    {name}
                  </Text>
                  {showWhiteBadge ? <VerifiedBadge size={16} tone="white" /> : null}
                </View>
              </View>
              <Pressable onPress={onClose} hitSlop={12} style={styles.iconHit}>
                <Ionicons name="close" size={22} color={colors.text} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
              {items
                .filter((item) => !item.hidden)
                .map((item) => (
                  <Pressable
                    key={item.key}
                    onPress={item.onPress}
                    style={[styles.row, { borderColor: colors.border }]}
                  >
                    <Ionicons name={item.icon} size={20} color={colors.text} />
                    <Text style={[styles.rowLabel, { color: colors.text }]}>{item.label}</Text>
                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                  </Pressable>
                ))}
              <Pressable
                onPress={async () => {
                  onClose();
                  await signOut();
                }}
                style={[styles.row, styles.signOut, { borderColor: colors.border }]}
              >
                <Ionicons name="log-out-outline" size={20} color="#EF4444" />
                <Text style={[styles.rowLabel, { color: '#EF4444' }]}>Sign out</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
      <ShareAppSheet visible={shareOpen} onClose={() => setShareOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  iconHit: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    flexDirection: 'row',
  },
  sheet: {
    width: '82%',
    maxWidth: 340,
    borderRightWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 18,
    paddingHorizontal: 4,
  },
  brand: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontFamily: 'Fraunces_700Bold', fontSize: 24, letterSpacing: -0.4, maxWidth: 220 },
  list: { gap: 8, paddingBottom: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  rowLabel: { flex: 1, fontFamily: 'DMSans_500Medium', fontSize: 15 },
  signOut: { marginTop: 8 },
});
