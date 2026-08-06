'use client';

import Link from 'next/link';
import { CoverArt } from '@/components/CoverArt';
import { formatMs } from '@/lib/format';
import { usePlayer } from '@/lib/player-context';

export function PlayerBar() {
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
    <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-background/95 backdrop-blur px-4 py-3 z-30">
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
            className="btn btn-outline px-3 py-2"
            disabled={!hasPrevious}
            onClick={() => void playPrevious()}
            aria-label="Previous"
          >
            ⏮
          </button>
          <button
            type="button"
            className="btn btn-primary w-11 h-11 rounded-full px-0"
            onClick={() => void togglePlay()}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? '❚❚' : '▶'}
          </button>
          <button
            type="button"
            className="btn btn-outline px-3 py-2"
            disabled={!hasNext}
            onClick={() => void playNext()}
            aria-label="Next"
          >
            ⏭
          </button>
          <button
            type="button"
            className={`btn btn-outline px-3 py-2 hidden sm:inline-flex ${isLooping ? 'chip-active' : ''}`}
            onClick={toggleLoop}
            aria-label="Loop"
          >
            🔁
          </button>
        </div>
        <div className="hidden md:block w-40 h-1 rounded bg-border overflow-hidden">
          <div className="h-full bg-foreground" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </div>
  );
}
