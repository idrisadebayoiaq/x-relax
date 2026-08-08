import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../lib/useAppTheme';
import { useAuth } from '../auth/AuthProvider';
import { formatDuration } from '../../lib/format';
import { supabase } from '../../lib/supabase';
import { CoverArt } from '../home/CoverArt';
import { EmptyBlock } from '../../ui/Screen';
import type { Sound } from '../../types/database';

export function CreatorSoundsScreen() {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const navigation = useNavigation();
  const [sounds, setSounds] = useState<Sound[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('sounds')
      .select('*')
      .eq('creator_id', user.id)
      .order('created_at', { ascending: false });
    setSounds((data as Sound[]) ?? []);
    setLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.iconBtn}>
          <Text style={{ color: colors.text, fontSize: 28, lineHeight: 32 }}>‹</Text>
        </Pressable>
        <Pressable
          onPress={() => (navigation as any).navigate('CreatorUpload')}
          hitSlop={12}
          style={styles.iconBtn}
        >
          <Text style={{ color: colors.text, fontSize: 28, lineHeight: 32 }}>+</Text>
        </Pressable>
      </View>
      <Text style={[styles.title, { color: colors.text }]}>My sounds</Text>
      <Text style={[styles.sub, { color: colors.textMuted }]}>
        Published, pending, and rejected uploads
      </Text>

      {loading ? (
        <ActivityIndicator color={colors.icon} style={{ marginTop: 28 }} />
      ) : (
        <FlatList
          data={sounds}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
          ListEmptyComponent={
            <EmptyBlock title="No uploads yet" body="Upload your first track from Creator → Upload." />
          }
          renderItem={({ item, index }) => {
            const isLast = index === sounds.length - 1;
            const separator = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)';
            return (
              <View style={styles.row}>
                <CoverArt title={item.title} uri={item.cover_url} size={56} rounded={4} />
                <View
                  style={[
                    styles.rowBody,
                    { borderBottomColor: isLast ? 'transparent' : separator },
                  ]}
                >
                  <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={[styles.rowMeta, { color: colors.textMuted }]}>
                    {item.status}
                    {item.duration_seconds ? ` · ${formatDuration(item.duration_seconds)}` : ''}
                    {item.average_rating
                      ? ` · ${Number(item.average_rating).toFixed(1)}★`
                      : ''}
                  </Text>
                  {item.rejection_reason ? (
                    <Text style={[styles.reject, { color: colors.textMuted }]}>
                      {item.rejection_reason}
                    </Text>
                  ) : null}
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    minHeight: 44,
  },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 34,
    letterSpacing: -0.8,
    paddingHorizontal: 16,
    marginTop: 4,
  },
  sub: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    paddingHorizontal: 16,
    marginTop: 6,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    minHeight: 72,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
    marginLeft: 14,
    paddingRight: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
  },
  rowTitle: { fontFamily: 'DMSans_400Regular', fontSize: 17 },
  rowMeta: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    marginTop: 3,
    textTransform: 'capitalize',
  },
  reject: { fontFamily: 'DMSans_400Regular', fontSize: 12, marginTop: 4 },
});
