import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../lib/useAppTheme';
import { moodPaletteFor } from '../../lib/format';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import { useAppSettings } from '../../lib/AppSettingsProvider';
import { loadSuggestedPlaylists } from '../../lib/playlistSuggestions';
import { loadCachedLibrarySnapshot } from '../../lib/offlineCache';
import type { Playlist } from '../../types/database';
import type { RootStackParamList } from '../../navigation/types';

type SortMode = 'recent' | 'alpha' | 'discover';

type ListRow =
  | { kind: 'favourites'; id: 'favourites'; title: string }
  | { kind: 'playlist'; id: string; playlist: Playlist };

export function PlaylistsListScreen() {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const { online } = useAppSettings();

  const [mine, setMine] = useState<Playlist[]>([]);
  const [discover, setDiscover] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortMode>('recent');
  const [sortOpen, setSortOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'public'>('private');
  const [favCount, setFavCount] = useState(0);

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    if (!online) {
      const snap = await loadCachedLibrarySnapshot();
      setMine(snap?.playlists ?? []);
      setDiscover([]);
      setFavCount(snap?.favourites.length ?? 0);
      setLoading(false);
      return;
    }
    try {
      const [{ data: own }, suggested, { count }] = await Promise.all([
        supabase
          .from('playlists')
          .select('*, items:playlist_items(position, sound:sounds(cover_url))')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false }),
        loadSuggestedPlaylists({ userId: user.id, limit: 40 }),
        supabase
          .from('favourites')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id),
      ]);

      setMine(
        ((own as any[]) ?? []).map((p) => {
          const items = [...(p.items ?? [])].sort(
            (a: any, b: any) => (a.position ?? 0) - (b.position ?? 0),
          );
          return {
            ...p,
            cover_url: p.cover_url ?? items[0]?.sound?.cover_url ?? null,
            item_count: items.length,
          } as Playlist;
        }),
      );
      setDiscover(suggested);
      setFavCount(Number(count ?? 0));
    } catch {
      const snap = await loadCachedLibrarySnapshot();
      setMine(snap?.playlists ?? []);
      setDiscover([]);
      setFavCount(snap?.favourites.length ?? 0);
    }
    setLoading(false);
  }, [user, online]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const createPlaylist = async () => {
    if (!online) {
      Alert.alert('Offline', 'Connect to the internet to create a playlist.');
      return;
    }
    if (!user || !title.trim()) {
      Alert.alert('Name required', 'Give your playlist a name.');
      return;
    }
    setCreating(true);
    const { data, error } = await supabase
      .from('playlists')
      .insert({
        user_id: user.id,
        title: title.trim(),
        visibility,
      })
      .select('id')
      .single();
    setCreating(false);
    if (error) {
      Alert.alert('Could not create playlist', error.message);
      return;
    }
    setTitle('');
    setVisibility('private');
    setCreateOpen(false);
    await load();
    if (data?.id) navigation.navigate('PlaylistDetail', { playlistId: data.id });
  };

  const promptCreate = () => {
    setTitle('');
    setVisibility('private');
    setCreateOpen(true);
  };

  const filteredPlaylists = useMemo(() => {
    const source = sort === 'discover' ? discover : mine;
    const q = query.trim().toLowerCase();
    let list = q ? source.filter((p) => p.title.toLowerCase().includes(q)) : [...source];
    if (sort === 'alpha') {
      list.sort((a, b) => a.title.localeCompare(b.title));
    }
    return list;
  }, [mine, discover, query, sort]);

  const rows: ListRow[] = useMemo(() => {
    const next: ListRow[] = [];
    const q = query.trim().toLowerCase();
    const showFavourites =
      sort !== 'discover' && (!q || 'favourite songs'.includes(q) || 'favorites'.includes(q));
    if (showFavourites) {
      next.push({ kind: 'favourites', id: 'favourites', title: 'Favourite Songs' });
    }
    for (const playlist of filteredPlaylists) {
      next.push({ kind: 'playlist', id: playlist.id, playlist });
    }
    return next;
  }, [filteredPlaylists, query, sort]);

  const separatorColor = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)';
  const searchBg = colors.surface;

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Top chrome */}
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={28} color={colors.text} />
        </Pressable>
        <View style={styles.topActions}>
          <Pressable onPress={promptCreate} hitSlop={10} style={styles.iconBtn}>
            <Ionicons name="add" size={28} color={colors.text} />
          </Pressable>
          <Pressable onPress={() => setSortOpen(true)} hitSlop={10} style={styles.iconBtn}>
            <Ionicons name="filter-outline" size={22} color={colors.text} />
          </Pressable>
        </View>
      </View>

      <Text style={[styles.heroTitle, { color: colors.text }]}>Playlists</Text>

      <View style={[styles.searchWrap, { backgroundColor: searchBg }]}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search in Playlists"
          placeholderTextColor={colors.textMuted}
          style={[styles.searchInput, { color: colors.text }]}
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
        {query.length > 0 && Platform.OS !== 'ios' ? (
          <Pressable onPress={() => setQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.icon} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.textMuted }]}>
              {sort === 'discover'
                ? 'No public playlists to suggest yet.'
                : query
                  ? 'No playlists match your search.'
                  : 'No playlists yet — tap + to create one.'}
            </Text>
          }
          renderItem={({ item, index }) => {
            const isLast = index === rows.length - 1;
            if (item.kind === 'favourites') {
              return (
                <Pressable
                  onPress={() => navigation.navigate('FavouritesList')}
                  style={styles.row}
                >
                  <View style={styles.pinCol}>
                    <Ionicons name="star" size={14} color={colors.textMuted} />
                  </View>
                  <View style={[styles.favArt, { backgroundColor: isDark ? '#F5F5F5' : '#FFFFFF' }]}>
                    <Ionicons name="star" size={36} color="#C45C4A" />
                  </View>
                  <View style={[styles.rowBody, { borderBottomColor: isLast ? 'transparent' : separatorColor }]}>
                    <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
                      Favourite Songs
                    </Text>
                    {favCount > 0 ? (
                      <Text style={[styles.rowMeta, { color: colors.textMuted }]}>
                        {favCount} liked
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              );
            }

            const pl = item.playlist;
            const [a, b] = moodPaletteFor(pl.title);
            return (
              <Pressable
                onPress={() => navigation.navigate('PlaylistDetail', { playlistId: pl.id })}
                style={styles.row}
              >
                <View style={styles.pinCol} />
                <View style={styles.art}>
                  {pl.cover_url ? (
                    <Image
                      source={{ uri: pl.cover_url }}
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                    />
                  ) : (
                    <LinearGradient colors={[a, b]} style={StyleSheet.absoluteFill}>
                      <Text style={styles.artTitle} numberOfLines={2}>
                        {pl.title}
                      </Text>
                    </LinearGradient>
                  )}
                </View>
                <View style={[styles.rowBody, { borderBottomColor: isLast ? 'transparent' : separatorColor }]}>
                  <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
                    {pl.title}
                  </Text>
                  <Text style={[styles.rowMeta, { color: colors.textMuted }]} numberOfLines={1}>
                    {sort === 'discover' && pl.owner?.display_name
                      ? pl.owner.display_name
                      : pl.visibility === 'public'
                        ? 'Public'
                        : 'Private'}
                    {pl.item_count != null ? ` · ${pl.item_count}` : ''}
                  </Text>
                </View>
              </Pressable>
            );
          }}
        />
      )}

      {/* Sort sheet */}
      <Modal visible={sortOpen} transparent animationType="fade" onRequestClose={() => setSortOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setSortOpen(false)}>
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: colors.elevated,
                paddingBottom: insets.bottom + 16,
              },
            ]}
          >
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Sort & filter</Text>
            {(
              [
                ['recent', 'Recently updated', 'time-outline'],
                ['alpha', 'Title A–Z', 'text-outline'],
                ['discover', 'For you (public)', 'sparkles-outline'],
              ] as const
            ).map(([key, label, icon]) => {
              const active = sort === key;
              return (
                <Pressable
                  key={key}
                  onPress={() => {
                    setSort(key);
                    setSortOpen(false);
                  }}
                  style={styles.sheetRow}
                >
                  <Ionicons name={icon} size={20} color={colors.text} />
                  <Text style={[styles.sheetRowText, { color: colors.text }]}>{label}</Text>
                  {active ? <Ionicons name="checkmark" size={20} color={colors.text} /> : null}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>

      {/* Create sheet */}
      <Modal visible={createOpen} transparent animationType="slide" onRequestClose={() => setCreateOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setCreateOpen(false)}>
          <Pressable
            style={[
              styles.createSheet,
              {
                backgroundColor: colors.elevated,
                paddingBottom: insets.bottom + 20,
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.sheetTitle, { color: colors.text }]}>New Playlist</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Playlist name"
              placeholderTextColor={colors.textMuted}
              autoFocus
              style={[
                styles.createInput,
                {
                  color: colors.text,
                  borderColor: separatorColor,
                  backgroundColor: colors.surface,
                },
              ]}
            />
            <View style={styles.visRow}>
              {(['private', 'public'] as const).map((v) => {
                const active = visibility === v;
                return (
                  <Pressable
                    key={v}
                    onPress={() => setVisibility(v)}
                    style={[
                      styles.visChip,
                      {
                        borderColor: active ? colors.text : separatorColor,
                        backgroundColor: active
                          ? isDark
                            ? 'rgba(255,255,255,0.1)'
                            : 'rgba(0,0,0,0.06)'
                          : 'transparent',
                      },
                    ]}
                  >
                    <Ionicons
                      name={v === 'private' ? 'lock-closed-outline' : 'globe-outline'}
                      size={14}
                      color={colors.text}
                    />
                    <Text style={{ color: colors.text, fontFamily: 'DMSans_500Medium', fontSize: 13 }}>
                      {v === 'private' ? 'Private' : 'Public'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable
              onPress={() => void createPlaylist()}
              disabled={creating}
              style={[
                styles.createBtn,
                { backgroundColor: colors.inverse, opacity: creating ? 0.6 : 1 },
              ]}
            >
              <Text style={{ color: colors.inverseText, fontFamily: 'DMSans_700Bold', fontSize: 16 }}>
                {creating ? 'Creating…' : 'Create'}
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    minHeight: 44,
  },
  topActions: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 34,
    letterSpacing: -0.8,
    paddingHorizontal: 16,
    marginTop: 4,
    marginBottom: 14,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 4,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
    paddingVertical: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 6,
    minHeight: 72,
  },
  pinCol: {
    width: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  art: {
    width: 56,
    height: 56,
    borderRadius: 4,
    overflow: 'hidden',
  },
  favArt: {
    width: 56,
    height: 56,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  artTitle: {
    color: 'rgba(255,255,255,0.9)',
    fontFamily: 'DMSans_700Bold',
    fontSize: 11,
    padding: 6,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
    marginLeft: 14,
    paddingRight: 16,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
  },
  rowTitle: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 17,
    letterSpacing: -0.2,
  },
  rowMeta: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    marginTop: 3,
  },
  empty: {
    textAlign: 'center',
    marginTop: 48,
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    paddingHorizontal: 32,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 18,
    paddingHorizontal: 20,
  },
  createSheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 18,
    paddingHorizontal: 20,
    gap: 14,
  },
  sheetTitle: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 20,
    marginBottom: 8,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
  },
  sheetRowText: {
    flex: 1,
    fontFamily: 'DMSans_500Medium',
    fontSize: 16,
  },
  createInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
  },
  visRow: { flexDirection: 'row', gap: 8 },
  visChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  createBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
});
