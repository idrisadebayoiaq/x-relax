import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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

type Row = {
  id: string;
  user_id: string;
  amount: number;
  currency: string;
  status: string;
  payout_method: string | null;
  created_at: string;
};

export function AdminWithdrawalsScreen() {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { isAdmin } = useAuth();
  const navigation = useNavigation();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('withdrawal_requests')
      .select('id, user_id, amount, currency, status, payout_method, created_at')
      .in('status', ['pending', 'approved'])
      .order('created_at', { ascending: true });
    setRows((data as Row[]) ?? []);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const review = async (id: string, status: 'approved' | 'rejected' | 'paid') => {
    const { error } = await supabase.rpc('review_withdrawal', {
      p_id: id,
      p_status: status,
      p_admin_note: null,
    });
    if (error) Alert.alert('Failed', error.message);
    else load();
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
        <Text style={[styles.title, { color: colors.text }]}>Withdrawals</Text>
        <Text style={[styles.sub, { color: colors.textMuted }]}>
          Approve and mark creator payouts
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
            <EmptyBlock title="Queue clear" body="No open withdrawals." />
          }
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={({ item }) => (
            <View style={[styles.card, { borderColor: colors.border }]}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>
                {item.currency} {item.amount}
              </Text>
              <Text style={[styles.rowMeta, { color: colors.textMuted }]}>
                {item.status} · {item.payout_method ?? 'method n/a'} · {item.user_id.slice(0, 8)}…
              </Text>
              <View style={styles.actions}>
                {item.status === 'pending' ? (
                  <>
                    <Pressable onPress={() => review(item.id, 'approved')}>
                      <Text style={{ color: colors.text, fontFamily: 'DMSans_700Bold' }}>
                        Approve
                      </Text>
                    </Pressable>
                    <Pressable onPress={() => review(item.id, 'rejected')}>
                      <Text style={{ color: colors.textMuted, fontFamily: 'DMSans_500Medium' }}>
                        Reject
                      </Text>
                    </Pressable>
                  </>
                ) : (
                  <Pressable onPress={() => review(item.id, 'paid')}>
                    <Text style={{ color: colors.text, fontFamily: 'DMSans_700Bold' }}>
                      Mark paid
                    </Text>
                  </Pressable>
                )}
              </View>
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
