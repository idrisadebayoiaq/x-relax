import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../lib/useAppTheme';
import { supabase } from '../../lib/supabase';
import { registerForPushNotifications } from '../../lib/push';
import { EmptyBlock } from '../../ui/Screen';
import { IconButton } from '../../ui/Icon';

type NotificationRow = {
  id: string;
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
};

export function NotificationsScreen() {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pushMsg, setPushMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('notifications')
      .select('id, title, body, data, read_at, created_at')
      .order('created_at', { ascending: false })
      .limit(100);
    setItems((data as NotificationRow[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const markRead = async (id: string) => {
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id)
      .is('read_at', null);
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)),
    );
  };

  const onEnablePush = async () => {
    setPushMsg(null);
    const result = await registerForPushNotifications();
    setPushMsg(result.error ?? 'Push enabled for this device');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient
        colors={isDark ? ['#121212', '#000'] : ['#F3F0EA', '#FFF']}
        style={StyleSheet.absoluteFill}
      />
      <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 20 }}>
        <IconButton
          name="chevron-back"
          onPress={() => navigation.goBack()}
          color={colors.textMuted}
          size={22}
          style={{ alignSelf: 'flex-start', marginLeft: -8, marginBottom: 4 }}
        />
        <Text style={[styles.title, { color: colors.text }]}>Notifications</Text>
        <Text style={[styles.sub, { color: colors.textMuted }]}>
          Welcome notes, payments, and creator updates
        </Text>
        <Pressable
          style={[styles.pushBtn, { borderColor: colors.border }]}
          onPress={onEnablePush}
        >
          <Ionicons name="notifications-outline" size={18} color={colors.text} />
          <Text style={{ color: colors.text, fontFamily: 'DMSans_700Bold', fontSize: 14 }}>
            Enable push on this device
          </Text>
        </Pressable>
        {pushMsg ? (
          <Text style={[styles.hint, { color: colors.textMuted }]}>{pushMsg}</Text>
        ) : null}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.icon} style={{ marginTop: 28 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, paddingTop: 12 }}
          ListEmptyComponent={
            <EmptyBlock title="All quiet" body="No notifications yet. We’ll nudge you when something matters." />
          }
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={({ item }) => {
            const fromUnverified =
              item.data?.from_unverified_admin === true || item.data?.admin_verified === false;
            return (
            <Pressable
              onPress={() => markRead(item.id)}
              style={[
                styles.row,
                {
                  borderColor: colors.border,
                  opacity: item.read_at ? 0.65 : 1,
                },
              ]}
            >
              {!item.read_at ? (
                <View style={[styles.iconBubble, { backgroundColor: colors.inverse }]}>
                  <Ionicons name="mail-unread-outline" size={14} color={colors.inverseText} />
                </View>
              ) : (
                <View style={[styles.iconBubble, { borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth }]}>
                  <Ionicons name="mail-open-outline" size={14} color={colors.textMuted} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                {fromUnverified ? (
                  <Text style={[styles.warn, { color: '#B45309' }]}>
                    ⚠ From an unverified admin
                  </Text>
                ) : null}
                <Text style={[styles.rowTitle, { color: colors.text }]}>{item.title}</Text>
                {item.body ? (
                  <Text style={[styles.rowBody, { color: colors.textMuted }]}>{item.body}</Text>
                ) : null}
                <Text style={[styles.meta, { color: colors.textMuted }]}>
                  {new Date(item.created_at).toLocaleString()}
                </Text>
              </View>
            </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: 'Fraunces_700Bold', fontSize: 34, letterSpacing: -0.8 },
  sub: { fontFamily: 'DMSans_400Regular', fontSize: 14, marginTop: 6, marginBottom: 14 },
  pushBtn: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  hint: { fontFamily: 'DMSans_400Regular', marginTop: 8, fontSize: 13 },
  row: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    gap: 12,
  },
  iconBubble: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  rowTitle: { fontFamily: 'DMSans_700Bold', fontSize: 15 },
  warn: { fontFamily: 'DMSans_500Medium', fontSize: 11, marginBottom: 4 },
  rowBody: { fontFamily: 'DMSans_400Regular', fontSize: 13, lineHeight: 19, marginTop: 4 },
  meta: { fontFamily: 'DMSans_400Regular', fontSize: 11, marginTop: 8 },
});
