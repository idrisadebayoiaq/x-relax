'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, Search } from 'lucide-react';
import { SoundCard } from '@/components/SoundCard';
import { HorizontalRail } from '@/components/HorizontalRail';
import { ListeningTipBanner } from '@/components/ListeningTipBanner';
import { WelcomeBanner } from '@/components/WelcomeBanner';
import { loadHomeCatalog, type CatalogSection } from '@/lib/catalog';
import { getDailyPlayStatus, FREE_DAILY_SOUND_LIMIT } from '@/lib/daily-listen-limit';
import { moodPaletteFor } from '@/lib/format';
import { useAuth } from '@/lib/auth-context';
import { usePlayer } from '@/lib/player-context';
import type { Category, Sound } from '@/types/database';

export default function HomePage() {
  const router = useRouter();
  const { user, profile, isPremium, hasUnlimitedListening } = useAuth();
  const { playSound } = usePlayer();
  const [sections, setSections] = useState<CatalogSection[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [catalog, setCatalog] = useState<Sound[]>([]);
  const [loading, setLoading] = useState(true);
  const [dailyPlays, setDailyPlays] = useState<{ remaining: number; limit: number } | null>(null);

  useEffect(() => {
    loadHomeCatalog(user?.id)
      .then(({ all, sections: secs, categories: cats }) => {
        setCatalog(all);
        setSections(secs);
        setCategories(cats);
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

  const openSound = async (sound: Sound, queue?: Sound[], queueLabel?: string) => {
    const playableQueue = queue ?? catalog;
    const index = playableQueue.findIndex((s) => s.id === sound.id);
    const started = await playSound(sound, {
      queue: playableQueue,
      queueIndex: index >= 0 ? index : 0,
      queueLabel: queueLabel ?? (queue ? 'Queue' : 'All sounds'),
    });
    if (started) router.push('/player');
  };

  if (loading) {
    return <p className="text-muted">Loading calm…</p>;
  }

  const greetingName = profile?.display_name?.split(' ')[0] ?? 'there';

  return (
    <div className="max-w-6xl mx-auto space-y-9">
      <ListeningTipBanner />
      <WelcomeBanner />
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-serif font-bold tracking-tight">
            Hello, {greetingName}
          </h1>
          <p className="text-muted mt-1">Your space for sleep, focus, and calm</p>
        </div>
        <div className="flex gap-2 items-center">
          {isPremium ? (
            <span className="chip chip-active inline-flex items-center gap-1.5">Premium</span>
          ) : null}
          <Link
            href="/search"
            className="chip inline-flex items-center gap-1.5"
            aria-label="Search"
          >
            <Search size={15} />
            Search
          </Link>
          <Link
            href="/notifications"
            className="chip inline-flex items-center gap-1.5"
            aria-label="Notifications"
          >
            <Bell size={15} />
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
            Free plan · unlock {FREE_DAILY_SOUND_LIMIT} sounds/day · replay those freely.{' '}
            <Link href="/premium" className="underline">
              Upgrade for unlimited
            </Link>
          </p>
        </div>
      ) : null}

      {categories.length ? (
        <section>
          <div className="mb-4">
            <h3 className="text-xl font-semibold">Categories</h3>
            <p className="text-sm text-muted">Open a category to play only those sounds</p>
          </div>
          <HorizontalRail>
            {categories.map((c) => {
              const [a, b] = moodPaletteFor(c.slug || c.name);
              return (
                <Link key={c.id} href={`/category/${c.id}`} className="min-w-[88px] text-center shrink-0">
                  <div
                    className="w-[76px] h-[76px] rounded-full mx-auto overflow-hidden"
                    style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}
                  >
                    {c.cover_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.cover_url} alt="" className="w-full h-full object-cover" />
                    ) : null}
                  </div>
                  <p className="text-sm mt-2 truncate">{c.name}</p>
                </Link>
              );
            })}
          </HorizontalRail>
        </section>
      ) : null}

      {sections.map((section) => (
        <section key={section.key}>
          <div className="mb-4">
            <h3 className="text-xl font-semibold">{section.title}</h3>
            {section.subtitle ? <p className="text-sm text-muted">{section.subtitle}</p> : null}
          </div>
          <HorizontalRail>
            {section.data.map((sound) => (
              <SoundCard
                key={`${section.key}-${sound.id}`}
                sound={sound}
                compact
                onPlay={() => void openSound(sound, section.data, section.title)}
              />
            ))}
          </HorizontalRail>
        </section>
      ))}

      <Link
        href="/search"
        className="card block p-5 hover:opacity-90 transition-opacity"
      >
        <p className="font-semibold">All sounds</p>
        <p className="text-sm text-muted">Browse the full catalog · {catalog.length} tracks</p>
      </Link>
    </div>
  );
}
