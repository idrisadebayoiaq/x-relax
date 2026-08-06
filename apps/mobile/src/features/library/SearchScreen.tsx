import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../lib/useAppTheme';
import { supabase } from '../../lib/supabase';
import { usePlayer } from '../player/PlayerProvider';
import { SoundCard } from '../../ui/Cards';
import { EmptyBlock } from '../../ui/Screen';
import type { Sound } from '../../types/database';
import type { MainTabParamList, RootStackParamList } from '../../navigation/types';

type SortKey = 'newest' | 'popular' | 'rating';

export function SearchScreen() {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { playSound } = usePlayer();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<MainTabParamList, 'Search'>>();
  const [query, setQuery] = useState(route.params?.query ?? '');
  const [sort, setSort] = useState<SortKey>('newest');
  const [sounds, setSounds] = useState<Sound[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (route.params?.query) setQuery(route.params.query);
    }, [route.params?.query]),
  );

  const load = useCallback(async () => {
    let q = supabase.from('sounds').select('*').eq('status', 'published');
    if (sort === 'newest') q = q.order('created_at', { ascending: false });
    if (sort === 'popular') q = q.order('play_count', { ascending: false });
    if (sort === 'rating') q = q.order('average_rating', { ascending: false });
    const { data } = await q;
    setSounds((data as Sound[]) ?? []);
    setLoading(false);
  }, [sort]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sounds;
    return sounds.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        (s.description ?? '').toLowerCase().includes(q),
    );
  }, [sounds, query]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient
        colors={isDark ? ['#121212', '#000'] : ['#F3F0EA', '#FFF']}
        style={StyleSheet.absoluteFill}
      />
      <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 20 }}>
        <Text style={[styles.title, { color: colors.text }]}>
          {query.trim() ? 'Search' : 'All sounds'}
        </Text>
        <Text style={[styles.sub, { color: colors.textMuted }]}>
          {query.trim()
            ? 'Find rain, forest, ocean, thunder, and more'
            : 'Browse the full published catalog'}
        </Text>
        <View
          style={[
            styles.inputWrap,
            {
              borderColor: colors.border,
              backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : colors.surface,
            },
          ]}
        >
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            style={[styles.input, { color: colors.text }]}
            placeholder="Search by title or mood"
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
          />
          {query ? (
            <Pressable onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
        <View style={styles.sortRow}>
          {(['newest', 'popular', 'rating'] as SortKey[]).map((key) => {
            const selected = sort === key;
            return (
              <Pressable
                key={key}
                onPress={() => setSort(key)}
                style={[
                  styles.sortChip,
                  {
                    backgroundColor: selected ? colors.inverse : 'transparent',
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text
                  style={{
                    color: selected ? colors.inverseText : colors.textMuted,
                    fontFamily: 'DMSans_700Bold',
                    fontSize: 12,
                    textTransform: 'capitalize',
                  }}
                >
                  {key}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.icon} style={{ marginTop: 32 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, paddingTop: 8 }}
          ListEmptyComponent={
            <EmptyBlock title="No matches" body="Try another word, or clear the search." />
          }
          renderItem={({ item }) => (
            <SoundCard
              sound={item}
              onPress={async () => {
                const index = filtered.findIndex((s) => s.id === item.id);
                const started = await playSound(item, {
                  queue: filtered,
                  queueIndex: index,
                  queueLabel: 'Search results',
                });
                if (started) navigation.navigate('Player', { soundId: item.id });
              }}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: 'Fraunces_700Bold', fontSize: 34, letterSpacing: -0.8 },
  sub: { fontFamily: 'DMSans_400Regular', fontSize: 14, marginTop: 6, marginBottom: 16 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 13,
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
  },
  sortRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  sortChip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
});
