import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
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
import { formatDuration, formatPlayCount, formatRatingSummary, moodPaletteFor } from '../../lib/format';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import { usePlayer } from '../player/PlayerProvider';
import { CoverArt } from '../home/CoverArt';
import type { Playlist, Sound } from '../../types/database';
import type { MainTabParamList, RootStackParamList } from '../../navigation/types';

type TabKey = 'playlists' | 'favourites' | 'downloads';
type LibraryNavigation = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Library'>,
  NativeStackNavigationProp<RootStackParamList>
>;

const TABS: {
  key: TabKey;
  label: string;
  hint: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: 'playlists', label: 'Playlists', hint: 'Your collections', icon: 'list' },
  { key: 'favourites', label: 'Favourites', hint: 'Saved sounds', icon: 'heart' },
  { key: 'downloads', label: 'Downloads', hint: 'Offline ready', icon: 'download' },
];

export function LibraryScreen() {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { user, canDownloadOffline } = useAuth();
  const { playSound } = usePlayer();
  const navigation = useNavigation<LibraryNavigation>();
  const [tab, setTab] = useState<TabKey>('playlists');
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [favourites, setFavourites] = useState<Sound[]>([]);
  const [downloads, setDownloads] = useState<(Sound & { local_uri?: string | null })[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    const [{ data: pls }, { data: favs }, dlsResult] = await Promise.all([
      supabase
        .from('playlists')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false }),
      supabase
        .from('favourites')
        .select('sound:sounds(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      canDownloadOffline
        ? supabase
            .from('downloads')
            .select('local_uri, sound:sounds(*)')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [] as { local_uri: string | null; sound: Sound | null }[] }),
    ]);
    setPlaylists((pls as Playlist[]) ?? []);
    setFavourites(((favs as any[]) ?? []).map((f) => f.sound).filter(Boolean));
    const dls = dlsResult.data;
    setDownloads(
      ((dls as any[]) ?? [])
        .map((d) => (d.sound ? { ...d.sound, local_uri: d.local_uri } : null))
        .filter(Boolean),
    );
    setLoading(false);
  }, [user, canDownloadOffline]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const counts = useMemo(
    () => ({
      playlists: playlists.length,
      favourites: favourites.length,
      downloads: downloads.length,
    }),
    [playlists.length, favourites.length, downloads.length],
  );

  const createPlaylist = async () => {
    if (!user || !newTitle.trim()) return;
    setCreating(true);
    const { error } = await supabase.from('playlists').insert({
      user_id: user.id,
      title: newTitle.trim(),
    });
    setCreating(false);
    if (error) {
      Alert.alert('Could not create playlist', error.message);
      return;
    }
    setNewTitle('');
    load();
  };

  const openSound = async (
    item: Sound & { local_uri?: string | null },
    list?: (Sound & { local_uri?: string | null })[],
    label?: string,
  ) => {
    const playable = item.local_uri ? { ...item, audio_url: item.local_uri } : item;
    const source = list ?? [item];
    const queue = source.map((entry) =>
      entry.local_uri ? { ...entry, audio_url: entry.local_uri } : entry,
    );
    const index = queue.findIndex((entry) => entry.id === item.id);
    const started = await playSound(playable, {
      queue,
      queueIndex: index >= 0 ? index : 0,
      queueLabel: label,
    });
    if (started) navigation.navigate('Player', { soundId: item.id });
  };

  const activeTab = TABS.find((t) => t.key === tab)!;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient
        colors={
          isDark ? ['#101010', '#000000', '#000000'] : ['#F3F0EA', '#FFFFFF', '#FFFFFF']
        }
        locations={[0, 0.28, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={[styles.brand, { color: colors.text }]}>Library</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          Playlists, saves, and offline calm
        </Text>

        <View style={styles.segment}>
          {TABS.map((item) => {
            const selected = tab === item.key;
            return (
              <Pressable
                key={item.key}
                onPress={() => setTab(item.key)}
                style={[
                  styles.segmentItem,
                  selected && {
                    backgroundColor: colors.inverse,
                  },
                ]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons
                    name={item.icon}
                    size={14}
                    color={selected ? colors.inverseText : colors.textMuted}
                  />
                  <Text
                    style={[
                      styles.segmentLabel,
                      { color: selected ? colors.inverseText : colors.textMuted },
                    ]}
                  >
                    {item.label}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.segmentCount,
                    { color: selected ? colors.inverseText : colors.textMuted },
                  ]}
                >
                  {counts[item.key]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.icon} style={{ marginTop: 40 }} />
      ) : tab === 'playlists' ? (
        <FlatList
          data={playlists}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View style={styles.createBlock}>
              <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
                {activeTab.hint}
              </Text>
              <View style={styles.createRow}>
                <TextInput
                  style={[
                    styles.input,
                    {
                      color: colors.text,
                      borderColor: colors.border,
                      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : colors.surface,
                    },
                  ]}
                  placeholder="Name a new playlist"
                  placeholderTextColor={colors.textMuted}
                  value={newTitle}
                  onChangeText={setNewTitle}
                  onSubmitEditing={createPlaylist}
                  returnKeyType="done"
                />
                <Pressable
                  style={[
                    styles.addBtn,
                    {
                      backgroundColor: newTitle.trim() ? colors.inverse : colors.surface,
                      borderColor: colors.border,
                      opacity: creating ? 0.6 : 1,
                    },
                  ]}
                  onPress={createPlaylist}
                  disabled={creating || !newTitle.trim()}
                >
                  <Text
                    style={{
                      color: newTitle.trim() ? colors.inverseText : colors.textMuted,
                      fontFamily: 'DMSans_700Bold',
                      fontSize: 14,
                    }}
                  >
                    Create
                  </Text>
                </Pressable>
              </View>
            </View>
          }
          renderItem={({ item, index }) => (
            <Pressable
              onPress={() => navigation.navigate('PlaylistDetail', { playlistId: item.id })}
              style={styles.playlistRow}
            >
              <LinearGradient
                colors={moodPaletteFor(item.title)}
                style={styles.playlistArt}
              >
                <Text style={styles.playlistArtMark}>
                  {(item.title.trim()[0] ?? 'P').toUpperCase()}
                </Text>
              </LinearGradient>
              <View style={styles.playlistMeta}>
                <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={[styles.rowSub, { color: colors.textMuted }]}>
                  {item.is_favourite ? 'Favourites collection' : `Playlist · #${index + 1}`}
                </Text>
              </View>
              <Text style={{ color: colors.textMuted, fontSize: 18 }}>›</Text>
            </Pressable>
          )}
          ListEmptyComponent={
            <EmptyState
              colors={colors}
              title="No playlists yet"
              body="Create one above to group night rains, focus beds, and sleep stacks."
            />
          }
          ItemSeparatorComponent={() => (
            <View style={[styles.sep, { backgroundColor: colors.border }]} />
          )}
        />
      ) : tab === 'favourites' ? (
        <FlatList
          data={favourites}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <Text style={[styles.sectionLabel, { color: colors.textMuted, marginBottom: 14 }]}>
              {activeTab.hint}
            </Text>
          }
          renderItem={({ item }) => (
            <SoundRow
              sound={item}
              colors={colors}
              meta={[
                formatDuration(item.duration_seconds),
                formatPlayCount(item.play_count),
                formatRatingSummary(item.average_rating, item.rating_count),
              ]
                .filter(Boolean)
                .join(' · ')}
              onPress={() => openSound(item, favourites, 'Favourites')}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              colors={colors}
              title="Nothing saved"
              body="Tap the heart on a sound in the player to keep it here."
            />
          }
          ItemSeparatorComponent={() => (
            <View style={[styles.sep, { backgroundColor: colors.border }]} />
          )}
        />
      ) : (
        <FlatList
          data={downloads}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View style={{ marginBottom: 14 }}>
              <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
                {activeTab.hint}
              </Text>
              {!canDownloadOffline ? (
                <Pressable
                  onPress={() => navigation.navigate('Premium')}
                  style={[styles.premiumNote, { borderColor: colors.border }]}
                >
                  <Text style={[styles.premiumNoteTitle, { color: colors.text }]}>
                    Downloads need Premium
                  </Text>
                  <Text style={{ color: colors.textMuted, fontFamily: 'DMSans_400Regular', fontSize: 13, lineHeight: 19 }}>
                    Upgrade to save sounds for offline listening · Premium or admin only.
                  </Text>
                </Pressable>
              ) : null}
            </View>
          }
          renderItem={({ item }) => (
            <SoundRow
              sound={item}
              colors={colors}
              meta="Available offline"
              onPress={() => openSound(item, downloads, 'Downloads')}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              colors={colors}
              title="No downloads yet"
              body={
                canDownloadOffline
                  ? 'Open any sound and download it for offline play.'
                  : 'Premium unlocks offline downloads. Browse Home meanwhile.'
              }
            />
          }
          ItemSeparatorComponent={() => (
            <View style={[styles.sep, { backgroundColor: colors.border }]} />
          )}
        />
      )}
    </View>
  );
}

function SoundRow({
  sound,
  colors,
  meta,
  onPress,
}: {
  sound: Sound;
  colors: ReturnType<typeof useAppTheme>['colors'];
  meta: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.soundRow}>
      <CoverArt title={sound.title} uri={sound.cover_url} size={56} rounded={12} />
      <View style={styles.playlistMeta}>
        <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
          {sound.title}
        </Text>
        <Text style={[styles.rowSub, { color: colors.textMuted }]} numberOfLines={1}>
          {meta}
          {sound.is_premium_only ? '  ·  Premium' : ''}
        </Text>
      </View>
      <View style={[styles.playDot, { backgroundColor: colors.inverse }]}>
        <Text style={{ color: colors.inverseText, fontSize: 11 }}>▶</Text>
      </View>
    </Pressable>
  );
}

function EmptyState({
  colors,
  title,
  body,
}: {
  colors: ReturnType<typeof useAppTheme>['colors'];
  title: string;
  body: string;
}) {
  return (
    <View style={[styles.empty, { borderColor: colors.border }]}>
      <LinearGradient colors={moodPaletteFor(title)} style={styles.emptyOrb} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.emptyBody, { color: colors.textMuted }]}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 8 },
  brand: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 34,
    letterSpacing: -0.8,
    lineHeight: 38,
  },
  subtitle: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    marginTop: 6,
    marginBottom: 18,
  },
  segment: {
    flexDirection: 'row',
    gap: 6,
    padding: 4,
    borderRadius: 14,
    backgroundColor: 'rgba(128,128,128,0.12)',
  },
  segmentItem: {
    flex: 1,
    borderRadius: 11,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  segmentLabel: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 12,
  },
  segmentCount: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 11,
    marginTop: 2,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  createBlock: { marginBottom: 18 },
  sectionLabel: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  createRow: { flexDirection: 'row', gap: 10 },
  input: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
  },
  addBtn: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 18,
    justifyContent: 'center',
  },
  playlistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 14,
  },
  playlistArt: {
    width: 64,
    height: 64,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playlistArtMark: {
    fontFamily: 'Fraunces_600SemiBold',
    fontSize: 26,
    color: 'rgba(255,255,255,0.9)',
  },
  playlistMeta: { flex: 1 },
  soundRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 14,
  },
  rowTitle: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 16,
    marginBottom: 3,
  },
  rowSub: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
  },
  playDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sep: { height: StyleSheet.hairlineWidth },
  empty: {
    marginTop: 28,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
  },
  emptyOrb: {
    width: 72,
    height: 72,
    borderRadius: 36,
    marginBottom: 16,
  },
  emptyTitle: {
    fontFamily: 'Fraunces_600SemiBold',
    fontSize: 22,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyBody: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  premiumNote: {
    marginTop: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 16,
  },
  premiumNoteTitle: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 15,
    marginBottom: 6,
  },
});
