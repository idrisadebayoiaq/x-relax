'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';

type EarningsAnalytics = {
  published_sounds?: number;
  pending_sounds?: number;
  total_plays?: number;
  earnings_usd?: number;
  earnings_ngn?: number;
};

type ProfileAnalytics = {
  follower_count?: number;
  new_followers_7d?: number;
  monthly_listeners?: number;
  total_likes?: number;
  new_likes_7d?: number;
  plays_7d?: number;
  total_saves?: number;
  top_countries?: { country_code: string; plays: number }[];
  sounds?: {
    id: string;
    title: string;
    play_count: number;
    likes: number;
    saves: number;
    status: string;
  }[];
};

type EarnRequirement = {
  key: string;
  label: string;
  required: number;
  current: number;
  met: boolean;
};

type EarnStatus = {
  can_earn?: boolean;
  requirements?: EarnRequirement[];
};

function formatStat(n: number | undefined): string {
  const value = Number(n ?? 0);
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(Math.floor(value));
}

export default function CreatorPage() {
  const { isCreator, user } = useAuth();
  const [earnings, setEarnings] = useState<EarningsAnalytics | null>(null);
  const [profileStats, setProfileStats] = useState<ProfileAnalytics | null>(null);
  const [earnStatus, setEarnStatus] = useState<EarnStatus | null>(null);

  useEffect(() => {
    if (!isCreator) return;
    const supabase = createClient();
    void Promise.all([
      supabase.rpc('creator_analytics'),
      supabase.rpc('creator_profile_analytics'),
      supabase.rpc('get_creator_earn_requirements'),
    ]).then(([{ data: earnData }, { data: profileData }, { data: reqData }]) => {
      setEarnings((earnData as EarningsAnalytics) ?? null);
      setProfileStats((profileData as ProfileAnalytics) ?? null);
      setEarnStatus((reqData as EarnStatus) ?? null);
    });
  }, [isCreator]);

  if (!isCreator) {
    return (
      <div className="max-w-lg mx-auto space-y-4 text-center py-16">
        <h1 className="text-3xl font-serif font-bold">Creator</h1>
        <p className="text-muted">Share original relaxation audio and earn from Premium listening.</p>
        <Link href="/creator/become" className="btn btn-primary inline-block">Become a Creator</Link>
      </div>
    );
  }

  const topCountries = profileStats?.top_countries ?? [];
  const soundRows = profileStats?.sounds ?? [];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-3xl font-serif font-bold">Creator dashboard</h1>
        {user ? (
          <Link href={`/creator/${user.id}`} className="btn btn-outline text-sm">
            View public profile
          </Link>
        ) : null}
      </div>

      <div>
        <p className="text-[11px] uppercase tracking-wider text-muted mb-2 px-1">Earnings</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            ['Published', earnings?.published_sounds ?? 0],
            ['Pending', earnings?.pending_sounds ?? 0],
            ['Total plays', earnings?.total_plays ?? 0],
            ['Earnings USD', `$${Number(earnings?.earnings_usd ?? 0).toFixed(2)}`],
          ].map(([label, value]) => (
            <div key={label as string} className="card p-4">
              <p className="text-sm text-muted">{label}</p>
              <p className="text-2xl font-bold mt-1">{value}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[11px] uppercase tracking-wider text-muted mb-2 px-1">Audience</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            ['Followers', formatStat(profileStats?.follower_count)],
            ['New followers (7d)', formatStat(profileStats?.new_followers_7d)],
            ['Monthly listeners', formatStat(profileStats?.monthly_listeners)],
            ['Plays (7d)', formatStat(profileStats?.plays_7d)],
            ['Total likes', formatStat(profileStats?.total_likes)],
            ['New likes (7d)', formatStat(profileStats?.new_likes_7d)],
            ['Total saves', formatStat(profileStats?.total_saves)],
          ].map(([label, value]) => (
            <div key={label as string} className="card p-4">
              <p className="text-sm text-muted">{label}</p>
              <p className="text-2xl font-bold mt-1">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {!earnStatus?.can_earn && earnStatus?.requirements?.length ? (
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted mb-2 px-1">Path to earning</p>
          <p className="text-sm text-muted mb-3 px-1">
            Track progress toward Apply to Earn (includes 1,000 likes).
          </p>
          <div className="card p-4 space-y-4">
            {earnStatus.requirements
              .filter((r) => r.key !== 'identity')
              .map((req) => {
                const pct = Math.min(
                  100,
                  Math.round((Number(req.current) / Math.max(1, Number(req.required))) * 100),
                );
                return (
                  <div key={req.key}>
                    <div className="flex items-center justify-between gap-3 text-sm mb-1.5">
                      <span className="font-semibold">{req.label}</span>
                      <span className="text-muted">
                        {req.current}/{req.required}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-border overflow-hidden">
                      <div
                        className={`h-full rounded-full ${req.met ? 'bg-emerald-500' : 'bg-[#C9A227]'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            <Link href="/creator/verification" className="btn btn-outline inline-flex">
              Open Apply to Earn
            </Link>
          </div>
        </div>
      ) : null}

      {topCountries.length ? (
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted mb-2 px-1">Top countries</p>
          <div className="card p-4 flex flex-wrap gap-2">
            {topCountries.map((row) => (
              <span key={row.country_code} className="chip">
                {row.country_code} · {formatStat(Number(row.plays))} plays
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {soundRows.length ? (
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted mb-2 px-1">Sound performance</p>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted">
                    <th className="px-4 py-3 font-medium">Title</th>
                    <th className="px-4 py-3 font-medium">Plays</th>
                    <th className="px-4 py-3 font-medium">Likes</th>
                    <th className="px-4 py-3 font-medium">Saves</th>
                  </tr>
                </thead>
                <tbody>
                  {soundRows.map((sound) => (
                    <tr key={sound.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 font-semibold">{sound.title}</td>
                      <td className="px-4 py-3">{formatStat(Number(sound.play_count))}</td>
                      <td className="px-4 py-3">{formatStat(Number(sound.likes))}</td>
                      <td className="px-4 py-3">{formatStat(Number(sound.saves))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid sm:grid-cols-2 gap-3">
        <Link href="/creator/upload" className="card p-4">Upload sound</Link>
        <Link href="/creator/sounds" className="card p-4">My sounds</Link>
        <Link href="/creator/verification" className="card p-4 font-semibold">
          Apply to earn
          <span className="block text-sm text-muted font-normal mt-1">
            Requirements · identity verify · admin review
          </span>
        </Link>
        <Link href="/creator/withdrawals" className="card p-4">Withdrawals</Link>
      </div>
    </div>
  );
}
