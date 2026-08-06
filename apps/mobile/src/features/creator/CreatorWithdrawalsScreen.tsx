import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAppTheme } from '../../lib/useAppTheme';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../../lib/supabase';
import { EmptyBlock, PrimaryButton, ScreenScaffold, SectionLabel } from '../../ui/Screen';

type Earning = {
  id: string;
  period_start: string;
  period_end: string;
  amount_usd: number;
  amount_ngn: number;
};

type Withdrawal = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
};

export function CreatorWithdrawalsScreen() {
  const { colors, isDark } = useAppTheme();
  const { user } = useAuth();
  const navigation = useNavigation();
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<'USD' | 'NGN'>('NGN');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const [{ data: e }, { data: w }] = await Promise.all([
      supabase
        .from('creator_earnings')
        .select('id, period_start, period_end, amount_usd, amount_ngn')
        .eq('user_id', user.id)
        .order('period_start', { ascending: false }),
      supabase
        .from('withdrawal_requests')
        .select('id, amount, currency, status, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
    ]);
    setEarnings((e as Earning[]) ?? []);
    setWithdrawals((w as Withdrawal[]) ?? []);
    setLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const request = async () => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      Alert.alert('Invalid amount');
      return;
    }
    setBusy(true);
    const { error } = await supabase.rpc('request_withdrawal', {
      p_amount: value,
      p_currency: currency,
      p_payout_method: currency === 'NGN' ? 'opay' : 'usd_bank',
      p_payout_details: {},
    });
    setBusy(false);
    if (error) {
      Alert.alert('Request failed', error.message);
      return;
    }
    Alert.alert('Submitted', 'Finance admin will review your withdrawal.');
    setAmount('');
    load();
  };

  return (
    <ScreenScaffold
      title="Earnings"
      subtitle="Min $20 / ₦10,000 · one pending request at a time"
      onBack={() => navigation.goBack()}
    >
      {loading ? (
        <ActivityIndicator color={colors.icon} style={{ marginTop: 24 }} />
      ) : (
        <>
          <SectionLabel>Earnings history</SectionLabel>
          {earnings.length === 0 ? (
            <EmptyBlock title="No earnings yet" body="Plays on published sounds build your pool share." />
          ) : (
            earnings.map((item) => (
              <View key={item.id} style={[styles.line, { borderColor: colors.border }]}>
                <Text style={[styles.lineTitle, { color: colors.text }]}>
                  {item.period_start} → {item.period_end}
                </Text>
                <Text style={[styles.lineMeta, { color: colors.textMuted }]}>
                  ${Number(item.amount_usd).toFixed(2)} · ₦
                  {Number(item.amount_ngn).toLocaleString()}
                </Text>
              </View>
            ))
          )}

          <SectionLabel>Request withdrawal</SectionLabel>
          <View style={styles.row}>
            {(['NGN', 'USD'] as const).map((c) => {
              const selected = currency === c;
              return (
                <Pressable
                  key={c}
                  onPress={() => setCurrency(c)}
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
                    }}
                  >
                    {c}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <TextInput
            style={[
              styles.input,
              {
                color: colors.text,
                borderColor: colors.border,
                backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : colors.surface,
              },
            ]}
            placeholder="Amount"
            placeholderTextColor={colors.textMuted}
            keyboardType="decimal-pad"
            value={amount}
            onChangeText={setAmount}
          />
          <PrimaryButton
            label="Request payout"
            onPress={request}
            loading={busy}
            disabled={busy}
          />

          <SectionLabel>Withdrawal history</SectionLabel>
          {withdrawals.length === 0 ? (
            <Text style={[styles.emptyHint, { color: colors.textMuted }]}>
              No withdrawals yet.
            </Text>
          ) : (
            withdrawals.map((item) => (
              <View key={item.id} style={[styles.line, { borderColor: colors.border }]}>
                <Text style={[styles.lineTitle, { color: colors.text }]}>
                  {item.currency} {item.amount}
                </Text>
                <Text style={[styles.lineMeta, { color: colors.textMuted }]}>
                  {item.status} · {new Date(item.created_at).toLocaleDateString()}
                </Text>
              </View>
            ))
          )}
        </>
      )}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  line: {
    marginHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
  },
  lineTitle: { fontFamily: 'DMSans_700Bold', fontSize: 14 },
  lineMeta: { fontFamily: 'DMSans_400Regular', fontSize: 12, marginTop: 3, textTransform: 'capitalize' },
  row: { flexDirection: 'row', gap: 8, marginHorizontal: 20, marginBottom: 12 },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  input: {
    marginHorizontal: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 12,
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
  },
  emptyHint: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    paddingHorizontal: 20,
  },
});
