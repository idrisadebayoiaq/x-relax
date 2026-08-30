import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../auth/AuthProvider';
import { useAppTheme } from '../../lib/useAppTheme';
import {
  emptyAnalyticsSummary,
  fetchAdminAnalytics,
  type AnalyticsSummary,
} from '../../lib/analytics';
import type { RootStackParamList } from '../../navigation/types';
import { EmptyBlock, OutlineRow, ScreenScaffold, SectionLabel } from '../../ui/Screen';

function StatCard({
  label,
  value,
  today,
  colors,
}: {
  label: string;
  value: number;
  today: number;
  colors: { text: string; textMuted: string; border: string; surface: string };
}) {
  return (
    <View style={[styles.stat, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <Text style={[styles.statLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.statValue, { color: colors.text }]}>{value.toLocaleString()}</Text>
      <Text style={[styles.statToday, { color: colors.textMuted }]}>{today.toLocaleString()} today</Text>
    </View>
  );
}

function MiniBars({
  title,
  values,
  colors,
}: {
  title: string;
  values: number[];
  colors: { text: string; textMuted: string; border: string };
}) {
  const max = Math.max(1, ...values);
  return (
    <View style={[styles.chart, { borderColor: colors.border }]}>
      <Text style={[styles.chartTitle, { color: colors.text }]}>{title}</Text>
      <View style={styles.bars}>
        {values.map((n, i) => (
          <View key={i} style={styles.barSlot}>
            <View
              style={[
                styles.bar,
                { height: Math.max(3, (n / max) * 72), backgroundColor: colors.text },
              ]}
            />
          </View>
        ))}
      </View>
      <Text style={[styles.chartHint, { color: colors.textMuted }]}>Last {values.length} days</Text>
    </View>
  );
}

export function AdminHubScreen() {
  const { isAdmin } = useAuth();
  const { colors } = useAppTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [summary, setSummary] = useState<AnalyticsSummary>(emptyAnalyticsSummary());
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setSummary(await fetchAdminAnalytics(30));
  }, [isAdmin]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (!isAdmin) {
    return (
      <ScreenScaffold title="Admin" onBack={() => navigation.goBack()}>
        <EmptyBlock title="Admin only" body="You do not have access to admin tools." />
      </ScreenScaffold>
    );
  }

  const visitBars = summary.daily.slice(-14).map((d) => d.web_visits);
  const downloadBars = summary.daily.slice(-14).map((d) => d.app_downloads);

  return (
    <ScreenScaffold
      title="Admin"
      subtitle="Reach and operations"
      onBack={() => navigation.goBack()}
      contentStyle={{ paddingBottom: 48 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
          tintColor={colors.text}
        />
      }
    >
      <SectionLabel>Reach · last 30 days</SectionLabel>
      <View style={styles.statGrid}>
        <StatCard label="Web visits" value={summary.web_visits} today={summary.web_visits_today} colors={colors} />
        <StatCard
          label="Unique visitors"
          value={summary.unique_visitors}
          today={summary.unique_visitors_today}
          colors={colors}
        />
        <StatCard
          label="App downloads"
          value={summary.app_downloads}
          today={summary.app_downloads_today}
          colors={colors}
        />
        <StatCard label="App opens" value={summary.app_opens} today={summary.app_opens_today} colors={colors} />
      </View>

      <MiniBars title="Website visits" values={visitBars} colors={colors} />
      <MiniBars title="APK downloads" values={downloadBars} colors={colors} />

      {summary.top_paths[0] ? (
        <Pressable style={[styles.note, { borderColor: colors.border }]}>
          <Text style={[styles.noteTitle, { color: colors.text }]}>Top website page</Text>
          <Text style={[styles.noteBody, { color: colors.textMuted }]}>
            {summary.top_paths[0].path} · {summary.top_paths[0].visits} visits
          </Text>
        </Pressable>
      ) : null}

      <SectionLabel>Queues</SectionLabel>
      <OutlineRow
        label="Payments"
        hint="Approve or reject Premium proofs"
        icon="card-outline"
        onPress={() => navigation.navigate('AdminPayments')}
      />
      <OutlineRow
        label="Sound moderation"
        hint="Publish or reject uploads"
        icon="checkmark-done-outline"
        onPress={() => navigation.navigate('AdminModeration')}
      />
      <OutlineRow
        label="Earning applications"
        hint="Review identity & apply-to-earn requests"
        icon="people-outline"
        onPress={() => navigation.navigate('AdminVerifications')}
      />
      <OutlineRow
        label="Withdrawals"
        hint="Approve payouts and mark paid"
        icon="cash-outline"
        onPress={() => navigation.navigate('AdminWithdrawals')}
      />
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  statGrid: {
    marginHorizontal: 20,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  stat: {
    width: '47%',
    flexGrow: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 14,
  },
  statLabel: { fontFamily: 'DMSans_500Medium', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6 },
  statValue: { fontFamily: 'Fraunces_700Bold', fontSize: 26, marginTop: 6 },
  statToday: { fontFamily: 'DMSans_400Regular', fontSize: 12, marginTop: 4 },
  chart: {
    marginHorizontal: 20,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 16,
  },
  chartTitle: { fontFamily: 'DMSans_700Bold', fontSize: 15, marginBottom: 12 },
  chartHint: { fontFamily: 'DMSans_400Regular', fontSize: 12, marginTop: 10 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', height: 76, gap: 3 },
  barSlot: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: 2 },
  note: {
    marginHorizontal: 20,
    marginBottom: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 16,
  },
  noteTitle: { fontFamily: 'DMSans_700Bold', fontSize: 14 },
  noteBody: { fontFamily: 'DMSans_400Regular', fontSize: 13, marginTop: 4 },
});
