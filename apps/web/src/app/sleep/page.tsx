'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Moon, Lock } from 'lucide-react';
import { CoverArt } from '@/components/CoverArt';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import {
  DAILY_LIMIT_MESSAGE,
  FREE_DAILY_SOUND_LIMIT,
  getDailyPlayStatus,
  getTodayPlayedSoundIds,
} from '@/lib/daily-listen-limit';
import {
  DEFAULT_SLEEP_TIME_SCHEDULE,
  formatTimeLabel,
  loadSleepTimeSchedule,
  nextTriggerDate,
  saveSleepTimeSchedule,
  STOP_AFTER_OPTIONS,
  type SleepTimeSchedule,
} from '@/lib/sleep-time';
import type { Playlist, Sound } from '@/types/database';

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

async function loadSleepSounds(supabase: ReturnType<typeof createClient>): Promise<Sound[]> {
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

async function loadLikedSounds(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<Sound[]> {
  const { data } = await supabase
    .from('favourites')
    .select('sound:sounds(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return ((data as unknown as { sound: Sound | null }[]) ?? [])
    .map((row) => row.sound)
    .filter((s): s is Sound => !!s && s.status === 'published');
}

async function loadUserPlaylists(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<Playlist[]> {
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

async function loadPlaylistSounds(
  supabase: ReturnType<typeof createClient>,
  playlistId: string,
): Promise<Sound[]> {
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
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-muted">{label}</span>
      <div className="flex items-center border border-border rounded-lg overflow-hidden">
        <button
          type="button"
          className="px-3 py-2 hover:bg-surface"
          onClick={() => onChange(value <= min ? max : value - 1)}
        >
          −
        </button>
        <span className="px-3 font-serif font-bold text-lg min-w-[2.5rem] text-center">
          {String(value).padStart(2, '0')}
        </span>
        <button
          type="button"
          className="px-3 py-2 hover:bg-surface"
          onClick={() => onChange(value >= max ? min : value + 1)}
        >
          +
        </button>
      </div>
    </div>
  );
}

function SoundRow({
  sound,
  selected,
  onClick,
}: {
  sound: Sound;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`card w-full flex items-center gap-3 text-left ${selected ? 'ring-1 ring-foreground' : ''}`}
    >
      <CoverArt title={sound.title} uri={sound.cover_url} size={44} rounded={10} />
      <span className="flex-1 font-medium truncate">{sound.title}</span>
      <span className={`text-sm ${selected ? 'text-foreground font-semibold' : 'text-muted'}`}>
        {selected ? '✓' : '○'}
      </span>
    </button>
  );
}

export default function SleepTimePage() {
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
  const [message, setMessage] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const supabase = createClient();
    const [stored, status, playedIds, sleep, liked, userPlaylists, { data: allSounds }] =
      await Promise.all([
        Promise.resolve(loadSleepTimeSchedule(user.id)),
        getDailyPlayStatus(user.id, hasUnlimitedListening),
        getTodayPlayedSoundIds(user.id),
        loadSleepSounds(supabase),
        loadLikedSounds(supabase, user.id),
        loadUserPlaylists(supabase, user.id),
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

  if (!user) {
    return (
      <div className="max-w-lg mx-auto space-y-4 py-12">
        <Link href="/login" className="text-sm text-muted underline">
          Sign in
        </Link>
        <h1 className="text-3xl font-serif font-bold flex items-center gap-2">
          <Moon className="h-7 w-7" /> Sleep Time
        </h1>
        <p className="text-muted">Sign in to schedule bedtime sounds.</p>
      </div>
    );
  }

  const toggleSound = (id: string) => {
    setSchedule((prev) => {
      const has = prev.soundIds.includes(id);
      if (has) {
        return { ...prev, soundIds: prev.soundIds.filter((x) => x !== id) };
      }
      if (!hasUnlimitedListening && !unlockedToday.includes(id) && dailyRemaining <= 0) {
        setMessage(DAILY_LIMIT_MESSAGE);
        return prev;
      }
      return { ...prev, soundIds: [...prev.soundIds, id] };
    });
    setMessage(null);
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
    const supabase = createClient();
    const sounds = await loadPlaylistSounds(supabase, playlist.id);
    setPlaylistSounds(sounds);
    setLoadingPlaylist(false);
  };

  const handleEnableToggle = (next: boolean) => {
    if (next && !canEnableFree) {
      setMessage(DAILY_LIMIT_MESSAGE);
      return;
    }
    if (next && schedule.soundIds.length === 0) {
      setMessage('Select at least one sound for Sleep Time.');
      return;
    }
    setSchedule((prev) => ({ ...prev, enabled: next }));
    setMessage(null);
  };

  const handleSave = async () => {
    if (schedule.enabled && !canEnableFree) {
      setMessage(DAILY_LIMIT_MESSAGE);
      return;
    }
    if (schedule.enabled && schedule.soundIds.length === 0) {
      setMessage('Select at least one sound for Sleep Time.');
      return;
    }
    setSaving(true);
    const toSave = hasUnlimitedListening
      ? schedule
      : { ...schedule, loop: false, stopAfterMinutes: null };
    saveSleepTimeSchedule(user.id, toSave);
    setSaving(false);
    setMessage(
      schedule.enabled
        ? `Saved — next at ${formatTimeLabel(schedule.hour, schedule.minute)}.`
        : 'Sleep Time turned off.',
    );
  };

  const renderSoundList = (sounds: Sound[], emptyMessage: string) => {
    if (!sounds.length) {
      return <p className="text-sm text-muted">{emptyMessage}</p>;
    }
    return (
      <div className="space-y-2 max-h-[420px] overflow-y-auto main-scroll">
        {sounds.map((sound) => (
          <SoundRow
            key={sound.id}
            sound={sound}
            selected={selectedSet.has(sound.id)}
            onClick={() => toggleSound(sound.id)}
          />
        ))}
      </div>
    );
  };

  const renderSoundPicker = () => {
    if (soundTab === 'playlists' && selectedPlaylist) {
      return (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => {
              setSelectedPlaylist(null);
              setPlaylistSounds([]);
            }}
            className="flex items-center gap-1 text-sm font-medium hover:opacity-80"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="truncate">{selectedPlaylist.title}</span>
          </button>
          {loadingPlaylist ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : (
            renderSoundList(playlistSounds, 'This playlist has no published sounds.')
          )}
        </div>
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
          <p className="text-sm text-muted">Create a playlist to pick sounds from it.</p>
        );
      }
      return (
        <div className="space-y-2 max-h-[420px] overflow-y-auto main-scroll">
          {playlists.map((pl) => (
            <button
              key={pl.id}
              type="button"
              onClick={() => void openPlaylist(pl)}
              className="card w-full flex items-center gap-3 text-left"
            >
              <CoverArt title={pl.title} uri={pl.cover_url ?? null} size={44} rounded={10} />
              <span className="flex-1 min-w-0">
                <span className="block font-medium truncate">{pl.title}</span>
                <span className="block text-sm text-muted">{pl.item_count ?? 0} sounds</span>
              </span>
              <ChevronRight className="h-4 w-4 text-muted shrink-0" />
            </button>
          ))}
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by title…"
          className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
        />
        {renderSoundList(
          searchResults,
          search.trim() ? 'No sounds match your search.' : 'Type to search all sounds.',
        )}
      </div>
    );
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-serif font-bold flex items-center gap-2">
          <Moon className="h-7 w-7" /> Sleep Time
        </h1>
        <p className="text-muted mt-1">
          {schedule.enabled
            ? `Next: ${formatTimeLabel(schedule.hour, schedule.minute)} · ${nextRun.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}`
            : 'Schedule calming sounds at bedtime'}
        </p>
      </div>

      {loading ? (
        <p className="text-muted">Loading…</p>
      ) : (
        <>
          <div className="card space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-medium">Enable Sleep Time</p>
                <p className="text-sm text-muted">
                  {hasUnlimitedListening
                    ? 'Premium — loop, auto-stop, and unlimited sounds.'
                    : `${dailyRemaining} of ${FREE_DAILY_SOUND_LIMIT} daily unlocks left.`}
                </p>
              </div>
              <input
                type="checkbox"
                className="h-5 w-5 accent-foreground"
                checked={schedule.enabled}
                onChange={(e) => handleEnableToggle(e.target.checked)}
              />
            </div>
          </div>

          <div className="card space-y-4">
            <p className="text-xs uppercase tracking-wider text-muted">Bedtime</p>
            <Stepper
              label="Hour"
              value={schedule.hour}
              min={0}
              max={23}
              onChange={(hour) => setSchedule((p) => ({ ...p, hour }))}
            />
            <Stepper
              label="Minute"
              value={schedule.minute}
              min={0}
              max={59}
              onChange={(minute) => setSchedule((p) => ({ ...p, minute }))}
            />
            <p className="text-center font-serif font-bold text-2xl">
              {formatTimeLabel(schedule.hour, schedule.minute)}
            </p>
          </div>

          <div className="card space-y-3">
            <p className="text-xs uppercase tracking-wider text-muted">Playback</p>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Loop sounds</p>
                <p className="text-sm text-muted">
                  {hasUnlimitedListening ? 'Repeat until auto-stop or you stop' : 'Premium feature'}
                </p>
              </div>
              {hasUnlimitedListening ? (
                <input
                  type="checkbox"
                  className="h-5 w-5 accent-foreground"
                  checked={schedule.loop}
                  onChange={(e) => setSchedule((p) => ({ ...p, loop: e.target.checked }))}
                />
              ) : (
                <Link href="/premium" className="text-muted hover:text-foreground">
                  <Lock className="h-4 w-4" />
                </Link>
              )}
            </div>

            {hasUnlimitedListening ? (
              <>
                <p className="text-sm text-muted pt-2">Stop after</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={`btn text-sm ${schedule.stopAfterMinutes == null ? 'btn-primary' : 'border border-border'}`}
                    onClick={() => setSchedule((p) => ({ ...p, stopAfterMinutes: null }))}
                  >
                    Off
                  </button>
                  {STOP_AFTER_OPTIONS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      className={`btn text-sm ${schedule.stopAfterMinutes === m ? 'btn-primary' : 'border border-border'}`}
                      onClick={() => setSchedule((p) => ({ ...p, stopAfterMinutes: m }))}
                    >
                      {m}m
                    </button>
                  ))}
                </div>
              </>
            ) : null}
          </div>

          <div className="space-y-3">
            <p className="text-xs uppercase tracking-wider text-muted">
              Sounds ({schedule.soundIds.length} selected)
            </p>
            <div className="flex flex-wrap gap-2">
              {SOUND_TABS.map((tab) => {
                const active = soundTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => handleTabChange(tab.key)}
                    className={`btn text-sm ${active ? 'btn-primary' : 'border border-border'}`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
            {renderSoundPicker()}
          </div>

          <div className="card text-sm text-muted space-y-2">
            <p className="font-medium text-foreground">Free vs Premium</p>
            <p>
              {hasUnlimitedListening
                ? 'Premium: unlimited sounds, loop, and auto-stop timer.'
                : 'Free: needs a daily unlock slot (or replay sounds you already unlocked today). Plays once through the sound\'s normal duration then stops. Premium: unlimited sounds, loop, and auto-stop timer.'}
            </p>
            {!hasUnlimitedListening ? (
              <Link href="/premium" className="text-foreground underline inline-block">
                Upgrade to Premium
              </Link>
            ) : null}
          </div>

          {message ? <p className="text-sm text-muted">{message}</p> : null}

          <button
            type="button"
            className="btn btn-primary w-full"
            disabled={saving}
            onClick={() => void handleSave()}
          >
            {saving ? 'Saving…' : 'Save schedule'}
          </button>
        </>
      )}
    </div>
  );
}
