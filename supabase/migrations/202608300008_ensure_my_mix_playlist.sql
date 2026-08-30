-- One "My Mix" playlist per user; consolidate existing duplicates.

DO $$
DECLARE
  rec RECORD;
  keeper_id uuid;
BEGIN
  FOR rec IN
    SELECT user_id
    FROM public.playlists
    WHERE title = 'My Mix'
    GROUP BY user_id
    HAVING COUNT(*) > 1
  LOOP
    SELECT id INTO keeper_id
    FROM public.playlists
    WHERE user_id = rec.user_id AND title = 'My Mix'
    ORDER BY created_at ASC
    LIMIT 1;

    INSERT INTO public.playlist_items (playlist_id, sound_id, position)
    SELECT keeper_id, pi.sound_id, pi.position + 10000
    FROM public.playlist_items pi
    JOIN public.playlists p ON p.id = pi.playlist_id
    WHERE p.user_id = rec.user_id AND p.title = 'My Mix' AND p.id <> keeper_id
    ON CONFLICT (playlist_id, sound_id) DO NOTHING;

    DELETE FROM public.playlist_items pi
    USING public.playlists p
    WHERE pi.playlist_id = p.id
      AND p.user_id = rec.user_id
      AND p.title = 'My Mix'
      AND p.id <> keeper_id;

    DELETE FROM public.playlists
    WHERE user_id = rec.user_id AND title = 'My Mix' AND id <> keeper_id;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS playlists_user_my_mix_unique_idx
  ON public.playlists (user_id)
  WHERE title = 'My Mix';

CREATE OR REPLACE FUNCTION public.ensure_my_mix_playlist()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  pid uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id INTO pid
  FROM public.playlists
  WHERE user_id = uid AND title = 'My Mix'
  ORDER BY created_at ASC
  LIMIT 1;

  IF pid IS NOT NULL THEN
    RETURN pid;
  END IF;

  BEGIN
    INSERT INTO public.playlists (user_id, title)
    VALUES (uid, 'My Mix')
    RETURNING id INTO pid;
  EXCEPTION
    WHEN unique_violation THEN
      SELECT id INTO pid
      FROM public.playlists
      WHERE user_id = uid AND title = 'My Mix'
      ORDER BY created_at ASC
      LIMIT 1;
  END;

  RETURN pid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_my_mix_playlist() TO authenticated;
