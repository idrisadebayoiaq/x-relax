'use client';

import Link from 'next/link';
import type { AnalyticsSummary } from '@/lib/analytics';

export type QueueCard = {
  href: string;
  label: string;
  value: number;
  hint?: string;
};

function Stat({
  label,
  value,
  today,
  note,
}: {
  label: string;
  value: number;
  today: number;
  note: string;
}) {
  return (
    <div className="card p-5">
      <p className="text-xs uppercase tracking-wider text-muted">{label}</p>
      <p className="text-3xl font-semibold mt-2 tabular-nums">{value.toLocaleString()}</p>
      <p className="text-sm text-muted mt-2">
        {today.toLocaleString()} today · {note}
      </p>
    </div>
  );
}

function TrendChart({
  title,
  series,
  aKey,
  bKey,
  aLabel,
  bLabel,
}: {
  title: string;
  series: AnalyticsSummary['daily'];
  aKey: 'web_visits' | 'app_downloads';
  bKey: 'unique_visitors' | 'app_opens';
  aLabel: string;
  bLabel: string;
}) {
  const max = Math.max(1, ...series.map((d) => Math.max(Number(d[aKey] ?? 0), Number(d[bKey] ?? 0))));
  const recent = series.slice(-14);

  return (
    <div className="card p-5">
      <div className="flex items-end justify-between gap-3 mb-4">
        <div>
          <p className="font-semibold">{title}</p>
          <p className="text-xs text-muted mt-1">Last {recent.length} days</p>
        </div>
        <div className="flex gap-3 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-foreground" />
            {aLabel}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-foreground/35" />
            {bLabel}
          </span>
        </div>
      </div>
      <div className="flex items-end gap-1 h-36">
        {recent.map((day) => {
          const a = Number(day[aKey] ?? 0);
          const b = Number(day[bKey] ?? 0);
          return (
            <div key={day.day} className="flex-1 flex items-end justify-center gap-0.5 h-full" title={`${day.day}: ${a} ${aLabel}, ${b} ${bLabel}`}>
              <div
                className="w-[45%] min-h-px bg-foreground rounded-t-sm"
                style={{ height: `${Math.max(2, (a / max) * 100)}%` }}
              />
              <div
                className="w-[45%] min-h-px bg-foreground/35 rounded-t-sm"
                style={{ height: `${Math.max(2, (b / max) * 100)}%` }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RankList({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: { label: string; value: number }[];
  empty: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="card p-5">
      <p className="font-semibold mb-4">{title}</p>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.label}>
              <div className="flex justify-between gap-3 text-sm mb-1">
                <span className="truncate">{row.label}</span>
                <span className="tabular-nums text-muted">{row.value.toLocaleString()}</span>
              </div>
              <div className="h-1.5 rounded-full bg-background overflow-hidden">
                <div className="h-full bg-foreground" style={{ width: `${(row.value / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AnalyticsDashboard({
  summary,
  queues,
  queueHrefPrefix = '/admin',
}: {
  summary: AnalyticsSummary;
  queues: QueueCard[];
  queueHrefPrefix?: string;
}) {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-wider text-muted">Reach</p>
        <h2 className="text-2xl font-serif font-bold mt-1">How people find X-Relax</h2>
        <p className="text-sm text-muted mt-2 max-w-2xl">
          First-party counts only — website page views and Android APK downloads. No ad networks.
          Last {summary.period_days} days.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Website visits" value={summary.web_visits} today={summary.web_visits_today} note="page views" />
        <Stat label="Unique visitors" value={summary.unique_visitors} today={summary.unique_visitors_today} note="browser sessions" />
        <Stat label="App downloads" value={summary.app_downloads} today={summary.app_downloads_today} note="APK clicks" />
        <Stat label="App opens" value={summary.app_opens} today={summary.app_opens_today} note="Android sessions" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <TrendChart
          title="Website"
          series={summary.daily}
          aKey="web_visits"
          bKey="unique_visitors"
          aLabel="Visits"
          bLabel="Unique"
        />
        <TrendChart
          title="Android app"
          series={summary.daily}
          aKey="app_downloads"
          bKey="app_opens"
          aLabel="Downloads"
          bLabel="Opens"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <RankList
          title="Top website pages"
          empty="No website visits recorded yet."
          rows={summary.top_paths.map((p) => ({ label: p.path, value: p.visits }))}
        />
        <RankList
          title="Download sources"
          empty="No APK downloads recorded yet."
          rows={summary.download_sources.map((s) => ({ label: s.source.replace(/_/g, ' '), value: s.count }))}
        />
      </div>

      <div>
        <div className="flex items-end justify-between gap-3 mb-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted">Operations</p>
            <h3 className="text-lg font-semibold mt-1">Queues</h3>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {queues.map((card) => (
            <Link key={card.href} href={card.href.startsWith('/') ? card.href : `${queueHrefPrefix}/${card.href}`} className="card p-5 hover:opacity-90">
              <p className="text-sm text-muted">{card.label}</p>
              <p className="text-3xl font-semibold mt-2 tabular-nums">{card.value.toLocaleString()}</p>
              {card.hint ? <p className="text-xs text-muted mt-2">{card.hint}</p> : null}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
