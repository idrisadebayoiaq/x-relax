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
  addMixTrackLive,
  isMixPlaying as layersArePlaying,
  pauseMixLayers,
  registerMixStopHandler,
  releaseMixLayers,
  removeMixTrackLive,
  resumeMixLayers,
  setMixLayerVolume,
  setMixSessionMeta,
  startMixLayers,
  stopMixCompletely,
  type MixLayer,
} from '../../lib/mixPlayback';
import { supabase } from '../../lib/supabase';
import { renderMixLayersToWav } from '../../lib/mixRender';
import type { Mix, Sound } from '../../types/database';
import { useAuth } from '../auth/AuthProvider';
import { usePlayer } from '../player/PlayerProvider';
import { appAlert } from '../../ui/appAlert';
import { ensureMyMixPlaylist } from '../../lib/ensureMyMixPlaylist';

export type SavedMix = Mix & {
  visibility?: string | null;
  tracks: { volume: number; position: number; sound: Sound }[];
};

type MixContextValue = {
  layers: MixLayer[];
  mixId: string | null;
  mixTitle: string;
  isMixActive: boolean;
  isMixPlaying: boolean;
  /** Wall-clock seconds accumulated while the mix was playing this session. */
  sessionElapsedSec: number;
  /** When replaying a saved mix, stop after this many seconds (from save). */
  savedDurationSec: number | null;
  sleepEndsAt: number | null;
  maxTracks: number;
  setMixTitle: (title: string) => void;
  addSound: (sound: Sound, volume?: number) => Promise<boolean>;
  removeSound: (soundId: string) => void;
  setTrackVolume: (soundId: string, volume: number) => void;
  playMix: () => Promise<boolean>;
  pauseMix: () => void;
  toggleMixPlay: () => Promise<void>;
  stopMix: () => void;
  loadSavedMix: (mix: SavedMix, autoPlay?: boolean) => Promise<boolean>;
  saveMix: (title?: string) => Promise<string | null>;
  clearMix: () => void;
  setSleepTimerMinutes: (minutes: number | null) => void;
  seedWithSound: (sound: Sound) => Promise<void>;
};

const MixContext = createContext<MixContextValue | null>(null);

const DEFAULT_VOLUME = 0.5;
const MIX_SOUND_PREFIX = '__xrelax_mix__:';
const MY_MIX_PLAYLIST = 'My Mix';

export function MixProvider({ children }: { children: ReactNode }) {
  const { user, canUseMixes, freeMixLimit, isPremium, isAdmin, premiumMixLimit } = useAuth();
  const { stopPlayback, playSound } = usePlayer();

  const [layers, setLayers] = useState<MixLayer[]>([]);
  const [mixId, setMixId] = useState<string | null>(null);
  const [mixTitle, setMixTitleState] = useState('My Mix');
  const [isMixPlaying, setIsMixPlaying] = useState(false);
  const [sleepEndsAt, setSleepEndsAt] = useState<number | null>(null);
  const [sessionElapsedSec, setSessionElapsedSec] = useState(0);
  const [savedDurationSec, setSavedDurationSec] = useState<number | null>(null);
  const [linkedSoundId, setLinkedSoundId] = useState<string | null>(null);

  const layersRef = useRef(layers);
  const playingRef = useRef(false);
  const titleRef = useRef(mixTitle);
  const sleepRef = useRef<number | null>(null);
  const sessionElapsedRef = useRef(0);
  const tickStartedAtRef = useRef<number | null>(null);
  const savedDurationRef = useRef<number | null>(null);
  const replayElapsedRef = useRef(0);

  layersRef.current = layers;
  playingRef.current = isMixPlaying;
  titleRef.current = mixTitle;
  sleepRef.current = sleepEndsAt;
  sessionElapsedRef.current = sessionElapsedSec;
  savedDurationRef.current = savedDurationSec;

  const maxTracks = isPremium || isAdmin ? premiumMixLimit : Math.max(1, freeMixLimit);

  const flushTick = useCallback(() => {
    if (tickStartedAtRef.current == null) return;
    const delta = (Date.now() - tickStartedAtRef.current) / 1000;
    tickStartedAtRef.current = Date.now();
    sessionElapsedRef.current += delta;
    setSessionElapsedSec(sessionElapsedRef.current);
    if (savedDurationRef.current != null && savedDurationRef.current > 0) {
      replayElapsedRef.current += delta;
    }
  }, []);

  const syncPlayingFlag = useCallback((nextLayers: MixLayer[]) => {
    const playing = layersArePlaying(nextLayers);
    setIsMixPlaying(playing);
    playingRef.current = playing;
  }, []);

  const stopMix = useCallback(() => {
    flushTick();
    tickStartedAtRef.current = null;
    stopMixCompletely();
    setLayers((prev) => prev.map((l) => ({ ...l, player: undefined })));
    setIsMixPlaying(false);
    playingRef.current = false;
    setSleepEndsAt(null);
    sleepRef.current = null;
  }, [flushTick]);

  useEffect(() => {
    registerMixStopHandler(() => {
      flushTick();
      tickStartedAtRef.current = null;
      stopMixCompletely();
      setLayers((prev) => prev.map((l) => ({ ...l, player: undefined })));
      setIsMixPlaying(false);
      playingRef.current = false;
      setSleepEndsAt(null);
    });
    return () => {
      registerMixStopHandler(null);
      releaseMixLayers(layersRef.current);
    };
  }, [flushTick]);

  // Live session timer + optional stop when replaying a saved duration.
  useEffect(() => {
    if (!isMixPlaying) {
      flushTick();
      tickStartedAtRef.current = null;
      return;
    }
    tickStartedAtRef.current = Date.now();
    const id = setInterval(() => {
      flushTick();
      const cap = savedDurationRef.current;
      if (cap != null && cap > 0 && replayElapsedRef.current >= cap) {
        stopMix();
      }
    }, 250);
    return () => clearInterval(id);
  }, [isMixPlaying, flushTick, stopMix]);

  useEffect(() => {
    if (!sleepEndsAt) return;
    const id = setInterval(() => {
      if (sleepRef.current && Date.now() >= sleepRef.current) {
        stopMix();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [sleepEndsAt, stopMix]);

  const setMixTitle = useCallback((title: string) => {
    const next = title.trim() || 'My Mix';
    setMixTitleState(next);
    titleRef.current = next;
    setMixSessionMeta({ title: next });
  }, []);

  const addSound = useCallback(
    async (sound: Sound, volume = DEFAULT_VOLUME) => {
      if (!canUseMixes) {
        appAlert('Premium feature', 'Mix Sounds is available for Premium listeners.');
        return false;
      }
      if (!sound.audio_url) {
        appAlert('Unavailable', 'This sound has no audio file.');
        return false;
      }
      if (layersRef.current.some((l) => l.sound.id === sound.id)) return false;
      if (layersRef.current.length >= maxTracks) {
        appAlert('Limit reached', `You can mix up to ${maxTracks} sounds.`);
        return false;
      }

      const shouldPlay = playingRef.current;
      const next = await addMixTrackLive(
        layersRef.current,
        sound,
        volume,
        shouldPlay,
        titleRef.current,
      );
      setLayers(next);
      layersRef.current = next;
      if (shouldPlay) syncPlayingFlag(next);
      return true;
    },
    [canUseMixes, maxTracks, syncPlayingFlag],
  );

  const removeSound = useCallback(
    (soundId: string) => {
      const next = removeMixTrackLive(layersRef.current, soundId, titleRef.current);
      setLayers(next);
      layersRef.current = next;
      if (!next.length) {
        flushTick();
        tickStartedAtRef.current = null;
        setIsMixPlaying(false);
        playingRef.current = false;
        return;
      }
      syncPlayingFlag(next);
    },
    [syncPlayingFlag, flushTick],
  );

  const setTrackVolume = useCallback((soundId: string, volume: number) => {
    const next = setMixLayerVolume(layersRef.current, soundId, volume);
    setLayers(next);
    layersRef.current = next;
  }, []);

  const playMix = useCallback(async () => {
    if (!canUseMixes) {
      appAlert('Premium feature', 'Mix Sounds is available for Premium listeners.');
      return false;
    }
    if (!layersRef.current.length) {
      appAlert('Empty mix', 'Add at least one sound to your mix.');
      return false;
    }

    await stopPlayback();

    if (layersRef.current.some((l) => l.player) && !layersArePlaying(layersRef.current)) {
      resumeMixLayers(layersRef.current);
      setIsMixPlaying(true);
      playingRef.current = true;
      tickStartedAtRef.current = Date.now();
      return true;
    }

    if (layersArePlaying(layersRef.current)) {
      return true;
    }

    const started = await startMixLayers(layersRef.current, titleRef.current);
    if (!started.length) {
      appAlert('Playback failed', 'Could not start the selected sounds.');
      return false;
    }
    setLayers(started);
    layersRef.current = started;
    setIsMixPlaying(true);
    playingRef.current = true;
    tickStartedAtRef.current = Date.now();
    setMixSessionMeta({ title: titleRef.current, id: mixId });
    return true;
  }, [canUseMixes, stopPlayback, mixId]);

  const pauseMix = useCallback(() => {
    flushTick();
    tickStartedAtRef.current = null;
    pauseMixLayers(layersRef.current);
    setIsMixPlaying(false);
    playingRef.current = false;
  }, [flushTick]);

  const toggleMixPlay = useCallback(async () => {
    if (playingRef.current) {
      pauseMix();
      return;
    }
    await playMix();
  }, [pauseMix, playMix]);

  const loadSavedMix = useCallback(
    async (mix: SavedMix, autoPlay = false) => {
      if (!canUseMixes) {
        appAlert('Premium feature', 'Mix Sounds is available for Premium listeners.');
        return false;
      }
      stopMix();
      await stopPlayback();
      const nextLayers: MixLayer[] = mix.tracks
        .map((t) => ({
          sound: t.sound,
          volume: Number(t.volume) || DEFAULT_VOLUME,
        }))
        .filter((l) => !!l.sound?.audio_url);
      if (!nextLayers.length) {
        appAlert('Mix unavailable', 'This mix has no playable sounds.');
        return false;
      }
      setMixId(mix.id);
      setMixTitle(mix.title);
      setLayers(nextLayers);
      layersRef.current = nextLayers;
      setLinkedSoundId(mix.sound_id ?? null);
      const dur = Math.max(0, Number(mix.duration_seconds ?? 0));
      setSavedDurationSec(dur > 0 ? dur : null);
      savedDurationRef.current = dur > 0 ? dur : null;
      // New play session timer starts at 0; replay cap uses saved duration.
      setSessionElapsedSec(0);
      sessionElapsedRef.current = 0;
      replayElapsedRef.current = 0;
      setMixSessionMeta({ id: mix.id, title: mix.title });
      if (autoPlay) {
        const started = await startMixLayers(nextLayers, mix.title);
        setLayers(started);
        layersRef.current = started;
        setIsMixPlaying(true);
        playingRef.current = true;
        tickStartedAtRef.current = Date.now();
      }
      return true;
    },
    [canUseMixes, stopMix, stopPlayback, setMixTitle],
  );

  const clearMix = useCallback(() => {
    stopMix();
    setLayers([]);
    layersRef.current = [];
    setMixId(null);
    setMixTitle('My Mix');
    setSessionElapsedSec(0);
    sessionElapsedRef.current = 0;
    setSavedDurationSec(null);
    savedDurationRef.current = null;
    setLinkedSoundId(null);
    replayElapsedRef.current = 0;
  }, [stopMix, setMixTitle]);

  const saveMix = useCallback(
    async (titleOverride?: string) => {
      if (!user) {
        appAlert('Sign in', 'Sign in to save mixes.');
        return null;
      }
      if (!canUseMixes) {
        appAlert('Premium feature', 'Saving mixes requires Premium.');
        return null;
      }
      if (!layersRef.current.length) {
        appAlert('Empty mix', 'Add sounds before saving.');
        return null;
      }

      flushTick();
      const playedSec = Math.floor(sessionElapsedRef.current);
      if (playedSec <= 0 && !savedDurationRef.current) {
        appAlert(
          'Play first',
          'Start your mix and let it play for a bit, then save. The duration becomes the length of your mix.',
        );
        return null;
      }

      const title = (titleOverride ?? titleRef.current).trim() || 'My Mix';
      setMixTitle(title);
      const durationSeconds = Math.max(playedSec, savedDurationRef.current ?? 0, 1);
      const coverUrl = layersRef.current[0]?.sound.cover_url ?? null;
      const layersSnapshot = [...layersRef.current];

      stopMix();

      let renderedUrl: string | null = null;
      let renderedPath: string | null = null;
      try {
        const wav = await renderMixLayersToWav(layersSnapshot, durationSeconds);
        const storagePath = `${user.id}/mix-renders/${mixId ?? 'new'}-${Date.now()}.wav`;
        const { error: uploadError } = await supabase.storage
          .from('sounds')
          .upload(storagePath, wav, { upsert: true, contentType: 'audio/wav' });
        if (uploadError) {
          appAlert('Upload failed', uploadError.message);
          return null;
        }
        const { data: pub } = supabase.storage.from('sounds').getPublicUrl(storagePath);
        renderedUrl = `${pub.publicUrl}?v=${Date.now()}`;
        renderedPath = storagePath;
      } catch (err) {
        appAlert(
          'Could not render mix',
          err instanceof Error ? err.message : 'Connect to the internet and try again.',
        );
        return null;
      }

      let id = mixId;
      if (id) {
        const { error } = await supabase
          .from('mixes')
          .update({
            title,
            duration_seconds: durationSeconds,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .eq('user_id', user.id);
        if (error) {
          appAlert('Save failed', error.message);
          return null;
        }
        await supabase.from('mix_tracks').delete().eq('mix_id', id);
      } else {
        const { data, error } = await supabase
          .from('mixes')
          .insert({
            user_id: user.id,
            title,
            duration_seconds: durationSeconds,
          })
          .select('id')
          .single();
        if (error || !data) {
          appAlert('Save failed', error?.message ?? 'Could not create mix.');
          return null;
        }
        id = data.id as string;
        setMixId(id);
      }

      const rows = layersSnapshot.map((layer, index) => ({
        mix_id: id,
        sound_id: layer.sound.id,
        volume: layer.volume,
        position: index,
      }));
      const { error: trackErr } = await supabase.from('mix_tracks').insert(rows);
      if (trackErr) {
        appAlert('Save failed', trackErr.message);
        return null;
      }

      // Personal draft sound so the mix appears in playlist "My Mix" like a track.
      const desc = `${MIX_SOUND_PREFIX}${id}`;
      let soundId = linkedSoundId;
      const soundPayload = {
        creator_id: user.id,
        title,
        description: desc,
        cover_url: coverUrl,
        audio_url: renderedUrl,
        audio_path: renderedPath,
        duration_seconds: durationSeconds,
        status: 'draft' as const,
        updated_at: new Date().toISOString(),
      };

      if (soundId) {
        const { error: soundErr } = await supabase
          .from('sounds')
          .update(soundPayload)
          .eq('id', soundId)
          .eq('creator_id', user.id);
        if (soundErr) {
          // Recreate if missing
          soundId = null;
        }
      }
      if (!soundId) {
        const { data: soundRow, error: soundErr } = await supabase
          .from('sounds')
          .insert(soundPayload)
          .select('id')
          .single();
        if (soundErr || !soundRow) {
          appAlert(
            'Mix saved',
            `"${title}" is in Library → My Mixes, but playlist link failed: ${soundErr?.message ?? 'unknown'}`,
          );
          setSavedDurationSec(durationSeconds);
          savedDurationRef.current = durationSeconds;
          setMixSessionMeta({ id, title });
          return id;
        }
        soundId = soundRow.id as string;
        setLinkedSoundId(soundId);
      }

      await supabase
        .from('mixes')
        .update({ sound_id: soundId, duration_seconds: durationSeconds })
        .eq('id', id);

      try {
        const playlistId = await ensureMyMixPlaylist();
        await supabase.from('playlist_items').upsert(
          {
            playlist_id: playlistId,
            sound_id: soundId,
            position: Date.now() % 100000,
          },
          { onConflict: 'playlist_id,sound_id' },
        );
      } catch (err) {
        console.warn('My Mix playlist link failed', err);
      }

      setSavedDurationSec(durationSeconds);
      savedDurationRef.current = durationSeconds;
      setMixSessionMeta({ id, title });

      const { data: savedSound } = await supabase
        .from('sounds')
        .select('*')
        .eq('id', soundId)
        .maybeSingle();

      clearMix();

      if (savedSound) {
        await playSound(savedSound as Sound, { queueLabel: 'My Mix' });
      }

      appAlert(
        'Saved to My Mix',
        `"${title}" is now one sound in playlist “My Mix”.`,
      );
      return id;
    },
    [
      user,
      canUseMixes,
      mixId,
      setMixTitle,
      flushTick,
      linkedSoundId,
      stopMix,
      clearMix,
      playSound,
    ],
  );

  const setSleepTimerMinutes = useCallback(
    (minutes: number | null) => {
      if (minutes == null) {
        setSleepEndsAt(null);
        sleepRef.current = null;
        return;
      }
      if (!isPremium && !isAdmin) {
        appAlert('Premium feature', 'Sleep timer is available for Premium listeners.');
        return;
      }
      const endsAt = Date.now() + minutes * 60_000;
      setSleepEndsAt(endsAt);
      sleepRef.current = endsAt;
    },
    [isPremium, isAdmin],
  );

  const seedWithSound = useCallback(
    async (sound: Sound) => {
      if (!layersRef.current.some((l) => l.sound.id === sound.id)) {
        await addSound(sound, DEFAULT_VOLUME);
      }
    },
    [addSound],
  );

  const isMixActive = layers.length > 0;

  const value = useMemo<MixContextValue>(
    () => ({
      layers,
      mixId,
      mixTitle,
      isMixActive,
      isMixPlaying,
      sessionElapsedSec,
      savedDurationSec,
      sleepEndsAt,
      maxTracks,
      setMixTitle,
      addSound,
      removeSound,
      setTrackVolume,
      playMix,
      pauseMix,
      toggleMixPlay,
      stopMix,
      loadSavedMix,
      saveMix,
      clearMix,
      setSleepTimerMinutes,
      seedWithSound,
    }),
    [
      layers,
      mixId,
      mixTitle,
      isMixActive,
      isMixPlaying,
      sessionElapsedSec,
      savedDurationSec,
      sleepEndsAt,
      maxTracks,
      setMixTitle,
      addSound,
      removeSound,
      setTrackVolume,
      playMix,
      pauseMix,
      toggleMixPlay,
      stopMix,
      loadSavedMix,
      saveMix,
      clearMix,
      setSleepTimerMinutes,
      seedWithSound,
    ],
  );

  return <MixContext.Provider value={value}>{children}</MixContext.Provider>;
}

export function useMix() {
  const ctx = useContext(MixContext);
  if (!ctx) throw new Error('useMix must be used within MixProvider');
  return ctx;
}
