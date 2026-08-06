'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CoverArt } from '@/components/CoverArt';
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

type SavedMix = Mix & { tracks: { volume: number; position: number; sound: Sound }[] };

export default function MixPage() {
  const { user, canUseMixes } = useAuth();
  const { stopPlayback } = usePlayer();
  const [catalog, setCatalog] = useState<Sound[]>([]);
  const [selected, setSelected] = useState<MixLayer[]>([]);
  const [savedMixes, setSavedMixes] = useState<SavedMix[]>([]);
  const [title, setTitle] = useState('My mix');
  const [mixPlaying, setMixPlaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const selectedRef = useRef<MixLayer[]>([]);
  selectedRef.current = selected;
  const maxTracks = 8;

  const stopMix = useCallback(async () => {
    releaseMixLayers(selectedRef.current);
    setSelected((prev) => prev.map((l) => ({ ...l, audio: undefined })));
    setMixPlaying(false);
  }, []);

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
    if (!user || !canUseMixes) return;
    createClient()
      .from('mixes')
      .select('*, tracks:mix_tracks(volume, position, sound:sounds(*))')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .then(({ data }) => setSavedMixes((data as SavedMix[]) ?? []));
  }, [user?.id, canUseMixes]);

  useEffect(() => {
    registerMixStopHandler(() => void stopMix());
    return () => {
      registerMixStopHandler(null);
      releaseMixLayers(selectedRef.current);
    };
  }, [stopMix]);

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
      alert(`Max ${maxTracks} tracks.`);
      return;
    }
    setSelected((prev) => [...prev, { sound, volume: 0.8 }]);
  };

  const playMix = async () => {
    if (!selectedRef.current.length) return alert('Select at least one sound.');
    if (isMixPlaying(selectedRef.current)) {
      pauseMixLayers(selectedRef.current);
      setMixPlaying(false);
      return;
    }
    if (selectedRef.current.some((l) => l.audio)) {
      resumeMixLayers(selectedRef.current);
      setMixPlaying(true);
      return;
    }
    await stopPlayback();
    releaseMixLayers(selectedRef.current);
    const started = await startMixLayers(selectedRef.current);
    setSelected(started);
    setMixPlaying(!!started.length);
  };

  const saveMix = async () => {
    if (!user) return alert('Sign in to save mixes.');
    if (!selected.length) return alert('Select sounds first.');
    setBusy(true);
    const supabase = createClient();
    const { data: mix, error } = await supabase
      .from('mixes')
      .insert({ user_id: user.id, title: title.trim() || 'My mix' })
      .select('*')
      .single();
    if (error || !mix) {
      setBusy(false);
      return alert(error?.message ?? 'Save failed');
    }
    const { error: tracksError } = await supabase.from('mix_tracks').insert(
      selected.map((l, i) => ({
        mix_id: mix.id,
        sound_id: l.sound.id,
        volume: l.volume,
        position: i,
      })),
    );
    setBusy(false);
    if (tracksError) {
      await supabase.from('mixes').delete().eq('id', mix.id);
      return alert(tracksError.message);
    }
    alert('Mix saved.');
  };

  const loadSaved = async (mix: SavedMix) => {
    await stopMix();
    const layers = [...(mix.tracks ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((t) => ({ sound: t.sound, volume: Number(t.volume) || 0.8 }))
      .filter((l) => l.sound?.audio_url);
    setTitle(mix.title);
    setSelected(layers);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-3xl font-serif font-bold">Mix Studio</h1>
      <p className="text-muted">Up to {maxTracks} layers · save enabled · Premium feature</p>
      <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Mix title" />
      <div className="flex gap-2 flex-wrap">
        <button type="button" className="btn btn-primary" onClick={() => void playMix()}>{mixPlaying ? 'Pause' : 'Play mix'}</button>
        <button type="button" className="btn btn-outline" onClick={() => void stopMix()}>Stop</button>
        <button type="button" className="btn btn-outline" disabled={busy} onClick={() => void saveMix()}>Save</button>
      </div>
      {selected.length ? (
        <div className="space-y-2">
          {selected.map((layer) => (
            <div key={layer.sound.id} className="card p-3 flex items-center gap-3">
              <CoverArt title={layer.sound.title} uri={layer.sound.cover_url} size={40} rounded={10} />
              <p className="flex-1 font-medium truncate">{layer.sound.title}</p>
              <button type="button" className="chip" onClick={() => setSelected((prev) => setMixLayerVolume(prev, layer.sound.id, layer.volume - 0.1))}>−</button>
              <span className="text-sm text-muted w-12 text-center">{Math.round(layer.volume * 100)}%</span>
              <button type="button" className="chip" onClick={() => setSelected((prev) => setMixLayerVolume(prev, layer.sound.id, layer.volume + 0.1))}>+</button>
              <button type="button" className="chip" onClick={() => void toggleSelect(layer.sound)}>Remove</button>
            </div>
          ))}
        </div>
      ) : null}
      {savedMixes.length ? (
        <div className="space-y-2">
          <h2 className="font-semibold">Saved mixes</h2>
          {savedMixes.map((mix) => (
            <button key={mix.id} type="button" className="card w-full text-left p-3" onClick={() => void loadSaved(mix)}>
              {mix.title} · {mix.tracks?.length ?? 0} layers
            </button>
          ))}
        </div>
      ) : null}
      <div className="grid gap-2 max-h-[420px] overflow-y-auto">
        {catalog.map((sound) => {
          const on = selected.some((l) => l.sound.id === sound.id);
          return (
            <button key={sound.id} type="button" className="card p-3 flex items-center gap-3 text-left" onClick={() => void toggleSelect(sound)}>
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
