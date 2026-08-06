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
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient
        colors={isDark ? ['#121212', '#000'] : ['#F3F0EA', '#FFF']}
        style={StyleSheet.absoluteFill}
      />
      <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 20 }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <Text style={[styles.back, { color: colors.textMuted }]}>‹ Back</Text>
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]}>My sounds</Text>
        <Text style={[styles.sub, { color: colors.textMuted }]}>
          Published, pending, and rejected uploads
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.icon} style={{ marginTop: 28 }} />
      ) : (
        <FlatList
          data={sounds}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          ListEmptyComponent={
            <EmptyBlock title="No uploads yet" body="Upload your first track from the Creator tab." />
          }
          ItemSeparatorComponent={() => (
            <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border }} />
          )}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <CoverArt title={item.title} uri={item.cover_url} size={52} rounded={12} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={[styles.rowMeta, { color: colors.textMuted }]}>
                  {item.status}
                  {item.duration_seconds ? ` · ${formatDuration(item.duration_seconds)}` : ''}
                </Text>
                {item.rejection_reason ? (
                  <Text style={[styles.reject, { color: colors.textMuted }]}>
                    {item.rejection_reason}
                  </Text>
                ) : null}
              </View>
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
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 },
  rowTitle: { fontFamily: 'DMSans_700Bold', fontSize: 15, marginBottom: 3 },
  rowMeta: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    textTransform: 'capitalize',
  },
  reject: { fontFamily: 'DMSans_400Regular', fontSize: 12, marginTop: 4 },
});
