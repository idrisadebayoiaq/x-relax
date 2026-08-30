import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../lib/useAppTheme';
import { formatDuration, formatElapsed, formatPlayCount } from '../../lib/format';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import { usePlayer } from '../player/PlayerProvider';
import { appAlert } from '../../ui/appAlert';
import { removeFavorite, deleteDownload, deleteMix, isRenderedMixSound } from '../../lib/libraryActions';
import { useAppSettings } from '../../lib/AppSettingsProvider';
import { SoundCard } from '../../ui/Cards';
import {
  cacheOfflineDownloads,
  loadCachedDownloads,
  loadCachedLibrarySnapshot,
} from '../../lib/offlineCache';
import type { Sound } from '../../types/database';
import type { RootStackParamList } from '../../navigation/types';

export function FavouritesListScreen() {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const { online } = useAppSettings();
  const { playSound, current, isPlaying, togglePlay } = usePlayer();
  const [items, setItems] = useState<Sound[]>([]);
  const [loading, setLoading] = useState(true);
  const separatorColor = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)';

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    if (!online) {
      const snap = await loadCachedLibrarySnapshot();
      setItems(snap?.favourites ?? []);
      setLoading(false);
      return;
    }
    try {
      const { data } = await supabase
        .from('favourites')
        .select('sound:sounds(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      setItems(((data as any[]) ?? []).map((f) => f.sound).filter(Boolean));
    } catch {
      const snap = await loadCachedLibrarySnapshot();
      setItems(snap?.favourites ?? []);
    }
    setLoading(false);
  }, [user, online]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const playAll = async () => {
    if (!items.length) return;
    const started = await playSound(items[0], {
      queue: items,
      queueIndex: 0,
      queueLabel: 'Favourite Songs',
    });
    if (started) navigation.navigate('Player', { soundId: items[0].id });
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={28} color={colors.text} />
        </Pressable>
        <View style={styles.iconBtn} />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.icon} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
          ListHeaderComponent={
            <View style={styles.favHeader}>
              <View style={[styles.favArt, { backgroundColor: isDark ? '#F5F5F5' : '#FFFFFF' }]}>
                <Ionicons name="star" size={72} color="#C45C4A" />
              </View>
              <Text style={[styles.heroTitle, { color: colors.text }]}>Favourite Songs</Text>
              <Text style={[styles.sub, { color: colors.textMuted }]}>
                {items.length} liked sound{items.length === 1 ? '' : 's'}
                {!online ? ' · Offline' : ''}
              </Text>
              <Pressable
                onPress={() => void playAll()}
                disabled={!items.length}
                style={[
                  styles.playBtn,
                  {
                    backgroundColor: colors.inverse,
                    opacity: items.length ? 1 : 0.4,
                    marginTop: 18,
                  },
                ]}
              >
                <Ionicons name="play" size={22} color={colors.inverseText} style={{ marginLeft: 2 }} />
                <Text style={[styles.playText, { color: colors.inverseText }]}>Play</Text>
              </Pressable>
            </View>
          }
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.textMuted }]}>
              Like a sound on the player to save it here.
            </Text>
          }
          renderItem={({ item, index }) => {
            const isLast = index === items.length - 1;
            const active = current?.id === item.id;
            return (
              <Pressable
                onPress={async () => {
                  if (active) {
                    void togglePlay();
                    return;
                  }
                  const started = await playSound(item, {
                    queue: items,
                    queueIndex: index,
                    queueLabel: 'Favourite Songs',
                  });
                  if (started) navigation.navigate('Player', { soundId: item.id });
                }}
                style={styles.trackRow}
              >
                <View style={styles.trackArt}>
                  {item.cover_url ? (
                    <Image
                      source={{ uri: item.cover_url }}
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                    />
                  ) : null}
                </View>
                <View
                  style={[
                    styles.trackBody,
                    { borderBottomColor: isLast ? 'transparent' : separatorColor },
                  ]}
                >
                  <Text
                    style={[
                      styles.trackTitle,
                      { color: colors.text },
                      active ? { fontFamily: 'DMSans_700Bold' } : null,
                    ]}
                    numberOfLines={1}
                  >
                    {item.title}
                  </Text>
                  <Text style={[styles.trackMeta, { color: colors.textMuted }]}>
                    {formatDuration(item.duration_seconds)}
                    {item.play_count ? ` · ${formatPlayCount(item.play_count)} plays` : ''}
                  </Text>
                </View>
                {active && isPlaying ? (
                  <Ionicons name="pause" size={18} color={colors.text} style={{ marginRight: 8 }} />
                ) : null}
                <Pressable
                  onPress={() => {
                    if (!user) return;
                    appAlert('Remove favourite', `Remove "${item.title}" from favourites?`, [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Remove',
                        style: 'destructive',
                        onPress: async () => {
                          const { error } = await removeFavorite(user.id, item.id);
                          if (error) appAlert('Could not remove', error);
                          else void load();
                        },
                      },
                    ]);
                  }}
                  hitSlop={8}
                  style={{ paddingRight: 16 }}
                >
                  <Ionicons name="heart-dislike-outline" size={20} color={colors.textMuted} />
                </Pressable>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

export function DownloadsListScreen() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, canDownloadOffline } = useAuth();
  const { online } = useAppSettings();
  const { playSound } = usePlayer();
  const [items, setItems] = useState<(Sound & { local_uri?: string | null })[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user || !canDownloadOffline || !online) {
      const cached = await loadCachedDownloads();
      setItems(cached.map((d) => ({ ...d.sound, local_uri: d.localUri, audio_url: d.localUri })));
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('downloads')
        .select('local_uri, sound:sounds(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const mapped = ((data as any[]) ?? [])
        .map((d) => (d.sound ? { ...d.sound, local_uri: d.local_uri } : null))
        .filter(Boolean) as (Sound & { local_uri?: string | null })[];
      setItems(mapped);
      await cacheOfflineDownloads(
        mapped
          .filter((s) => s.local_uri)
          .map((s) => ({
            sound: s,
            localUri: s.local_uri as string,
            downloadedAt: new Date().toISOString(),
          })),
      );
    } catch {
      const cached = await loadCachedDownloads();
      setItems(cached.map((d) => ({ ...d.sound, local_uri: d.localUri, audio_url: d.localUri })));
    }
    setLoading(false);
  }, [user, canDownloadOffline, online]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.back}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]}>Downloaded</Text>
        <View style={styles.back} />
      </View>
      {!canDownloadOffline ? (
        <Pressable
          onPress={() => navigation.navigate('Premium')}
          style={[styles.note, { borderColor: colors.border }]}
        >
          <Text style={[styles.noteTitle, { color: colors.text }]}>Downloads need Premium</Text>
          <Text style={{ color: colors.textMuted, fontFamily: 'DMSans_400Regular', fontSize: 13 }}>
            Upgrade to save sounds for offline listening.
          </Text>
        </Pressable>
      ) : null}
      {loading ? (
        <ActivityIndicator color={colors.icon} style={{ marginTop: 28 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24 }}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.textMuted }]}>
              {canDownloadOffline
                ? 'Download a sound from the player menu for offline play.'
                : 'Premium unlocks offline downloads.'}
            </Text>
          }
          renderItem={({ item }) => (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <SoundCard
                  sound={item}
                  onPress={async () => {
                    const playable = item.local_uri ? { ...item, audio_url: item.local_uri } : item;
                    const queue = items.map((entry) =>
                      entry.local_uri ? { ...entry, audio_url: entry.local_uri } : entry,
                    );
                    const index = queue.findIndex((s) => s.id === item.id);
                    const started = await playSound(playable, {
                      queue,
                      queueIndex: index,
                      queueLabel: 'Downloads',
                    });
                    if (started) navigation.navigate('Player', { soundId: item.id });
                  }}
                />
              </View>
              {user ? (
                <Pressable
                  onPress={() => {
                    appAlert('Delete download', `Remove offline copy of "${item.title}"?`, [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: async () => {
                          const { error } = await deleteDownload(user.id, item.id);
                          if (error) appAlert('Could not delete', error);
                          else void load();
                        },
                      },
                    ]);
                  }}
                  hitSlop={8}
                  style={{ paddingRight: 8 }}
                >
                  <Ionicons name="trash-outline" size={20} color={colors.textMuted} />
                </Pressable>
              ) : null}
            </View>
          )}
        />
      )}
    </View>
  );
}

export function LibraryMixesScreen() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, canUseMixes } = useAuth();
  const { online } = useAppSettings();
  const { playSound } = usePlayer();
  const [items, setItems] = useState<
    {
      id: string;
      title: string;
      trackCount: number;
      durationSeconds: number;
      cover?: string | null;
    }[]
  >([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    if (!online) {
      const snap = await loadCachedLibrarySnapshot();
      setItems(
        (snap?.mixes ?? []).map((m) => ({
          id: m.id,
          title: m.title,
          trackCount: m.trackCount,
          durationSeconds: m.durationSeconds,
          cover: m.cover,
        })),
      );
      setLoading(false);
      return;
    }
    try {
      const { data } = await supabase
        .from('mixes')
        .select('id, title, duration_seconds, tracks:mix_tracks(position, sound:sounds(cover_url))')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });
      setItems(
        ((data as any[]) ?? []).map((m) => {
          const tracks = [...(m.tracks ?? [])].sort(
            (a: any, b: any) => (a.position ?? 0) - (b.position ?? 0),
          );
          return {
            id: m.id,
            title: m.title,
            trackCount: tracks.length,
            durationSeconds: Number(m.duration_seconds ?? 0),
            cover: tracks[0]?.sound?.cover_url ?? null,
          };
        }),
      );
    } catch {
      const snap = await loadCachedLibrarySnapshot();
      setItems(
        (snap?.mixes ?? []).map((m) => ({
          id: m.id,
          title: m.title,
          trackCount: m.trackCount,
          durationSeconds: m.durationSeconds,
          cover: m.cover,
        })),
      );
    }
    setLoading(false);
  }, [user, online]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.back}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]}>My Mixes</Text>
        <Pressable
          onPress={() => {
            if (!canUseMixes) navigation.navigate('Premium');
            else navigation.navigate('MixStudio');
          }}
          hitSlop={8}
          style={styles.back}
        >
          <Ionicons name="add" size={24} color={colors.text} />
        </Pressable>
      </View>
      {loading ? (
        <ActivityIndicator color={colors.icon} style={{ marginTop: 28 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24, gap: 10 }}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.textMuted }]}>
              {canUseMixes
                ? 'Layer sounds together in Mix Studio.'
                : 'Premium unlocks Mix Sounds.'}
            </Text>
          }
          renderItem={({ item }) => (
            <View style={[styles.mixRow, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              <Pressable
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
                onPress={async () => {
                  if (!canUseMixes || !user) {
                    navigation.navigate('Premium');
                    return;
                  }
                  const { data } = await supabase
                    .from('mixes')
                    .select('sound:sounds(*)')
                    .eq('id', item.id)
                    .maybeSingle();
                  const sound = (data as { sound?: Sound } | null)?.sound;
                  if (sound && isRenderedMixSound(sound)) {
                    const started = await playSound(sound, { queueLabel: 'My Mixes' });
                    if (started) navigation.navigate('Player', { soundId: sound.id });
                    return;
                  }
                  navigation.navigate('MixStudio', { mixId: item.id });
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.mixTitle, { color: colors.text }]}>{item.title}</Text>
                  <Text style={{ color: colors.textMuted, fontFamily: 'DMSans_400Regular', fontSize: 12 }}>
                    {item.durationSeconds > 0
                      ? `Saved mix · ${formatElapsed(item.durationSeconds)}`
                      : `${item.trackCount} layer${item.trackCount === 1 ? '' : 's'}`}
                  </Text>
                </View>
                <Ionicons name="play-circle-outline" size={26} color={colors.text} />
              </Pressable>
              <Pressable
                onPress={() => {
                  if (!user) return;
                  appAlert('Delete mix', `Delete "${item.title}" permanently?`, [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Delete',
                      style: 'destructive',
                      onPress: async () => {
                        const { error } = await deleteMix(user.id, item.id);
                        if (error) appAlert('Could not delete', error);
                        else void load();
                      },
                    },
                  ]);
                }}
                hitSlop={8}
                style={{ paddingLeft: 8 }}
              >
                <Ionicons name="trash-outline" size={20} color={colors.textMuted} />
              </Pressable>
            </View>
          )}
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
    paddingVertical: 8,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    minHeight: 44,
  },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: 'Fraunces_700Bold', fontSize: 22 },
  favHeader: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 18,
    paddingTop: 8,
  },
  favArt: {
    width: 200,
    height: 200,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  heroTitle: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 28,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  sub: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  playBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    paddingVertical: 14,
    width: '100%',
  },
  playText: { fontFamily: 'DMSans_700Bold', fontSize: 16 },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    minHeight: 64,
  },
  trackArt: {
    width: 48,
    height: 48,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: '#222',
  },
  trackBody: {
    flex: 1,
    minWidth: 0,
    marginLeft: 14,
    paddingRight: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
  },
  trackTitle: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
  },
  trackMeta: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    marginTop: 3,
  },
  empty: {
    textAlign: 'center',
    marginTop: 40,
    fontFamily: 'DMSans_400Regular',
    paddingHorizontal: 24,
    lineHeight: 20,
  },
  note: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 14,
  },
  noteTitle: { fontFamily: 'DMSans_700Bold', fontSize: 14, marginBottom: 4 },
  mixRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 14,
  },
  mixTitle: { fontFamily: 'DMSans_700Bold', fontSize: 15, marginBottom: 3 },
});
