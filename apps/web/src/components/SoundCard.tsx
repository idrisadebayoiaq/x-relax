import { CoverArt } from '@/components/CoverArt';
import { formatDuration } from '@/lib/format';
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
  return (
    <button
      type="button"
      onClick={onPlay}
      className={`text-left card hover:opacity-90 transition-opacity ${compact ? 'min-w-[160px] p-3' : 'w-full p-4 flex gap-4 items-center'}`}
    >
      <CoverArt title={sound.title} uri={sound.cover_url} size={compact ? 80 : 64} rounded={12} />
      <div className={compact ? 'mt-2' : 'flex-1 min-w-0'}>
        <p className="font-semibold truncate">{sound.title}</p>
        <p className="text-sm text-muted truncate">
          {formatDuration(sound.duration_seconds)}
          {sound.average_rating ? ` · ★ ${sound.average_rating.toFixed(1)}` : ''}
        </p>
      </div>
    </button>
  );
}
