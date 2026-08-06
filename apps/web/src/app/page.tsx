'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CoverArt } from '@/components/CoverArt';
import { SoundCard } from '@/components/SoundCard';
import { loadHomeCatalog, type CatalogSection } from '@/lib/catalog';
import { getDailyPlayStatus, FREE_DAILY_SOUND_LIMIT } from '@/lib/daily-listen-limit';
import { moodPaletteFor } from '@/lib/format';
import { useAuth } from '@/lib/auth-context';
import { usePlayer } from '@/lib/player-context';
import type { Sound } from '@/types/database';

export default function HomePage() {
  const router = useRouter();
  const { user, isPremium, hasUnlimitedListening } = useAuth();
  const { playSound } = usePlayer();
  const [sections, setSections] = useState<CatalogSection[]>([]);
  const [daily, setDaily] = useState<Sound | null>(null);
  const [catalog, setCatalog] = useState<Sound[]>([]);
  const [loading, setLoading] = useState(true);
  const [dailyPlays, setDailyPlays] = useState<{ remaining: number; limit: number } | null>(null);

  useEffect(() => {
    loadHomeCatalog(user?.id)
      .then(({ all, daily: pick, sections: secs }) => {
        setCatalog(all);
        setDaily(pick);
        setSections(secs);
      })
      .finally(() => setLoading(false));
  }, [user?.id]);

  useEffect(() => {
    if (hasUnlimitedListening) {
      setDailyPlays(null);
      return;
    }
    getDailyPlayStatus(user?.id ?? null, false).then((s) =>
      setDailyPlays({ remaining: s.remaining, limit: s.limit }),
    );
  }, [user?.id, hasUnlimitedListening]);

  const openSound = async (sound: Sound, queue?: Sound[]) => {
    const playableQueue = queue ?? catalog;
    const index = playableQueue.findIndex((s) => s.id === sound.id);
    const started = await playSound(sound, { queue: playableQueue, queueIndex: index >= 0 ? index : 0 });
    if (started) router.push('/player');
  };

  const heroColors = daily ? moodPaletteFor(daily.title) : (['#0B1C1D', '#1A2E2F'] as [string, string]);

  if (loading) {
    return <p className="text-muted">Loading calm…</p>;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-serif font-bold tracking-tight">X-Relax</h1>
          <p className="text-muted mt-1">Your space for sleep, focus, and calm</p>
        </div>
        <div className="flex gap-2">
          {isPremium ? <span className="chip chip-active">Premium</span> : null}
          <Link href="/search" className="chip">
            Search
          </Link>
          <Link href="/notifications" className="chip">
            Alerts
          </Link>
        </div>
      </div>

      {!hasUnlimitedListening && dailyPlays ? (
        <div className="card p-4">
          <p className="font-semibold">
            {dailyPlays.remaining > 0
              ? `${dailyPlays.remaining} of ${dailyPlays.limit} sounds left today`
              : 'Daily limit reached'}
          </p>
          <p className="text-sm text-muted mt-1">
            Free plan · normal track length · no sleep timer.{' '}
            <Link href="/premium" className="underline">
              Upgrade
            </Link>
          </p>
        </div>
      ) : null}

      {daily ? (
        <button
          type="button"
          onClick={() => void openSound(daily, [daily, ...catalog.filter((s) => s.id !== daily.id)])}
          className="w-full text-left overflow-hidden rounded-3xl min-h-[280px] relative"
          style={{ background: `linear-gradient(135deg, ${heroColors[0]}, ${heroColors[1]})` }}
        >
          <div className="absolute inset-0 p-8 flex flex-col justify-end text-white">
            <p className="text-xs uppercase tracking-widest opacity-80">Today&apos;s pick</p>
            <h2 className="text-3xl font-serif font-bold mt-2">{daily.title}</h2>
            <p className="opacity-85 mt-2 max-w-xl">{daily.description ?? 'Press play and unwind.'}</p>
            <span className="mt-4 inline-flex w-fit rounded-full bg-white text-black px-5 py-2 font-semibold">
              Play now
            </span>
          </div>
          {daily.cover_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={daily.cover_url} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />
          ) : null}
        </button>
      ) : null}

      {sections.map((section) => (
        <section key={section.key}>
          <div className="mb-4">
            <h3 className="text-xl font-semibold">{section.title}</h3>
            {section.subtitle ? <p className="text-sm text-muted">{section.subtitle}</p> : null}
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {section.data.map((sound) => (
              <SoundCard
                key={`${section.key}-${sound.id}`}
                sound={sound}
                compact
                onPlay={() => void openSound(sound, section.data)}
              />
            ))}
          </div>
        </section>
      ))}

      <Link href="/search" className="card block p-5">
        <p className="font-semibold">All sounds</p>
        <p className="text-sm text-muted">Browse the full catalog · {catalog.length} tracks</p>
      </Link>
    </div>
  );
}
