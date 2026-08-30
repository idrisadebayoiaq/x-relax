-- Hourly heartbeat so the project does not look idle.
-- pg_cron keeps the database warm while it is running.
-- External callers (Edge Function / GitHub Action / /api/keep-alive) also hit this RPC.

CREATE TABLE IF NOT EXISTS public.keep_alive_heartbeats (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  last_ping_at timestamptz NOT NULL DEFAULT now(),
  ping_count bigint NOT NULL DEFAULT 0,
  last_source text
);

INSERT INTO public.keep_alive_heartbeats (id, last_ping_at, ping_count, last_source)
VALUES (1, now(), 0, 'bootstrap')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.keep_alive_heartbeats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read keep-alive" ON public.keep_alive_heartbeats;
CREATE POLICY "Anyone can read keep-alive"
  ON public.keep_alive_heartbeats FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE OR REPLACE FUNCTION public.supabase_keep_alive(p_source text DEFAULT 'rpc')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  src text := left(coalesce(nullif(trim(p_source), ''), 'rpc'), 64);
  row public.keep_alive_heartbeats;
BEGIN
  INSERT INTO public.keep_alive_heartbeats (id, last_ping_at, ping_count, last_source)
  VALUES (1, now(), 1, src)
  ON CONFLICT (id) DO UPDATE
    SET last_ping_at = now(),
        ping_count = public.keep_alive_heartbeats.ping_count + 1,
        last_source = excluded.last_source
  RETURNING * INTO row;

  RETURN jsonb_build_object(
    'ok', true,
    'last_ping_at', row.last_ping_at,
    'ping_count', row.ping_count,
    'source', row.last_source
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.supabase_keep_alive(text) TO anon, authenticated;

CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  PERFORM cron.unschedule(jobid)
  FROM cron.job
  WHERE jobname = 'xrelax-hourly-keep-alive';
EXCEPTION
  WHEN undefined_table OR undefined_function THEN
    NULL;
END
$$;

SELECT cron.schedule(
  'xrelax-hourly-keep-alive',
  '0 * * * *',
  $$SELECT public.supabase_keep_alive('pg_cron');$$
);
