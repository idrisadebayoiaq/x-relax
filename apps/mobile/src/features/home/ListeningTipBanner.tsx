import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAppTheme } from '../../lib/useAppTheme';
import type { RootStackParamList } from '../../navigation/types';

const STORAGE_KEY = 'xrelax:headset_listening_tip_v2';

/** One-time tip: headset + Premium benefits. */
export function ListeningTipBanner() {
  const { colors } = useAppTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((seen) => {
        if (!cancelled && !seen) setVisible(true);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const dismiss = async () => {
    setVisible(false);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, new Date().toISOString());
    } catch {
      // ignore
    }
  };

  const openPremium = async () => {
    await dismiss();
    navigation.navigate('Premium');
  };

  if (!visible) return null;

  return (
    <Modal transparent animationType="fade" visible onRequestClose={dismiss}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <LinearGradient colors={['#0B1C1D', '#1A3A3C']} style={styles.iconWrap}>
            <Ionicons name="headset-outline" size={28} color="#F5F2EC" />
          </LinearGradient>
          <Text style={[styles.brand, { color: colors.textMuted }]}>Welcome tip</Text>
          <Text style={[styles.title, { color: colors.text }]}>For the best experience</Text>
          <Text style={[styles.body, { color: colors.textMuted }]}>
            Use your headset, earpods, or airpiece to enjoy these calming sounds.
          </Text>
          <View style={[styles.premiumBox, { borderColor: colors.border }]}>
            <Text style={[styles.premiumTitle, { color: colors.text }]}>Premium unlocks</Text>
            {(
              [
                'Unlimited listening every day',
                'Loop sounds and Sleep Time schedules',
                'Offline downloads and Mix Studio',
                'Ad-free calm, sleep timer, and more',
              ] as const
            ).map((line) => (
              <Text key={line} style={[styles.premiumLine, { color: colors.textMuted }]}>
                • {line}
              </Text>
            ))}
          </View>
          <Pressable onPress={() => void openPremium()} style={[styles.btn, { backgroundColor: colors.inverse }]}>
            <Text style={[styles.btnText, { color: colors.inverseText }]}>Explore Premium</Text>
          </Pressable>
          <Pressable onPress={() => void dismiss()} style={styles.secondary}>
            <Text style={{ color: colors.textMuted, fontFamily: 'DMSans_500Medium' }}>Got it</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
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
  premiumTitle: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 14,
    marginBottom: 8,
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
