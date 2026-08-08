'use client';

import Link from 'next/link';
import { Lock, Pause, Play, Repeat, SkipBack, SkipForward } from 'lucide-react';
import { CoverArt } from '@/components/CoverArt';
import { formatMs } from '@/lib/format';
import { useAuth } from '@/lib/auth-context';
import { usePlayer } from '@/lib/player-context';

export function PlayerBar() {
  const { isPremium } = useAuth();
  const {
    current,
    isPlaying,
    positionMs,
    durationMs,
    isLooping,
    togglePlay,
    playNext,
    playPrevious,
    toggleLoop,
    hasNext,
    hasPrevious,
  } = usePlayer();

  if (!current) return null;

  const progress = durationMs > 0 ? (positionMs / durationMs) * 100 : 0;

  return (
    <div className="shrink-0 border-t border-border bg-background/95 backdrop-blur px-4 py-3 z-30">
      <div className="max-w-6xl mx-auto flex items-center gap-3">
        <Link href="/player" className="flex items-center gap-3 min-w-0 flex-1">
          <CoverArt title={current.title} uri={current.cover_url} size={48} rounded={10} />
          <div className="min-w-0">
            <p className="font-semibold truncate">{current.title}</p>
            <p className="text-xs text-muted">
              {formatMs(positionMs)} / {formatMs(durationMs)}
            </p>
          </div>
        </Link>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className="btn btn-outline px-3 py-2 disabled:opacity-40"
            disabled={!hasPrevious}
            onClick={() => void playPrevious()}
            aria-label="Previous"
          >
            <SkipBack size={16} />
          </button>
          <button
            type="button"
            className="btn btn-primary w-11 h-11 rounded-full px-0 inline-flex items-center justify-center"
            onClick={() => void togglePlay()}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause size={18} fill="currentColor" />
            ) : (
              <Play size={18} fill="currentColor" className="ml-0.5" />
            )}
          </button>
          <button
            type="button"
            className="btn btn-outline px-3 py-2 disabled:opacity-40"
            disabled={!hasNext}
            onClick={() => void playNext()}
            aria-label="Next"
          >
            <SkipForward size={16} />
          </button>
          <button
            type="button"
            className={`btn btn-outline px-3 py-2 hidden sm:inline-flex items-center justify-center ${
              isLooping ? 'bg-foreground text-background border-foreground' : ''
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
            {isPremium ? <Repeat size={16} /> : <Lock size={16} />}
          </button>
        </div>
        <div className="hidden md:block w-40 h-1 rounded bg-border overflow-hidden">
          <div className="h-full bg-foreground" style={{ width: `${progress}%` }} />
        </div>
      </div>
      <div className="md:hidden mt-2 h-1 rounded bg-border overflow-hidden">
        <div className="h-full bg-foreground" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
