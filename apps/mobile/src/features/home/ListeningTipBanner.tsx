import { useEffect, useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAppTheme } from '../../lib/useAppTheme';
import { useAuth } from '../auth/AuthProvider';
import { shouldShowHeadsetTip, useAudioOutputRoute } from '../../lib/useAudioOutputRoute';
import type { RootStackParamList } from '../../navigation/types';

const HEADSET_TIP_KEY = 'xrelax:headset_listening_tip_v3';
const PREMIUM_TIP_KEY = 'xrelax:premium_listening_tip_v1';

function TipModal({
  visible,
  onDismiss,
  icon,
  iconColors,
  kicker,
  title,
  body,
  children,
  primaryLabel,
  onPrimary,
}: {
  visible: boolean;
  onDismiss: () => void;
  icon: keyof typeof Ionicons.glyphMap;
  iconColors: [string, string];
  kicker: string;
  title: string;
  body: string;
  children?: ReactNode;
  primaryLabel?: string;
  onPrimary?: () => void;
}) {
  const { colors } = useAppTheme();
  if (!visible) return null;

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <LinearGradient colors={iconColors} style={styles.iconWrap}>
            <Ionicons name={icon} size={28} color="#F5F2EC" />
          </LinearGradient>
          <Text style={[styles.brand, { color: colors.textMuted }]}>{kicker}</Text>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.body, { color: colors.textMuted }]}>{body}</Text>
          {children}
          {primaryLabel && onPrimary ? (
            <Pressable onPress={onPrimary} style={[styles.btn, { backgroundColor: colors.inverse }]}>
              <Text style={[styles.btnText, { color: colors.inverseText }]}>{primaryLabel}</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={onDismiss} style={styles.secondary}>
            <Text style={{ color: colors.textMuted, fontFamily: 'DMSans_500Medium' }}>Got it</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

/** Headset tip — only for listeners on the phone speaker (no headset / Bluetooth / earpiece). */
export function HeadsetListeningTip({ onDismissed }: { onDismissed?: () => void }) {
  const audioRoute = useAudioOutputRoute();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!shouldShowHeadsetTip(audioRoute)) return;
    let cancelled = false;
    AsyncStorage.getItem(HEADSET_TIP_KEY)
      .then((seen) => {
        if (!cancelled && !seen) setVisible(true);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [audioRoute.kind]);

  const dismiss = async () => {
    setVisible(false);
    try {
      await AsyncStorage.setItem(HEADSET_TIP_KEY, new Date().toISOString());
    } catch {
      /* ignore */
    }
    onDismissed?.();
  };

  return (
    <TipModal
      visible={visible}
      onDismiss={() => void dismiss()}
      icon="headset-outline"
      iconColors={['#0B1C1D', '#1A3A3C']}
      kicker="Listening tip"
      title="Best on headphones"
      body="Plug in a headset, earpods, or AirPods for a more immersive, calming experience."
    />
  );
}

/** Premium tip — only for users who are not on a Premium plan. */
export function PremiumListeningTip({ recheckKey = 0 }: { recheckKey?: number }) {
  const { isPremium, isAdmin } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors } = useAppTheme();
  const audioRoute = useAudioOutputRoute();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isPremium || isAdmin) return;

    let cancelled = false;
    (async () => {
      const [premiumSeen, headsetSeen] = await Promise.all([
        AsyncStorage.getItem(PREMIUM_TIP_KEY),
        AsyncStorage.getItem(HEADSET_TIP_KEY),
      ]);
      if (cancelled || premiumSeen) return;

      const headsetPending = shouldShowHeadsetTip(audioRoute) && !headsetSeen;
      if (headsetPending) return;

      setVisible(true);
    })().catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [isPremium, isAdmin, audioRoute.kind, recheckKey]);

  const dismiss = async () => {
    setVisible(false);
    try {
      await AsyncStorage.setItem(PREMIUM_TIP_KEY, new Date().toISOString());
    } catch {
      /* ignore */
    }
  };

  const openPremium = async () => {
    await dismiss();
    navigation.navigate('Premium');
  };

  return (
    <TipModal
      visible={visible}
      onDismiss={() => void dismiss()}
      icon="diamond-outline"
      iconColors={['#1A2744', '#0B3D91']}
      kicker="Premium tip"
      title="Unlock the full experience"
      body="Premium gives you unlimited listening, offline downloads, Mix Studio, loop, and Sleep Time."
      primaryLabel="Explore Premium"
      onPrimary={() => void openPremium()}
    >
      <View style={[styles.premiumBox, { borderColor: colors.border }]}>
        {(
          [
            'Unlimited listening every day',
            'Offline downloads for travel',
            'Mix Studio & sleep timer',
            'Loop sounds continuously',
          ] as const
        ).map((line) => (
          <Text key={line} style={[styles.premiumLine, { color: colors.textMuted }]}>
            • {line}
          </Text>
        ))}
      </View>
    </TipModal>
  );
}

/** Combined listening tips — headset first, then premium when eligible. */
export function ListeningTipBanner() {
  const [recheckKey, setRecheckKey] = useState(0);
  return (
    <>
      <HeadsetListeningTip onDismissed={() => setRecheckKey((k) => k + 1)} />
      <PremiumListeningTip recheckKey={recheckKey} />
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 22,
    padding: 24,
    alignItems: 'center',
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  title: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 24,
    letterSpacing: -0.5,
    textAlign: 'center',
    marginBottom: 10,
  },
  body: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 14,
  },
  premiumBox: {
    alignSelf: 'stretch',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  premiumLine: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    lineHeight: 20,
  },
  btn: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 28,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  btnText: { fontFamily: 'DMSans_700Bold', fontSize: 15 },
  secondary: { marginTop: 12, paddingVertical: 6 },
});
