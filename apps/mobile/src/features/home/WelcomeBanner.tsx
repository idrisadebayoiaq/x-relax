import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import { useAppTheme } from '../../lib/useAppTheme';

type WelcomeRow = {
  id: string;
  title: string;
  body: string | null;
};

/** Shows once for unread welcome notifications after signup. */
export function WelcomeBanner() {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const [welcome, setWelcome] = useState<WelcomeRow | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      setWelcome(null);
      return;
    }
    const { data } = await supabase
      .from('notifications')
      .select('id, title, body')
      .eq('user_id', user.id)
      .filter('data->>type', 'eq', 'welcome')
      .is('read_at', null)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    setWelcome((data as WelcomeRow) ?? null);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const dismiss = async () => {
    if (!welcome) return;
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', welcome.id);
    setWelcome(null);
  };

  if (!welcome) return null;

  return (
    <Modal transparent animationType="fade" visible onRequestClose={dismiss}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <LinearGradient colors={['#1A1410', '#6B5344']} style={styles.orb} />
          <Text style={[styles.brand, { color: colors.textMuted }]}>X-Relax</Text>
          <Text style={[styles.title, { color: colors.text }]}>{welcome.title}</Text>
          {welcome.body ? (
            <Text style={[styles.body, { color: colors.textMuted }]}>{welcome.body}</Text>
          ) : null}
          <View style={[styles.premiumBox, { borderColor: colors.border }]}>
            <Text style={[styles.premiumTitle, { color: colors.text }]}>Premium benefits</Text>
            {(
              [
                'Unlimited listening every day',
                'Loop, Sleep Time, and sleep timer',
                'Offline downloads and Mix Studio',
                'Ad-free calm experience',
              ] as const
            ).map((line) => (
              <Text key={line} style={[styles.premiumLine, { color: colors.textMuted }]}>
                • {line}
              </Text>
            ))}
          </View>
          <Pressable
            onPress={dismiss}
            style={[styles.btn, { backgroundColor: colors.inverse }]}
          >
            <Text style={[styles.btnText, { color: colors.inverseText }]}>Get started</Text>
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
  orb: { width: 64, height: 64, borderRadius: 32, marginBottom: 16 },
  brand: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  title: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 26,
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
});
