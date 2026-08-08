import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppTheme } from '../../lib/useAppTheme';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import {
  DAILY_LIMIT_MESSAGE,
  FREE_DAILY_SOUND_LIMIT,
  getDailyPlayStatus,
  getTodayPlayedSoundIds,
} from '../../lib/dailyListenLimit';
import {
  DEFAULT_SLEEP_TIME_SCHEDULE,
  formatTimeLabel,
  loadSleepTimeSchedule,
  nextTriggerDate,
  saveSleepTimeSchedule,
  STOP_AFTER_OPTIONS,
  type SleepTimeSchedule,
} from '../../lib/sleepTime';
import { CoverArt } from '../home/CoverArt';
import type { Playlist, Sound } from '../../types/database';
import type { RootStackParamList } from '../../navigation/types';
import { ScreenScaffold, SectionLabel } from '../../ui/Screen';

type Props = NativeStackScreenProps<RootStackParamList, 'SleepTime'>;
type SoundTab = 'sleep' | 'liked' | 'playlists' | 'search';

const SOUND_TABS: { key: SoundTab; label: string }[] = [
  { key: 'sleep', label: 'Sleep' },
  { key: 'liked', label: 'Liked' },
  { key: 'playlists', label: 'Playlists' },
  { key: 'search', label: 'Search' },
];

const SLEEP_KEYWORDS = ['sleep', 'night', 'lull'];

function matchesSleepFallback(sound: Sound) {
  const hay = `${sound.title} ${sound.description ?? ''}`.toLowerCase();
  return SLEEP_KEYWORDS.some((kw) => hay.includes(kw));
}

async function loadSleepSounds(): Promise<Sound[]> {
  const { data: sleepCat } = await supabase
    .from('categories')
    .select('id')
    .eq('slug', 'sleep')
    .maybeSingle();

  if (sleepCat?.id) {
    const { data: links } = await supabase
      .from('sound_categories')
      .select('sound_id')
      .eq('category_id', sleepCat.id);
    const ids = [...new Set((links ?? []).map((l) => l.sound_id).filter(Boolean))];
    if (ids.length) {
      const { data: sounds } = await supabase
        .from('sounds')
        .select('*')
        .in('id', ids)
        .eq('status', 'published')
        .order('title');
      if ((sounds as Sound[])?.length) return sounds as Sound[];
    }
  }

  const { data: all } = await supabase
    .from('sounds')
    .select('*')
    .eq('status', 'published')
    .order('title');
  return ((all as Sound[]) ?? []).filter(matchesSleepFallback);
}

async function loadLikedSounds(userId: string): Promise<Sound[]> {
  const { data } = await supabase
    .from('favourites')
    .select('sound:sounds(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return ((data as unknown as { sound: Sound | null }[]) ?? [])
    .map((row) => row.sound)
    .filter((s): s is Sound => !!s && s.status === 'published');
}

async function loadUserPlaylists(userId: string): Promise<Playlist[]> {
  const { data } = await supabase
    .from('playlists')
    .select('*, items:playlist_items(position, sound:sounds(cover_url))')
    .eq('user_id', userId)
    .eq('is_favourite', false)
    .order('updated_at', { ascending: false });
  return ((data as any[]) ?? []).map((p) => {
    const items = [...(p.items ?? [])].sort(
      (a: { position?: number }, b: { position?: number }) =>
        (a.position ?? 0) - (b.position ?? 0),
    );
    return {
      ...p,
      cover_url: p.cover_url ?? items[0]?.sound?.cover_url ?? null,
      item_count: items.length,
    } as Playlist;
  });
}

async function loadPlaylistSounds(playlistId: string): Promise<Sound[]> {
  const { data: items } = await supabase
    .from('playlist_items')
    .select('position, sound:sounds(*)')
    .eq('playlist_id', playlistId)
    .order('position', { ascending: true });
  return ((items as unknown as { sound: Sound | null }[]) ?? [])
    .map((i) => i.sound)
    .filter((s): s is Sound => !!s && s.status === 'published');
}

function Stepper({
  value,
  min,
  max,
  onChange,
  label,
  colors,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  label: string;
  colors: { text: string; border: string; textMuted: string };
}) {
  return (
    <View style={styles.stepperRow}>
      <Text style={[styles.stepperLabel, { color: colors.textMuted }]}>{label}</Text>
      <View style={[styles.stepper, { borderColor: colors.border }]}>
        <Pressable
          onPress={() => onChange(value <= min ? max : value - 1)}
          hitSlop={8}
          style={styles.stepBtn}
        >
          <Ionicons name="remove" size={18} color={colors.text} />
        </Pressable>
        <Text style={[styles.stepValue, { color: colors.text }]}>
          {String(value).padStart(2, '0')}
        </Text>
        <Pressable
          onPress={() => onChange(value >= max ? min : value + 1)}
          hitSlop={8}
          style={styles.stepBtn}
        >
          <Ionicons name="add" size={18} color={colors.text} />
        </Pressable>
      </View>
    </View>
  );
}

function SoundRow({
  sound,
  selected,
  onPress,
  colors,
}: {
  sound: Sound;
  selected: boolean;
  onPress: () => void;
  colors: { text: string; border: string; textMuted: string };
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.soundRow, { borderColor: colors.border }]}
    >
      <CoverArt title={sound.title} uri={sound.cover_url} size={44} rounded={10} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.soundTitle, { color: colors.text }]} numberOfLines={1}>
          {sound.title}
        </Text>
      </View>
      <Ionicons
        name={selected ? 'checkmark-circle' : 'ellipse-outline'}
        size={22}
        color={selected ? '#8A6A45' : colors.textMuted}
      />
    </Pressable>
  );
}

export function SleepTimeScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const { user, hasUnlimitedListening } = useAuth();
  const [schedule, setSchedule] = useState<SleepTimeSchedule>(DEFAULT_SLEEP_TIME_SCHEDULE);
  const [sleepSounds, setSleepSounds] = useState<Sound[]>([]);
  const [likedSounds, setLikedSounds] = useState<Sound[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [catalog, setCatalog] = useState<Sound[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [soundTab, setSoundTab] = useState<SoundTab>('sleep');
  const [search, setSearch] = useState('');
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [playlistSounds, setPlaylistSounds] = useState<Sound[]>([]);
  const [loadingPlaylist, setLoadingPlaylist] = useState(false);
  const [dailyRemaining, setDailyRemaining] = useState(FREE_DAILY_SOUND_LIMIT);
  const [unlockedToday, setUnlockedToday] = useState<string[]>([]);

  const loadAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [
      stored,
      status,
      playedIds,
      sleep,
      liked,
      userPlaylists,
      { data: allSounds },
    ] = await Promise.all([
      loadSleepTimeSchedule(user.id),
      getDailyPlayStatus(user.id, hasUnlimitedListening),
      getTodayPlayedSoundIds(user.id),
      loadSleepSounds(),
      loadLikedSounds(user.id),
      loadUserPlaylists(user.id),
      supabase.from('sounds').select('*').eq('status', 'published').order('title'),
    ]);
    setSleepSounds(sleep);
    setLikedSounds(liked);
    setPlaylists(userPlaylists);
    setCatalog((allSounds as Sound[]) ?? []);
    setSchedule(
      hasUnlimitedListening
        ? stored
        : { ...stored, loop: false, stopAfterMinutes: null },
    );
    setDailyRemaining(status.remaining);
    setUnlockedToday(playedIds);
    setLoading(false);
  }, [user, hasUnlimitedListening]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return catalog.slice(0, 40);
    return catalog.filter((s) => s.title.toLowerCase().includes(q));
  }, [catalog, search]);

  const selectedSet = useMemo(() => new Set(schedule.soundIds), [schedule.soundIds]);

  const canEnableFree = useMemo(() => {
    if (hasUnlimitedListening) return true;
    if (dailyRemaining > 0) return true;
    if (!schedule.soundIds.length) return dailyRemaining > 0;
    return schedule.soundIds.every((id) => unlockedToday.includes(id));
  }, [hasUnlimitedListening, dailyRemaining, schedule.soundIds, unlockedToday]);

  const nextRun = nextTriggerDate(schedule.hour, schedule.minute);

  const toggleSound = (id: string) => {
    setSchedule((prev) => {
      const has = prev.soundIds.includes(id);
      if (has) {
        return { ...prev, soundIds: prev.soundIds.filter((x) => x !== id) };
      }
      if (!hasUnlimitedListening && !unlockedToday.includes(id) && dailyRemaining <= 0) {
        Alert.alert('Daily limit reached', DAILY_LIMIT_MESSAGE, [
          { text: 'Not now', style: 'cancel' },
          { text: 'View Premium', onPress: () => navigation.navigate('Premium') },
        ]);
        return prev;
      }
      return { ...prev, soundIds: [...prev.soundIds, id] };
    });
  };

  const handleTabChange = (tab: SoundTab) => {
    setSoundTab(tab);
    if (tab !== 'playlists') {
      setSelectedPlaylist(null);
      setPlaylistSounds([]);
    }
  };

  const openPlaylist = async (playlist: Playlist) => {
    setSelectedPlaylist(playlist);
    setLoadingPlaylist(true);
    const sounds = await loadPlaylistSounds(playlist.id);
    setPlaylistSounds(sounds);
    setLoadingPlaylist(false);
  };

  const handleEnableToggle = (next: boolean) => {
    if (next && !canEnableFree) {
      Alert.alert('Upgrade to Premium', DAILY_LIMIT_MESSAGE, [
        { text: 'Not now', style: 'cancel' },
        { text: 'View Premium', onPress: () => navigation.navigate('Premium') },
      ]);
      return;
    }
    if (next && schedule.soundIds.length === 0) {
      Alert.alert('Pick sounds', 'Select at least one sound for Sleep Time.');
      return;
    }
    setSchedule((prev) => ({ ...prev, enabled: next }));
  };

  const handleSave = async () => {
    if (!user) return;
    if (schedule.enabled && !canEnableFree) {
      Alert.alert('Upgrade to Premium', DAILY_LIMIT_MESSAGE);
      return;
    }
    if (schedule.enabled && schedule.soundIds.length === 0) {
      Alert.alert('Pick sounds', 'Select at least one sound for Sleep Time.');
      return;
    }
    setSaving(true);
    const toSave = hasUnlimitedListening
      ? schedule
      : { ...schedule, loop: false, stopAfterMinutes: null };
    await saveSleepTimeSchedule(user.id, toSave);
    setSaving(false);
    Alert.alert(
      'Saved',
      schedule.enabled
        ? `Sleep Time set for ${formatTimeLabel(schedule.hour, schedule.minute)}.`
        : 'Sleep Time turned off.',
    );
  };

  const renderSoundList = (sounds: Sound[], emptyMessage: string) => {
    if (!sounds.length) {
      return (
        <Text style={[styles.emptyHint, { color: colors.textMuted }]}>{emptyMessage}</Text>
      );
    }
    return sounds.map((sound) => (
      <SoundRow
        key={sound.id}
        sound={sound}
        selected={selectedSet.has(sound.id)}
        onPress={() => toggleSound(sound.id)}
        colors={colors}
      />
    ));
  };

  const renderSoundPicker = () => {
    if (soundTab === 'playlists' && selectedPlaylist) {
      return (
        <>
          <Pressable
            onPress={() => {
              setSelectedPlaylist(null);
              setPlaylistSounds([]);
            }}
            style={styles.backRow}
          >
            <Ionicons name="chevron-back" size={18} color={colors.text} />
            <Text style={[styles.backLabel, { color: colors.text }]} numberOfLines={1}>
              {selectedPlaylist.title}
            </Text>
          </Pressable>
          {loadingPlaylist ? (
            <ActivityIndicator color={colors.icon} style={{ marginVertical: 16 }} />
          ) : (
            renderSoundList(playlistSounds, 'This playlist has no published sounds.')
          )}
        </>
      );
    }

    if (soundTab === 'sleep') {
      return renderSoundList(sleepSounds, 'No sleep sounds found yet.');
    }
    if (soundTab === 'liked') {
      return renderSoundList(likedSounds, 'Like sounds to see them here.');
    }
    if (soundTab === 'playlists') {
      if (!playlists.length) {
        return (
          <Text style={[styles.emptyHint, { color: colors.textMuted }]}>
            Create a playlist to pick sounds from it.
          </Text>
        );
      }
      return playlists.map((pl) => (
        <Pressable
          key={pl.id}
          onPress={() => void openPlaylist(pl)}
          style={[styles.playlistRow, { borderColor: colors.border }]}
        >
          <CoverArt title={pl.title} uri={pl.cover_url ?? null} size={44} rounded={10} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.soundTitle, { color: colors.text }]} numberOfLines={1}>
              {pl.title}
            </Text>
            <Text style={[styles.playlistMeta, { color: colors.textMuted }]}>
              {pl.item_count ?? 0} sounds
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>
      ));
    }

    return (
      <>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by title…"
          placeholderTextColor={colors.textMuted}
          style={[
            styles.search,
            { borderColor: colors.border, color: colors.text, backgroundColor: colors.background },
          ]}
        />
        {renderSoundList(searchResults, search.trim() ? 'No sounds match your search.' : 'Type to search all sounds.')}
      </>
    );
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.icon} />
      </View>
    );
  }

  return (
    <ScreenScaffold
      title="Sleep Time"
      subtitle={
        schedule.enabled
          ? `Next: ${formatTimeLabel(schedule.hour, schedule.minute)} · ${nextRun.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}`
          : 'Schedule calming sounds at bedtime'
      }
      onBack={() => navigation.goBack()}
    >
      <View style={[styles.card, { borderColor: colors.border }]}>
        <View style={styles.rowBetween}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Enable Sleep Time</Text>
            <Text style={[styles.cardHint, { color: colors.textMuted }]}>
              {hasUnlimitedListening
                ? 'Premium — loop, auto-stop, and unlimited sounds.'
                : `${dailyRemaining} of ${FREE_DAILY_SOUND_LIMIT} daily unlocks left.`}
            </Text>
          </View>
          <Switch
            value={schedule.enabled}
            onValueChange={handleEnableToggle}
            trackColor={{ false: colors.border, true: '#8A6A45' }}
          />
        </View>
      </View>

      <SectionLabel>Bedtime</SectionLabel>
      <View style={[styles.card, { borderColor: colors.border }]}>
        <Stepper
          label="Hour"
          value={schedule.hour}
          min={0}
          max={23}
          onChange={(hour) => setSchedule((p) => ({ ...p, hour }))}
          colors={colors}
        />
        <Stepper
          label="Minute"
          value={schedule.minute}
          min={0}
          max={59}
          onChange={(minute) => setSchedule((p) => ({ ...p, minute }))}
          colors={colors}
        />
        <Text style={[styles.timePreview, { color: colors.text }]}>
          {formatTimeLabel(schedule.hour, schedule.minute)}
        </Text>
      </View>

      <SectionLabel>Playback</SectionLabel>
      <View style={[styles.card, { borderColor: colors.border }]}>
        <View style={styles.rowBetween}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Loop sounds</Text>
            <Text style={[styles.cardHint, { color: colors.textMuted }]}>
              {hasUnlimitedListening ? 'Repeat until auto-stop or you stop' : 'Premium feature'}
            </Text>
          </View>
          {hasUnlimitedListening ? (
            <Switch
              value={schedule.loop}
              onValueChange={(loop) => setSchedule((p) => ({ ...p, loop }))}
              trackColor={{ false: colors.border, true: '#8A6A45' }}
            />
          ) : (
            <Pressable onPress={() => navigation.navigate('Premium')} hitSlop={8}>
              <Ionicons name="lock-closed" size={18} color={colors.textMuted} />
            </Pressable>
          )}
        </View>

        {hasUnlimitedListening ? (
          <>
            <Text style={[styles.stopLabel, { color: colors.textMuted }]}>Stop after</Text>
            <View style={styles.chipRowInline}>
              <Pressable
                onPress={() => setSchedule((p) => ({ ...p, stopAfterMinutes: null }))}
                style={[
                  styles.chip,
                  {
                    borderColor: colors.border,
                    backgroundColor:
                      schedule.stopAfterMinutes == null ? colors.text : 'transparent',
                  },
                ]}
              >
                <Text
                  style={{
                    color: schedule.stopAfterMinutes == null ? colors.background : colors.text,
                    fontFamily: 'DMSans_500Medium',
                    fontSize: 13,
                  }}
                >
                  Off
                </Text>
              </Pressable>
              {STOP_AFTER_OPTIONS.map((m) => (
                <Pressable
                  key={m}
                  onPress={() => setSchedule((p) => ({ ...p, stopAfterMinutes: m }))}
                  style={[
                    styles.chip,
                    {
                      borderColor: colors.border,
                      backgroundColor:
                        schedule.stopAfterMinutes === m ? colors.text : 'transparent',
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: schedule.stopAfterMinutes === m ? colors.background : colors.text,
                      fontFamily: 'DMSans_500Medium',
                      fontSize: 13,
                    }}
                  >
                    {m}m
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}
      </View>

      <SectionLabel>{`Sounds (${schedule.soundIds.length} selected)`}</SectionLabel>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabRow}
      >
        {SOUND_TABS.map((tab) => {
          const active = soundTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => handleTabChange(tab.key)}
              style={[
                styles.tabChip,
                {
                  borderColor: colors.border,
                  backgroundColor: active ? colors.text : 'transparent',
                },
              ]}
            >
              <Text
                style={{
                  color: active ? colors.background : colors.text,
                  fontFamily: 'DMSans_500Medium',
                  fontSize: 13,
                }}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {renderSoundPicker()}

      <View style={[styles.rules, { borderColor: colors.border }]}>
        <Text style={[styles.rulesTitle, { color: colors.text }]}>Free vs Premium</Text>
        <Text style={[styles.rulesBody, { color: colors.textMuted }]}>
          {hasUnlimitedListening
            ? 'Premium: unlimited sounds, loop, and auto-stop timer.'
            : 'Free: needs a daily unlock slot (or replay sounds you already unlocked today). Plays once through the sound\'s normal duration then stops. Premium: unlimited sounds, loop, and auto-stop timer.'}
        </Text>
      </View>

      <Pressable
        onPress={() => void handleSave()}
        disabled={saving}
        style={[styles.saveBtn, { backgroundColor: colors.text, opacity: saving ? 0.6 : 1 }]}
      >
        {saving ? (
          <ActivityIndicator color={colors.background} />
        ) : (
          <Text style={[styles.saveLabel, { color: colors.background }]}>Save schedule</Text>
        )}
      </Pressable>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  rowBetween: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardTitle: { fontFamily: 'DMSans_700Bold', fontSize: 15 },
  cardHint: { fontFamily: 'DMSans_400Regular', fontSize: 12, marginTop: 4 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepperLabel: { fontFamily: 'DMSans_500Medium', fontSize: 13 },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    overflow: 'hidden',
  },
  stepBtn: { paddingHorizontal: 14, paddingVertical: 8 },
  stepValue: { fontFamily: 'Fraunces_700Bold', fontSize: 20, minWidth: 36, textAlign: 'center' },
  timePreview: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 28,
    textAlign: 'center',
    marginTop: 4,
  },
  stopLabel: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 12,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  chipRowInline: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  tabChip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  search: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
  },
  soundRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 10,
  },
  playlistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 10,
  },
  soundTitle: { fontFamily: 'DMSans_500Medium', fontSize: 14 },
  playlistMeta: { fontFamily: 'DMSans_400Regular', fontSize: 12, marginTop: 2 },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginHorizontal: 16,
    marginBottom: 10,
  },
  backLabel: { fontFamily: 'DMSans_600SemiBold', fontSize: 14, flex: 1 },
  emptyHint: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    marginHorizontal: 16,
    marginBottom: 8,
    lineHeight: 19,
  },
  rules: {
    marginHorizontal: 16,
    marginTop: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 14,
  },
  rulesTitle: { fontFamily: 'DMSans_700Bold', fontSize: 14, marginBottom: 6 },
  rulesBody: { fontFamily: 'DMSans_400Regular', fontSize: 13, lineHeight: 19 },
  saveBtn: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveLabel: { fontFamily: 'DMSans_700Bold', fontSize: 15 },
});
