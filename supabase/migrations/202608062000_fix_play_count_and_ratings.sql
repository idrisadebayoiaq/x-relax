-- Lower play-count threshold to 5s and return jsonb for client sync.
-- Harden rating aggregate refresh.

DROP FUNCTION IF EXISTS public.record_sound_listen(uuid, integer);

CREATE FUNCTION public.record_sound_listen(p_sound_id uuid, p_listened_seconds integer DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_count integer;
BEGIN
  IF p_listened_seconds < 5 THEN
    SELECT play_count INTO new_count FROM public.sounds WHERE id = p_sound_id;
    RETURN jsonb_build_object('counted', false, 'play_count', COALESCE(new_count, 0));
  END IF;

  UPDATE public.sounds
  SET play_count = play_count + 1,
      updated_at = now()
  WHERE id = p_sound_id AND status = 'published'
  RETURNING play_count INTO new_count;

  RETURN jsonb_build_object('counted', new_count IS NOT NULL, 'play_count', COALESCE(new_count, 0));
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_sound_listen(uuid, integer) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.refresh_sound_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  sid uuid;
BEGIN
  sid := COALESCE(NEW.sound_id, OLD.sound_id);
  UPDATE public.sounds s
  SET
    average_rating = sub.avg_score,
    rating_count = sub.cnt,
    updated_at = now()
  FROM (
    SELECT COALESCE(AVG(score)::numeric(3,2), NULL) AS avg_score,
           COUNT(*)::int AS cnt
    FROM public.ratings
    WHERE sound_id = sid
  ) sub
  WHERE s.id = sid;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS ratings_refresh_sound ON public.ratings;
CREATE TRIGGER ratings_refresh_sound
AFTER INSERT OR DELETE OR UPDATE ON public.ratings
FOR EACH ROW EXECUTE FUNCTION public.refresh_sound_rating();
