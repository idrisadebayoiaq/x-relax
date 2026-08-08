import { Star } from 'lucide-react';
import { CoverArt } from '@/components/CoverArt';
import { formatDuration, formatPlayCount, formatRatingSummary } from '@/lib/format';
import type { Sound } from '@/types/database';

export function SoundCard({
  sound,
  onPlay,
  compact,
}: {
  sound: Sound;
  onPlay: () => void;
  compact?: boolean;
}) {
  const rating = Number(sound.average_rating ?? 0);
  const hasRating = Number(sound.rating_count ?? 0) > 0 && rating > 0;

  if (compact) {
    return (
      <button
        type="button"
        onClick={onPlay}
        className="text-left min-w-[168px] max-w-[168px] shrink-0 group"
      >
        <CoverArt title={sound.title} uri={sound.cover_url} size={168} rounded={14} />
        <p className="font-semibold truncate mt-2.5 text-[15px]">{sound.title}</p>
        <p className="text-sm text-muted mt-0.5 flex items-center gap-1.5">
          <span>{formatDuration(sound.duration_seconds)}</span>
          {hasRating ? (
            <>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-0.5">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                {rating.toFixed(1)}
              </span>
            </>
          ) : null}
        </p>
      </button>
    );
  }

  const ratingLine = formatRatingSummary(sound.average_rating, sound.rating_count);
  const meta = [formatDuration(sound.duration_seconds), formatPlayCount(sound.play_count), ratingLine]
    .filter((part) => part && part !== '—')
    .join(' · ');

  return (
    <button
      type="button"
      onClick={onPlay}
      className="text-left w-full p-3.5 flex gap-3.5 items-center rounded-2xl border border-border bg-surface hover:opacity-90 transition-opacity"
    >
      <CoverArt title={sound.title} uri={sound.cover_url} size={64} rounded={12} />
      <div className="flex-1 min-w-0">
        <p className="font-semibold truncate">{sound.title}</p>
        <p className="text-sm text-muted truncate mt-0.5">{meta}</p>
      </div>
    </button>
  );
}
