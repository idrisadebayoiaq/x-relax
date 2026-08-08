import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../lib/useAppTheme';
import { supabase } from '../../lib/supabase';
import { moodPaletteFor } from '../../lib/format';
import { categoriesWithSounds } from '../../lib/recommendations';
import type { RootStackParamList } from '../../navigation/types';

type Cat = {
  id: string;
  name: string;
  slug: string;
  cover_url?: string | null;
  created_by?: string | null;
  sort_order?: number | null;
  soundCount: number;
};

const CATALOG_SLUGS = new Set([
  'asmr',
  'bell',
  'birds',
  'children',
  'fireplace',
  'focus',
  'forest',
  'healing',
  'meditation',
  'nature',
  'ocean',
  'rain',
  'reading',
  'relaxation',
  'rivers',
  'sleep',
  'thunder',
  'wind',
]);

export function CategoriesAllScreen() {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [items, setItems] = useState<Cat[]>([]);
  const [loading, setLoading] = useState(true);

  const gap = 12;
  const pad = 16;
  const cardW = (width - pad * 2 - gap) / 2;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: cats }, { data: links }, { data: published }] = await Promise.all([
        supabase
          .from('categories')
          .select('id, name, slug, cover_url, created_by, sort_order')
          .is('parent_id', null)
          .order('sort_order'),
        supabase.from('sound_categories').select('sound_id, category_id'),
        supabase.from('sounds').select('id').eq('status', 'published'),
      ]);
      const publishedIds = new Set(((published as { id: string }[]) ?? []).map((s) => s.id));
      const linkRows = (links as { sound_id: string; category_id: string }[]) ?? [];
      const catRows = (cats as Omit<Cat, 'soundCount'>[]) ?? [];
      const withSounds = categoriesWithSounds(catRows, linkRows, publishedIds).filter(
        (c) => CATALOG_SLUGS.has(c.slug) || Boolean(c.cover_url) || Boolean(c.created_by),
      );
      const counts = new Map<string, number>();
      for (const row of linkRows) {
        if (!publishedIds.has(row.sound_id)) continue;
        counts.set(row.category_id, (counts.get(row.category_id) ?? 0) + 1);
      }
      setItems(
        withSounds.map((c) => ({
          ...c,
          soundCount: counts.get(c.id) ?? 0,
        })),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const openCategory = (cat: Cat) => {
    navigation.navigate('CategoryDetail', { categoryId: cat.id, name: cat.name });
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.back}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]}>Categories</Text>
        <View style={styles.back} />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.icon} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={{ gap, paddingHorizontal: pad }}
          contentContainerStyle={{ gap, paddingBottom: insets.bottom + 24 }}
          renderItem={({ item }) => {
            const [a, b] = moodPaletteFor(item.slug || item.name);
            return (
              <Pressable
                onPress={() => openCategory(item)}
                style={[styles.card, { width: cardW, height: cardW * 1.15 }]}
              >
                {item.cover_url ? (
                  <Image
                    source={{ uri: item.cover_url }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                  />
                ) : (
                  <LinearGradient colors={[a, b]} style={StyleSheet.absoluteFill} />
                )}
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.75)']}
                  locations={[0.45, 1]}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.cardFoot}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.cardMeta}>
                      {item.soundCount} Sound{item.soundCount === 1 ? '' : 's'}
                    </Text>
                  </View>
                  <View style={[styles.dl, { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.25)' }]}>
                    <Ionicons name="cloud-download-outline" size={16} color="#FFFFFF" />
                  </View>
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.textMuted }]}>No categories yet.</Text>
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
  card: {
    borderRadius: 18,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  cardFoot: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    padding: 12,
  },
  cardTitle: {
    fontFamily: 'DMSans_700Bold',
    color: '#FFFFFF',
    fontSize: 16,
  },
  cardMeta: {
    fontFamily: 'DMSans_400Regular',
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    marginTop: 2,
  },
  dl: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    textAlign: 'center',
    marginTop: 40,
    fontFamily: 'DMSans_400Regular',
    paddingHorizontal: 24,
  },
});
