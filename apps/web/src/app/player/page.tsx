'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  Download,
  Gauge,
  Heart,
  Lock,
  Moon,
  Pause,
  Play,
  Repeat,
  SkipBack,
  SkipForward,
} from 'lucide-react';
import { CoverArt } from '@/components/CoverArt';
import { SoundRatingPanel } from '@/components/SoundRatingPanel';
import { formatMs, formatPlayCount, formatRatingSummary } from '@/lib/format';
import { hasOfflineSound } from '@/lib/offline-storage';
import { downloadSoundForWeb, removeDownloadForWeb } from '@/lib/web-downloads';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { usePlayer } from '@/lib/player-context';
import { appAlert } from '@/components/AppDialog';

function formatSleep(totalSec: number) {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function PlayerPage() {
  const { user, isPremium, canDownloadOffline, hasUnlimitedListening } = useAuth();
  const {
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
    hasNext,
    hasPrevious,
    togglePlay,
    playNext,
    playPrevious,
    seekBy,
    seekTo,
    setRate,
    toggleLoop,
    setSleepTimerMinutes,
    toggleFavourite,
    isFavourite,
  } = usePlayer();
  const [downloaded, setDownloaded] = useState(false);
  const [downloadBusy, setDownloadBusy] = useState(false);
  const [stats, setStats] = useState({ avg: 0, count: 0, plays: 0 });
  const [creatorName, setCreatorName] = useState<string | null>(null);
  const [sleepOpen, setSleepOpen] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!sleepEndsAt) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [sleepEndsAt]);

  useEffect(() => {
    if (!current) {
      setDownloaded(false);
      setCreatorName(null);
      return;
    }
    setStats({
      avg: Number(current.average_rating ?? 0),
      count: Number(current.rating_count ?? 0),
      plays: Number(current.play_count ?? 0),
    });
    void hasOfflineSound(current.id).then(setDownloaded);
  }, [current?.id, current?.average_rating, current?.rating_count, current?.play_count]);

  useEffect(() => {
    if (!current?.creator_id) {
      setCreatorName(null);
      return;
    }
    const creatorId = current.creator_id;
    createClient()
      .rpc('get_creator_public_profile', { p_creator_id: creatorId })
      .then(({ data }) => {
        const name = (data as { display_name?: string | null } | null)?.display_name?.trim();
        setCreatorName(name || null);
      });
  }, [current?.creator_id]);

  if (!current) {
    return (
      <div className="max-w-lg mx-auto text-center space-y-4 py-20">
        <p className="text-muted">No sound selected</p>
        <Link href="/" className="underline">
          Browse sounds
        </Link>
      </div>
    );
  }

  const progress = durationMs > 0 ? (positionMs / durationMs) * 100 : 0;
  const sleepRemaining =
    sleepEndsAt != null ? Math.max(0, Math.floor((sleepEndsAt - Date.now()) / 1000)) : null;
  const ratingLine = formatRatingSummary(stats.avg, stats.count);
  const subtitle = queueLabel || 'X-Relax';

  const cycleRate = () => {
    void setRate(rate >= 1.5 ? 0.75 : Number((rate + 0.25).toFixed(2)));
  };

  const toggleDownload = async () => {
    if (!user) return;
    if (!canDownloadOffline) {
      appAlert('Offline downloads require Premium or admin access.');
      return;
    }
    setDownloadBusy(true);
    if (downloaded) {
      const result = await removeDownloadForWeb(user.id, current.id);
      setDownloadBusy(false);
      if (!result.ok) appAlert(result.message);
      else setDownloaded(false);
      return;
    }
    const result = await downloadSoundForWeb(user.id, current);
    setDownloadBusy(false);
    if (!result.ok) appAlert(result.message);
    else {
      setDownloaded(true);
      appAlert(result.message);
    }
  };

  const applySleep = (minutes: number | null) => {
    if (minutes != null && !isPremium) {
      window.location.href = '/premium';
      return;
    }
    setSleepTimerMinutes(minutes);
    setSleepOpen(false);
  };

  return (
    <div className="max-w-md mx-auto space-y-5 pb-10">
      <div className="flex items-center justify-between gap-3">
        <Link href="/" className="text-sm text-muted hover:text-foreground">
          ↓ Close
        </Link>
        <div className="text-center min-w-0">
          <p className="text-[10px] tracking-[0.16em] uppercase text-muted">Now playing</p>
          <p className="text-sm font-semibold truncate">{subtitle}</p>
        </div>
        <button
          type="button"
          className="text-sm text-muted"
          onClick={() => {
            void navigator.share?.({
              title: current.title,
              text: `Listen to ${current.title} on X-Relax`,
              url: window.location.origin,
            });
          }}
        >
          Share
        </button>
      </div>

      <div className="flex justify-center pt-2">
        <CoverArt title={current.title} uri={current.cover_url} size={300} rounded={18} />
      </div>

      <div>
        <h1 className="text-2xl font-serif font-bold leading-tight">{current.title}</h1>
        {current.creator_id ? (
          <Link
            href={`/creator/${current.creator_id}`}
            className="text-sm text-muted hover:text-foreground underline mt-1 inline-block"
          >
            {creatorName ?? 'View creator'}
          </Link>
        ) : null}
        {current.description?.trim() ? (
          <p className="text-muted mt-1 line-clamp-4">{current.description.trim()}</p>
        ) : (
          <p className="text-muted mt-1">Ambient sound · X-Relax</p>
        )}
        <p className="text-sm text-muted mt-2">
          {formatPlayCount(stats.plays)}
          {ratingLine ? ` · ${ratingLine}` : ''}
          {queue.length > 1 ? ` · ${queueIndex + 1}/${queue.length}` : ''}
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto rail-scroll pb-1 -mx-1 px-1">
        <button
          type="button"
          className={`min-w-[4.75rem] h-16 rounded-2xl border px-2 flex flex-col items-center justify-center gap-1 text-xs font-medium ${
            sleepEndsAt ? 'border-foreground bg-foreground/5' : 'border-border'
          }`}
          onClick={() => (isPremium ? setSleepOpen((v) => !v) : (window.location.href = '/premium'))}
        >
          <Moon size={18} />
          {sleepRemaining != null
            ? formatSleep(sleepRemaining)
            : isPremium
              ? 'Sleep'
              : 'Sleep'}
          {!isPremium ? <Lock size={10} className="opacity-60" /> : null}
        </button>
        <button
          type="button"
          className={`min-w-[4.75rem] h-16 rounded-2xl border px-2 flex flex-col items-center justify-center gap-1 text-xs font-medium ${
            isLooping || sleepEndsAt ? 'border-foreground bg-foreground/5' : 'border-border'
          }`}
          onClick={() => {
            if (!isPremium) {
              window.location.href = '/premium';
              return;
            }
            toggleLoop();
          }}
        >
          {isPremium ? <Repeat size={18} /> : <Lock size={18} />}
          Loop
          {!isPremium ? <Lock size={10} className="opacity-60" /> : null}
        </button>
        <button
          type="button"
          className="min-w-[4.75rem] h-16 rounded-2xl border border-border px-2 flex flex-col items-center justify-center gap-1 text-xs font-medium"
          onClick={cycleRate}
        >
          <Gauge size={18} />
          {rate.toFixed(2)}×
        </button>
        <button
          type="button"
          className={`min-w-[4.75rem] h-16 rounded-2xl border px-2 flex flex-col items-center justify-center gap-1 text-xs font-medium ${
            isFavourite ? 'border-foreground bg-foreground/5' : 'border-border'
          }`}
          onClick={() => void toggleFavourite()}
        >
          <Heart size={18} className={isFavourite ? 'fill-current text-red-500' : ''} />
          {isFavourite ? 'Liked' : 'Like'}
        </button>
        <button
          type="button"
          className={`min-w-[4.75rem] h-16 rounded-2xl border px-2 flex flex-col items-center justify-center gap-1 text-xs font-medium ${
            downloaded ? 'border-foreground bg-foreground/5' : 'border-border'
          }`}
          disabled={downloadBusy}
          onClick={() => void toggleDownload()}
        >
          {canDownloadOffline ? <Download size={18} /> : <Lock size={18} />}
          Offline
        </button>
      </div>

      {sleepOpen && isPremium ? (
        <div className="flex flex-wrap gap-2">
          {[10, 20, 30, 45, 60].map((m) => (
            <button key={m} type="button" className="chip" onClick={() => applySleep(m)}>
              {m}m
            </button>
          ))}
          <button type="button" className="chip" onClick={() => applySleep(null)}>
            Clear
          </button>
        </div>
      ) : null}

      <div>
        <input
          type="range"
          min={0}
          max={Math.max(1, durationMs)}
          value={Math.min(positionMs, durationMs || 1)}
          onChange={(e) => void seekTo(Number(e.target.value))}
          className="w-full accent-foreground"
          aria-label="Seek"
        />
        <div className="flex justify-between text-sm text-muted mt-1">
          <span>{formatMs(positionMs)}</span>
          <span>{formatMs(durationMs)}</span>
        </div>
      </div>

      <div className="flex items-center justify-between px-1">
        <button
          type="button"
          className="text-muted text-sm w-12 inline-flex flex-col items-center gap-0.5"
          onClick={cycleRate}
        >
          <Gauge size={18} />
          <span className="text-[10px]">{rate.toFixed(2)}×</span>
        </button>
        <button
          type="button"
          className="btn btn-outline px-4 py-3 inline-flex items-center justify-center disabled:opacity-40"
          disabled={!hasPrevious}
          onClick={() => void playPrevious()}
        >
          <SkipBack size={18} />
        </button>
        <button
          type="button"
          className="btn btn-primary w-16 h-16 rounded-full inline-flex items-center justify-center"
          onClick={() => void togglePlay()}
        >
          {isPlaying ? (
            <Pause size={26} fill="currentColor" />
          ) : (
            <Play size={26} fill="currentColor" className="ml-0.5" />
          )}
        </button>
        <button
          type="button"
          className="btn btn-outline px-4 py-3 inline-flex items-center justify-center disabled:opacity-40"
          disabled={!hasNext}
          onClick={() => void playNext()}
        >
          <SkipForward size={18} />
        </button>
        <button
          type="button"
          className={`w-12 inline-flex justify-center ${
            isLooping || sleepEndsAt ? 'text-foreground' : 'text-muted'
          }`}
          onClick={() => {
            if (!isPremium) {
              window.location.href = '/premium';
              return;
            }
            toggleLoop();
          }}
          aria-label="Loop"
        >
          {isPremium ? <Repeat size={20} /> : <Lock size={18} />}
        </button>
      </div>

      {!hasUnlimitedListening ? (
        <Link
          href="/premium"
          className="block rounded-2xl border border-border px-4 py-3 text-sm font-medium bg-[rgba(201,162,39,0.12)]"
        >
          Upgrade to Premium for unlimited listening, loop, downloads, and Sleep Time →
        </Link>
      ) : null}

      <div className="flex justify-center gap-3">
        <button type="button" className="chip" onClick={() => void seekBy(-15000)}>
          -15s
        </button>
        <button type="button" className="chip" onClick={() => void seekBy(15000)}>
          +15s
        </button>
      </div>

      {/* Keep progress visual for bar consistency */}
      <div className="h-0 overflow-hidden" aria-hidden>
        <div style={{ width: `${progress}%` }} />
      </div>

      <SoundRatingPanel
        sound={current}
        onSoundUpdated={(next) =>
          setStats((s) => ({
            ...s,
            avg: Number(next.average_rating ?? 0),
            count: Number(next.rating_count ?? 0),
          }))
        }
      />
    </div>
  );
}
