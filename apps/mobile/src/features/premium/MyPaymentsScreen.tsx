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
import type { PaymentRequest } from '../../types/database';

export function MyPaymentsScreen() {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const navigation = useNavigation();
  const [rows, setRows] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('payment_requests')
      .select('*, plan:subscription_plans(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setRows((data as PaymentRequest[]) ?? []);
    setLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

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
        <Text style={[styles.title, { color: colors.text }]}>My payments</Text>
        <Text style={[styles.sub, { color: colors.textMuted }]}>
          Bank transfers awaiting review
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
            <EmptyBlock title="No requests yet" body="Choose a plan on Premium to start a transfer." />
          }
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={({ item }) => (
            <View style={[styles.row, { borderColor: colors.border }]}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>
                {(item as any).plan?.name ?? 'Plan'}
              </Text>
              <Text style={[styles.rowMeta, { color: colors.textMuted }]}>
                {item.currency} {item.amount} · {item.status}
              </Text>
              <Text style={[styles.rowDate, { color: colors.textMuted }]}>
                {new Date(item.created_at).toLocaleString()}
              </Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  back: { fontFamily: 'DMSans_500Medium', fontSize: 15, marginBottom: 8 },
  title: { fontFamily: 'Fraunces_700Bold', fontSize: 34, letterSpacing: -0.8 },
  sub: { fontFamily: 'DMSans_400Regular', fontSize: 14, marginTop: 6, marginBottom: 8 },
  row: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 16,
  },
  rowTitle: { fontFamily: 'DMSans_700Bold', fontSize: 16, marginBottom: 4 },
  rowMeta: { fontFamily: 'DMSans_400Regular', fontSize: 13, textTransform: 'capitalize' },
  rowDate: { fontFamily: 'DMSans_400Regular', fontSize: 11, marginTop: 8 },
});
