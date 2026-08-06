'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CoverArt } from '@/components/CoverArt';
import { SoundRatingPanel } from '@/components/SoundRatingPanel';
import { formatMs, formatPlayCount, formatRatingSummary } from '@/lib/format';
import { hasOfflineSound } from '@/lib/offline-storage';
import { downloadSoundForWeb, removeDownloadForWeb } from '@/lib/web-downloads';
import { useAuth } from '@/lib/auth-context';
import { usePlayer } from '@/lib/player-context';

export default function PlayerPage() {
  const { user, isPremium, canDownloadOffline } = useAuth();
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
    setRate,
    toggleLoop,
    setSleepTimerMinutes,
    toggleFavourite,
    isFavourite,
  } = usePlayer();
  const [downloaded, setDownloaded] = useState(false);
  const [downloadBusy, setDownloadBusy] = useState(false);
  const [stats, setStats] = useState({ avg: 0, count: 0, plays: 0 });

  useEffect(() => {
    if (!current) {
      setDownloaded(false);
      return;
    }
    setStats({
      avg: Number(current.average_rating ?? 0),
      count: Number(current.rating_count ?? 0),
      plays: Number(current.play_count ?? 0),
    });
    void hasOfflineSound(current.id).then(setDownloaded);
  }, [current?.id, current?.average_rating, current?.rating_count, current?.play_count]);

  if (!current) {
    return (
      <div className="max-w-lg mx-auto text-center space-y-4 py-20">
        <p className="text-muted">No sound selected</p>
        <Link href="/" className="underline">Browse sounds</Link>
      </div>
    );
  }

  const progress = durationMs > 0 ? (positionMs / durationMs) * 100 : 0;
  const sleepRemaining =
    sleepEndsAt != null ? Math.max(0, Math.floor((sleepEndsAt - Date.now()) / 1000)) : null;
  const ratingLine = formatRatingSummary(stats.avg, stats.count);

  const toggleDownload = async () => {
    if (!user) return;
    if (!canDownloadOffline) {
      alert('Offline downloads require Premium or admin access.');
      return;
    }
    setDownloadBusy(true);
    if (downloaded) {
      const result = await removeDownloadForWeb(user.id, current.id);
      setDownloadBusy(false);
      if (!result.ok) alert(result.message);
      else setDownloaded(false);
      return;
    }
    const result = await downloadSoundForWeb(user.id, current);
    setDownloadBusy(false);
    if (!result.ok) alert(result.message);
    else {
      setDownloaded(true);
      alert(result.message);
    }
  };

  return (
    <div className="max-w-lg mx-auto space-y-6 pb-8">
      <Link href="/" className="text-sm text-muted underline">← Back</Link>
      <div className="flex justify-center">
        <CoverArt title={current.title} uri={current.cover_url} size={280} rounded={24} />
      </div>
      <div className="text-center">
        <h1 className="text-2xl font-serif font-bold">{current.title}</h1>
        <p className="text-muted mt-2">{current.description ?? 'X-Relax'}</p>
        <p className="text-sm text-muted mt-2">
          {formatPlayCount(stats.plays)}
          {ratingLine ? ` · ${ratingLine}` : ''}
        </p>
        {queue.length > 1 ? (
          <p className="text-sm text-muted mt-2">
            {queueLabel ? `${queueLabel} · ` : ''}Track {queueIndex + 1} of {queue.length}
          </p>
        ) : null}
      </div>
      <div className="h-1 rounded bg-border overflow-hidden">
        <div className="h-full bg-foreground" style={{ width: `${progress}%` }} />
      </div>
      <div className="flex justify-between text-sm text-muted">
        <span>{formatMs(positionMs)}</span>
        <span>{formatMs(durationMs)}</span>
      </div>
      <div className="flex justify-center items-center gap-4">
        <button type="button" className="btn btn-outline px-4" disabled={!hasPrevious} onClick={() => void playPrevious()}>⏮</button>
        <button type="button" className="btn btn-primary px-8 py-3" onClick={() => void togglePlay()}>{isPlaying ? 'Pause' : 'Play'}</button>
        <button type="button" className="btn btn-outline px-4" disabled={!hasNext} onClick={() => void playNext()}>⏭</button>
      </div>
      <div className="flex flex-wrap gap-2 justify-center">
        <button type="button" className="chip" onClick={() => void seekBy(-15000)}>-15s</button>
        <button type="button" className="chip" onClick={() => void seekBy(15000)}>+15s</button>
        <button type="button" className={`chip ${isLooping ? 'chip-active' : ''}`} onClick={toggleLoop}>Loop {isLooping ? 'on' : 'off'}</button>
        <button type="button" className="chip" onClick={() => setRate(rate >= 1.5 ? 0.75 : rate + 0.25)}>{rate.toFixed(2)}×</button>
        <button type="button" className={`chip ${isFavourite ? 'chip-active' : ''}`} onClick={() => void toggleFavourite()}>{isFavourite ? 'Saved' : 'Favourite'}</button>
      </div>
      <div>
        <p className="text-xs uppercase tracking-wider text-muted mb-2">Sleep timer</p>
        {isPremium ? (
          <div className="flex flex-wrap gap-2">
            {[10, 20, 30, 45, 60].map((m) => (
              <button key={m} type="button" className="chip" onClick={() => setSleepTimerMinutes(m)}>{m}m</button>
            ))}
            <button type="button" className="chip" onClick={() => setSleepTimerMinutes(null)}>Clear</button>
            {sleepRemaining != null ? (
              <p className="text-sm text-muted w-full">Sleep timer · {Math.floor(sleepRemaining / 60)}:{(sleepRemaining % 60).toString().padStart(2, '0')} left</p>
            ) : null}
          </div>
        ) : (
          <Link href="/premium" className="card block p-3 text-sm text-muted">Premium only · loops until timer ends</Link>
        )}
      </div>
      <div>
        <p className="text-xs uppercase tracking-wider text-muted mb-2">Offline download</p>
        {canDownloadOffline ? (
          <button
            type="button"
            className={`chip ${downloaded ? 'chip-active' : ''}`}
            disabled={downloadBusy}
            onClick={() => void toggleDownload()}
          >
            {downloaded ? 'Remove download' : 'Download for offline'}
          </button>
        ) : (
          <Link href="/premium" className="card block p-3 text-sm text-muted">
            Premium only · free accounts cannot download for offline
          </Link>
        )}
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
