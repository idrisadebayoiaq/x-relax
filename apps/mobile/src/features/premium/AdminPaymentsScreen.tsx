import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../lib/useAppTheme';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../../lib/supabase';
import { EmptyBlock } from '../../ui/Screen';
import type { PaymentRequest, PaymentStatus } from '../../types/database';
import { appAlert } from '../../ui/appAlert';


export function AdminPaymentsScreen() {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { isAdmin, refreshProfile } = useAuth();
  const navigation = useNavigation();
  const [rows, setRows] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('payment_requests')
      .select('*, plan:subscription_plans(*)')
      .order('created_at', { ascending: false });
    setRows((data as PaymentRequest[]) ?? []);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const review = async (id: string, status: PaymentStatus) => {
    setBusyId(id);
    const { error } = await supabase.rpc('admin_review_payment', {
      p_payment_id: id,
      p_status: status,
      p_note: null,
    });
    setBusyId(null);
    if (error) {
      appAlert('Review failed', error.message);
      return;
    }
    appAlert('Updated', `Payment marked ${status}`);
    await refreshProfile();
    load();
  };

  if (!isAdmin) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text, fontFamily: 'DMSans_700Bold' }}>Admin only</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient
        colors={[colors.gradientTop, colors.background]}
        style={StyleSheet.absoluteFill}
      />
      <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 20 }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <Text style={[styles.back, { color: colors.textMuted }]}>‹ Back</Text>
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]}>Payment review</Text>
        <Text style={[styles.sub, { color: colors.textMuted }]}>
          Approve proofs and unlock Premium
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.icon} style={{ marginTop: 28 }} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          ListEmptyComponent={
            <EmptyBlock title="Queue clear" body="No payment requests to review." />
          }
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={({ item }) => (
            <View style={[styles.card, { borderColor: colors.border }]}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>
                {(item as any).plan?.name ?? 'Plan'}
              </Text>
              <Text style={[styles.rowMeta, { color: colors.textMuted }]}>
                {item.currency} {item.amount} · {item.payment_method} · {item.status}
              </Text>
              {item.status === 'pending' || item.status === 'need_more_info' ? (
                <View style={styles.actions}>
                  <Pressable
                    onPress={() => review(item.id, 'approved')}
                    disabled={busyId === item.id}
                  >
                    <Text style={{ color: colors.text, fontFamily: 'DMSans_700Bold' }}>
                      Approve
                    </Text>
                  </Pressable>
                  <Pressable onPress={() => review(item.id, 'need_more_info')}>
                    <Text style={{ color: colors.textMuted, fontFamily: 'DMSans_500Medium' }}>
                      Need info
                    </Text>
                  </Pressable>
                  <Pressable onPress={() => review(item.id, 'rejected')}>
                    <Text style={{ color: colors.textMuted, fontFamily: 'DMSans_500Medium' }}>
                      Reject
                    </Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  back: { fontFamily: 'DMSans_500Medium', fontSize: 15, marginBottom: 8 },
  title: { fontFamily: 'Fraunces_700Bold', fontSize: 34, letterSpacing: -0.8 },
  sub: { fontFamily: 'DMSans_400Regular', fontSize: 14, marginTop: 6, marginBottom: 8 },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 16,
  },
  rowTitle: { fontFamily: 'DMSans_700Bold', fontSize: 16, marginBottom: 4 },
  rowMeta: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    textTransform: 'capitalize',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
  },
});
