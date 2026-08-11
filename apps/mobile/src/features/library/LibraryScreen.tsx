import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../lib/useAppTheme';
import { moodPaletteFor } from '../../lib/format';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import { useAppSettings } from '../../lib/AppSettingsProvider';
import {
  cacheLibrarySnapshot,
  loadCachedDownloads,
  loadCachedLibrarySnapshot,
} from '../../lib/offlineCache';
import type { Playlist, Sound } from '../../types/database';
import type { MainTabParamList, RootStackParamList } from '../../navigation/types';
import type { SavedMix } from '../mix/MixProvider';

type LibraryNavigation = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Library'>,
  NativeStackNavigationProp<RootStackParamList>
>;

type HubRow = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: keyof RootStackParamList;
  count?: number;
};

type RecentItem = {
  id: string;
  title: string;
  subtitle: string;
  coverUrl?: string | null;
  onPress: () => void;
};

export function LibraryScreen() {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { user, canDownloadOffline } = useAuth();
  const { online } = useAppSettings();
  const navigation = useNavigation<LibraryNavigation>();

  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [favourites, setFavourites] = useState<Sound[]>([]);
  const [mixes, setMixes] = useState<SavedMix[]>([]);
  const [downloadCount, setDownloadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const gap = 12;
  const pad = 20;
  const cardW = (width - pad * 2 - gap) / 2;

  const applySnapshot = useCallback(
    (snap: {
      playlists: Playlist[];
      favourites: Sound[];
      mixes: SavedMix[];
      downloadCount: number;
    }) => {
      setPlaylists(snap.playlists);
      setFavourites(snap.favourites);
      setMixes(snap.mixes);
      setDownloadCount(snap.downloadCount);
    },
    [],
  );

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (!online) {
      const [snap, downloads] = await Promise.all([
        loadCachedLibrarySnapshot(),
        loadCachedDownloads(),
      ]);
      if (snap) {
        applySnapshot({
          playlists: snap.playlists,
          favourites: snap.favourites,
          mixes: snap.mixes.map(
            (m) =>
              ({
                id: m.id,
                title: m.title,
                user_id: user.id,
                duration_seconds: m.durationSeconds,
                tracks: m.tracks ?? [],
                created_at: '',
                updated_at: '',
              }) as SavedMix,
          ),
          downloadCount: snap.downloadCount || downloads.length,
        });
      } else {
        applySnapshot({
          playlists: [],
          favourites: [],
          mixes: [],
          downloadCount: downloads.length,
        });
      }
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const [{ data: pls }, { data: favs }, { data: mixRows }, dlsResult] = await Promise.all([
        supabase
          .from('playlists')
          .select('*, items:playlist_items(position, sound:sounds(cover_url))')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false }),
        supabase
          .from('favourites')
          .select('sound:sounds(*)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('mixes')
          .select('*, tracks:mix_tracks(volume, position, sound:sounds(*))')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false }),
        canDownloadOffline
          ? supabase
              .from('downloads')
              .select('id', { count: 'exact', head: true })
              .eq('user_id', user.id)
          : Promise.resolve({ count: 0 }),
      ]);

      const normalizedPlaylists = ((pls as any[]) ?? []).map((p) => {
        const items = [...(p.items ?? [])].sort(
          (a: any, b: any) => (a.position ?? 0) - (b.position ?? 0),
        );
        return {
          ...p,
          cover_url: p.cover_url ?? items[0]?.sound?.cover_url ?? null,
          item_count: items.length,
        } as Playlist;
      });

      const nextFavourites = ((favs as any[]) ?? []).map((f) => f.sound).filter(Boolean) as Sound[];
      const nextMixes = ((mixRows as SavedMix[]) ?? [])
        .map((mix) => ({
          ...mix,
          tracks: [...(mix.tracks ?? [])].sort((a, b) => a.position - b.position),
        }))
        .filter((mix) => mix.tracks.length > 0);
      const nextDownloadCount = Number((dlsResult as { count?: number }).count ?? 0);

      applySnapshot({
        playlists: normalizedPlaylists,
        favourites: nextFavourites,
        mixes: nextMixes,
        downloadCount: nextDownloadCount,
      });

      await cacheLibrarySnapshot({
        playlists: normalizedPlaylists,
        favourites: nextFavourites,
        mixes: nextMixes.map((m) => ({
          id: m.id,
          title: m.title,
          durationSeconds: Number(m.duration_seconds ?? 0),
          trackCount: m.tracks.length,
          cover: m.tracks[0]?.sound?.cover_url ?? null,
          tracks: m.tracks,
        })),
        downloadCount: nextDownloadCount,
        updatedAt: new Date().toISOString(),
      });
    } catch {
      const [snap, downloads] = await Promise.all([
        loadCachedLibrarySnapshot(),
        loadCachedDownloads(),
      ]);
      if (snap) {
        applySnapshot({
          playlists: snap.playlists,
          favourites: snap.favourites,
          mixes: snap.mixes.map(
            (m) =>
              ({
                id: m.id,
                title: m.title,
                user_id: user.id,
                duration_seconds: m.durationSeconds,
                tracks: m.tracks ?? [],
                created_at: '',
                updated_at: '',
              }) as SavedMix,
          ),
          downloadCount: snap.downloadCount || downloads.length,
        });
      }
    }
    setLoading(false);
    setRefreshing(false);
  }, [user, canDownloadOffline, online, applySnapshot]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const hubRows: HubRow[] = useMemo(
    () => [
      {
        key: 'playlists',
        label: 'Playlists',
        icon: 'musical-notes-outline',
        route: 'PlaylistsList',
        count: playlists.length,
      },
      {
        key: 'favourites',
        label: 'Favourites',
        icon: 'heart-outline',
        route: 'FavouritesList',
        count: favourites.length,
      },
      {
        key: 'mixes',
        label: 'My Mixes',
        icon: 'layers-outline',
        route: 'LibraryMixes',
        count: mixes.length,
      },
      {
        key: 'downloads',
        label: 'Downloaded',
        icon: 'download-outline',
        route: 'DownloadsList',
        count: downloadCount,
      },
      {
        key: 'sounds',
        label: 'All sounds',
        icon: 'albums-outline',
        route: 'Tabs',
      },
    ],
    [playlists.length, favourites.length, mixes.length, downloadCount],
  );

  const recentlyAdded: RecentItem[] = useMemo(() => {
    const items: RecentItem[] = [];
    for (const pl of playlists.slice(0, 8)) {
      items.push({
        id: `pl-${pl.id}`,
        title: pl.title,
        subtitle: pl.visibility === 'public' ? 'Public playlist' : 'Private playlist',
        coverUrl: pl.cover_url,
        onPress: () => navigation.navigate('PlaylistDetail', { playlistId: pl.id }),
      });
    }
    for (const mix of mixes.slice(0, 4)) {
      items.push({
        id: `mix-${mix.id}`,
        title: mix.title,
        subtitle: `${mix.tracks.length} layered sounds`,
        coverUrl: mix.tracks[0]?.sound?.cover_url,
        onPress: () => navigation.navigate('MixStudio', { mixId: mix.id }),
      });
    }
    for (const fav of favourites.slice(0, 4)) {
      items.push({
        id: `fav-${fav.id}`,
        title: fav.title,
        subtitle: 'Favourite',
        coverUrl: fav.cover_url,
        onPress: () => navigation.navigate('FavouritesList'),
      });
    }
    return items.slice(0, 12);
  }, [playlists, mixes, favourites, navigation]);

  const openHub = (row: HubRow) => {
    if (row.key === 'sounds') {
      navigation.navigate('Search');
      return;
    }
    navigation.navigate(row.route as never);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient
        colors={isDark ? ['#101010', '#000000', '#000000'] : ['#F3F0EA', '#FFFFFF', '#FFFFFF']}
        locations={[0, 0.28, 1]}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingBottom: 40,
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
        <View style={styles.header}>
          <Text style={[styles.brand, { color: colors.text }]}>Library</Text>
          <View style={styles.headerActions}>
            <Pressable
              onPress={() => navigation.navigate('PlaylistsList')}
              hitSlop={10}
              style={styles.iconHit}
            >
              <Ionicons name="add" size={24} color={colors.text} />
            </Pressable>
            <Pressable
              onPress={() => navigation.navigate('Search')}
              hitSlop={10}
              style={styles.iconHit}
            >
              <Ionicons name="ellipsis-horizontal" size={22} color={colors.text} />
            </Pressable>
          </View>
        </View>

        {!online ? (
          <View
            style={[
              styles.offlineBanner,
              { borderColor: colors.border, backgroundColor: colors.surface },
            ]}
          >
            <Ionicons name="cloud-offline-outline" size={16} color={colors.text} />
            <Text style={{ color: colors.textMuted, fontFamily: 'DMSans_400Regular', fontSize: 13, flex: 1 }}>
              Offline · browse Library · play downloaded sounds only
            </Text>
          </View>
        ) : null}

        {loading ? (
          <ActivityIndicator color={colors.icon} style={{ marginTop: 40 }} />
        ) : (
          <>
            <View style={styles.hubList}>
              {hubRows.map((row, index) => (
                <Pressable
                  key={row.key}
                  onPress={() => openHub(row)}
                  style={[
                    styles.hubRow,
                    index < hubRows.length - 1 && {
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: colors.border,
                    },
                  ]}
                >
                  <Ionicons name={row.icon} size={22} color={colors.text} />
                  <Text style={[styles.hubLabel, { color: colors.text }]}>{row.label}</Text>
                  {typeof row.count === 'number' ? (
                    <Text style={[styles.hubCount, { color: colors.textMuted }]}>{row.count}</Text>
                  ) : (
                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                  )}
                </Pressable>
              ))}
            </View>

            <View style={styles.recentHead}>
              <Text style={[styles.recentTitle, { color: colors.text }]}>Recently Added</Text>
            </View>

            {recentlyAdded.length ? (
              <View style={[styles.grid, { paddingHorizontal: pad, gap }]}>
                {recentlyAdded.map((item) => {
                  const [a, b] = moodPaletteFor(item.title);
                  return (
                    <Pressable
                      key={item.id}
                      onPress={item.onPress}
                      style={{ width: cardW }}
                    >
                      <View style={[styles.cardArt, { width: cardW, height: cardW }]}>
                        {item.coverUrl ? (
                          <Image
                            source={{ uri: item.coverUrl }}
                            style={StyleSheet.absoluteFill}
                            contentFit="cover"
                          />
                        ) : (
                          <LinearGradient colors={[a, b]} style={StyleSheet.absoluteFill} />
                        )}
                        <LinearGradient
                          colors={['rgba(0,0,0,0.45)', 'transparent']}
                          style={styles.cardShade}
                        />
                        <Text style={styles.cardOverlayTitle} numberOfLines={2}>
                          {item.title}
                        </Text>
                      </View>
                      <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <Text style={[styles.cardSub, { color: colors.textMuted }]} numberOfLines={1}>
                        {item.subtitle}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <Text style={[styles.emptyRecent, { color: colors.textMuted }]}>
                Create a playlist or save favourites — they’ll show up here.
              </Text>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  brand: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 34,
    letterSpacing: -0.8,
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconHit: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hubList: { paddingHorizontal: 20 },
  hubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
  },
  hubLabel: {
    flex: 1,
    fontFamily: 'DMSans_500Medium',
    fontSize: 20,
  },
  hubCount: { fontFamily: 'DMSans_400Regular', fontSize: 15 },
  recentHead: {
    paddingHorizontal: 20,
    marginTop: 28,
    marginBottom: 14,
  },
  recentTitle: {
    fontFamily: 'Fraunces_600SemiBold',
    fontSize: 22,
    letterSpacing: -0.3,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cardArt: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 8,
  },
  cardShade: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 56,
  },
  cardOverlayTitle: {
    position: 'absolute',
    left: 10,
    top: 10,
    right: 10,
    color: '#FFFFFF',
    fontFamily: 'DMSans_700Bold',
    fontSize: 13,
  },
  cardTitle: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 14,
  },
  cardSub: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    marginTop: 2,
    marginBottom: 14,
  },
  emptyRecent: {
    paddingHorizontal: 20,
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    lineHeight: 20,
  },
  offlineBanner: {
    marginHorizontal: 20,
    marginBottom: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
});
