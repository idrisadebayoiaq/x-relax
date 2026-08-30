-- First-party analytics: web visits, APK downloads, and app opens.
-- No advertising IDs. Clients insert only via record_analytics_event.

CREATE TABLE IF NOT EXISTS public.analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL CHECK (event_type IN ('web_visit', 'app_download', 'app_open')),
  path text,
  referrer text,
  source text,
  platform text,
  session_id text,
  user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS analytics_events_type_created_idx
  ON public.analytics_events (event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS analytics_events_session_created_idx
  ON public.analytics_events (session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS analytics_events_path_idx
  ON public.analytics_events (path, created_at DESC)
  WHERE event_type = 'web_visit';

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read analytics" ON public.analytics_events;
CREATE POLICY "Admins read analytics"
  ON public.analytics_events FOR SELECT
  TO authenticated
  USING (public.is_admin());

REVOKE INSERT, UPDATE, DELETE ON public.analytics_events FROM anon, authenticated;
GRANT SELECT ON public.analytics_events TO authenticated;

CREATE OR REPLACE FUNCTION public.record_analytics_event(
  p_event_type text,
  p_path text DEFAULT NULL,
  p_referrer text DEFAULT NULL,
  p_source text DEFAULT NULL,
  p_platform text DEFAULT NULL,
  p_session_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  kind text := lower(trim(coalesce(p_event_type, '')));
  sid text := nullif(left(trim(coalesce(p_session_id, '')), 80), '');
  clean_path text := nullif(left(trim(coalesce(p_path, '')), 240), '');
  clean_ref text := nullif(left(trim(coalesce(p_referrer, '')), 240), '');
  clean_source text := nullif(left(trim(coalesce(p_source, '')), 64), '');
  clean_platform text := nullif(left(trim(coalesce(p_platform, '')), 32), '');
  recent_count integer;
  duplicate boolean := false;
BEGIN
  IF kind NOT IN ('web_visit', 'app_download', 'app_open') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_type');
  END IF;

  IF sid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'session_required');
  END IF;

  SELECT COUNT(*) INTO recent_count
  FROM public.analytics_events e
  WHERE e.session_id = sid
    AND e.created_at > now() - interval '1 hour';

  IF recent_count >= 80 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'rate_limited');
  END IF;

  IF kind = 'web_visit' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.analytics_events e
      WHERE e.session_id = sid
        AND e.event_type = 'web_visit'
        AND coalesce(e.path, '') = coalesce(clean_path, '')
        AND e.created_at > now() - interval '30 minutes'
    ) INTO duplicate;
  ELSIF kind = 'app_open' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.analytics_events e
      WHERE e.session_id = sid
        AND e.event_type = 'app_open'
        AND e.created_at > now() - interval '6 hours'
    ) INTO duplicate;
  ELSIF kind = 'app_download' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.analytics_events e
      WHERE e.session_id = sid
        AND e.event_type = 'app_download'
        AND coalesce(e.source, '') = coalesce(clean_source, '')
        AND e.created_at > now() - interval '2 minutes'
    ) INTO duplicate;
  END IF;

  IF duplicate THEN
    RETURN jsonb_build_object('ok', true, 'deduped', true);
  END IF;

  INSERT INTO public.analytics_events (
    event_type, path, referrer, source, platform, session_id, user_id
  ) VALUES (
    kind,
    clean_path,
    clean_ref,
    clean_source,
    clean_platform,
    sid,
    auth.uid()
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_analytics_event(text, text, text, text, text, text)
  TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_analytics_summary(p_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  days integer := GREATEST(1, LEAST(COALESCE(p_days, 30), 90));
  since date := (CURRENT_DATE - (days - 1));
  result jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  WITH bounds AS (
    SELECT since AS start_day, CURRENT_DATE AS end_day
  ),
  scoped AS (
    SELECT *
    FROM public.analytics_events e
    WHERE e.created_at::date >= since
  ),
  days_series AS (
    SELECT generate_series(since, CURRENT_DATE, interval '1 day')::date AS day
  ),
  daily AS (
    SELECT
      d.day,
      COUNT(*) FILTER (WHERE s.event_type = 'web_visit')::int AS web_visits,
      COUNT(DISTINCT s.session_id) FILTER (WHERE s.event_type = 'web_visit')::int AS unique_visitors,
      COUNT(*) FILTER (WHERE s.event_type = 'app_download')::int AS app_downloads,
      COUNT(*) FILTER (WHERE s.event_type = 'app_open')::int AS app_opens
    FROM days_series d
    LEFT JOIN scoped s ON s.created_at::date = d.day
    GROUP BY d.day
  ),
  top_paths AS (
    SELECT coalesce(nullif(s.path, ''), '/') AS path, COUNT(*)::int AS visits
    FROM scoped s
    WHERE s.event_type = 'web_visit'
    GROUP BY 1
    ORDER BY visits DESC, path
    LIMIT 8
  ),
  download_sources AS (
    SELECT coalesce(nullif(s.source, ''), 'unknown') AS source, COUNT(*)::int AS count
    FROM scoped s
    WHERE s.event_type = 'app_download'
    GROUP BY 1
    ORDER BY count DESC, source
    LIMIT 8
  )
  SELECT jsonb_build_object(
    'period_days', days,
    'web_visits', (SELECT COUNT(*) FROM scoped WHERE event_type = 'web_visit'),
    'unique_visitors', (SELECT COUNT(DISTINCT session_id) FROM scoped WHERE event_type = 'web_visit'),
    'app_downloads', (SELECT COUNT(*) FROM scoped WHERE event_type = 'app_download'),
    'app_opens', (SELECT COUNT(*) FROM scoped WHERE event_type = 'app_open'),
    'web_visits_today', (SELECT COUNT(*) FROM scoped WHERE event_type = 'web_visit' AND created_at::date = CURRENT_DATE),
    'unique_visitors_today', (SELECT COUNT(DISTINCT session_id) FROM scoped WHERE event_type = 'web_visit' AND created_at::date = CURRENT_DATE),
    'app_downloads_today', (SELECT COUNT(*) FROM scoped WHERE event_type = 'app_download' AND created_at::date = CURRENT_DATE),
    'app_opens_today', (SELECT COUNT(*) FROM scoped WHERE event_type = 'app_open' AND created_at::date = CURRENT_DATE),
    'daily', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'day', to_char(d.day, 'YYYY-MM-DD'),
        'web_visits', d.web_visits,
        'unique_visitors', d.unique_visitors,
        'app_downloads', d.app_downloads,
        'app_opens', d.app_opens
      ) ORDER BY d.day)
      FROM daily d
    ), '[]'::jsonb),
    'top_paths', coalesce((
      SELECT jsonb_agg(jsonb_build_object('path', t.path, 'visits', t.visits) ORDER BY t.visits DESC)
      FROM top_paths t
    ), '[]'::jsonb),
    'download_sources', coalesce((
      SELECT jsonb_agg(jsonb_build_object('source', s.source, 'count', s.count) ORDER BY s.count DESC)
      FROM download_sources s
    ), '[]'::jsonb)
  )
  INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_analytics_summary(integer) TO authenticated;
