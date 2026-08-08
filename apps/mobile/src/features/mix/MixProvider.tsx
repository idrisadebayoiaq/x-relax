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
import { Alert } from 'react-native';
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
import type { Mix, Sound } from '../../types/database';
import { useAuth } from '../auth/AuthProvider';
import { usePlayer } from '../player/PlayerProvider';

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

export function MixProvider({ children }: { children: ReactNode }) {
  const { user, canUseMixes, freeMixLimit, isPremium, isAdmin, premiumMixLimit } = useAuth();
  const { stopPlayback } = usePlayer();

  const [layers, setLayers] = useState<MixLayer[]>([]);
  const [mixId, setMixId] = useState<string | null>(null);
  const [mixTitle, setMixTitleState] = useState('My Mix');
  const [isMixPlaying, setIsMixPlaying] = useState(false);
  const [sleepEndsAt, setSleepEndsAt] = useState<number | null>(null);

  const layersRef = useRef(layers);
  const playingRef = useRef(false);
  const titleRef = useRef(mixTitle);
  const sleepRef = useRef<number | null>(null);

  layersRef.current = layers;
  playingRef.current = isMixPlaying;
  titleRef.current = mixTitle;
  sleepRef.current = sleepEndsAt;

  const maxTracks = isPremium || isAdmin ? premiumMixLimit : Math.max(1, freeMixLimit);

  const syncPlayingFlag = useCallback((nextLayers: MixLayer[]) => {
    const playing = layersArePlaying(nextLayers);
    setIsMixPlaying(playing);
    playingRef.current = playing;
  }, []);

  const stopMix = useCallback(() => {
    stopMixCompletely();
    setLayers((prev) => prev.map((l) => ({ ...l, player: undefined })));
    setIsMixPlaying(false);
    playingRef.current = false;
    setSleepEndsAt(null);
    sleepRef.current = null;
  }, []);

  useEffect(() => {
    registerMixStopHandler(() => {
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
  }, []);

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
        Alert.alert('Premium feature', 'Mix Sounds is available for Premium listeners.');
        return false;
      }
      if (!sound.audio_url) {
        Alert.alert('Unavailable', 'This sound has no audio file.');
        return false;
      }
      if (layersRef.current.some((l) => l.sound.id === sound.id)) return false;
      if (layersRef.current.length >= maxTracks) {
        Alert.alert('Limit reached', `You can mix up to ${maxTracks} sounds.`);
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
        setIsMixPlaying(false);
        playingRef.current = false;
        return;
      }
      syncPlayingFlag(next);
    },
    [syncPlayingFlag],
  );

  const setTrackVolume = useCallback((soundId: string, volume: number) => {
    const next = setMixLayerVolume(layersRef.current, soundId, volume);
    setLayers(next);
    layersRef.current = next;
  }, []);

  const playMix = useCallback(async () => {
    if (!canUseMixes) {
      Alert.alert('Premium feature', 'Mix Sounds is available for Premium listeners.');
      return false;
    }
    if (!layersRef.current.length) {
      Alert.alert('Empty mix', 'Add at least one sound to your mix.');
      return false;
    }

    await stopPlayback();

    if (layersRef.current.some((l) => l.player) && !layersArePlaying(layersRef.current)) {
      resumeMixLayers(layersRef.current);
      setIsMixPlaying(true);
      playingRef.current = true;
      return true;
    }

    if (layersArePlaying(layersRef.current)) {
      return true;
    }

    const started = await startMixLayers(layersRef.current, titleRef.current);
    if (!started.length) {
      Alert.alert('Playback failed', 'Could not start the selected sounds.');
      return false;
    }
    setLayers(started);
    layersRef.current = started;
    setIsMixPlaying(true);
    playingRef.current = true;
    setMixSessionMeta({ title: titleRef.current, id: mixId });
    return true;
  }, [canUseMixes, stopPlayback, mixId]);

  const pauseMix = useCallback(() => {
    pauseMixLayers(layersRef.current);
    setIsMixPlaying(false);
    playingRef.current = false;
  }, []);

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
        Alert.alert('Premium feature', 'Mix Sounds is available for Premium listeners.');
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
        Alert.alert('Mix unavailable', 'This mix has no playable sounds.');
        return false;
      }
      setMixId(mix.id);
      setMixTitle(mix.title);
      setLayers(nextLayers);
      layersRef.current = nextLayers;
      setMixSessionMeta({ id: mix.id, title: mix.title });
      if (autoPlay) {
        const started = await startMixLayers(nextLayers, mix.title);
        setLayers(started);
        layersRef.current = started;
        setIsMixPlaying(true);
        playingRef.current = true;
      }
      return true;
    },
    [canUseMixes, stopMix, stopPlayback, setMixTitle],
  );

  const saveMix = useCallback(
    async (titleOverride?: string) => {
      if (!user) {
        Alert.alert('Sign in', 'Sign in to save mixes.');
        return null;
      }
      if (!canUseMixes) {
        Alert.alert('Premium feature', 'Saving mixes requires Premium.');
        return null;
      }
      if (!layersRef.current.length) {
        Alert.alert('Empty mix', 'Add sounds before saving.');
        return null;
      }
      const title = (titleOverride ?? titleRef.current).trim() || 'My Mix';
      setMixTitle(title);

      let id = mixId;
      if (id) {
        const { error } = await supabase
          .from('mixes')
          .update({ title, updated_at: new Date().toISOString() })
          .eq('id', id)
          .eq('user_id', user.id);
        if (error) {
          Alert.alert('Save failed', error.message);
          return null;
        }
        await supabase.from('mix_tracks').delete().eq('mix_id', id);
      } else {
        const { data, error } = await supabase
          .from('mixes')
          .insert({ user_id: user.id, title })
          .select('id')
          .single();
        if (error || !data) {
          Alert.alert('Save failed', error?.message ?? 'Could not create mix.');
          return null;
        }
        id = data.id as string;
        setMixId(id);
      }

      const rows = layersRef.current.map((layer, index) => ({
        mix_id: id,
        sound_id: layer.sound.id,
        volume: layer.volume,
        position: index,
      }));
      const { error: trackErr } = await supabase.from('mix_tracks').insert(rows);
      if (trackErr) {
        Alert.alert('Save failed', trackErr.message);
        return null;
      }
      setMixSessionMeta({ id, title });
      Alert.alert('Saved to Library', `"${title}" is in Library → My Mixes.`);
      return id;
    },
    [user, canUseMixes, mixId, setMixTitle],
  );

  const clearMix = useCallback(() => {
    stopMix();
    setLayers([]);
    layersRef.current = [];
    setMixId(null);
    setMixTitle('My Mix');
  }, [stopMix, setMixTitle]);

  const setSleepTimerMinutes = useCallback(
    (minutes: number | null) => {
      if (minutes == null) {
        setSleepEndsAt(null);
        sleepRef.current = null;
        return;
      }
      if (!isPremium && !isAdmin) {
        Alert.alert('Premium feature', 'Sleep timer is available for Premium listeners.');
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
