'use client';

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
import { createClient } from '@/lib/supabase/client';
import {
  claimDailySoundPlay,
  DAILY_LIMIT_MESSAGE,
  filterQueueForDailyLimit,
  getTodayPlayedSoundIds,
} from '@/lib/daily-listen-limit';
import { getOfflineAudioUrl, isOnline } from '@/lib/offline-storage';
import { stopExternalMixPlayback } from '@/lib/mix-playback';
import { useAuth } from '@/lib/auth-context';
import type { Sound } from '@/types/database';

export type PlaySoundOptions = {
  queue?: Sound[];
  queueIndex?: number;
  /** Shown in player, e.g. "Playlist", "Favourites", "Category" */
  queueLabel?: string;
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
  isFavourite: boolean;
  playSound: (sound: Sound, options?: PlaySoundOptions) => Promise<boolean>;
  playNext: () => Promise<boolean>;
  playPrevious: () => Promise<boolean>;
  stopPlayback: () => Promise<void>;
  togglePlay: () => Promise<void>;
  seekBy: (deltaMs: number) => Promise<void>;
  setRate: (rate: number) => Promise<void>;
  toggleLoop: () => void;
  setSleepTimerMinutes: (minutes: number | null) => void;
  toggleFavourite: () => Promise<boolean>;
};

const PlayerContext = createContext<PlayerContextValue | undefined>(undefined);
const PLAY_COUNT_THRESHOLD_SEC = 5;

export function PlayerProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const { user, hasUnlimitedListening, isPremium, canDownloadOffline } = useAuth();

  const audioRef = useRef<HTMLAudioElement | null>(null);
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

  const currentRef = useRef<Sound | null>(null);
  const queueRef = useRef<Sound[]>([]);
  const queueIndexRef = useRef(0);
  const queueLabelRef = useRef<string | null>(null);
  const isLoopingRef = useRef(false);
  const sleepEndsAtRef = useRef<number | null>(null);
  const listenSecondsRef = useRef(0);
  const lastAudioPosRef = useRef(0);
  const playCountedRef = useRef(false);
  const lastHistoryWrite = useRef(0);
  const playNextRef = useRef<() => Promise<boolean>>(async () => false);

  currentRef.current = current;
  queueRef.current = queue;
  queueIndexRef.current = queueIndex;
  queueLabelRef.current = queueLabel;
  isLoopingRef.current = isLooping;
  sleepEndsAtRef.current = sleepEndsAt;

  const recordPlayIfEligible = useCallback(
    async (sound: Sound, listenedSec: number) => {
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
    },
    [supabase],
  );

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
    [supabase, user],
  );

  const detachAudio = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.onplay = null;
    audio.onpause = null;
    audio.ontimeupdate = null;
    audio.onended = null;
    audio.onloadedmetadata = null;
    audio.pause();
    audio.src = '';
    audioRef.current = null;
  }, []);

  const flushPlayCount = useCallback(() => {
    const track = currentRef.current;
    if (!track) return;
    void recordPlayIfEligible(track, Math.floor(listenSecondsRef.current));
  }, [recordPlayIfEligible]);

  const unload = useCallback(async () => {
    flushPlayCount();
    detachAudio();
    setCurrent(null);
    setIsPlaying(false);
    setPositionMs(0);
    setDurationMs(0);
  }, [detachAudio, flushPlayCount]);

  const stopPlayback = useCallback(async () => {
    await unload();
    setQueue([]);
    setQueueIndex(0);
    setQueueLabel(null);
    queueRef.current = [];
    queueIndexRef.current = 0;
    queueLabelRef.current = null;
  }, [unload]);

  const bindAudio = useCallback(
    (audio: HTMLAudioElement, sound: Sound) => {
      audio.onplay = () => setIsPlaying(true);
      audio.onpause = () => setIsPlaying(false);
      audio.onloadedmetadata = () => setDurationMs((audio.duration || 0) * 1000);
      audio.ontimeupdate = () => {
        const posSec = audio.currentTime || 0;
        setPositionMs(posSec * 1000);
        const lastPos = lastAudioPosRef.current;
        if (posSec >= lastPos) {
          listenSecondsRef.current += posSec - lastPos;
        } else {
          // Seek backward or loop restart — count remaining of prior segment.
          listenSecondsRef.current += Math.max(0, (audio.duration || lastPos) - lastPos) + posSec;
        }
        lastAudioPosRef.current = posSec;
        void recordPlayIfEligible(sound, Math.floor(listenSecondsRef.current));

        const now = Date.now();
        if (user && now - lastHistoryWrite.current > 15000) {
          lastHistoryWrite.current = now;
          const completed = !!audio.duration && posSec / audio.duration > 0.9;
          void writeHistory(sound, posSec, completed);
        }
      };
      audio.onended = () => {
        const sleepActive =
          sleepEndsAtRef.current != null && Date.now() < sleepEndsAtRef.current;
        if (sleepActive) {
          audio.currentTime = 0;
          void audio.play();
          return;
        }
        if (isLoopingRef.current) {
          audio.currentTime = 0;
          void audio.play();
          return;
        }
        if (
          queueRef.current.length > 1 &&
          queueIndexRef.current < queueRef.current.length - 1
        ) {
          void playNextRef.current();
        } else {
          setIsPlaying(false);
        }
      };
    },
    [recordPlayIfEligible, user, writeHistory],
  );

  const loadSound = useCallback(
    async (
      sound: Sound,
      index: number,
      nextQueue: Sound[],
      audioUrl?: string,
      nextQueueLabel?: string | null,
    ) => {
      const resolvedUrl = audioUrl ?? sound.audio_url;
      if (!resolvedUrl) return false;
      await unload();
      listenSecondsRef.current = 0;
      lastAudioPosRef.current = 0;
      playCountedRef.current = false;

      setQueue(nextQueue);
      setQueueIndex(index);
      queueRef.current = nextQueue;
      queueIndexRef.current = index;
      if (nextQueueLabel !== undefined) {
        setQueueLabel(nextQueueLabel);
        queueLabelRef.current = nextQueueLabel;
      }

      const sleepActive =
        isPremium && sleepEndsAtRef.current != null && Date.now() < sleepEndsAtRef.current;
      const shouldLoop = sleepActive || isLooping;

      const audio = new Audio(resolvedUrl);
      audio.loop = shouldLoop;
      audio.playbackRate = rate;
      bindAudio(audio, sound);
      audioRef.current = audio;
      setCurrent(sound);

      try {
        await audio.play();
      } catch {
        return false;
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

      return true;
    },
    [bindAudio, isLooping, isPremium, rate, supabase, unload, user],
  );

  const playSound = useCallback(
    async (sound: Sound, options?: PlaySoundOptions): Promise<boolean> => {
      stopExternalMixPlayback();

      if (!isOnline()) {
        if (!canDownloadOffline) {
          alert('Internet required. Free accounts need a connection to listen.');
          return false;
        }
        const offlineUrl = await getOfflineAudioUrl(sound.id);
        if (!offlineUrl) {
          alert('Not downloaded. Save this sound from the player while online first.');
          return false;
        }
        // Offline Premium: still respect daily unlocks if somehow not unlimited.
        const claimOffline = await claimDailySoundPlay(
          user?.id ?? null,
          sound.id,
          hasUnlimitedListening,
        );
        if (!claimOffline.allowed) {
          alert(DAILY_LIMIT_MESSAGE);
          return false;
        }
        const unlockedOffline = await getTodayPlayedSoundIds(user?.id ?? null);
        if (!unlockedOffline.includes(sound.id)) unlockedOffline.push(sound.id);
        const rawOfflineQueue = (options?.queue ?? [sound]).filter((item) => !!item.id);
        const playableQueue = filterQueueForDailyLimit(
          rawOfflineQueue,
          unlockedOffline,
          hasUnlimitedListening,
        );
        if (!playableQueue.some((item) => item.id === sound.id)) {
          alert(DAILY_LIMIT_MESSAGE);
          return false;
        }
        const index = Math.max(0, playableQueue.findIndex((item) => item.id === sound.id));
        const label =
          options?.queueLabel ??
          (playableQueue.length > 1 ? queueLabelRef.current : null);
        return loadSound(sound, index, playableQueue, offlineUrl, label);
      }

      if (!sound.audio_url) return false;

      const userId = user?.id ?? null;
      const claim = await claimDailySoundPlay(userId, sound.id, hasUnlimitedListening);
      if (!claim.allowed) {
        alert(DAILY_LIMIT_MESSAGE);
        return false;
      }

      const unlockedToday = await getTodayPlayedSoundIds(userId);
      if (!unlockedToday.includes(sound.id)) unlockedToday.push(sound.id);

      const rawQueue = (options?.queue ?? [sound]).filter((item) => !!item.audio_url);
      const playableQueue = filterQueueForDailyLimit(
        rawQueue,
        unlockedToday,
        hasUnlimitedListening,
      );
      if (!playableQueue.some((item) => item.id === sound.id)) {
        alert(DAILY_LIMIT_MESSAGE);
        return false;
      }

      const index = Math.max(0, playableQueue.findIndex((item) => item.id === sound.id));
      const label =
        options?.queueLabel ??
        (options?.queue ? queueLabelRef.current : null) ??
        (playableQueue.length > 1 ? 'Queue' : null);

      return loadSound(sound, index, playableQueue, undefined, label);
    },
    [hasUnlimitedListening, loadSound, user?.id, canDownloadOffline],
  );

  const playNext = useCallback(async () => {
    const q = queueRef.current;
    const idx = queueIndexRef.current;
    if (idx >= q.length - 1) return false;
    const nextSound = q[idx + 1];
    if (!nextSound) return false;
    return playSound(nextSound, {
      queue: q,
      queueIndex: idx + 1,
      queueLabel: queueLabelRef.current ?? undefined,
    });
  }, [playSound]);

  const playPrevious = useCallback(async () => {
    const audio = audioRef.current;
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      return true;
    }
    const q = queueRef.current;
    const idx = queueIndexRef.current;
    if (idx <= 0) {
      if (audio) audio.currentTime = 0;
      return true;
    }
    const prevSound = q[idx - 1];
    if (!prevSound) return false;
    return playSound(prevSound, {
      queue: q,
      queueIndex: idx - 1,
      queueLabel: queueLabelRef.current ?? undefined,
    });
  }, [playSound]);

  playNextRef.current = playNext;

  const togglePlay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      flushPlayCount();
      await audio.play();
    } else {
      flushPlayCount();
      audio.pause();
    }
  }, [flushPlayCount]);

  const seekBy = useCallback(async (deltaMs: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, audio.currentTime + deltaMs / 1000);
  }, []);

  const setRate = useCallback(async (next: number) => {
    setRateState(next);
    const audio = audioRef.current;
    if (audio) audio.playbackRate = next;
  }, []);

  const toggleLoop = useCallback(() => {
    if (sleepEndsAtRef.current) return;
    const next = !isLooping;
    setIsLooping(next);
    isLoopingRef.current = next;
    const audio = audioRef.current;
    if (audio) audio.loop = next;
  }, [isLooping]);

  const setSleepTimerMinutes = useCallback(
    (minutes: number | null) => {
      if (minutes != null && !isPremium) return;
      if (minutes == null) {
        setSleepEndsAt(null);
        sleepEndsAtRef.current = null;
        const audio = audioRef.current;
        if (audio) audio.loop = isLooping;
        return;
      }
      const endsAt = Date.now() + minutes * 60_000;
      setSleepEndsAt(endsAt);
      sleepEndsAtRef.current = endsAt;
      const audio = audioRef.current;
      if (audio) {
        audio.loop = true;
        if (audio.paused) void audio.play();
      }
    },
    [isLooping, isPremium],
  );

  const toggleFavourite = useCallback(async () => {
    if (!user || !current) return false;
    if (isFavourite) {
      await supabase.from('favourites').delete().eq('user_id', user.id).eq('sound_id', current.id);
      setIsFavourite(false);
      return false;
    }
    await supabase.from('favourites').insert({ user_id: user.id, sound_id: current.id });
    setIsFavourite(true);
    return true;
  }, [current, isFavourite, supabase, user]);

  useEffect(() => {
    if (!sleepEndsAt) return;
    const id = window.setInterval(() => {
      if (sleepEndsAtRef.current && Date.now() >= sleepEndsAtRef.current) {
        audioRef.current?.pause();
        setSleepEndsAt(null);
        sleepEndsAtRef.current = null;
        const audio = audioRef.current;
        if (audio) audio.loop = isLooping;
      }
    }, 1000);
    return () => clearInterval(id);
  }, [sleepEndsAt, isLooping]);

  useEffect(() => {
    return () => {
      flushPlayCount();
      detachAudio();
    };
  }, [detachAudio, flushPlayCount]);

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
      isFavourite,
      playSound,
      playNext,
      playPrevious,
      stopPlayback,
      togglePlay,
      seekBy,
      setRate,
      toggleLoop,
      setSleepTimerMinutes,
      toggleFavourite,
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
      isFavourite,
      playSound,
      playNext,
      playPrevious,
      stopPlayback,
      togglePlay,
      seekBy,
      setRate,
      toggleLoop,
      setSleepTimerMinutes,
      toggleFavourite,
    ],
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider');
  return ctx;
}
