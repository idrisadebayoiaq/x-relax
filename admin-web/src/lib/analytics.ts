export type AnalyticsDay = {
  day: string;
  web_visits: number;
  unique_visitors: number;
  app_downloads: number;
  app_opens: number;
};

export type AnalyticsSummary = {
  period_days: number;
  web_visits: number;
  unique_visitors: number;
  app_downloads: number;
  app_opens: number;
  web_visits_today: number;
  unique_visitors_today: number;
  app_downloads_today: number;
  app_opens_today: number;
  daily: AnalyticsDay[];
  top_paths: { path: string; visits: number }[];
  download_sources: { source: string; count: number }[];
};

export function emptyAnalyticsSummary(days = 30): AnalyticsSummary {
  return {
    period_days: days,
    web_visits: 0,
    unique_visitors: 0,
    app_downloads: 0,
    app_opens: 0,
    web_visits_today: 0,
    unique_visitors_today: 0,
    app_downloads_today: 0,
    app_opens_today: 0,
    daily: [],
    top_paths: [],
    download_sources: [],
  };
}

export function parseAnalyticsSummary(raw: unknown, days = 30): AnalyticsSummary {
  const empty = emptyAnalyticsSummary(days);
  if (!raw || typeof raw !== 'object') return empty;
  const row = raw as Partial<AnalyticsSummary>;
  return {
    ...empty,
    ...row,
    daily: Array.isArray(row.daily) ? row.daily : [],
    top_paths: Array.isArray(row.top_paths) ? row.top_paths : [],
    download_sources: Array.isArray(row.download_sources) ? row.download_sources : [],
  };
}

export type QueueStat = {
  href: string;
  label: string;
  value: number;
  hint?: string;
};
