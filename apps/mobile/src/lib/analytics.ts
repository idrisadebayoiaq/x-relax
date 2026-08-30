import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const SESSION_KEY = 'xrelax.analytics.sid';

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

async function getSessionId(): Promise<string> {
  const existing = await AsyncStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const next = `m-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  await AsyncStorage.setItem(SESSION_KEY, next);
  return next;
}

export async function recordAppOpen(): Promise<void> {
  try {
    const sessionId = await getSessionId();
    await supabase.rpc('record_analytics_event', {
      p_event_type: 'app_open',
      p_path: 'app://open',
      p_referrer: null,
      p_source: 'android_app',
      p_platform: 'android',
      p_session_id: sessionId,
    });
  } catch {
    /* ignore */
  }
}

export async function fetchAdminAnalytics(days = 30): Promise<AnalyticsSummary> {
  const { data, error } = await supabase.rpc('admin_analytics_summary', { p_days: days });
  if (error) return emptyAnalyticsSummary(days);
  return parseAnalyticsSummary(data, days);
}
