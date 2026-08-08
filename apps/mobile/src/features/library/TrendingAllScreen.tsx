import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../lib/useAppTheme';
import { supabase } from '../../lib/supabase';
import { formatPlayCount } from '../../lib/format';
import { usePlayer } from '../player/PlayerProvider';
import { CoverArt } from '../home/CoverArt';
import type { Sound } from '../../types/database';
import type { RootStackParamList } from '../../navigation/types';

function formatPlaysShort(count: number | null | undefined): string {
  const n = Number(count ?? 0);
  if (!Number.isFinite(n) || n <= 0) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${Math.floor(n)}`;
}

export function TrendingAllScreen() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { playSound } = usePlayer();
  const [items, setItems] = useState<Sound[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('sounds')
        .select('*')
        .eq('status', 'published')
        .order('play_count', { ascending: false })
        .limit(100);
      setItems((data as Sound[]) ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const openSound = async (sound: Sound, index: number) => {
    const started = await playSound(sound, {
      queue: items,
      queueIndex: index,
      queueLabel: 'Trending now',
    });
    if (started) navigation.navigate('Player', { soundId: sound.id });
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.back}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]}>Trending now</Text>
        <View style={styles.back} />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.icon} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24 }}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          renderItem={({ item, index }) => (
            <Pressable
              onPress={() => void openSound(item, index)}
              style={[styles.row, { borderColor: colors.border, backgroundColor: colors.surface }]}
            >
              <Text style={[styles.rank, { color: colors.textMuted }]}>{index + 1}</Text>
              <CoverArt title={item.title} uri={item.cover_url} size={56} rounded={12} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
                  {item.title}
                </Text>
                <View style={styles.metaRow}>
                  <Ionicons name="play" size={11} color={colors.textMuted} />
                  <Text style={[styles.meta, { color: colors.textMuted }]}>
                    {formatPlaysShort(item.play_count)} · {formatPlayCount(item.play_count)}
                  </Text>
                </View>
              </View>
              <Ionicons name="play-circle-outline" size={28} color={colors.text} />
            </Pressable>
          )}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.textMuted }]}>No trending sounds yet.</Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: 'Fraunces_700Bold', fontSize: 22, letterSpacing: -0.3 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 10,
  },
  rank: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 15,
    width: 22,
    textAlign: 'center',
  },
  rowTitle: { fontFamily: 'DMSans_700Bold', fontSize: 15 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  meta: { fontFamily: 'DMSans_400Regular', fontSize: 12 },
  empty: {
    textAlign: 'center',
    marginTop: 40,
    fontFamily: 'DMSans_400Regular',
  },
});
