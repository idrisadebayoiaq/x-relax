import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppTheme } from '../../lib/useAppTheme';
import { useAuth } from '../auth/AuthProvider';
import { paymentMethodForCountry } from '../../lib/countries';
import { fetchPremiumAccess, formatPremiumCoverage } from '../../lib/premiumAccess';
import { supabase } from '../../lib/supabase';
import type { PaymentMethod, SubscriptionPlan } from '../../types/database';
import type { RootStackParamList } from '../../navigation/types';
import { PrimaryButton, ScreenScaffold, SectionLabel } from '../../ui/Screen';
import { appAlert } from '../../ui/appAlert';

type Props = NativeStackScreenProps<RootStackParamList, 'PaymentCheckout'>;

type MethodInfo = {
  label: string;
  currency: 'USD' | 'NGN';
  account_name: string;
  bank_name: string;
  account_number: string;
  account_type?: string;
  routing_number?: string;
  bank_address?: string;
};

export function PaymentCheckoutScreen() {
  const { colors, isDark } = useAppTheme();
  const { user, profile } = useAuth();
  const route = useRoute<Props['route']>();
  const navigation = useNavigation();
  const allowedMethod = paymentMethodForCountry(profile?.country_code);
  const [plan, setPlan] = useState<SubscriptionPlan | null>(null);
  const [methods, setMethods] = useState<Record<string, MethodInfo>>({});
  const [method, setMethod] = useState<PaymentMethod>(allowedMethod);
  const [proofUri, setProofUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [blockedReason, setBlockedReason] = useState<string | null>(null);

  useEffect(() => {
    setMethod(allowedMethod);
  }, [allowedMethod]);

  useEffect(() => {
    (async () => {
      const [{ data: planRow }, { data: settings }] = await Promise.all([
        supabase
          .from('subscription_plans')
          .select('*')
          .eq('id', route.params.planId)
          .maybeSingle(),
        supabase.from('app_settings').select('value').eq('key', 'payment_methods').maybeSingle(),
      ]);
      const nextPlan = planRow as SubscriptionPlan | null;
      setPlan(nextPlan);
      setMethods((settings?.value as Record<string, MethodInfo>) ?? {});
      if (nextPlan && nextPlan.code !== 'creator_blue_badge') {
        const access = await fetchPremiumAccess();
        if (!access.canPurchase) {
          setBlockedReason(formatPremiumCoverage(access));
        }
      }
      setLoading(false);
    })();
  }, [route.params.planId]);

  const pickProof = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      setProofUri(result.assets[0].uri);
    }
  };

  const submit = async () => {
    if (!user || !plan || !proofUri) {
      appAlert('Missing proof', 'Upload a payment screenshot or receipt.');
      return;
    }
    if (blockedReason) {
      appAlert('Already Premium', blockedReason);
      return;
    }
    setBusy(true);
    const info = methods[method];
    const currency = info?.currency ?? (method === 'usd_lead_bank' ? 'USD' : 'NGN');
    const amount = currency === 'USD' ? Number(plan.price_usd) : Number(plan.price_ngn);

    const { data: payment, error: payError } = await supabase
      .from('payment_requests')
      .insert({
        user_id: user.id,
        plan_id: plan.id,
        payment_method: method,
        amount,
        currency,
        status: 'pending',
      })
      .select('*')
      .single();

    if (payError || !payment) {
      setBusy(false);
      const denied = /row-level security|violates/i.test(payError?.message ?? '');
      appAlert(
        'Failed',
        denied
          ? 'You already have Premium or a payment waiting for approval.'
          : (payError?.message ?? 'Could not create payment'),
      );
      return;
    }

    const ext = proofUri.split('.').pop()?.split('?')[0] || 'jpg';
    const path = `${user.id}/${payment.id}/proof.${ext}`;
    const response = await fetch(proofUri);
    const blob = await response.blob();
    const { error: uploadError } = await supabase.storage
      .from('payment-proofs')
      .upload(path, blob, { upsert: true, contentType: blob.type || 'image/jpeg' });

    if (uploadError) {
      setBusy(false);
      appAlert('Upload failed', uploadError.message);
      return;
    }

    await supabase.from('payment_requests').update({ proof_path: path }).eq('id', payment.id);

    await supabase.from('payment_messages').insert({
      payment_request_id: payment.id,
      sender_id: user.id,
      body: 'Payment proof uploaded. Please review.',
      attachment_path: path,
    });

    await supabase.rpc('notify_admins', {
      p_title: 'New payment request',
      p_body: `${user.email ?? 'User'} submitted a ${plan.name} payment`,
      p_data: { payment_id: payment.id },
    });

    setBusy(false);
    appAlert('Submitted', 'Admin will verify your payment shortly.');
    navigation.goBack();
  };

  if (loading || !plan) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.icon} />
      </View>
    );
  }

  const info = methods[method];

  return (
    <ScreenScaffold
      title={plan.name}
      subtitle="Pay manually, then upload proof for approval"
      onBack={() => navigation.goBack()}
    >
      {blockedReason ? (
        <View style={[styles.blocked, { borderColor: colors.border, backgroundColor: colors.accentSoft }]}>
          <Text style={{ color: colors.text, fontFamily: 'DMSans_700Bold', fontSize: 16, marginBottom: 6 }}>
            Plans are closed
          </Text>
          <Text style={{ color: colors.textMuted, fontFamily: 'DMSans_400Regular', fontSize: 14, lineHeight: 20 }}>
            {blockedReason}
          </Text>
        </View>
      ) : (
        <>
      <SectionLabel>Payment method</SectionLabel>
      {!profile?.country_code ? (
        <Text style={{ color: colors.textMuted, fontFamily: 'DMSans_400Regular', marginBottom: 10 }}>
          Set your country in Profile so we show the correct payout details.
        </Text>
      ) : null}
      <View style={styles.row}>
        {([allowedMethod] as PaymentMethod[]).map((m) => {
          const selected = method === m;
          return (
            <Pressable
              key={m}
              onPress={() => setMethod(m)}
              style={[
                styles.chip,
                {
                  borderColor: colors.border,
                  backgroundColor: selected ? colors.inverse : 'transparent',
                },
              ]}
            >
              <Text
                style={{
                  color: selected ? colors.inverseText : colors.text,
                  fontFamily: 'DMSans_700Bold',
                  fontSize: 13,
                }}
              >
                {m === 'ngn_opay' ? 'Opay (NGN)' : 'Lead Bank (USD)'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View
        style={[
          styles.card,
          {
            borderColor: colors.border,
            backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : colors.surface,
          },
        ]}
      >
        <Text style={[styles.cardTitle, { color: colors.text }]}>
          {info?.label ?? 'Transfer details'}
        </Text>
        <Text style={[styles.amount, { color: colors.text }]}>
          {info?.currency === 'USD'
            ? `$${Number(plan.price_usd).toFixed(2)}`
            : `₦${Number(plan.price_ngn).toLocaleString()}`}
        </Text>
        {info ? (
          <View style={{ gap: 4, marginTop: 10 }}>
            <Text style={[styles.detail, { color: colors.textMuted }]}>
              Account name: {info.account_name}
            </Text>
            <Text style={[styles.detail, { color: colors.textMuted }]}>Bank: {info.bank_name}</Text>
            <Text style={[styles.detail, { color: colors.textMuted }]}>
              Account number: {info.account_number}
            </Text>
            {info.routing_number ? (
              <Text style={[styles.detail, { color: colors.textMuted }]}>
                Routing: {info.routing_number}
              </Text>
            ) : null}
            {info.account_type ? (
              <Text style={[styles.detail, { color: colors.textMuted }]}>
                Type: {info.account_type}
              </Text>
            ) : null}
            {info.bank_address ? (
              <Text style={[styles.detail, { color: colors.textMuted }]}>
                Address: {info.bank_address}
              </Text>
            ) : null}
          </View>
        ) : null}
        <Text style={[styles.memo, { color: colors.textMuted }]}>
          Include your X-Relax email in the transfer memo if possible.
        </Text>
      </View>

      <Pressable style={[styles.btnOutline, { borderColor: colors.border }]} onPress={pickProof}>
        <Text style={{ color: colors.text, fontFamily: 'DMSans_700Bold' }}>
          {proofUri ? 'Change proof image' : 'Upload payment proof'}
        </Text>
      </Pressable>
      {proofUri ? (
        <Image source={{ uri: proofUri }} style={styles.preview} resizeMode="cover" />
      ) : null}

      <View style={{ height: 16 }} />
      <PrimaryButton
        label="Submit for review"
        onPress={submit}
        loading={busy}
        disabled={busy}
      />
        </>
      )}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  blocked: {
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 16,
  },
  row: { flexDirection: 'row', gap: 8, marginHorizontal: 20, marginBottom: 16 },
  chip: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
  },
  card: {
    marginHorizontal: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
  },
  cardTitle: { fontFamily: 'DMSans_700Bold', fontSize: 15 },
  amount: { fontFamily: 'Fraunces_700Bold', fontSize: 28, marginTop: 8, letterSpacing: -0.5 },
  detail: { fontFamily: 'DMSans_400Regular', fontSize: 13, lineHeight: 19 },
  memo: { fontFamily: 'DMSans_400Regular', fontSize: 12, marginTop: 12, lineHeight: 18 },
  btnOutline: {
    marginHorizontal: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  preview: {
    width: undefined,
    marginHorizontal: 20,
    height: 180,
    borderRadius: 14,
    marginTop: 12,
  },
});
