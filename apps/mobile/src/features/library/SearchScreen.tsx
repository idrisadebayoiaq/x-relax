import { useCallback, useEffect, useMemo, useState } from 'react';
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
  const [debounced, setDebounced] = useState(query.trim());
  const [sort, setSort] = useState<SortKey>('newest');
  const [sounds, setSounds] = useState<Sound[]>([]);
  const [loading, setLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (route.params?.query) setQuery(route.params.query);
    }, [route.params?.query]),
  );

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(id);
  }, [query]);

  const load = useCallback(async () => {
    const q = debounced;
    const safe = q.replace(/[%_,]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!safe) {
      setSounds([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    let req = supabase
      .from('sounds')
      .select('*')
      .eq('status', 'published')
      .or(`title.ilike.%${safe}%,description.ilike.%${safe}%`)
      .limit(40);
    if (sort === 'newest') req = req.order('created_at', { ascending: false });
    if (sort === 'popular') req = req.order('play_count', { ascending: false });
    if (sort === 'rating') req = req.order('average_rating', { ascending: false });
    const { data } = await req;
    setSounds((data as Sound[]) ?? []);
    setLoading(false);
  }, [debounced, sort]);

  useEffect(() => {
    void load();
  }, [load]);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || q === debounced.toLowerCase()) return sounds.slice(0, 8);
    return sounds
      .filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          (s.description ?? '').toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [sounds, query, debounced]);

  const showResults = debounced.length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient
        colors={isDark ? ['#121212', '#000'] : ['#F3F0EA', '#FFF']}
        style={StyleSheet.absoluteFill}
      />
      <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 20 }}>
        <Text style={[styles.title, { color: colors.text }]}>Search</Text>
        <Text style={[styles.sub, { color: colors.textMuted }]}>
          Type to find rain, forest, ocean, thunder, and more
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
            autoFocus={!!route.params?.query}
          />
          {query ? (
            <Pressable onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>

        {query.trim() && suggestions.length > 0 ? (
          <View style={styles.suggestWrap}>
            {suggestions.map((s) => (
              <Pressable
                key={`sg-${s.id}`}
                onPress={() => setQuery(s.title)}
                style={[styles.suggestRow, { borderColor: colors.border }]}
              >
                <Ionicons name="musical-note-outline" size={14} color={colors.textMuted} />
                <Text style={{ color: colors.text, fontFamily: 'DMSans_500Medium', flex: 1 }} numberOfLines={1}>
                  {s.title}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {showResults ? (
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
        ) : null}
      </View>

      {!showResults ? (
        <EmptyBlock
          title="Search sounds"
          body="Start typing to see matching sounds. Nothing loads until you search."
        />
      ) : loading ? (
        <ActivityIndicator color={colors.icon} style={{ marginTop: 32 }} />
      ) : (
        <FlatList
          data={sounds}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, paddingTop: 8 }}
          ListEmptyComponent={
            <EmptyBlock title="No matches" body="Try another word, or clear the search." />
          }
          renderItem={({ item }) => (
            <SoundCard
              sound={item}
              onPress={async () => {
                const index = sounds.findIndex((s) => s.id === item.id);
                const started = await playSound(item, {
                  queue: sounds,
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
  suggestWrap: { gap: 6, marginBottom: 10 },
  suggestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  sortRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  sortChip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
});
