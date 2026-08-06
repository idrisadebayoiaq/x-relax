import { useCallback, useEffect, useRef, useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { setAudioModeAsync } from 'expo-audio';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../lib/useAppTheme';
import {
  isMixPlaying,
  pauseMixLayers,
  registerMixStopHandler,
  releaseMixLayers,
  resumeMixLayers,
  setMixLayerVolume,
  startMixLayers,
  type MixLayer,
} from '../../lib/mixPlayback';
import { useAuth } from '../auth/AuthProvider';
import { usePlayer } from '../player/PlayerProvider';
import { supabase } from '../../lib/supabase';
import { CoverArt } from '../home/CoverArt';
import { IconButton } from '../../ui/Icon';
import type { Mix, Sound } from '../../types/database';

type SavedMix = Mix & {
  tracks: { volume: number; position: number; sound: Sound }[];
};

export function MixStudioScreen() {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { user, canUseMixes } = useAuth();
  const { stopPlayback } = usePlayer();
  const navigation = useNavigation();
  const [catalog, setCatalog] = useState<Sound[]>([]);
  const [selected, setSelected] = useState<MixLayer[]>([]);
  const [savedMixes, setSavedMixes] = useState<SavedMix[]>([]);
  const [title, setTitle] = useState('My mix');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [mixPlaying, setMixPlaying] = useState(false);
  const selectedRef = useRef<MixLayer[]>([]);
  selectedRef.current = selected;

  const maxTracks = 8;

  const loadSavedMixes = useCallback(async () => {
    if (!user) {
      setSavedMixes([]);
      return;
    }
    const { data } = await supabase
      .from('mixes')
      .select('*, tracks:mix_tracks(volume, position, sound:sounds(*))')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });
    const rows = ((data as SavedMix[]) ?? [])
      .map((mix) => ({
        ...mix,
        tracks: [...(mix.tracks ?? [])].sort((a, b) => a.position - b.position),
      }))
      .filter((mix) => mix.tracks.length > 0);
    setSavedMixes(rows);
  }, [user]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('sounds')
        .select('*')
        .eq('status', 'published')
        .order('title');
      setCatalog((data as Sound[]) ?? []);
      setLoading(false);
    })();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSavedMixes();
    }, [loadSavedMixes]),
  );

  const stopMix = useCallback(async () => {
    releaseMixLayers(selectedRef.current);
    setSelected((prev) => prev.map((layer) => ({ ...layer, player: undefined })));
    setMixPlaying(false);
  }, []);

  useEffect(() => {
    registerMixStopHandler(() => {
      void stopMix();
    });
    return () => {
      registerMixStopHandler(null);
      releaseMixLayers(selectedRef.current);
    };
  }, [stopMix]);

  const toggleSelect = async (sound: Sound) => {
    const exists = selected.find((layer) => layer.sound.id === sound.id);
    if (exists) {
      try {
        exists.player?.pause();
        exists.player?.remove();
      } catch {
        /* ignore */
      }
      setSelected((prev) => prev.filter((layer) => layer.sound.id !== sound.id));
      setMixPlaying(isMixPlaying(selected.filter((layer) => layer.sound.id !== sound.id)));
      return;
    }
    if (selected.length >= maxTracks) {
      Alert.alert('Limit reached', `Max ${maxTracks} tracks in a mix.`);
      return;
    }
    setSelected((prev) => [...prev, { sound, volume: 0.8 }]);
  };

  const playMix = useCallback(async () => {
    if (!selectedRef.current.length) {
      Alert.alert('Empty mix', 'Select at least one sound.');
      return;
    }

    if (isMixPlaying(selectedRef.current)) {
      pauseMixLayers(selectedRef.current);
      setMixPlaying(false);
      return;
    }

    if (selectedRef.current.some((layer) => layer.player)) {
      resumeMixLayers(selectedRef.current);
      setMixPlaying(true);
      return;
    }

    await stopPlayback();
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'mixWithOthers',
      shouldRouteThroughEarpiece: false,
      allowsRecording: false,
    }).catch(() => undefined);

    releaseMixLayers(selectedRef.current);
    const started = await startMixLayers(selectedRef.current);
    if (!started.length) {
      Alert.alert('Playback failed', 'Could not start the selected sounds.');
      return;
    }
    setSelected(started);
    setMixPlaying(true);
  }, [stopPlayback]);

  const adjustVolume = (soundId: string, delta: number) => {
    setSelected((prev) => {
      const next = setMixLayerVolume(
        prev,
        soundId,
        (prev.find((layer) => layer.sound.id === soundId)?.volume ?? 0.8) + delta,
      );
      selectedRef.current = next;
      return next;
    });
  };

  const loadSavedMix = async (mix: SavedMix) => {
    await stopMix();
    await stopPlayback();
    const layers: MixLayer[] = mix.tracks
      .map((track) => ({
        sound: track.sound,
        volume: Number(track.volume) || 0.8,
      }))
      .filter((layer) => !!layer.sound?.audio_url);
    if (!layers.length) {
      Alert.alert('Mix unavailable', 'This mix has no playable sounds.');
      return;
    }
    setTitle(mix.title);
    setSelected(layers);
    selectedRef.current = layers;
  };

  const saveMix = async () => {
    if (!user) return;
    if (!selected.length) {
      Alert.alert('Empty mix', 'Select at least one sound.');
      return;
    }
    setBusy(true);
    const { data: mix, error } = await supabase
      .from('mixes')
      .insert({ user_id: user.id, title: title.trim() || 'My mix' })
      .select('*')
      .single();
    if (error || !mix) {
      setBusy(false);
      Alert.alert('Save failed', error?.message ?? 'Unknown error');
      return;
    }
    const { error: tracksError } = await supabase.from('mix_tracks').insert(
      selected.map((layer, index) => ({
        mix_id: mix.id,
        sound_id: layer.sound.id,
        volume: layer.volume,
        position: index,
      })),
    );
    setBusy(false);
    if (tracksError) {
      await supabase.from('mixes').delete().eq('id', mix.id);
      Alert.alert('Save failed', tracksError.message);
      return;
    }
    await loadSavedMixes();
    Alert.alert('Saved', 'Your mix was saved.');
  };

  const handleBack = async () => {
    await stopMix();
    navigation.goBack();
  };

  if (!canUseMixes) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top + 24, paddingHorizontal: 20 }}>
        <IconButton
          name="chevron-back"
          onPress={() => navigation.goBack()}
          color={colors.textMuted}
          size={22}
          style={{ alignSelf: 'flex-start', marginLeft: -8, marginBottom: 16 }}
        />
        <Text style={[styles.title, { color: colors.text }]}>Mix studio</Text>
        <Text style={[styles.sub, { color: colors.textMuted, marginTop: 8 }]}>
          Layer sounds together and save custom mixes. Premium or admin access required.
        </Text>
        <Pressable
          style={[styles.actionPrimary, { backgroundColor: colors.inverse, marginTop: 24, alignSelf: 'flex-start' }]}
          onPress={() => navigation.navigate('Tabs', { screen: 'Premium' } as never)}
        >
          <Text style={{ color: colors.inverseText, fontFamily: 'DMSans_700Bold' }}>View Premium</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient
        colors={isDark ? ['#121212', '#000'] : ['#F3F0EA', '#FFF']}
        style={StyleSheet.absoluteFill}
      />
      <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 8 }}>
        <IconButton
          name="chevron-back"
          onPress={() => void handleBack()}
          color={colors.textMuted}
          size={22}
          style={{ alignSelf: 'flex-start', marginLeft: -8, marginBottom: 4 }}
        />
        <Text style={[styles.title, { color: colors.text }]}>Mix studio</Text>
        <Text style={[styles.sub, { color: colors.textMuted }]}>
          Premium · up to {maxTracks} layers · save enabled
        </Text>
        <TextInput
          style={[
            styles.input,
            {
              color: colors.text,
              borderColor: colors.border,
              backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : colors.surface,
            },
          ]}
          value={title}
          onChangeText={setTitle}
          placeholder="Mix title"
          placeholderTextColor={colors.textMuted}
        />
        <View style={styles.actions}>
          <Pressable
            style={[styles.actionPrimary, { backgroundColor: colors.inverse }]}
            onPress={() => void playMix()}
          >
            <Ionicons name={mixPlaying ? 'pause' : 'play'} size={16} color={colors.inverseText} />
            <Text style={{ color: colors.inverseText, fontFamily: 'DMSans_700Bold' }}>
              {mixPlaying ? 'Pause mix' : 'Play mix'}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.actionOutline, { borderColor: colors.border }]}
            onPress={() => void stopMix()}
          >
            <Ionicons name="stop-outline" size={16} color={colors.text} />
            <Text style={{ color: colors.text, fontFamily: 'DMSans_700Bold' }}>Stop</Text>
          </Pressable>
          <Pressable
            style={[styles.actionOutline, { borderColor: colors.border, opacity: busy ? 0.5 : 1 }]}
            onPress={saveMix}
            disabled={busy}
          >
            <Ionicons name="save-outline" size={16} color={colors.text} />
            <Text style={{ color: colors.text, fontFamily: 'DMSans_700Bold' }}>Save</Text>
          </Pressable>
        </View>
        <Text style={[styles.section, { color: colors.textMuted }]}>
          Selected · {selected.length}/{maxTracks}
        </Text>
      </View>

      {selected.length ? (
        <View style={{ paddingHorizontal: 20, marginBottom: 8 }}>
          {selected.map((layer) => (
            <View key={layer.sound.id} style={[styles.selectedRow, { borderColor: colors.border }]}>
              <CoverArt title={layer.sound.title} uri={layer.sound.cover_url} size={40} rounded={10} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.selectedTitle, { color: colors.text }]} numberOfLines={1}>
                  {layer.sound.title}
                </Text>
                <View style={styles.volumeRow}>
                  <Pressable onPress={() => adjustVolume(layer.sound.id, -0.1)} hitSlop={8}>
                    <Ionicons name="remove-circle-outline" size={20} color={colors.textMuted} />
                  </Pressable>
                  <Text style={[styles.volumeText, { color: colors.textMuted }]}>
                    Vol {Math.round(layer.volume * 100)}%
                  </Text>
                  <Pressable onPress={() => adjustVolume(layer.sound.id, 0.1)} hitSlop={8}>
                    <Ionicons name="add-circle-outline" size={20} color={colors.textMuted} />
                  </Pressable>
                </View>
              </View>
              <Pressable onPress={() => void toggleSelect(layer.sound)}>
                <Ionicons name="close-circle-outline" size={22} color={colors.textMuted} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      {savedMixes.length ? (
        <>
          <Text style={[styles.section, { color: colors.textMuted, paddingHorizontal: 20 }]}>
            Saved mixes
          </Text>
          <View style={{ paddingHorizontal: 20, marginBottom: 8 }}>
            {savedMixes.map((mix) => (
              <Pressable
                key={mix.id}
                style={[styles.savedRow, { borderColor: colors.border }]}
                onPress={() => void loadSavedMix(mix)}
              >
                <Ionicons name="layers-outline" size={18} color={colors.textMuted} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.savedTitle, { color: colors.text }]} numberOfLines={1}>
                    {mix.title}
                  </Text>
                  <Text style={[styles.savedMeta, { color: colors.textMuted }]}>
                    {mix.tracks.length} layer{mix.tracks.length === 1 ? '' : 's'}
                  </Text>
                </View>
                <Text style={{ color: colors.textMuted }}>Load</Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      <Text style={[styles.section, { color: colors.textMuted, paddingHorizontal: 20 }]}>
        Catalog
      </Text>
      {loading ? (
        <ActivityIndicator color={colors.icon} style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={catalog}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          renderItem={({ item }) => {
            const on = !!selected.find((layer) => layer.sound.id === item.id);
            return (
              <Pressable style={styles.catalogRow} onPress={() => void toggleSelect(item)}>
                <CoverArt title={item.title} uri={item.cover_url} size={48} rounded={12} />
                <Text style={[styles.catalogTitle, { color: colors.text }]} numberOfLines={1}>
                  {item.title}
                </Text>
                <View
                  style={[
                    styles.badge,
                    {
                      backgroundColor: on ? colors.inverse : 'transparent',
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: on ? colors.inverseText : colors.textMuted,
                      fontFamily: 'DMSans_700Bold',
                      fontSize: 11,
                    }}
                  >
                    {on ? 'On' : 'Add'}
                  </Text>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: 'Fraunces_700Bold', fontSize: 34, letterSpacing: -0.8 },
  sub: { fontFamily: 'DMSans_400Regular', fontSize: 14, marginTop: 6, marginBottom: 14 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    marginBottom: 12,
  },
  actions: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  actionPrimary: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionOutline: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  section: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 8,
    marginBottom: 8,
  },
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
  },
  selectedTitle: { fontFamily: 'DMSans_500Medium', fontSize: 14, marginBottom: 4 },
  volumeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  volumeText: { fontFamily: 'DMSans_400Regular', fontSize: 12, minWidth: 64 },
  savedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  savedTitle: { fontFamily: 'DMSans_700Bold', fontSize: 14 },
  savedMeta: { fontFamily: 'DMSans_400Regular', fontSize: 12, marginTop: 2 },
  catalogRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  catalogTitle: { flex: 1, fontFamily: 'DMSans_700Bold', fontSize: 14 },
  badge: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
});
