import { createClient } from '@/lib/supabase/client';

export type AnalyticsEventType = 'web_visit' | 'app_download' | 'app_open';

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

const SESSION_KEY = 'xrelax.analytics.sid';

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

export function getAnalyticsSessionId(): string {
  if (typeof window === 'undefined') return '';
  try {
    const existing = window.localStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const next = crypto.randomUUID();
    window.localStorage.setItem(SESSION_KEY, next);
    return next;
  } catch {
    return `anon-${Date.now()}`;
  }
}

export async function recordAnalyticsEvent(input: {
  eventType: AnalyticsEventType;
  path?: string;
  referrer?: string;
  source?: string;
  platform?: string;
}): Promise<void> {
  const sessionId = getAnalyticsSessionId();
  if (!sessionId) return;
  try {
    await createClient().rpc('record_analytics_event', {
      p_event_type: input.eventType,
      p_path: input.path ?? null,
      p_referrer: input.referrer ?? null,
      p_source: input.source ?? null,
      p_platform: input.platform ?? 'web',
      p_session_id: sessionId,
    });
  } catch {
    /* ignore analytics failures */
  }
}

export async function fetchAdminAnalytics(days = 30): Promise<AnalyticsSummary> {
  const { data, error } = await createClient().rpc('admin_analytics_summary', { p_days: days });
  if (error) return emptyAnalyticsSummary(days);
  return parseAnalyticsSummary(data, days);
}
