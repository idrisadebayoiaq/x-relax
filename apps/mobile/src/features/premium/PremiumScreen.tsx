import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAppTheme } from '../../lib/useAppTheme';
import { getAdminDashboardUrl } from '../../lib/adminUrl';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../../lib/supabase';
import { FREE_DAILY_SOUND_LIMIT } from '../../lib/dailyListenLimit';
import type { SubscriptionPlan } from '../../types/database';
import type { RootStackParamList } from '../../navigation/types';
import {
  OutlineRow,
  ScreenScaffold,
  SectionLabel,
} from '../../ui/Screen';

export function PremiumScreen() {
  const { colors } = useAppTheme();
  const { isPremium, isAdmin, refreshProfile, profile } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: planRows } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');
    setPlans((planRows as SubscriptionPlan[]) ?? []);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      refreshProfile();
    }, [load, refreshProfile]),
  );

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.icon} />
      </View>
    );
  }

  return (
    <ScreenScaffold
      title="Premium"
      subtitle={
        isPremium
          ? `You’re on ${profile?.premium_status ?? 'Premium'} — unlimited calm.`
          : 'Unlock unlimited listening, sleep timer, downloads, and more.'
      }
    >
      <View style={styles.heroWrap}>
        <LinearGradient colors={['#1A1410', '#8A6A45']} style={styles.hero}>
          <Text style={styles.heroEyebrow}>{isPremium ? 'Active' : 'Upgrade'}</Text>
          <Text style={styles.heroTitle}>
            {isPremium ? 'Premium calm' : 'Go deeper'}
          </Text>
          <Text style={styles.heroBody}>
            {isPremium
              ? 'Unlimited sounds, sleep timer, downloads, and Mix Studio are yours.'
              : `Free listeners get ${FREE_DAILY_SOUND_LIMIT} sounds per day at normal length. Premium removes the limit and adds sleep timer.`}
          </Text>
        </LinearGradient>
      </View>

      {!isPremium ? (
        <View style={[styles.freeCard, { borderColor: colors.border }]}>
          <Text style={[styles.freeTitle, { color: colors.text }]}>Free plan</Text>
          <Text style={[styles.freeBody, { color: colors.textMuted }]}>
            {`· ${FREE_DAILY_SOUND_LIMIT} different sounds per day\n· Normal track length (no sleep timer)\n· No Mix Studio or offline downloads\n· Browse, search, and favourites`}
          </Text>
        </View>
      ) : null}

      <SectionLabel>Plans</SectionLabel>
      {plans.map((plan) => (
        <Pressable
          key={plan.id}
          style={[styles.plan, { borderColor: colors.border }]}
          onPress={() => navigation.navigate('PaymentCheckout', { planId: plan.id })}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.planName, { color: colors.text }]}>{plan.name}</Text>
            <Text style={[styles.planMeta, { color: colors.textMuted }]}>
              ${Number(plan.price_usd).toFixed(2)} · ₦{Number(plan.price_ngn).toLocaleString()}
              {plan.duration_days == null ? ' · Lifetime' : ` · ${plan.duration_days} days`}
            </Text>
          </View>
          <Text style={{ color: colors.textMuted, fontSize: 18 }}>›</Text>
        </Pressable>
      ))}

      <SectionLabel>More</SectionLabel>
      <OutlineRow
        label="My payment requests"
        hint="Track bank transfers and approvals"
        icon="card-outline"
        onPress={() => navigation.navigate('MyPayments')}
      />
      {isAdmin ? (
        <>
          <OutlineRow
            label="Admin dashboard"
            hint="Full ops console in browser"
            icon="globe-outline"
            onPress={() => void Linking.openURL(getAdminDashboardUrl())}
          />
          <OutlineRow
            label="Admin · review payments"
            hint="Quick mobile queue"
            icon="shield-checkmark-outline"
            onPress={() => navigation.navigate('AdminPayments')}
          />
        </>
      ) : null}
      <OutlineRow
        label="Sound mixing studio"
        hint={isPremium ? 'Layer up to 8 tracks' : 'Premium only'}
        icon="layers-outline"
        onPress={() => navigation.navigate('MixStudio')}
      />
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  heroWrap: { paddingHorizontal: 20, marginTop: 8, marginBottom: 8 },
  hero: { borderRadius: 22, padding: 22, minHeight: 150, justifyContent: 'flex-end' },
  heroEyebrow: {
    fontFamily: 'DMSans_500Medium',
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  heroTitle: {
    fontFamily: 'Fraunces_700Bold',
    color: '#fff',
    fontSize: 28,
    letterSpacing: -0.5,
  },
  heroBody: {
    fontFamily: 'DMSans_400Regular',
    color: 'rgba(255,255,255,0.75)',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  freeCard: {
    marginHorizontal: 20,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 16,
  },
  freeTitle: { fontFamily: 'DMSans_700Bold', fontSize: 15, marginBottom: 8 },
  freeBody: { fontFamily: 'DMSans_400Regular', fontSize: 13, lineHeight: 21 },
  plan: {
    marginHorizontal: 20,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  planName: { fontFamily: 'DMSans_700Bold', fontSize: 16, marginBottom: 4 },
  planMeta: { fontFamily: 'DMSans_400Regular', fontSize: 13 },
});
