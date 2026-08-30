import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppTheme } from '../../lib/useAppTheme';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import { useMix, type SavedMix } from '../mix/MixProvider';
import { CoverArt } from '../home/CoverArt';
import { formatElapsed, formatDuration } from '../../lib/format';
import type { Category, Sound } from '../../types/database';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'MixStudio'>;

const FILTER_FALLBACK = [
  'nature',
  'rain',
  'ocean',
  'fireplace',
  'wind',
  'sleep',
  'focus',
  'meditation',
  'asmr',
];

function VolumeSlider({
  value,
  onChange,
  colors,
}: {
  value: number;
  onChange: (v: number) => void;
  colors: { text: string; border: string };
}) {
  const widthRef = useRef(1);
  return (
    <View style={styles.volRow}>
      <Pressable
        style={[styles.volTrack, { backgroundColor: 'rgba(128,128,128,0.35)' }]}
        onLayout={(e) => {
          widthRef.current = e.nativeEvent.layout.width || 1;
        }}
        onPress={(e) => {
          const w = widthRef.current || 1;
          onChange(Math.min(1, Math.max(0, e.nativeEvent.locationX / w)));
        }}
      >
        <View
          style={[
            styles.volFill,
            {
              width: `${Math.min(100, value * 100)}%` as `${number}%`,
              backgroundColor: colors.text,
            },
          ]}
        />
        <View
          style={[
            styles.volKnob,
            {
              left: `${Math.min(96, Math.max(0, value * 100))}%` as `${number}%`,
              backgroundColor: '#FFFFFF',
              borderColor: colors.border,
            },
          ]}
        />
      </Pressable>
      <Text style={[styles.volPct, { color: colors.text }]}>{Math.round(value * 100)}%</Text>
    </View>
  );
}

export function MixStudioScreen({ navigation, route }: Props) {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { canUseMixes } = useAuth();
  const {
    layers,
    mixTitle,
    isMixPlaying,
    sessionElapsedSec,
    savedDurationSec,
    maxTracks,
    setMixTitle,
    addSound,
    removeSound,
    setTrackVolume,
    toggleMixPlay,
    playMix,
    loadSavedMix,
    saveMix,
    seedWithSound,
    setSleepTimerMinutes,
    sleepEndsAt,
  } = useMix();

  const [catalog, setCatalog] = useState<Sound[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [links, setLinks] = useState<{ sound_id: string; category_id: string }[]>([]);
  const [filterSlug, setFilterSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const seededRef = useRef(false);

  useEffect(() => {
    (async () => {
      const [{ data: sounds }, { data: cats }, { data: catLinks }] = await Promise.all([
        supabase.from('sounds').select('*').eq('status', 'published').order('title'),
        supabase
          .from('categories')
          .select('*')
          .is('parent_id', null)
          .order('sort_order'),
        supabase.from('sound_categories').select('sound_id, category_id'),
      ]);
      setCatalog((sounds as Sound[]) ?? []);
      setCategories((cats as Category[]) ?? []);
      setLinks((catLinks as { sound_id: string; category_id: string }[]) ?? []);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    const mixId = route.params?.mixId;
    if (!mixId || !canUseMixes) return;
    (async () => {
      const { data } = await supabase
        .from('mixes')
        .select('*, tracks:mix_tracks(volume, position, sound:sounds(*))')
        .eq('id', mixId)
        .maybeSingle();
      if (!data) return;
      const mix = {
        ...(data as SavedMix),
        tracks: [...((data as SavedMix).tracks ?? [])].sort((a, b) => a.position - b.position),
      };
      await loadSavedMix(mix, true);
    })();
  }, [route.params?.mixId, canUseMixes, loadSavedMix]);

  useEffect(() => {
    const seedId = route.params?.seedSoundId;
    if (!seedId || seededRef.current || !catalog.length || !canUseMixes) return;
    const sound = catalog.find((s) => s.id === seedId);
    if (!sound) return;
    seededRef.current = true;
    void seedWithSound(sound);
  }, [route.params?.seedSoundId, catalog, canUseMixes, seedWithSound]);

  const filterChips = useMemo(() => {
    const bySlug = new Map(categories.map((c) => [c.slug, c]));
    const ordered: Category[] = [];
    for (const slug of FILTER_FALLBACK) {
      const cat = bySlug.get(slug);
      if (cat) ordered.push(cat);
    }
    for (const cat of categories) {
      if (!ordered.some((c) => c.id === cat.id) && cat.slug !== 'mixes') ordered.push(cat);
    }
    return ordered.slice(0, 12);
  }, [categories]);

  useEffect(() => {
    if (!filterSlug && filterChips.length) setFilterSlug(filterChips[0].slug);
  }, [filterChips, filterSlug]);

  const filteredCatalog = useMemo(() => {
    const selectedIds = new Set(layers.map((l) => l.sound.id));
    let list = catalog;
    if (filterSlug) {
      const cat = categories.find((c) => c.slug === filterSlug);
      if (cat) {
        const ids = new Set(links.filter((l) => l.category_id === cat.id).map((l) => l.sound_id));
        list = catalog.filter((s) => ids.has(s.id));
      }
    }
    return list;
  }, [catalog, filterSlug, categories, links, layers]);

  const promptSave = () => {
    if (!canUseMixes) {
      Alert.alert('Premium feature', 'Saving mixes requires Premium.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'View Premium', onPress: () => navigation.navigate('Premium') },
      ]);
      return;
    }
    const elapsedLabel = formatElapsed(sessionElapsedSec);
    if (Platform.OS === 'ios' && typeof Alert.prompt === 'function') {
      Alert.prompt(
        'Save Mix',
        `Played ${elapsedLabel}. That time becomes the mix duration. Saved to My Mixes + playlist “My Mix”.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Save',
            onPress: (name?: string) => {
              setSaving(true);
              void saveMix(name || mixTitle).finally(() => setSaving(false));
            },
          },
        ],
        'plain-text',
        mixTitle,
      );
      return;
    }
    Alert.alert(
      'Save Mix',
      `Save "${mixTitle}" (${elapsedLabel} played) to My Mixes?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save',
          onPress: () => {
            setSaving(true);
            void saveMix(mixTitle).finally(() => setSaving(false));
          },
        },
      ],
    );
  };

  if (!canUseMixes) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.headerBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Mix Sounds</Text>
          <View style={styles.headerBtn} />
        </View>
        <View style={styles.locked}>
          <Ionicons name="layers-outline" size={40} color={colors.textMuted} />
          <Text style={[styles.lockedTitle, { color: colors.text }]}>Premium Mix Studio</Text>
          <Text style={[styles.lockedBody, { color: colors.textMuted }]}>
            Combine Rain, Thunder, Birds and more — play them at the same time with independent
            volumes.
          </Text>
          <Pressable
            onPress={() => navigation.navigate('Premium')}
            style={[styles.primaryBtn, { backgroundColor: colors.inverse }]}
          >
            <Text style={[styles.primaryBtnText, { color: colors.inverseText }]}>View Premium</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Mix Sounds</Text>
        <Pressable onPress={promptSave} disabled={saving} hitSlop={8} style={styles.headerBtn}>
          <Text style={[styles.saveText, { color: colors.text }]}>{saving ? '…' : 'Save'}</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.titleBlock}>
          <TextInput
            value={mixTitle}
            onChangeText={setMixTitle}
            placeholder="Mix name"
            placeholderTextColor={colors.textMuted}
            style={[styles.titleInput, { color: colors.text, borderColor: colors.border }]}
          />
          <Text style={[styles.hint, { color: colors.textMuted }]}>
            {layers.length}/{maxTracks} sounds · Play time becomes the mix duration when you save
          </Text>
        </View>

        {/* Active mix layers */}
        <View style={{ paddingHorizontal: 16, gap: 12 }}>
          {layers.length === 0 ? (
            <View style={[styles.emptyCard, { borderColor: colors.border }]}>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                No sounds in this mix yet. Add some below.
              </Text>
            </View>
          ) : (
            layers.map((layer) => (
              <View
                key={layer.sound.id}
                style={[
                  styles.layerCard,
                  { backgroundColor: colors.elevated, borderColor: colors.border },
                ]}
              >
                <CoverArt title={layer.sound.title} uri={layer.sound.cover_url} size={52} rounded={10} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.layerTitle, { color: colors.text }]} numberOfLines={1}>
                    {layer.sound.title}
                  </Text>
                  <VolumeSlider
                    value={layer.volume}
                    onChange={(v) => setTrackVolume(layer.sound.id, v)}
                    colors={colors}
                  />
                </View>
                <Pressable onPress={() => removeSound(layer.sound.id)} hitSlop={10} style={styles.removeBtn}>
                  <Ionicons name="close" size={18} color={colors.textMuted} />
                </Pressable>
              </View>
            ))
          )}
        </View>

        {/* Transport */}
        {layers.length ? (
          <View style={styles.transportBlock}>
            <Text style={[styles.timer, { color: colors.text }]}>
              {formatElapsed(sessionElapsedSec)}
              {savedDurationSec ? (
                <Text style={{ color: colors.textMuted }}>
                  {' '}
                  / {formatDuration(savedDurationSec) || formatElapsed(savedDurationSec)}
                </Text>
              ) : null}
            </Text>
            <Text style={[styles.timerHint, { color: colors.textMuted }]}>
              {isMixPlaying ? 'Recording mix length…' : 'Duration counts while playing'}
            </Text>
            <View style={styles.transport}>
            <Pressable
              onPress={() => {
                Alert.alert('Sleep timer', 'Stop the whole mix when time is up.', [
                  ...[10, 20, 30, 45, 60].map((m) => ({
                    text: `${m} min`,
                    onPress: () => setSleepTimerMinutes(m),
                  })),
                  ...(sleepEndsAt
                    ? [{ text: 'Clear', style: 'destructive' as const, onPress: () => setSleepTimerMinutes(null) }]
                    : []),
                  { text: 'Cancel', style: 'cancel' as const },
                ]);
              }}
              style={[styles.transportSide, { borderColor: colors.border }]}
            >
              <Ionicons name="timer-outline" size={20} color={colors.text} />
            </Pressable>
            <Pressable
              onPress={() => void toggleMixPlay()}
              style={[styles.playBtn, { backgroundColor: colors.inverse }]}
            >
              <Ionicons
                name={isMixPlaying ? 'pause' : 'play'}
                size={28}
                color={colors.inverseText}
                style={!isMixPlaying ? { marginLeft: 2 } : undefined}
              />
            </Pressable>
            <Pressable
              onPress={() => void playMix()}
              style={[styles.transportSide, { borderColor: colors.border }]}
            >
              <Ionicons name="refresh-outline" size={20} color={colors.text} />
            </Pressable>
          </View>
          </View>
        ) : null}

        {/* Add more */}
        <Text style={[styles.sectionLabel, { color: colors.text }]}>Add More Sounds</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {filterChips.map((cat) => {
            const active = filterSlug === cat.slug;
            return (
              <Pressable
                key={cat.id}
                onPress={() => setFilterSlug(cat.slug)}
                style={[
                  styles.chip,
                  {
                    borderColor: active ? '#3B82F6' : colors.border,
                    backgroundColor: active ? 'rgba(59,130,246,0.12)' : 'transparent',
                  },
                ]}
              >
                <Text style={[styles.chipText, { color: active ? '#60A5FA' : colors.text }]}>
                  {cat.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {loading ? (
          <ActivityIndicator color={colors.icon} style={{ marginTop: 24 }} />
        ) : (
          <View style={{ paddingHorizontal: 16, gap: 10, marginTop: 8 }}>
            {filteredCatalog.map((sound) => {
              const inMix = layers.some((l) => l.sound.id === sound.id);
              const catName =
                categories.find((c) =>
                  links.some((l) => l.sound_id === sound.id && l.category_id === c.id),
                )?.name ?? 'Sound';
              return (
                <View
                  key={sound.id}
                  style={[
                    styles.addRow,
                    { borderColor: colors.border, backgroundColor: colors.elevated },
                  ]}
                >
                  <CoverArt title={sound.title} uri={sound.cover_url} size={48} rounded={10} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.addTitle, { color: colors.text }]} numberOfLines={1}>
                      {sound.title}
                    </Text>
                    <Text style={[styles.addMeta, { color: colors.textMuted }]}>{catName}</Text>
                  </View>
                  <Pressable
                    onPress={() => {
                      if (inMix) removeSound(sound.id);
                      else void addSound(sound);
                    }}
                    style={[
                      styles.addBtn,
                      {
                        backgroundColor: inMix ? 'rgba(59,130,246,0.2)' : colors.inverse,
                      },
                    ]}
                  >
                    <Ionicons
                      name={inMix ? 'checkmark' : 'add'}
                      size={20}
                      color={inMix ? '#60A5FA' : colors.inverseText}
                    />
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
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
  headerBtn: {
    minWidth: 56,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontFamily: 'Fraunces_700Bold', fontSize: 20, letterSpacing: -0.3 },
  saveText: { fontFamily: 'DMSans_700Bold', fontSize: 15 },
  titleBlock: { paddingHorizontal: 16, marginBottom: 16 },
  titleInput: {
    fontFamily: 'Fraunces_600SemiBold',
    fontSize: 22,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
  },
  hint: { fontFamily: 'DMSans_400Regular', fontSize: 12, marginTop: 8 },
  emptyCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 18,
  },
  emptyText: { fontFamily: 'DMSans_400Regular', fontSize: 14, lineHeight: 20 },
  layerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 12,
  },
  layerTitle: { fontFamily: 'DMSans_700Bold', fontSize: 15, marginBottom: 8 },
  removeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  volRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  volTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    justifyContent: 'center',
  },
  volFill: { height: '100%', borderRadius: 2 },
  volKnob: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    marginLeft: -7,
    borderWidth: StyleSheet.hairlineWidth,
  },
  volPct: { fontFamily: 'DMSans_500Medium', fontSize: 12, width: 40, textAlign: 'right' },
  transportBlock: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 8,
    gap: 6,
  },
  timer: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 36,
    letterSpacing: -0.5,
  },
  timerHint: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    marginBottom: 8,
  },
  transport: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
    marginTop: 20,
    marginBottom: 8,
  },
  transportSide: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: {
    fontFamily: 'Fraunces_600SemiBold',
    fontSize: 18,
    marginTop: 28,
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  chips: { paddingHorizontal: 16, gap: 8 },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipText: { fontFamily: 'DMSans_500Medium', fontSize: 13 },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 10,
  },
  addTitle: { fontFamily: 'DMSans_700Bold', fontSize: 14 },
  addMeta: { fontFamily: 'DMSans_400Regular', fontSize: 12, marginTop: 2 },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locked: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  lockedTitle: { fontFamily: 'Fraunces_700Bold', fontSize: 24, textAlign: 'center' },
  lockedBody: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  primaryBtn: {
    marginTop: 12,
    borderRadius: 14,
    paddingHorizontal: 22,
    paddingVertical: 14,
  },
  primaryBtnText: { fontFamily: 'DMSans_700Bold', fontSize: 15 },
});
