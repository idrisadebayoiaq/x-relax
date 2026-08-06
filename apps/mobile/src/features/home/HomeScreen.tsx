import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
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
import { useAppTheme } from '../../lib/useAppTheme';
import { supabase } from '../../lib/supabase';
import { formatDuration, moodPaletteFor } from '../../lib/format';
import { getDailyPlayStatus } from '../../lib/dailyListenLimit';
import { useAuth } from '../auth/AuthProvider';
import { usePlayer } from '../player/PlayerProvider';
import { WelcomeBanner } from './WelcomeBanner';
import { CoverArt } from './CoverArt';
import { CategoryCard, SoundCard } from '../../ui/Cards';
import { Icon } from '../../ui/Icon';
import { VerifiedBadge } from '../../ui/VerifiedBadge';
import { Ionicons } from '@expo/vector-icons';
import type { Sound } from '../../types/database';
import type { MainTabParamList, RootStackParamList } from '../../navigation/types';

type Section = {
  key: string;
  title: string;
  subtitle?: string;
  data: Sound[];
  icon?: keyof typeof Ionicons.glyphMap;
};
type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  cover_url?: string | null;
  created_by?: string | null;
};

const CATALOG_SLUGS = new Set([
  'birds',
  'fireplace',
  'forest',
  'meditation',
  'mixes',
  'ocean',
  'rain',
  'rivers',
  'thunder',
  'wind',
]);
type HomeNavigation = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Home'>,
  NativeStackNavigationProp<RootStackParamList>
>;

const { width: SCREEN_W } = Dimensions.get('window');
const HERO_H = Math.min(360, SCREEN_W * 0.92);

export function HomeScreen() {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { profile, user, isPremium, hasUnlimitedListening } = useAuth();
  const { playSound, current, isPlaying, togglePlay } = usePlayer();
  const navigation = useNavigation<HomeNavigation>();

  const [sections, setSections] = useState<Section[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [daily, setDaily] = useState<Sound | null>(null);
  const [catalogCount, setCatalogCount] = useState(0);
  const [dailyPlays, setDailyPlays] = useState<{ played: number; remaining: number; limit: number } | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const fade = useRef(new Animated.Value(0)).current;
  const heroLift = useRef(new Animated.Value(18)).current;

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [
        { data: published, error: soundsErr },
        { data: cats },
        { data: history },
        { data: dailySetting },
        { data: recommendedSetting },
      ] =
        await Promise.all([
          supabase
            .from('sounds')
            .select('*')
            .eq('status', 'published')
            .order('created_at', { ascending: false }),
          supabase
            .from('categories')
            .select('id, name, slug, cover_url, created_by')
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
          supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'daily_pick_sound_id')
            .maybeSingle(),
          supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'recommended_sound_ids')
            .maybeSingle(),
        ]);

      if (soundsErr) throw new Error(soundsErr.message);

      const all = (published as Sound[]) ?? [];
      setCatalogCount(all.length);

      const dailyPickId = (() => {
        const raw = dailySetting?.value;
        if (typeof raw === 'string') return raw.replace(/^"|"$/g, '');
        if (raw == null) return '';
        return String(raw).replace(/^"|"$/g, '');
      })();

      const recommendedIds: string[] = Array.isArray(recommendedSetting?.value)
        ? (recommendedSetting?.value as string[])
        : [];

      const continueListening = ((history as any[]) ?? [])
        .filter((h) => !h.completed && h.sound)
        .map((h) => h.sound as Sound);
      const trending = [...all].sort((a, b) => b.play_count - a.play_count).slice(0, 12);
      const featured = all.filter((s) => s.is_featured);
      const fromIds = recommendedIds
        .map((id) => all.find((s) => s.id === id))
        .filter(Boolean) as Sound[];
      const recommended =
        fromIds.length > 0
          ? fromIds
          : trending.slice(0, 12);

      const dailySound =
        (dailyPickId ? all.find((s) => s.id === dailyPickId) : undefined) ??
        featured[0] ??
        trending[0] ??
        all[0] ??
        null;

      setDaily(dailySound);

      const browseCats = ((cats as CategoryRow[]) ?? []).filter(
        (c) => CATALOG_SLUGS.has(c.slug) || Boolean(c.cover_url) || Boolean(c.created_by),
      );

      const next = (
        [
          {
            key: 'continue',
            title: 'Continue listening',
            subtitle: 'Pick up where you left off',
            data: continueListening,
            icon: 'play-forward-outline',
          },
          {
            key: 'featured',
            title: 'Featured for you',
            subtitle: 'Curated calm',
            data: featured.slice(0, 12),
            icon: 'star-outline',
          },
          {
            key: 'recommended',
            title: 'Recommended',
            subtitle: 'One pick from each mood',
            data: recommended,
            icon: 'sparkles-outline',
          },
          {
            key: 'trending',
            title: 'Trending now',
            data: trending,
            icon: 'trending-up-outline',
          },
        ] as Section[]
      ).filter((s) => s.data.length > 0);

      setSections(next);
      setCategories(browseCats);
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
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 520, useNativeDriver: true }),
      Animated.spring(heroLift, { toValue: 0, friction: 9, tension: 60, useNativeDriver: true }),
    ]).start();
  }, [loading, fade, heroLift]);

  const catalogSounds = useMemo(() => {
    const seen = new Set<string>();
    const items: Sound[] = [];
    for (const section of sections) {
      for (const sound of section.data) {
        if (seen.has(sound.id)) continue;
        seen.add(sound.id);
        items.push(sound);
      }
    }
    return items;
  }, [sections]);

  const openSound = async (sound: Sound, queue?: Sound[]) => {
    const playableQueue = queue ?? catalogSounds.length ? catalogSounds : [sound];
    const index = playableQueue.findIndex((item) => item.id === sound.id);
    const started = await playSound(sound, {
      queue: playableQueue,
      queueIndex: index >= 0 ? index : 0,
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

  const firstName = useMemo(() => {
    const raw = profile?.display_name?.trim();
    if (!raw) return 'listener';
    return raw.split(/\s+/)[0];
  }, [profile?.display_name]);

  const heroColors = daily ? moodPaletteFor(daily.title) : (['#0B1C1D', '#1A2E2F'] as [string, string]);

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
        colors={
          isDark
            ? ['#0A1214', '#000000', '#000000']
            : ['#F3F0EA', '#FFFFFF', '#FFFFFF']
        }
        locations={[0, 0.35, 1]}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingBottom: current ? 110 : 36,
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
        <WelcomeBanner />

        {!hasUnlimitedListening && dailyPlays ? (
          <View style={[styles.limitBanner, { borderColor: colors.border, marginHorizontal: 20 }]}>
            <Text style={[styles.limitTitle, { color: colors.text }]}>
              {dailyPlays.remaining > 0
                ? `${dailyPlays.remaining} of ${dailyPlays.limit} sounds left today`
                : 'Daily limit reached'}
            </Text>
            <Text style={[styles.limitBody, { color: colors.textMuted }]}>
              {dailyPlays.remaining > 0
                ? 'Free plan · normal track length · no sleep timer'
                : 'Upgrade to Premium for unlimited listening and sleep timer.'}
            </Text>
          </View>
        ) : null}

        <Animated.View style={{ opacity: fade, paddingHorizontal: 20 }}>
          <View style={styles.topRow}>
            <View>
              <Text style={[styles.brand, { color: colors.text }]}>X-Relax</Text>
              <View style={styles.helloRow}>
                <Text style={[styles.hello, { color: colors.textMuted }]}>
                  Good {greetingHour()}, {firstName}
                </Text>
                {isPremium ? <VerifiedBadge size={14} /> : null}
              </View>
            </View>
            <View style={styles.topActions}>
              {isPremium ? (
                <View style={[styles.passPill, { borderColor: colors.border }]}>
                  <Text style={[styles.passText, { color: colors.text }]}>Premium</Text>
                </View>
              ) : null}
              <Pressable
                onPress={() => openSearch()}
                hitSlop={12}
                style={[styles.iconBtn, { borderColor: colors.border }]}
              >
                <Icon name="search-outline" size={18} color={colors.text} />
              </Pressable>
              <Pressable
                onPress={() => navigation.navigate('Notifications')}
                hitSlop={12}
                style={[styles.iconBtn, { borderColor: colors.border }]}
              >
                <Icon name="notifications-outline" size={18} color={colors.text} />
              </Pressable>
            </View>
          </View>
        </Animated.View>

        {/* Hero daily pick */}
        <Animated.View
          style={{
            opacity: fade,
            transform: [{ translateY: heroLift }],
            marginTop: 22,
            paddingHorizontal: 20,
          }}
        >
          {daily ? (
            <Pressable onPress={() => openSound(daily, daily ? [daily, ...catalogSounds.filter((s) => s.id !== daily.id)] : undefined)} style={styles.heroPress}>
              <View style={[styles.hero, { height: HERO_H }]}>
                {daily.cover_url ? (
                  <CoverArt
                    title={daily.title}
                    uri={daily.cover_url}
                    size={SCREEN_W - 40}
                    rounded={0}
                    style={{ width: '100%', height: '100%', borderRadius: 22 }}
                  />
                ) : (
                  <LinearGradient
                    colors={[heroColors[0], heroColors[1], '#050505']}
                    locations={[0, 0.55, 1]}
                    start={{ x: 0.15, y: 0 }}
                    end={{ x: 0.9, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                )}
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.15)', 'rgba(0,0,0,0.88)']}
                  locations={[0.35, 0.62, 1]}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.heroCopy}>
                  <Text style={styles.heroEyebrow}>Today’s pick</Text>
                  <Text style={styles.heroTitle} numberOfLines={2}>
                    {daily.title}
                  </Text>
                  <Text style={styles.heroMeta}>
                    {formatDuration(daily.duration_seconds)}
                  </Text>
                  <View style={styles.heroCtaRow}>
                    <View style={styles.playCta}>
                      <Icon name="play" size={14} color="#0A0A0A" />
                      <Text style={styles.playCtaText}>Play</Text>
                    </View>
                    <Text style={styles.heroHint}>Unwind in one tap</Text>
                  </View>
                </View>
              </View>
            </Pressable>
          ) : (
            <View style={[styles.emptyHero, { borderColor: colors.border }]}>
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
          )}
        </Animated.View>

        {/* Moods / categories */}
        <Animated.View style={{ opacity: fade, marginTop: 28 }}>
          <View style={styles.sectionHead}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Icon name="grid-outline" size={18} color={colors.textMuted} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Browse moods</Text>
            </View>
            <Text style={[styles.sectionSub, { color: colors.textMuted }]}>
              {catalogCount ? `${catalogCount} sounds ready` : 'Find your frequency'}
            </Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.moodRow}
          >
            {categories.length ? (
              categories.map((c) => (
                <CategoryCard
                  key={c.id}
                  name={c.name}
                  slug={c.slug}
                  coverUrl={c.cover_url}
                  onPress={() => openSearch(c.name)}
                />
              ))
            ) : (
              <Text style={[styles.emptyBody, { color: colors.textMuted, paddingHorizontal: 20 }]}>
                Categories will show once synced.
              </Text>
            )}
          </ScrollView>
        </Animated.View>

        {/* Rails */}
        {sections.map((section) => (
          <Animated.View key={section.key} style={{ opacity: fade, marginTop: 28 }}>
            <View style={styles.sectionHead}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Icon
                  name={section.icon ?? 'musical-notes-outline'}
                  size={18}
                  color={colors.textMuted}
                />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>{section.title}</Text>
              </View>
              {section.subtitle ? (
                <Text style={[styles.sectionSub, { color: colors.textMuted }]}>
                  {section.subtitle}
                </Text>
              ) : null}
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.rail}
              decelerationRate="fast"
            >
              {section.data.map((item) => (
                <SoundCard
                  key={`${section.key}-${item.id}`}
                  sound={item}
                  compact
                  onPress={() => openSound(item, section.data)}
                />
              ))}
            </ScrollView>
          </Animated.View>
        ))}

        <Animated.View style={{ opacity: fade, marginTop: 28, paddingHorizontal: 20 }}>
          <Pressable
            onPress={() => openSearch()}
            style={[styles.allSoundsBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
          >
            <Icon name="albums-outline" size={20} color={colors.text} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.allSoundsTitle, { color: colors.text }]}>All sounds</Text>
              <Text style={[styles.allSoundsSub, { color: colors.textMuted }]}>
                Browse the full catalog{catalogCount ? ` · ${catalogCount} tracks` : ''}
              </Text>
            </View>
            <Icon name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        </Animated.View>

        {!sections.length && daily ? (
          <View style={{ paddingHorizontal: 20, marginTop: 28 }}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Keep exploring</Text>
            <Pressable
              onPress={() => openSearch()}
              style={[styles.linkRow, { borderColor: colors.border }]}
            >
              <Text style={{ color: colors.text, fontFamily: 'DMSans_500Medium' }}>
                Open search
              </Text>
              <Text style={{ color: colors.textMuted }}>→</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>

      {current ? (
        <Pressable
          onPress={() => navigation.navigate('Player', { soundId: current.id })}
          style={[
            styles.nowPlaying,
            {
              borderColor: colors.border,
              backgroundColor: isDark ? 'rgba(18,18,18,0.96)' : 'rgba(255,255,255,0.96)',
              bottom: 0,
              paddingBottom: 10,
            },
          ]}
        >
          <CoverArt title={current.title} uri={current.cover_url} size={44} rounded={10} />
          <View style={{ flex: 1, marginHorizontal: 12 }}>
            <Text style={[styles.npTitle, { color: colors.text }]} numberOfLines={1}>
              {current.title}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 12, fontFamily: 'DMSans_400Regular' }}>
              {isPlaying ? 'Playing now' : 'Paused'}
            </Text>
          </View>
          <Pressable
            onPress={() => {
              void togglePlay();
            }}
            hitSlop={10}
            style={[styles.npBtn, { backgroundColor: colors.inverse }]}
          >
            <Text style={{ color: colors.inverseText, fontWeight: '700' }}>
              {isPlaying ? 'Ⅱ' : '▶'}
            </Text>
          </Pressable>
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
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  brand: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 34,
    letterSpacing: -0.8,
    lineHeight: 38,
  },
  hello: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
  },
  helloRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  passPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  passText: { fontFamily: 'DMSans_500Medium', fontSize: 11, letterSpacing: 0.3 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroPress: { borderRadius: 22, overflow: 'hidden' },
  hero: {
    width: '100%',
    borderRadius: 22,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  heroCopy: { padding: 20, paddingBottom: 22 },
  heroEyebrow: {
    fontFamily: 'DMSans_500Medium',
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  heroTitle: {
    fontFamily: 'Fraunces_700Bold',
    color: '#FFFFFF',
    fontSize: 30,
    letterSpacing: -0.6,
    lineHeight: 34,
  },
  heroMeta: {
    fontFamily: 'DMSans_400Regular',
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    marginTop: 8,
  },
  heroCtaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 18,
  },
  playCta: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  playCtaText: {
    fontFamily: 'DMSans_700Bold',
    color: '#000000',
    fontSize: 14,
  },
  heroHint: {
    fontFamily: 'DMSans_400Regular',
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
  },
  emptyHero: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 24,
    minHeight: 200,
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
  sectionHead: { paddingHorizontal: 20, marginBottom: 14 },
  sectionTitle: {
    fontFamily: 'Fraunces_600SemiBold',
    fontSize: 22,
    letterSpacing: -0.3,
  },
  sectionSub: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    marginTop: 4,
  },
  moodRow: { paddingHorizontal: 20, gap: 14 },
  moodItem: { width: 76, alignItems: 'center' },
  moodDisc: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginBottom: 8,
  },
  moodLabel: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 12,
    textAlign: 'center',
  },
  rail: { paddingHorizontal: 20, gap: 14 },
  tile: { width: 148 },
  tileTitle: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 14,
    marginTop: 10,
    lineHeight: 18,
  },
  tileMeta: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    marginTop: 4,
  },
  linkRow: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
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
  nowPlaying: {
    position: 'absolute',
    left: 12,
    right: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  npTitle: { fontFamily: 'DMSans_700Bold', fontSize: 14 },
  npBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
