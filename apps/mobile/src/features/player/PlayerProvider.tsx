import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  createAudioPlayer,
  type AudioPlayer,
  type AudioStatus,
} from 'expo-audio';
import { Alert, AppState, type AppStateStatus } from 'react-native';
import { supabase } from '../../lib/supabase';
import {
  claimDailySoundPlay,
  DAILY_LIMIT_MESSAGE,
  filterQueueForDailyLimit,
  getTodayPlayedSoundIds,
} from '../../lib/dailyListenLimit';
import { stopExternalMixPlayback } from '../../lib/mixPlayback';
import { claimExclusiveAudioFocus } from '../../lib/audioSession';
import {
  clearPlaybackSession,
  loadPlaybackSession,
  savePlaybackSession,
} from '../../lib/playbackSession';
import { resolvePlayableUrl } from '../../lib/downloads';
import { isDeviceOnline, loadAppSettings } from '../../lib/appSettings';
import { useAuth } from '../auth/AuthProvider';
import type { Sound } from '../../types/database';

export type PlaySoundOptions = {
  queue?: Sound[];
  queueIndex?: number;
  queueLabel?: string;
  startPositionMs?: number;
  autoPlay?: boolean;
};

type PlayerContextValue = {
  current: Sound | null;
  isPlaying: boolean;
  positionMs: number;
  durationMs: number;
  rate: number;
  isLooping: boolean;
  sleepEndsAt: number | null;
  queue: Sound[];
  queueIndex: number;
  queueLabel: string | null;
  hasNext: boolean;
  hasPrevious: boolean;
  playSound: (sound: Sound, options?: PlaySoundOptions) => Promise<boolean>;
  playNext: () => Promise<boolean>;
  playPrevious: () => Promise<boolean>;
  stopPlayback: () => Promise<void>;
  dismissMiniPlayer: () => Promise<void>;
  togglePlay: () => Promise<void>;
  seekBy: (deltaMs: number) => Promise<void>;
  seekTo: (positionMs: number) => Promise<void>;
  setRate: (rate: number) => Promise<void>;
  toggleLoop: () => Promise<void>;
  setSleepTimerMinutes: (minutes: number | null) => void;
  toggleFavourite: () => Promise<boolean>;
  isFavourite: boolean;
};

const PlayerContext = createContext<PlayerContextValue | undefined>(undefined);
const PLAY_COUNT_THRESHOLD_SEC = 5;

function isActivelyPlaying(status: AudioStatus) {
  return (
    status.playing ||
    status.timeControlStatus === 'playing' ||
    status.playbackState === 'playing'
  );
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const { user, hasUnlimitedListening, isPremium } = useAuth();
  const soundRef = useRef<AudioPlayer | null>(null);
  const statusSubRef = useRef<{ remove: () => void } | null>(null);
  const [current, setCurrent] = useState<Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [rate, setRateState] = useState(1);
  const [isLooping, setIsLooping] = useState(false);
  const [sleepEndsAt, setSleepEndsAt] = useState<number | null>(null);
  const [isFavourite, setIsFavourite] = useState(false);
  const [queue, setQueue] = useState<Sound[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [queueLabel, setQueueLabel] = useState<string | null>(null);
  const lastHistoryWrite = useRef(0);
  const currentRef = useRef<Sound | null>(null);
  const queueRef = useRef<Sound[]>([]);
  const queueIndexRef = useRef(0);
  const queueLabelRef = useRef<string | null>(null);
  const isLoopingRef = useRef(false);
  const playNextRef = useRef<() => Promise<boolean>>(async () => false);
  const sleepEndsAtRef = useRef<number | null>(null);
  const listenSecondsRef = useRef(0);
  const playCountedRef = useRef(false);
  const lastPosSecRef = useRef(0);
  const lastStatusAtRef = useRef(0);
  const sleepLoopRef = useRef(false);
  const positionMsRef = useRef(0);
  const restoringRef = useRef(false);
  currentRef.current = current;
  sleepEndsAtRef.current = sleepEndsAt;
  queueRef.current = queue;
  queueIndexRef.current = queueIndex;
  queueLabelRef.current = queueLabel;
  isLoopingRef.current = isLooping;
  positionMsRef.current = positionMs;

  const persistSession = useCallback(async () => {
    const track = currentRef.current;
    if (!track?.audio_url) {
      await clearPlaybackSession();
      return;
    }
    await savePlaybackSession({
      sound: track,
      queue: queueRef.current.length ? queueRef.current : [track],
      queueIndex: queueIndexRef.current,
      queueLabel: queueLabelRef.current,
      positionMs: Math.max(0, positionMsRef.current),
      updatedAt: Date.now(),
    });
  }, []);

  useEffect(() => {
    void claimExclusiveAudioFocus();
  }, []);

  useEffect(() => {
    const onChange = (next: AppStateStatus) => {
      if (next === 'background' || next === 'inactive') {
        void persistSession();
      }
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [persistSession]);

  useEffect(() => {
    if (!current) return;
    const id = setInterval(() => {
      void persistSession();
    }, 8000);
    return () => clearInterval(id);
  }, [current, persistSession]);

  useEffect(() => {
    if (!sleepEndsAt) return;
    const id = setInterval(() => {
      if (sleepEndsAtRef.current && Date.now() >= sleepEndsAtRef.current) {
        try {
          soundRef.current?.pause();
        } catch {
          /* ignore */
        }
        setIsPlaying(false);
        setSleepEndsAt(null);
        sleepEndsAtRef.current = null;
        sleepLoopRef.current = false;
        const audio = soundRef.current;
        if (audio) audio.loop = isLooping;
      }
    }, 1000);
    return () => clearInterval(id);
  }, [sleepEndsAt, isLooping]);

  const recordPlayIfEligible = useCallback(async (sound: Sound, listenedSec: number) => {
    if (playCountedRef.current || listenedSec < PLAY_COUNT_THRESHOLD_SEC) return;
    playCountedRef.current = true;
    const { data, error } = await supabase.rpc('record_sound_listen', {
      p_sound_id: sound.id,
      p_listened_seconds: listenedSec,
    });
    if (error) {
      playCountedRef.current = false;
      return;
    }
    const payload = data as { counted?: boolean; play_count?: number } | null;
    if (payload?.counted) {
      const nextCount =
        typeof payload.play_count === 'number' ? payload.play_count : sound.play_count + 1;
      setCurrent((prev) =>
        prev && prev.id === sound.id ? { ...prev, play_count: nextCount } : prev,
      );
    } else {
      playCountedRef.current = false;
    }
  }, []);

  const accumulateListenTime = useCallback((status: AudioStatus) => {
    if (!isActivelyPlaying(status)) {
      lastStatusAtRef.current = Date.now();
      return;
    }

    const posSec = status.currentTime ?? 0;
    const now = Date.now();
    const wallDelta = lastStatusAtRef.current ? (now - lastStatusAtRef.current) / 1000 : 0;
    lastStatusAtRef.current = now;

    const posDelta = posSec - lastPosSecRef.current;
    if (posDelta > 0 && posDelta < 8) {
      listenSecondsRef.current += posDelta;
    } else if (posDelta < -0.5 && status.duration) {
      listenSecondsRef.current += Math.max(0, status.duration - lastPosSecRef.current) + posSec;
    } else if (wallDelta > 0 && wallDelta < 8) {
      listenSecondsRef.current += wallDelta;
    }
    lastPosSecRef.current = posSec;
  }, []);

  const writeHistory = useCallback(
    async (sound: Sound, positionSec: number, completed: boolean) => {
      if (!user) return;
      await supabase.from('listening_history').upsert(
        {
          user_id: user.id,
          sound_id: sound.id,
          progress_seconds: Math.floor(positionSec),
          duration_seconds: sound.duration_seconds,
          completed,
          played_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,sound_id' },
      );
    },
    [user],
  );

  const onPlaybackStatus = useCallback(
    (status: AudioStatus) => {
      if (!status.isLoaded) return;
      const posSec = status.currentTime ?? 0;
      setPositionMs(posSec * 1000);
      setDurationMs((status.duration ?? 0) * 1000);
      setIsPlaying(!!status.playing);

      const track = currentRef.current;
      if (!track) return;

      accumulateListenTime(status);
      recordPlayIfEligible(track, Math.floor(listenSecondsRef.current)).catch(() => undefined);

      const sleepActive = sleepEndsAtRef.current != null && Date.now() < sleepEndsAtRef.current;
      if (sleepActive && status.didJustFinish) {
        const audio = soundRef.current;
        if (audio) {
          audio.seekTo(0).then(() => audio.play()).catch(() => undefined);
        }
      } else if (
        status.didJustFinish &&
        !isLoopingRef.current &&
        !sleepActive &&
        queueRef.current.length > 1 &&
        queueIndexRef.current < queueRef.current.length - 1
      ) {
        playNextRef.current().catch(() => undefined);
      }

      const now = Date.now();
      if (user && now - lastHistoryWrite.current > 15000) {
        lastHistoryWrite.current = now;
        const completed =
          !!status.duration && status.currentTime / status.duration > 0.9;
        writeHistory(track, posSec, completed).catch(() => undefined);
      }
    },
    [user, writeHistory, recordPlayIfEligible, accumulateListenTime],
  );

  const flushPlayCount = useCallback(() => {
    const track = currentRef.current;
    if (!track) return;
    recordPlayIfEligible(track, Math.floor(listenSecondsRef.current)).catch(() => undefined);
  }, [recordPlayIfEligible]);

  const unload = useCallback(async () => {
    flushPlayCount();
    statusSubRef.current?.remove();
    statusSubRef.current = null;
    if (soundRef.current) {
      try {
        soundRef.current.clearLockScreenControls();
        soundRef.current.pause();
        soundRef.current.remove();
      } catch {
        /* ignore */
      }
      soundRef.current = null;
    }
    setCurrent(null);
    setIsPlaying(false);
    setPositionMs(0);
    setDurationMs(0);
  }, [flushPlayCount]);

  const stopPlayback = useCallback(async () => {
    await unload();
    setQueue([]);
    setQueueIndex(0);
    setQueueLabel(null);
    queueRef.current = [];
    queueIndexRef.current = 0;
    queueLabelRef.current = null;
    await clearPlaybackSession();
  }, [unload]);

  const dismissMiniPlayer = useCallback(async () => {
    await stopPlayback();
  }, [stopPlayback]);

  const loadSound = useCallback(
    async (
      sound: Sound,
      index: number,
      nextQueue: Sound[],
      nextQueueLabel?: string | null,
      opts?: { startPositionMs?: number; autoPlay?: boolean },
    ) => {
      if (!sound.audio_url && !(await resolvePlayableUrl(sound))) return false;

      await unload();
      listenSecondsRef.current = 0;
      playCountedRef.current = false;
      lastPosSecRef.current = 0;
      lastStatusAtRef.current = Date.now();

      setQueue(nextQueue);
      setQueueIndex(index);
      queueRef.current = nextQueue;
      queueIndexRef.current = index;
      if (nextQueueLabel !== undefined) {
        setQueueLabel(nextQueueLabel);
        queueLabelRef.current = nextQueueLabel;
      }

      const loopForSleep =
        isPremium && sleepEndsAtRef.current != null && Date.now() < sleepEndsAtRef.current;
      const shouldLoop = loopForSleep || isLooping;
      const autoPlay = opts?.autoPlay !== false;
      const startMs = Math.max(0, opts?.startPositionMs ?? 0);

      const uri = (await resolvePlayableUrl(sound)) ?? sound.audio_url;
      if (!uri) return false;

      const settings = await loadAppSettings();
      const player = createAudioPlayer({ uri }, { updateInterval: 500 });
      player.loop = shouldLoop;
      player.shouldCorrectPitch = true;
      player.setPlaybackRate(rate);
      try {
        player.volume = settings.volume;
      } catch {
        /* ignore */
      }
      statusSubRef.current = player.addListener(
        'playbackStatusUpdate',
        onPlaybackStatus,
      );

      const album =
        (nextQueueLabel !== undefined ? nextQueueLabel : queueLabelRef.current) || 'X-Relax';
      // Activates Android media notification + lock-screen controls (keeps audio alive while locked).
      player.setActiveForLockScreen(
        true,
        {
          title: sound.title,
          artist: 'X-Relax',
          albumTitle: album,
          artworkUrl: sound.cover_url ?? undefined,
        },
        {
          showSeekForward: true,
          showSeekBackward: true,
        },
      );

      soundRef.current = player;
      setCurrent(sound);
      setPositionMs(startMs);
      positionMsRef.current = startMs;

      if (startMs > 0) {
        try {
          await player.seekTo(startMs / 1000);
        } catch {
          /* ignore */
        }
      }

      if (autoPlay) {
        player.play();
        setIsPlaying(true);
      } else {
        try {
          player.pause();
        } catch {
          /* ignore */
        }
        setIsPlaying(false);
      }

      if (user) {
        const { data } = await supabase
          .from('favourites')
          .select('sound_id')
          .eq('user_id', user.id)
          .eq('sound_id', sound.id)
          .maybeSingle();
        setIsFavourite(!!data);
      } else {
        setIsFavourite(false);
      }

      void savePlaybackSession({
        sound,
        queue: nextQueue,
        queueIndex: index,
        queueLabel: nextQueueLabel ?? null,
        positionMs: startMs,
        updatedAt: Date.now(),
      });

      return true;
    },
    [unload, isLooping, rate, onPlaybackStatus, user, isPremium],
  );

  const playSound = useCallback(
    async (sound: Sound, options?: PlaySoundOptions): Promise<boolean> => {
      const uri = await resolvePlayableUrl(sound);
      if (!uri) {
        const online = await isDeviceOnline();
        Alert.alert(
          online ? 'Unavailable' : 'Offline',
          online
            ? 'This sound has no audio file.'
            : 'You are offline. Only downloaded sounds can be played. Open Library → Downloads.',
        );
        return false;
      }

      const playableSound = { ...sound, audio_url: uri };

      stopExternalMixPlayback();
      await claimExclusiveAudioFocus();

      const userId = user?.id ?? null;
      const skipDailyClaim = options?.autoPlay === false;
      const online = await isDeviceOnline();
      if (!skipDailyClaim && online) {
        const claim = await claimDailySoundPlay(userId, sound.id, hasUnlimitedListening);
        if (!claim.allowed) {
          Alert.alert('Daily limit reached', DAILY_LIMIT_MESSAGE);
          return false;
        }
      }

      const unlockedToday = online
        ? await getTodayPlayedSoundIds(userId)
        : [sound.id];
      if (!unlockedToday.includes(sound.id)) unlockedToday.push(sound.id);

      const rawQueue = (options?.queue ?? [playableSound]).map((item) =>
        item.id === playableSound.id ? playableSound : item,
      );
      const playableQueue = online
        ? filterQueueForDailyLimit(rawQueue, unlockedToday, hasUnlimitedListening)
        : rawQueue.filter((item) => !!item.audio_url);

      if (!playableQueue.some((item) => item.id === sound.id)) {
        if (!skipDailyClaim && online) {
          Alert.alert('Daily limit reached', DAILY_LIMIT_MESSAGE);
          return false;
        }
      }

      const queueForLoad = playableQueue.some((item) => item.id === sound.id)
        ? playableQueue
        : rawQueue.length
          ? rawQueue
          : [playableSound];

      const index = Math.max(
        0,
        queueForLoad.findIndex((item) => item.id === sound.id),
      );
      const label =
        options?.queueLabel ??
        (options?.queue ? queueLabelRef.current : null) ??
        (queueForLoad.length > 1 ? 'Queue' : null);

      return loadSound(playableSound, index, queueForLoad, label, {
        startPositionMs: options?.startPositionMs,
        autoPlay: options?.autoPlay,
      });
    },
    [user, hasUnlimitedListening, loadSound],
  );

  useEffect(() => {
    if (restoringRef.current) return;
    restoringRef.current = true;
    let cancelled = false;
    (async () => {
      const session = await loadPlaybackSession();
      if (cancelled || !session?.sound?.audio_url) return;
      await playSound(session.sound, {
        queue: session.queue?.length ? session.queue : [session.sound],
        queueIndex: session.queueIndex,
        queueLabel: session.queueLabel ?? undefined,
        startPositionMs: session.positionMs,
        autoPlay: false,
      });
    })().catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // Restore once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const playNext = useCallback(async (): Promise<boolean> => {
    const q = queueRef.current;
    const idx = queueIndexRef.current;
    if (idx >= q.length - 1) return false;
    const nextSound = q[idx + 1];
    if (!nextSound?.audio_url) return false;
    return playSound(nextSound, {
      queue: q,
      queueIndex: idx + 1,
      queueLabel: queueLabelRef.current ?? undefined,
    });
  }, [playSound]);

  const playPrevious = useCallback(async (): Promise<boolean> => {
    const audio = soundRef.current;
    if (audio && audio.currentTime > 3) {
      await audio.seekTo(0);
      return true;
    }
    const q = queueRef.current;
    const idx = queueIndexRef.current;
    if (idx <= 0) {
      if (audio) await audio.seekTo(0);
      return true;
    }
    const prevSound = q[idx - 1];
    if (!prevSound?.audio_url) return false;
    return playSound(prevSound, {
      queue: q,
      queueIndex: idx - 1,
      queueLabel: queueLabelRef.current ?? undefined,
    });
  }, [playSound]);

  playNextRef.current = playNext;

  const togglePlay = useCallback(async () => {
    const audio = soundRef.current;
    if (!audio) return;
    if (audio.playing) {
      flushPlayCount();
      audio.pause();
      // Keep exclusive focus so other apps (Spotify, etc.) do not auto-resume.
      await claimExclusiveAudioFocus();
      setIsPlaying(false);
      void persistSession();
    } else {
      await claimExclusiveAudioFocus();
      lastStatusAtRef.current = Date.now();
      audio.play();
      setIsPlaying(true);
      void persistSession();
    }
  }, [flushPlayCount, persistSession]);

  const seekBy = useCallback(async (deltaMs: number) => {
    const audio = soundRef.current;
    if (!audio) return;
    const next = Math.max(0, audio.currentTime + deltaMs / 1000);
    await audio.seekTo(next);
  }, []);

  const seekTo = useCallback(async (ms: number) => {
    const audio = soundRef.current;
    if (!audio) return;
    await audio.seekTo(Math.max(0, ms / 1000));
  }, []);

  const setRate = useCallback(async (next: number) => {
    setRateState(next);
    const audio = soundRef.current;
    if (!audio) return;
    audio.setPlaybackRate(next);
  }, []);

  const toggleLoop = useCallback(async () => {
    if (sleepLoopRef.current) return;
    if (!isPremium) return;
    const next = !isLooping;
    setIsLooping(next);
    const audio = soundRef.current;
    if (!audio) return;
    audio.loop = next;
  }, [isLooping, isPremium]);

  useEffect(() => {
    if (!isPremium && isLooping) {
      setIsLooping(false);
      const audio = soundRef.current;
      if (audio && !sleepLoopRef.current) audio.loop = false;
    }
  }, [isPremium, isLooping]);

  const setSleepTimerMinutes = useCallback((minutes: number | null) => {
    if (minutes != null && !isPremium) return;
    if (minutes == null) {
      setSleepEndsAt(null);
      sleepEndsAtRef.current = null;
      sleepLoopRef.current = false;
      const audio = soundRef.current;
      if (audio) audio.loop = isLooping;
      return;
    }
    const endsAt = Date.now() + minutes * 60_000;
    setSleepEndsAt(endsAt);
    sleepEndsAtRef.current = endsAt;
    sleepLoopRef.current = true;
    const audio = soundRef.current;
    if (audio) {
      audio.loop = true;
      if (!audio.playing) audio.play();
    }
  }, [isLooping, isPremium]);

  const toggleFavourite = useCallback(async () => {
    if (!user || !current) return false;
    if (isFavourite) {
      await supabase
        .from('favourites')
        .delete()
        .eq('user_id', user.id)
        .eq('sound_id', current.id);
      setIsFavourite(false);
      return false;
    }
    await supabase.from('favourites').insert({
      user_id: user.id,
      sound_id: current.id,
    });
    setIsFavourite(true);
    return true;
  }, [user, current, isFavourite]);

  useEffect(() => {
    if (!isPremium && sleepEndsAtRef.current) {
      setSleepEndsAt(null);
      sleepEndsAtRef.current = null;
      sleepLoopRef.current = false;
      const audio = soundRef.current;
      if (audio) audio.loop = isLooping;
    }
  }, [isPremium, isLooping]);

  useEffect(() => {
    return () => {
      unload().catch(() => undefined);
    };
  }, [unload]);

  const value = useMemo<PlayerContextValue>(
    () => ({
      current,
      isPlaying,
      positionMs,
      durationMs,
      rate,
      isLooping,
      sleepEndsAt,
      queue,
      queueIndex,
      queueLabel,
      hasNext: queue.length > 0 && queueIndex < queue.length - 1,
      hasPrevious: queue.length > 0 && (queueIndex > 0 || positionMs > 3000),
      playSound,
      playNext,
      playPrevious,
      stopPlayback,
      dismissMiniPlayer,
      togglePlay,
      seekBy,
      seekTo,
      setRate,
      toggleLoop,
      setSleepTimerMinutes,
      toggleFavourite,
      isFavourite,
    }),
    [
      current,
      isPlaying,
      positionMs,
      durationMs,
      rate,
      isLooping,
      sleepEndsAt,
      queue,
      queueIndex,
      queueLabel,
      playSound,
      playNext,
      playPrevious,
      stopPlayback,
      dismissMiniPlayer,
      togglePlay,
      seekBy,
      seekTo,
      setRate,
      toggleLoop,
      setSleepTimerMinutes,
      toggleFavourite,
      isFavourite,
    ],
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider');
  return ctx;
}
