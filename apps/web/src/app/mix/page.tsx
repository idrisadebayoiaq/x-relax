'use client';

import Link from 'next/link';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CoverArt } from '@/components/CoverArt';
import { formatElapsed } from '@/lib/format';
import {
  isMixPlaying,
  pauseMixLayers,
  registerMixStopHandler,
  releaseMixLayers,
  resumeMixLayers,
  setMixLayerVolume,
  startMixLayers,
  type MixLayer,
} from '@/lib/mix-playback';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { usePlayer } from '@/lib/player-context';
import type { Mix, Sound } from '@/types/database';
import { appAlert } from '@/components/AppDialog';
import { renderMixToWav } from '@/lib/mix-render';

type SavedMix = Mix & { tracks: { volume: number; position: number; sound: Sound }[] };

const MIX_SOUND_PREFIX = '__xrelax_mix__:';
const MY_MIX_PLAYLIST = 'My Mix';

export default function MixPage() {
  return (
    <Suspense fallback={<div className="max-w-4xl mx-auto py-12 text-muted">Loading Mix Studio…</div>}>
      <MixStudio />
    </Suspense>
  );
}

function MixStudio() {
  const { user, canUseMixes } = useAuth();
  const { stopPlayback, playSound } = usePlayer();
  const searchParams = useSearchParams();
  const [catalog, setCatalog] = useState<Sound[]>([]);
  const [selected, setSelected] = useState<MixLayer[]>([]);
  const [savedMixes, setSavedMixes] = useState<SavedMix[]>([]);
  const [title, setTitle] = useState('My mix');
  const [mixId, setMixId] = useState<string | null>(null);
  const [linkedSoundId, setLinkedSoundId] = useState<string | null>(null);
  const [mixPlaying, setMixPlaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sessionElapsedSec, setSessionElapsedSec] = useState(0);
  const [savedDurationSec, setSavedDurationSec] = useState<number | null>(null);
  const selectedRef = useRef<MixLayer[]>([]);
  const sessionElapsedRef = useRef(0);
  const savedDurationRef = useRef<number | null>(null);
  const replayElapsedRef = useRef(0);
  const tickStartedAtRef = useRef<number | null>(null);
  const playingRef = useRef(false);
  selectedRef.current = selected;
  const maxTracks = 8;

  const flushTick = useCallback(() => {
    if (!playingRef.current || tickStartedAtRef.current == null) return;
    const now = Date.now();
    const delta = Math.max(0, (now - tickStartedAtRef.current) / 1000);
    tickStartedAtRef.current = now;
    sessionElapsedRef.current += delta;
    setSessionElapsedSec(sessionElapsedRef.current);

    const cap = savedDurationRef.current;
    if (cap != null && cap > 0) {
      replayElapsedRef.current += delta;
      if (replayElapsedRef.current >= cap) {
        releaseMixLayers(selectedRef.current);
        setSelected((prev) => prev.map((l) => ({ ...l, audio: undefined })));
        setMixPlaying(false);
        playingRef.current = false;
        tickStartedAtRef.current = null;
        replayElapsedRef.current = cap;
        sessionElapsedRef.current = Math.min(sessionElapsedRef.current, cap);
        setSessionElapsedSec(sessionElapsedRef.current);
      }
    }
  }, []);

  useEffect(() => {
    if (!mixPlaying) return;
    const id = window.setInterval(() => flushTick(), 250);
    return () => window.clearInterval(id);
  }, [mixPlaying, flushTick]);

  const stopMix = useCallback(async () => {
    flushTick();
    releaseMixLayers(selectedRef.current);
    setSelected((prev) => prev.map((l) => ({ ...l, audio: undefined })));
    setMixPlaying(false);
    playingRef.current = false;
    tickStartedAtRef.current = null;
  }, [flushTick]);

  const refreshSaved = useCallback(async () => {
    if (!user || !canUseMixes) return;
    const { data } = await createClient()
      .from('mixes')
      .select('*, tracks:mix_tracks(volume, position, sound:sounds(*))')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });
    setSavedMixes((data as SavedMix[]) ?? []);
  }, [user, canUseMixes]);

  useEffect(() => {
    if (!canUseMixes) return;
    createClient()
      .from('sounds')
      .select('*')
      .eq('status', 'published')
      .order('title')
      .then(({ data }) => setCatalog((data as Sound[]) ?? []));
  }, [canUseMixes]);

  useEffect(() => {
    void refreshSaved();
  }, [refreshSaved]);

  useEffect(() => {
    registerMixStopHandler(() => void stopMix());
    return () => {
      registerMixStopHandler(null);
      releaseMixLayers(selectedRef.current);
    };
  }, [stopMix]);

  const loadSaved = useCallback(
    async (mix: SavedMix, autoPlay = false) => {
      await stopMix();
      const layers = [...(mix.tracks ?? [])]
        .sort((a, b) => a.position - b.position)
        .map((t) => ({ sound: t.sound, volume: Number(t.volume) || 0.8 }))
        .filter((l) => l.sound?.audio_url);
      if (!layers.length) {
        appAlert('This mix has no playable sounds.');
        return;
      }
      setTitle(mix.title);
      setMixId(mix.id);
      setLinkedSoundId(mix.sound_id ?? null);
      const dur = Math.max(0, Number(mix.duration_seconds ?? 0));
      setSavedDurationSec(dur > 0 ? dur : null);
      savedDurationRef.current = dur > 0 ? dur : null;
      setSessionElapsedSec(0);
      sessionElapsedRef.current = 0;
      replayElapsedRef.current = 0;
      setSelected(layers);
      selectedRef.current = layers;
      if (autoPlay) {
        await stopPlayback();
        const started = await startMixLayers(layers);
        setSelected(started);
        selectedRef.current = started;
        setMixPlaying(!!started.length);
        playingRef.current = !!started.length;
        tickStartedAtRef.current = started.length ? Date.now() : null;
      }
    },
    [stopMix, stopPlayback],
  );

  useEffect(() => {
    const id = searchParams.get('mixId');
    if (!id || !canUseMixes || !user) return;
    (async () => {
      const { data } = await createClient()
        .from('mixes')
        .select('*, tracks:mix_tracks(volume, position, sound:sounds(*))')
        .eq('id', id)
        .maybeSingle();
      if (data) await loadSaved(data as SavedMix, true);
    })();
  }, [searchParams, canUseMixes, user, loadSaved]);

  if (!canUseMixes) {
    return (
      <div className="max-w-lg mx-auto space-y-4 py-12">
        <Link href="/" className="text-sm text-muted underline">
          ← Back
        </Link>
        <h1 className="text-3xl font-serif font-bold">Mix Studio</h1>
        <p className="text-muted">
          Layer sounds together and save custom mixes. Premium or admin access required.
        </p>
        <Link href="/premium" className="btn btn-primary inline-block">
          View Premium
        </Link>
      </div>
    );
  }

  const toggleSelect = async (sound: Sound) => {
    const exists = selected.find((l) => l.sound.id === sound.id);
    if (exists) {
      exists.audio?.pause();
      setSelected((prev) => prev.filter((l) => l.sound.id !== sound.id));
      return;
    }
    if (selected.length >= maxTracks) {
      appAlert(`Max ${maxTracks} tracks.`);
      return;
    }
    setSelected((prev) => [...prev, { sound, volume: 0.8 }]);
  };

  const playMix = async () => {
    if (!selectedRef.current.length) return appAlert('Select at least one sound.');
    if (isMixPlaying(selectedRef.current)) {
      flushTick();
      pauseMixLayers(selectedRef.current);
      setMixPlaying(false);
      playingRef.current = false;
      tickStartedAtRef.current = null;
      return;
    }
    if (selectedRef.current.some((l) => l.audio)) {
      resumeMixLayers(selectedRef.current);
      setMixPlaying(true);
      playingRef.current = true;
      tickStartedAtRef.current = Date.now();
      return;
    }
    await stopPlayback();
    releaseMixLayers(selectedRef.current);
    const started = await startMixLayers(selectedRef.current);
    setSelected(started);
    selectedRef.current = started;
    const on = !!started.length;
    setMixPlaying(on);
    playingRef.current = on;
    tickStartedAtRef.current = on ? Date.now() : null;
    if (on && savedDurationRef.current) {
      replayElapsedRef.current = 0;
    }
  };

  const ensureMyMixPlaylist = async () => {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('ensure_my_mix_playlist');
    if (error || !data) throw new Error(error?.message ?? 'Could not resolve My Mix playlist');
    return data as string;
  };

  const saveMix = async () => {
    if (!user) return appAlert('Sign in to save mixes.');
    if (!selected.length) return appAlert('Select sounds first.');
    flushTick();
    const playedSec = Math.floor(sessionElapsedRef.current);
    if (playedSec <= 0 && !savedDurationRef.current) {
      return appAlert(
        'Start your mix and let it play for a bit, then save. The duration becomes the length of your mix.',
      );
    }

    setBusy(true);
    const supabase = createClient();
    const mixTitle = title.trim() || 'My mix';
    const durationSeconds = Math.max(playedSec, savedDurationRef.current ?? 0, 1);
    const coverUrl = selected[0]?.sound.cover_url ?? null;
    const layersSnapshot = [...selectedRef.current];

    await stopMix();

    let renderedUrl: string | null = null;
    let renderedPath: string | null = null;
    try {
      const wavBlob = await renderMixToWav(
        layersSnapshot
          .filter((l) => l.sound.audio_url)
          .map((l) => ({ url: l.sound.audio_url as string, volume: l.volume })),
        durationSeconds,
      );
      const storagePath = `${user.id}/mix-renders/${mixId ?? 'new'}-${Date.now()}.wav`;
      const { error: uploadError } = await supabase.storage
        .from('sounds')
        .upload(storagePath, wavBlob, { upsert: true, contentType: 'audio/wav' });
      if (uploadError) {
        setBusy(false);
        return appAlert('Upload failed', uploadError.message);
      }
      const { data: pub } = supabase.storage.from('sounds').getPublicUrl(storagePath);
      renderedUrl = `${pub.publicUrl}?v=${Date.now()}`;
      renderedPath = storagePath;
    } catch (err) {
      setBusy(false);
      return appAlert(
        'Could not render mix',
        err instanceof Error ? err.message : 'Try again while online.',
      );
    }

    let id = mixId;
    if (id) {
      const { error } = await supabase
        .from('mixes')
        .update({
          title: mixTitle,
          duration_seconds: durationSeconds,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('user_id', user.id);
      if (error) {
        setBusy(false);
        return appAlert(error.message);
      }
      await supabase.from('mix_tracks').delete().eq('mix_id', id);
    } else {
      const { data: mix, error } = await supabase
        .from('mixes')
        .insert({
          user_id: user.id,
          title: mixTitle,
          duration_seconds: durationSeconds,
        })
        .select('*')
        .single();
      if (error || !mix) {
        setBusy(false);
        return appAlert(error?.message ?? 'Save failed');
      }
      id = mix.id;
      setMixId(id);
    }

    const { error: tracksError } = await supabase.from('mix_tracks').insert(
      layersSnapshot.map((l, i) => ({
        mix_id: id,
        sound_id: l.sound.id,
        volume: l.volume,
        position: i,
      })),
    );
    if (tracksError) {
      setBusy(false);
      return appAlert(tracksError.message);
    }

    const desc = `${MIX_SOUND_PREFIX}${id}`;
    let soundId = linkedSoundId;
    const soundPayload = {
      creator_id: user.id,
      title: mixTitle,
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
      if (soundErr) soundId = null;
    }
    if (!soundId) {
      const { data: soundRow, error: soundErr } = await supabase
        .from('sounds')
        .insert(soundPayload)
        .select('id')
        .single();
      if (soundErr || !soundRow) {
        setBusy(false);
        setSavedDurationSec(durationSeconds);
        savedDurationRef.current = durationSeconds;
        await refreshSaved();
        return appAlert(
          `Mix saved to Library, but playlist link failed: ${soundErr?.message ?? 'unknown'}`,
        );
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
    setSelected([]);
    selectedRef.current = [];
    setMixId(null);
    setLinkedSoundId(null);
    setSessionElapsedSec(0);
    sessionElapsedRef.current = 0;
    setBusy(false);
    await refreshSaved();

    const { data: savedSound } = await supabase
      .from('sounds')
      .select('*')
      .eq('id', soundId)
      .maybeSingle();
    if (savedSound) {
      await playSound(savedSound as Sound, { queueLabel: 'My Mix' });
    }

    appAlert('Saved to My Mix', `"${mixTitle}" is now one sound in playlist “My Mix”.`);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-3xl font-serif font-bold">Mix Studio</h1>
      <p className="text-muted">
        Up to {maxTracks} layers · duration counts while playing · saves to playlist “My Mix”
      </p>
      <input
        className="input"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Mix title"
      />
      {selected.length ? (
        <div className="text-center space-y-1">
          <p className="text-4xl font-serif font-bold tracking-tight">
            {formatElapsed(sessionElapsedSec)}
            {savedDurationSec ? (
              <span className="text-muted text-2xl"> / {formatElapsed(savedDurationSec)}</span>
            ) : null}
          </p>
          <p className="text-sm text-muted">
            {mixPlaying ? 'Recording mix length…' : 'Duration counts while playing'}
          </p>
        </div>
      ) : null}
      <div className="flex gap-2 flex-wrap">
        <button type="button" className="btn btn-primary" onClick={() => void playMix()}>
          {mixPlaying ? 'Pause' : 'Play mix'}
        </button>
        <button type="button" className="btn btn-outline" onClick={() => void stopMix()}>
          Stop
        </button>
        <button
          type="button"
          className="btn btn-outline"
          disabled={busy}
          onClick={() => void saveMix()}
        >
          Save
        </button>
      </div>
      {selected.length ? (
        <div className="space-y-2">
          {selected.map((layer) => (
            <div key={layer.sound.id} className="card p-3 flex items-center gap-3">
              <CoverArt title={layer.sound.title} uri={layer.sound.cover_url} size={40} rounded={10} />
              <p className="flex-1 font-medium truncate">{layer.sound.title}</p>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={Math.round(layer.volume * 100)}
                onChange={(e) =>
                  setSelected((prev) =>
                    setMixLayerVolume(prev, layer.sound.id, Number(e.target.value) / 100),
                  )
                }
                className="w-28"
              />
              <span className="text-sm text-muted w-10 text-center">
                {Math.round(layer.volume * 100)}%
              </span>
              <button type="button" className="chip" onClick={() => void toggleSelect(layer.sound)}>
                Remove
              </button>
            </div>
          ))}
        </div>
      ) : null}
      {savedMixes.length ? (
        <div className="space-y-2">
          <h2 className="font-semibold">Saved mixes</h2>
          {savedMixes.map((mix) => (
            <button
              key={mix.id}
              type="button"
              className="card w-full text-left p-3"
              onClick={() => void loadSaved(mix, true)}
            >
              {mix.title} · {mix.tracks?.length ?? 0} layers
              {mix.duration_seconds
                ? ` · ${formatElapsed(Number(mix.duration_seconds))}`
                : ''}
            </button>
          ))}
        </div>
      ) : null}
      <div className="grid gap-2 max-h-[420px] overflow-y-auto">
        {catalog.map((sound) => {
          const on = selected.some((l) => l.sound.id === sound.id);
          return (
            <button
              key={sound.id}
              type="button"
              className="card p-3 flex items-center gap-3 text-left"
              onClick={() => void toggleSelect(sound)}
            >
              <CoverArt title={sound.title} uri={sound.cover_url} size={48} rounded={10} />
              <span className="flex-1">{sound.title}</span>
              <span className={`chip ${on ? 'chip-active' : ''}`}>{on ? 'On' : 'Add'}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
