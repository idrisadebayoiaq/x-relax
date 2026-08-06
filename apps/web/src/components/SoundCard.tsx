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
  const rating = formatRatingSummary(sound.average_rating, sound.rating_count);
  const meta = [formatDuration(sound.duration_seconds), formatPlayCount(sound.play_count), rating]
    .filter(Boolean)
    .join(' · ');

  const tip = sound.description?.trim();

  return (
    <button
      type="button"
      onClick={onPlay}
      className={`text-left card hover:opacity-90 transition-opacity ${compact ? 'min-w-[160px] p-3' : 'w-full p-4 flex gap-4 items-center'}`}
    >
      <CoverArt title={sound.title} uri={sound.cover_url} size={compact ? 80 : 64} rounded={12} />
      <div className={compact ? 'mt-2' : 'flex-1 min-w-0'}>
        <p className="font-semibold truncate">{sound.title}</p>
        {tip ? (
          <p className={`text-xs text-muted ${compact ? 'line-clamp-2 mt-1' : 'line-clamp-2 mt-0.5'}`}>{tip}</p>
        ) : null}
        <p className="text-sm text-muted truncate mt-0.5">{meta}</p>
      </div>
    </button>
  );
}
