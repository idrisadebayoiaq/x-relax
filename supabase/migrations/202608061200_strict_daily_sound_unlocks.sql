-- Strict free-tier daily unlocks: 7 unique sounds/day (unlimited replays of those 7).
-- Premium + admin: unlimited listening.

CREATE TABLE IF NOT EXISTS public.daily_sound_unlocks (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  sound_id uuid NOT NULL REFERENCES public.sounds (id) ON DELETE CASCADE,
  play_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, play_date, sound_id)
);

CREATE INDEX IF NOT EXISTS daily_sound_unlocks_user_date_idx
  ON public.daily_sound_unlocks (user_id, play_date);

ALTER TABLE public.daily_sound_unlocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Own daily unlocks select" ON public.daily_sound_unlocks;
CREATE POLICY "Own daily unlocks select"
  ON public.daily_sound_unlocks FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Inserts only via security definer RPC (no direct client insert).
REVOKE INSERT, UPDATE, DELETE ON public.daily_sound_unlocks FROM authenticated, anon;
GRANT SELECT ON public.daily_sound_unlocks TO authenticated;

CREATE OR REPLACE FUNCTION public.user_has_unlimited_listening(uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.user_has_premium(uid), false)
    OR EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.user_id = uid)
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = uid AND p.role = 'admin');
$$;

GRANT EXECUTE ON FUNCTION public.user_has_unlimited_listening(uuid) TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.claim_daily_sound_play(
  p_sound_id uuid,
  p_play_date date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  unlocked_count integer;
  already boolean;
  limit_n integer := 7;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'auth_required',
      'remaining', 0,
      'played', 0,
      'limit', limit_n
    );
  END IF;

  IF public.user_has_unlimited_listening(uid) THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'unlimited', true,
      'remaining', null,
      'played', 0,
      'limit', limit_n
    );
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.daily_sound_unlocks d
    WHERE d.user_id = uid
      AND d.sound_id = p_sound_id
      AND d.play_date = p_play_date
  ) INTO already;

  SELECT count(*)::integer INTO unlocked_count
  FROM public.daily_sound_unlocks d
  WHERE d.user_id = uid AND d.play_date = p_play_date;

  IF already THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'replay', true,
      'remaining', greatest(0, limit_n - unlocked_count),
      'played', unlocked_count,
      'limit', limit_n
    );
  END IF;

  IF unlocked_count >= limit_n THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'daily_limit',
      'remaining', 0,
      'played', unlocked_count,
      'limit', limit_n
    );
  END IF;

  INSERT INTO public.daily_sound_unlocks (user_id, sound_id, play_date)
  VALUES (uid, p_sound_id, p_play_date)
  ON CONFLICT DO NOTHING;

  SELECT count(*)::integer INTO unlocked_count
  FROM public.daily_sound_unlocks d
  WHERE d.user_id = uid AND d.play_date = p_play_date;

  RETURN jsonb_build_object(
    'allowed', true,
    'new', true,
    'remaining', greatest(0, limit_n - unlocked_count),
    'played', unlocked_count,
    'limit', limit_n
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_daily_sound_play(uuid, date) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_daily_sound_play_status(
  p_play_date date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  unlocked_count integer;
  ids uuid[];
  limit_n integer := 7;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object(
      'unlimited', false,
      'played', 0,
      'remaining', limit_n,
      'limit', limit_n,
      'sound_ids', '[]'::jsonb
    );
  END IF;

  IF public.user_has_unlimited_listening(uid) THEN
    RETURN jsonb_build_object(
      'unlimited', true,
      'played', 0,
      'remaining', null,
      'limit', limit_n,
      'sound_ids', '[]'::jsonb
    );
  END IF;

  SELECT coalesce(array_agg(d.sound_id), '{}'::uuid[]), count(*)::integer
  INTO ids, unlocked_count
  FROM public.daily_sound_unlocks d
  WHERE d.user_id = uid AND d.play_date = p_play_date;

  RETURN jsonb_build_object(
    'unlimited', false,
    'played', unlocked_count,
    'remaining', greatest(0, limit_n - unlocked_count),
    'limit', limit_n,
    'sound_ids', to_jsonb(ids)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_daily_sound_play_status(date) TO authenticated;

-- Seed today's unlocks from existing listening history so mid-day users keep their slots.
INSERT INTO public.daily_sound_unlocks (user_id, sound_id, play_date)
SELECT DISTINCT
  lh.user_id,
  lh.sound_id,
  ((lh.played_at AT TIME ZONE 'UTC')::date)
FROM public.listening_history lh
WHERE lh.played_at >= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date - 1
ON CONFLICT DO NOTHING;
