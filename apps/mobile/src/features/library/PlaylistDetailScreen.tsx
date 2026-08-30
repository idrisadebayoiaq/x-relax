import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../lib/useAppTheme';
import { moodPaletteFor, formatDuration } from '../../lib/format';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import { usePlayer } from '../player/PlayerProvider';
import { useAppSettings } from '../../lib/AppSettingsProvider';
import { cachePlaylistDetail, loadCachedPlaylistDetail } from '../../lib/offlineCache';
import type { Playlist, Sound } from '../../types/database';
import type { RootStackParamList } from '../../navigation/types';
import { appAlert } from '../../ui/appAlert';
import {
  deletePlaylist,
  isRenderedMixSound,
  mixIdFromSound,
  removePlaylistItem,
} from '../../lib/libraryActions';

type Props = NativeStackScreenProps<RootStackParamList, 'PlaylistDetail'>;

export function PlaylistDetailScreen() {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const route = useRoute<Props['route']>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const { online } = useAppSettings();
  const { playSound, current, isPlaying, togglePlay } = usePlayer();
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [ownerName, setOwnerName] = useState<string | null>(null);
  const [sounds, setSounds] = useState<Sound[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const isOwner = !!user && playlist?.user_id === user.id;
  const separatorColor = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)';

  const load = useCallback(async () => {
    const playlistId = route.params.playlistId;

    if (!online) {
      const cached = await loadCachedPlaylistDetail(playlistId);
      if (cached) {
        setPlaylist(cached.playlist);
        setOwnerName(cached.ownerName);
        setSounds(cached.sounds);
      } else {
        setPlaylist(null);
        setSounds([]);
      }
      setLoading(false);
      return;
    }

    try {
      const [{ data: pl }, { data: items }] = await Promise.all([
        supabase.from('playlists').select('*').eq('id', playlistId).maybeSingle(),
        supabase
          .from('playlist_items')
          .select('position, sound:sounds(*)')
          .eq('playlist_id', playlistId)
          .order('position', { ascending: true }),
      ]);

      const nextSounds = ((items as any[]) ?? []).map((i) => i.sound).filter(Boolean) as Sound[];
      setSounds(nextSounds);

      if (pl) {
        const cover = pl.cover_url ?? nextSounds[0]?.cover_url ?? null;
        const nextPlaylist = { ...(pl as Playlist), cover_url: cover };
        setPlaylist(nextPlaylist);
        const { data: owner } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('id', pl.user_id)
          .maybeSingle();
        const name = owner?.display_name ?? null;
        setOwnerName(name);
        await cachePlaylistDetail({
          playlist: nextPlaylist,
          ownerName: name,
          sounds: nextSounds,
          updatedAt: new Date().toISOString(),
        });
      } else {
        setPlaylist(null);
      }
    } catch {
      const cached = await loadCachedPlaylistDetail(playlistId);
      if (cached) {
        setPlaylist(cached.playlist);
        setOwnerName(cached.ownerName);
        setSounds(cached.sounds);
      }
    }
    setLoading(false);
  }, [route.params.playlistId, online]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const toggleVisibility = async () => {
    if (!playlist || !isOwner) return;
    if (!online) {
      appAlert('Offline', 'Connect to change playlist visibility.');
      return;
    }
    const next = playlist.visibility === 'public' ? 'private' : 'public';
    setBusy(true);
    const { error } = await supabase
      .from('playlists')
      .update({ visibility: next, updated_at: new Date().toISOString() })
      .eq('id', playlist.id);
    setBusy(false);
    if (error) {
      appAlert('Could not update', error.message);
      return;
    }
    setPlaylist({ ...playlist, visibility: next });
  };

  const openOrPlay = async (item: Sound, index: number) => {
    const mixId = mixIdFromSound(item.description);
    if (mixId && !isRenderedMixSound(item)) {
      navigation.navigate('MixStudio', { mixId });
      return;
    }
    if (current?.id === item.id) {
      void togglePlay();
      return;
    }
    const started = await playSound(item, {
      queue: sounds,
      queueIndex: index,
      queueLabel: playlist?.title ?? 'Playlist',
    });
    if (started) navigation.navigate('Player', { soundId: item.id });
  };

  const playAll = async () => {
    if (!sounds.length) return;
    await openOrPlay(sounds[0], 0);
  };

  const cover = playlist?.cover_url ?? sounds[0]?.cover_url;
  const [a, b] = moodPaletteFor(playlist?.title ?? 'playlist');

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={28} color={colors.text} />
        </Pressable>
        {isOwner ? (
          <View style={{ flexDirection: 'row' }}>
            <Pressable
              onPress={() => {
                if (!playlist) return;
                appAlert('Delete playlist', `Delete "${playlist.title}" permanently?`, [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                      if (!user) return;
                      const { error } = await deletePlaylist(user.id, playlist.id);
                      if (error) appAlert('Could not delete', error);
                      else navigation.goBack();
                    },
                  },
                ]);
              }}
              hitSlop={10}
              style={styles.iconBtn}
            >
              <Ionicons name="trash-outline" size={20} color="#EF4444" />
            </Pressable>
            <Pressable onPress={() => void toggleVisibility()} disabled={busy} hitSlop={10} style={styles.iconBtn}>
              <Ionicons
                name={playlist?.visibility === 'public' ? 'globe-outline' : 'lock-closed-outline'}
                size={22}
                color={colors.text}
              />
            </Pressable>
          </View>
        ) : (
          <View style={styles.iconBtn} />
        )}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.icon} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={sounds}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
          ListHeaderComponent={
            <View style={styles.headerBlock}>
              <View style={styles.coverWrap}>
                {cover ? (
                  <Image source={{ uri: cover }} style={styles.cover} contentFit="cover" />
                ) : (
                  <LinearGradient colors={[a, b]} style={styles.cover}>
                    <Text style={styles.coverTitle} numberOfLines={3}>
                      {playlist?.title}
                    </Text>
                  </LinearGradient>
                )}
              </View>
              <Text style={[styles.title, { color: colors.text }]}>{playlist?.title ?? 'Playlist'}</Text>
              <Text style={[styles.sub, { color: colors.textMuted }]}>
                {ownerName ?? 'Playlist'}
                {` · ${sounds.length} sound${sounds.length === 1 ? '' : 's'}`}
                {` · ${playlist?.visibility === 'public' ? 'Public' : 'Private'}`}
                {!online ? ' · Offline' : ''}
              </Text>

              <View style={styles.actions}>
                <Pressable
                  onPress={() => void playAll()}
                  disabled={!sounds.length}
                  style={[
                    styles.playBtn,
                    {
                      backgroundColor: colors.inverse,
                      opacity: sounds.length ? 1 : 0.4,
                    },
                  ]}
                >
                  <Ionicons name="play" size={22} color={colors.inverseText} style={{ marginLeft: 2 }} />
                  <Text style={[styles.playText, { color: colors.inverseText }]}>Play</Text>
                </Pressable>
              </View>
            </View>
          }
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.textMuted }]}>
              {isOwner
                ? 'Empty playlist — open a sound and use ⋯ → Add to playlist.'
                : 'This playlist has no sounds yet.'}
            </Text>
          }
          renderItem={({ item, index }) => {
            const isLast = index === sounds.length - 1;
            const active = current?.id === item.id;
            return (
              <Pressable onPress={() => void openOrPlay(item, index)} style={styles.trackRow}>
                <View style={styles.trackArt}>
                  {item.cover_url ? (
                    <Image
                      source={{ uri: item.cover_url }}
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                    />
                  ) : (
                    <LinearGradient
                      colors={moodPaletteFor(item.title)}
                      style={StyleSheet.absoluteFill}
                    />
                  )}
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
                      { color: active ? (isDark ? '#FFFFFF' : colors.text) : colors.text },
                      active && { fontFamily: 'DMSans_700Bold' },
                    ]}
                    numberOfLines={1}
                  >
                    {item.title}
                  </Text>
                  <Text style={[styles.trackMeta, { color: colors.textMuted }]} numberOfLines={1}>
                    {formatDuration(item.duration_seconds)}
                    {mixIdFromSound(item) ? ' · Mix' : ''}
                    {item.average_rating
                      ? ` · ${Number(item.average_rating).toFixed(1)}★`
                      : ''}
                  </Text>
                </View>
                {active && isPlaying ? (
                  <Ionicons name="pause" size={18} color={colors.text} style={{ marginRight: 8 }} />
                ) : null}
                {isOwner ? (
                  <Pressable
                    onPress={() => {
                      if (!playlist) return;
                      appAlert('Remove sound', `Remove "${item.title}" from this playlist?`, [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Remove',
                          style: 'destructive',
                          onPress: async () => {
                            const { error } = await removePlaylistItem(playlist.id, item.id);
                            if (error) appAlert('Could not remove', error);
                            else void load();
                          },
                        },
                      ]);
                    }}
                    hitSlop={8}
                    style={{ paddingRight: 12 }}
                  >
                    <Ionicons name="close-circle-outline" size={20} color={colors.textMuted} />
                  </Pressable>
                ) : null}
              </Pressable>
            );
          }}
        />
      )}
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
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBlock: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 18,
  },
  coverWrap: {
    marginTop: 8,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  cover: {
    width: 220,
    height: 220,
    borderRadius: 8,
    overflow: 'hidden',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
  },
  coverTitle: {
    color: '#FFF',
    fontFamily: 'Fraunces_700Bold',
    fontSize: 22,
    padding: 16,
  },
  title: {
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
  actions: {
    marginTop: 18,
    width: '100%',
  },
  playBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    paddingVertical: 14,
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
    marginTop: 28,
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    paddingHorizontal: 32,
    lineHeight: 20,
  },
});
