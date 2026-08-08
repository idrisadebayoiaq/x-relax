import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../lib/useAppTheme';
import { supabase } from '../../lib/supabase';
import { formatDuration } from '../../lib/format';
import { getDailyPlayStatus } from '../../lib/dailyListenLimit';
import {
  buildNewReleasesFromFollows,
  buildPersonalizedRecommended,
  categoriesWithSounds,
  followCountryBias,
} from '../../lib/recommendations';
import { CATEGORY_ICONS } from '../../lib/categoryRails';
import { useAuth } from '../auth/AuthProvider';
import { usePlayer } from '../player/PlayerProvider';
import { WelcomeBanner } from './WelcomeBanner';
import { ListeningTipBanner } from './ListeningTipBanner';
import { CoverArt } from './CoverArt';
import { SoundCard } from '../../ui/Cards';
import { VerifiedBadge } from '../../ui/VerifiedBadge';
import { AppMenu } from '../../navigation/AppMenu';
import { loadSuggestedPlaylists } from '../../lib/playlistSuggestions';
import { moodPaletteFor } from '../../lib/format';
import type { Playlist, Sound } from '../../types/database';
import type { MainTabParamList, RootStackParamList } from '../../navigation/types';
import { Image } from 'expo-image';

type Section = {
  key: string;
  title: string;
  subtitle?: string;
  data: Sound[];
};

type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  cover_url?: string | null;
  created_by?: string | null;
  sort_order?: number | null;
};

type ContinueItem = {
  sound: Sound;
  progressSeconds: number;
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

const HOME_CAT_PRIORITY = [
  'nature',
  'sleep',
  'meditation',
  'focus',
  'rain',
  'ocean',
  'asmr',
  'relaxation',
];

type HomeNavigation = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Home'>,
  NativeStackNavigationProp<RootStackParamList>
>;

function formatPlaysShort(count: number | null | undefined): string {
  const n = Number(count ?? 0);
  if (!Number.isFinite(n) || n <= 0) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${Math.floor(n)}`;
}

function pickHomeCategories(cats: CategoryRow[], limit = 5): CategoryRow[] {
  const bySlug = new Map(cats.map((c) => [c.slug, c]));
  const picked: CategoryRow[] = [];
  const used = new Set<string>();
  for (const slug of HOME_CAT_PRIORITY) {
    const cat = bySlug.get(slug);
    if (!cat || used.has(cat.id)) continue;
    picked.push(cat);
    used.add(cat.id);
    if (picked.length >= limit) return picked;
  }
  for (const cat of cats) {
    if (used.has(cat.id)) continue;
    picked.push(cat);
    used.add(cat.id);
    if (picked.length >= limit) break;
  }
  return picked;
}

export function HomeScreen() {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { profile, user, isPremium, hasUnlimitedListening } = useAuth();
  const { playSound, toggleFavourite, isFavourite, current } = usePlayer();
  const navigation = useNavigation<HomeNavigation>();

  const [sections, setSections] = useState<Section[]>([]);
  const [continueItems, setContinueItems] = useState<ContinueItem[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [trending, setTrending] = useState<Sound[]>([]);
  const [suggestedPlaylists, setSuggestedPlaylists] = useState<Playlist[]>([]);
  const [catalogCount, setCatalogCount] = useState(0);
  const [dailyPlays, setDailyPlays] = useState<{ played: number; remaining: number; limit: number } | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const fade = useRef(new Animated.Value(0)).current;

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [
        { data: published, error: soundsErr },
        { data: cats },
        { data: history },
        { data: preferenceHistory },
        { data: favourites },
        { data: recommendedSetting },
        { data: categoryLinks },
        { data: follows },
      ] = await Promise.all([
        supabase
          .from('sounds')
          .select('*')
          .eq('status', 'published')
          .order('created_at', { ascending: false }),
        supabase
          .from('categories')
          .select('id, name, slug, cover_url, created_by, sort_order')
          .is('parent_id', null)
          .order('sort_order'),
        user
          ? supabase
              .from('listening_history')
              .select('sound_id, progress_seconds, completed, played_at, sound:sounds(*)')
              .eq('user_id', user.id)
              .order('played_at', { ascending: false })
              .limit(12)
          : Promise.resolve({ data: [] as any[] }),
        user
          ? supabase
              .from('listening_history')
              .select('sound_id')
              .eq('user_id', user.id)
              .order('played_at', { ascending: false })
              .limit(80)
          : Promise.resolve({ data: [] as any[] }),
        user
          ? supabase
              .from('favourites')
              .select('sound_id, created_at')
              .eq('user_id', user.id)
              .order('created_at', { ascending: false })
              .limit(80)
          : Promise.resolve({ data: [] as { sound_id: string }[] }),
        supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'recommended_sound_ids')
          .maybeSingle(),
        supabase.from('sound_categories').select('sound_id, category_id'),
        user
          ? supabase.from('creator_follows').select('creator_id').eq('follower_id', user.id)
          : Promise.resolve({ data: [] as { creator_id: string }[] }),
      ]);

      if (soundsErr) throw new Error(soundsErr.message);

      const all = (published as Sound[]) ?? [];
      setCatalogCount(all.length);

      const recommendedIds: string[] = Array.isArray(recommendedSetting?.value)
        ? (recommendedSetting?.value as string[])
        : [];

      const continueRaw = ((history as any[]) ?? [])
        .filter((h) => !h.completed && h.sound)
        .map((h) => ({
          sound: h.sound as Sound,
          progressSeconds: Number(h.progress_seconds ?? 0),
        }));
      setContinueItems(continueRaw);

      const trendingSorted = [...all].sort((a, b) => b.play_count - a.play_count);
      setTrending(trendingSorted.slice(0, 10));

      const featured = all.filter((s) => s.is_featured);
      const links = (categoryLinks as { sound_id: string; category_id: string }[]) ?? [];
      const recentHistorySoundIds = [
        ...new Set(
          ((preferenceHistory as { sound_id: string }[]) ?? []).map((h) => h.sound_id).filter(Boolean),
        ),
      ];
      const likedSoundIds = [
        ...new Set(
          ((favourites as { sound_id: string }[]) ?? []).map((f) => f.sound_id).filter(Boolean),
        ),
      ];
      const followedCreatorIds = [
        ...new Set(
          ((follows as { creator_id: string }[]) ?? []).map((f) => f.creator_id).filter(Boolean),
        ),
      ];
      const creatorIds = [
        ...new Set(
          all.map((s) => s.creator_id).filter(Boolean).concat(followedCreatorIds) as string[],
        ),
      ];
      const creatorCountries: Record<string, string | null> = {};
      if (creatorIds.length) {
        const { data: creatorProfiles } = await supabase
          .from('profiles')
          .select('id, country_code')
          .in('id', creatorIds);
        for (const row of (creatorProfiles as { id: string; country_code: string | null }[]) ?? []) {
          creatorCountries[row.id] = row.country_code;
        }
      }
      const bias = followCountryBias(followedCreatorIds.map((id) => creatorCountries[id]));
      const recommended = buildPersonalizedRecommended({
        all,
        categoryLinks: links,
        recentHistorySoundIds,
        likedSoundIds,
        adminRecommendedIds: recommendedIds,
        creatorCountries,
        followBias: bias,
        limit: 12,
      });
      const newReleases = buildNewReleasesFromFollows({
        all,
        followedCreatorIds,
        limit: 12,
      });

      const catRows = (cats as CategoryRow[]) ?? [];
      const publishedIds = new Set(all.map((s) => s.id));
      const withSounds = categoriesWithSounds(catRows, links, publishedIds);
      const browseCats = withSounds.filter(
        (c) => CATALOG_SLUGS.has(c.slug) || Boolean(c.cover_url) || Boolean(c.created_by),
      );
      setCategories(browseCats);

      const recommendedSubtitle = bias
        ? bias === 'NG'
          ? 'Weighted toward creators you follow in Nigeria'
          : 'Weighted toward creators you follow internationally'
        : likedSoundIds.length
          ? recentHistorySoundIds.length
            ? 'Based on likes and listening'
            : 'Based on sounds you like'
          : recentHistorySoundIds.length
            ? 'Based on what you listen to most'
            : 'Picks to start your calm library';

      const next = (
        [
          {
            key: 'new_releases',
            title: 'New Release',
            subtitle: 'From creators you follow',
            data: newReleases,
          },
          {
            key: 'featured',
            title: 'Featured for you',
            subtitle: 'Curated calm',
            data: featured.slice(0, 12),
          },
          {
            key: 'recommended',
            title: 'Recommended for you',
            subtitle: recommendedSubtitle,
            data: recommended,
          },
        ] as Section[]
      ).filter((s) => s.data.length > 0);

      setSections(next);
      const suggested = await loadSuggestedPlaylists({ userId: user?.id, limit: 12 });
      setSuggestedPlaylists(suggested);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load home');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
      if (hasUnlimitedListening) {
        setDailyPlays(null);
        return;
      }
      getDailyPlayStatus(user?.id ?? null, false)
        .then(setDailyPlays)
        .catch(() => undefined);
    }, [load, user?.id, hasUnlimitedListening]),
  );

  useEffect(() => {
    if (loading) return;
    Animated.timing(fade, { toValue: 1, duration: 520, useNativeDriver: true }).start();
  }, [loading, fade]);

  const homeCategories = useMemo(() => pickHomeCategories(categories, 5), [categories]);

  const openSound = async (sound: Sound, queue?: Sound[], queueLabel?: string) => {
    const playableQueue = queue ?? [sound];
    const index = playableQueue.findIndex((item) => item.id === sound.id);
    const started = await playSound(sound, {
      queue: playableQueue,
      queueIndex: index >= 0 ? index : 0,
      queueLabel: queueLabel ?? (queue ? undefined : 'All sounds'),
    });
    if (!started) return;
    if (!hasUnlimitedListening) {
      getDailyPlayStatus(user?.id ?? null, false)
        .then(setDailyPlays)
        .catch(() => undefined);
    }
    navigation.navigate('Player', { soundId: sound.id });
  };

  const openSearch = (query?: string) => {
    navigation.navigate('Search', query ? { query } : undefined);
  };

  const displayName = useMemo(() => {
    const raw = profile?.display_name?.trim();
    if (!raw) return 'Listener';
    return raw.split(/\s+/)[0];
  }, [profile?.display_name]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.icon} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient
        colors={isDark ? ['#0A1214', '#000000', '#000000'] : ['#F3F0EA', '#FFFFFF', '#FFFFFF']}
        locations={[0, 0.35, 1]}
        style={StyleSheet.absoluteFill}
      />

      <AppMenu visible={menuOpen} onClose={() => setMenuOpen(false)} />
      <WelcomeBanner />
      <ListeningTipBanner />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingBottom: current ? 24 : 36,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={colors.icon}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {!hasUnlimitedListening && dailyPlays ? (
          <View style={[styles.limitBanner, { borderColor: colors.border, marginHorizontal: 20 }]}>
            <Text style={[styles.limitTitle, { color: colors.text }]}>
              {dailyPlays.remaining > 0
                ? `${dailyPlays.remaining} of ${dailyPlays.limit} sounds left today`
                : 'Daily limit reached'}
            </Text>
            <Text style={[styles.limitBody, { color: colors.textMuted }]}>
              {dailyPlays.remaining > 0
                ? `Free plan · unlock ${dailyPlays.limit} sounds/day · replay those freely`
                : 'You can still replay today’s unlocked sounds. Upgrade to Premium for unlimited listening.'}
            </Text>
          </View>
        ) : null}

        {/* Header */}
        <Animated.View style={{ opacity: fade, paddingHorizontal: 16 }}>
          <View style={styles.topRow}>
            <Pressable onPress={() => setMenuOpen(true)} hitSlop={12} style={styles.iconHit}>
              <Ionicons name="menu" size={24} color={colors.text} />
            </Pressable>
            <View style={styles.greetingBlock}>
              <Text style={[styles.greeting, { color: colors.text }]}>
                Good {greetingHour()}
              </Text>
              <View style={styles.nameRow}>
                <Text style={[styles.userName, { color: colors.text }]} numberOfLines={1}>
                  {displayName}
                </Text>
                {isPremium ? <VerifiedBadge size={16} tone="white" /> : null}
              </View>
            </View>
            <Pressable
              onPress={() => navigation.navigate('Notifications')}
              hitSlop={12}
              style={styles.iconHit}
            >
              <Ionicons name="notifications-outline" size={22} color={colors.text} />
            </Pressable>
          </View>

          {/* Search */}
          <Pressable
            onPress={() => openSearch()}
            style={[styles.searchBar, { backgroundColor: isDark ? '#1A1A1A' : colors.surface, borderColor: colors.border }]}
          >
            <Ionicons name="search" size={18} color={colors.textMuted} />
            <Text style={[styles.searchPlaceholder, { color: colors.textMuted }]} numberOfLines={1}>
              Search sounds, moods, or creators...
            </Text>
          </Pressable>
        </Animated.View>

        {loadError || (!sections.length && !continueItems.length && !trending.length && !catalogCount) ? (
          <View style={[styles.emptyHero, { borderColor: colors.border, marginHorizontal: 20, marginTop: 20 }]}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Your calm space</Text>
            <Text style={[styles.emptyBody, { color: colors.textMuted }]}>
              {loadError
                ? loadError
                : 'Published sounds will appear here. Pull to refresh if you just installed.'}
            </Text>
            <Pressable
              onPress={() => openSearch()}
              style={[styles.playCta, { backgroundColor: colors.inverse }]}
            >
              <Text style={[styles.playCtaText, { color: colors.inverseText }]}>Browse library</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Continue listening */}
        {continueItems.length ? (
          <Animated.View style={{ opacity: fade, marginTop: 26 }}>
            <SectionHeader
              title="Continue listening"
              onSeeAll={() => openSearch()}
              colors={colors}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.railPad}
              decelerationRate="fast"
            >
              {continueItems.slice(0, 8).map((item) => {
                const duration = Number(item.sound.duration_seconds ?? 0);
                const progress = Math.min(
                  1,
                  duration > 0 ? item.progressSeconds / duration : 0,
                );
                return (
                  <Pressable
                    key={item.sound.id}
                    onPress={() =>
                      void openSound(
                        item.sound,
                        continueItems.map((c) => c.sound),
                        'Continue listening',
                      )
                    }
                    style={[
                      styles.continueCard,
                      { backgroundColor: isDark ? '#141414' : colors.surface, borderColor: colors.border },
                    ]}
                  >
                    <View style={styles.continueArt}>
                      <CoverArt
                        title={item.sound.title}
                        uri={item.sound.cover_url}
                        size={72}
                        rounded={12}
                      />
                      <View style={styles.continuePlay}>
                        <Ionicons name="play" size={14} color="#0A0A0A" />
                      </View>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[styles.continueTitle, { color: colors.text }]} numberOfLines={1}>
                        {item.sound.title}
                      </Text>
                      <Text style={[styles.continueMeta, { color: colors.textMuted }]} numberOfLines={1}>
                        {formatDuration(item.sound.duration_seconds) || 'Sound'}
                      </Text>
                      <View style={[styles.progressTrack, { backgroundColor: isDark ? '#2A2A2A' : '#E5E5E5' }]}>
                        <View
                          style={[
                            styles.progressFill,
                            { width: `${Math.max(4, progress * 100)}%`, backgroundColor: colors.text },
                          ]}
                        />
                      </View>
                      <Text style={[styles.progressTimes, { color: colors.textMuted }]}>
                        {formatDuration(item.progressSeconds) || '0:00'}
                        {duration ? ` / ${formatDuration(duration)}` : ''}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => {
                        if (current?.id === item.sound.id) void toggleFavourite();
                      }}
                      hitSlop={10}
                      style={styles.heartHit}
                    >
                      <Ionicons
                        name={current?.id === item.sound.id && isFavourite ? 'heart' : 'heart-outline'}
                        size={18}
                        color={colors.textMuted}
                      />
                    </Pressable>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Animated.View>
        ) : null}

        {/* Featured + Recommended rails */}
        {sections.map((section) => (
          <Animated.View key={section.key} style={{ opacity: fade, marginTop: 26 }}>
            <SectionHeader
              title={section.title}
              onSeeAll={
                section.key === 'recommended' ||
                section.key === 'featured' ||
                section.key === 'new_releases'
                  ? () => openSearch()
                  : undefined
              }
              colors={colors}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.railPad}
              decelerationRate="fast"
            >
              {section.data.map((item) => (
                <SoundCard
                  key={`${section.key}-${item.id}`}
                  sound={item}
                  compact
                  onPress={() => openSound(item, section.data, section.title)}
                />
              ))}
            </ScrollView>
          </Animated.View>
        ))}

        {/* Playlists for you */}
        {suggestedPlaylists.length ? (
          <Animated.View style={{ opacity: fade, marginTop: 26 }}>
            <SectionHeader
              title="Playlists for you"
              onSeeAll={() => navigation.navigate('PlaylistsList')}
              colors={colors}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.railPad}
              decelerationRate="fast"
            >
              {suggestedPlaylists.map((pl) => {
                const [a, b] = moodPaletteFor(pl.title);
                return (
                  <Pressable
                    key={pl.id}
                    onPress={() => navigation.navigate('PlaylistDetail', { playlistId: pl.id })}
                    style={styles.playlistCard}
                  >
                    <View style={styles.playlistArt}>
                      {pl.cover_url ? (
                        <Image
                          source={{ uri: pl.cover_url }}
                          style={StyleSheet.absoluteFill}
                          contentFit="cover"
                        />
                      ) : (
                        <LinearGradient colors={[a, b]} style={StyleSheet.absoluteFill} />
                      )}
                    </View>
                    <Text style={[styles.playlistTitle, { color: colors.text }]} numberOfLines={2}>
                      {pl.title}
                    </Text>
                    <Text style={[styles.playlistMeta, { color: colors.textMuted }]} numberOfLines={1}>
                      {pl.owner?.display_name ?? 'Public playlist'}
                      {pl.item_count != null ? ` · ${pl.item_count}` : ''}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Animated.View>
        ) : null}

        {/* Categories — 5 chips + see all */}
        <Animated.View style={{ opacity: fade, marginTop: 26 }}>
          <SectionHeader
            title="Categories"
            onSeeAll={() => navigation.navigate('CategoriesAll')}
            colors={colors}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.railPad}
          >
            {homeCategories.map((c) => {
              const icon = (CATEGORY_ICONS[c.slug] ??
                'musical-notes-outline') as keyof typeof Ionicons.glyphMap;
              return (
                <Pressable
                  key={c.id}
                  onPress={() =>
                    navigation.navigate('CategoryDetail', {
                      categoryId: c.id,
                      name: c.name,
                    })
                  }
                  style={styles.moodItem}
                >
                  <View
                    style={[
                      styles.moodDisc,
                      {
                        backgroundColor: isDark ? '#1A1A1A' : colors.surface,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Ionicons name={icon} size={22} color={colors.text} />
                  </View>
                  <Text style={[styles.moodLabel, { color: colors.text }]} numberOfLines={1}>
                    {c.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </Animated.View>

        {/* Trending — top 10 by play count */}
        {trending.length ? (
          <Animated.View style={{ opacity: fade, marginTop: 26 }}>
            <SectionHeader
              title="Trending now"
              onSeeAll={() => navigation.navigate('TrendingAll')}
              colors={colors}
            />
            <View style={{ paddingHorizontal: 16, gap: 10 }}>
              {trending.map((item, index) => (
                <Pressable
                  key={item.id}
                  onPress={() => void openSound(item, trending, 'Trending now')}
                  style={styles.trendRow}
                >
                  <Text style={[styles.trendRank, { color: colors.textMuted }]}>{index + 1}</Text>
                  <CoverArt title={item.title} uri={item.cover_url} size={52} rounded={10} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.trendTitle, { color: colors.text }]} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <View style={styles.trendMetaRow}>
                      <Ionicons name="play" size={11} color={colors.textMuted} />
                      <Text style={[styles.trendMeta, { color: colors.textMuted }]}>
                        {formatPlaysShort(item.play_count)}
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="ellipsis-horizontal" size={18} color={colors.textMuted} />
                </Pressable>
              ))}
            </View>
          </Animated.View>
        ) : null}

        <Animated.View style={{ opacity: fade, marginTop: 28, paddingHorizontal: 16 }}>
          <Pressable
            onPress={() => openSearch()}
            style={[
              styles.allSoundsBtn,
              { borderColor: colors.border, backgroundColor: colors.surface },
            ]}
          >
            <Ionicons name="albums-outline" size={20} color={colors.text} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.allSoundsTitle, { color: colors.text }]}>All sounds</Text>
              <Text style={[styles.allSoundsSub, { color: colors.textMuted }]}>
                Browse the full catalog{catalogCount ? ` · ${catalogCount} tracks` : ''}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

function SectionHeader({
  title,
  onSeeAll,
  colors,
}: {
  title: string;
  onSeeAll?: () => void;
  colors: { text: string; textMuted: string };
}) {
  return (
    <View style={styles.sectionHead}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      {onSeeAll ? (
        <Pressable onPress={onSeeAll} hitSlop={8}>
          <Text style={[styles.seeAll, { color: colors.textMuted }]}>See All</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function greetingHour() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  limitBanner: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  limitTitle: { fontFamily: 'DMSans_700Bold', fontSize: 14, marginBottom: 4 },
  limitBody: { fontFamily: 'DMSans_400Regular', fontSize: 12, lineHeight: 17 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  iconHit: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greetingBlock: { flex: 1, alignItems: 'center' },
  greeting: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 22,
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 2,
  },
  userName: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 14,
    maxWidth: 180,
  },
  searchBar: {
    marginTop: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchPlaceholder: { flex: 1, fontFamily: 'DMSans_400Regular', fontSize: 14 },
  sectionHead: {
    paddingHorizontal: 16,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontFamily: 'Fraunces_600SemiBold',
    fontSize: 20,
    letterSpacing: -0.3,
  },
  seeAll: { fontFamily: 'DMSans_500Medium', fontSize: 13 },
  railPad: { paddingHorizontal: 16, gap: 12 },
  continueCard: {
    width: 300,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  continueArt: { position: 'relative' },
  continuePlay: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueTitle: { fontFamily: 'DMSans_700Bold', fontSize: 15 },
  continueMeta: { fontFamily: 'DMSans_400Regular', fontSize: 12, marginTop: 2 },
  progressTrack: {
    height: 3,
    borderRadius: 2,
    marginTop: 10,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 2 },
  progressTimes: { fontFamily: 'DMSans_400Regular', fontSize: 11, marginTop: 6 },
  heartHit: { padding: 4 },
  moodItem: { width: 76, alignItems: 'center' },
  moodDisc: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  moodLabel: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 12,
    textAlign: 'center',
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  trendRank: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 15,
    width: 22,
    textAlign: 'center',
  },
  trendTitle: { fontFamily: 'DMSans_700Bold', fontSize: 15 },
  trendMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  trendMeta: { fontFamily: 'DMSans_400Regular', fontSize: 12 },
  allSoundsBtn: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  allSoundsTitle: { fontFamily: 'DMSans_700Bold', fontSize: 16 },
  allSoundsSub: { fontFamily: 'DMSans_400Regular', fontSize: 12, marginTop: 2 },
  playlistCard: { width: 140 },
  playlistArt: {
    width: 140,
    height: 140,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 8,
  },
  playlistTitle: { fontFamily: 'DMSans_700Bold', fontSize: 13, lineHeight: 17 },
  playlistMeta: { fontFamily: 'DMSans_400Regular', fontSize: 11, marginTop: 2 },
  emptyHero: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 24,
    minHeight: 180,
    justifyContent: 'center',
  },
  emptyTitle: {
    fontFamily: 'Fraunces_600SemiBold',
    fontSize: 24,
    marginBottom: 8,
  },
  emptyBody: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 18,
  },
  playCta: {
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  playCtaText: { fontFamily: 'DMSans_700Bold', fontSize: 14 },
});
