-- Add 1000 likes requirement for Apply to Earn

CREATE OR REPLACE FUNCTION public.get_creator_earn_requirements()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  pub_count int := 0;
  plays bigint := 0;
  likes_count bigint := 0;
  avg_rating numeric := 0;
  bio_ok boolean := false;
  bio_len int := 0;
  min_sounds int := 20;
  min_plays int := 5000;
  min_likes int := 1000;
  min_rating numeric := 4.5;
  settings jsonb;
  latest_status text;
  eligible boolean;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.creator_profiles WHERE user_id = uid) THEN
    RAISE EXCEPTION 'Creator profile required';
  END IF;

  SELECT value INTO settings FROM public.app_settings WHERE key = 'creator_settings';
  IF settings IS NOT NULL THEN
    min_sounds := COALESCE((settings->'verification'->>'min_sounds')::int, (settings->>'verification_min_sounds')::int, 20);
    min_plays := COALESCE((settings->'verification'->>'min_plays')::int, (settings->>'verification_min_plays')::int, 5000);
    min_likes := COALESCE((settings->'verification'->>'min_likes')::int, (settings->>'verification_min_likes')::int, 1000);
    min_rating := COALESCE((settings->'verification'->>'min_rating')::numeric, (settings->>'verification_min_rating')::numeric, 4.5);
  END IF;

  SELECT COUNT(*) INTO pub_count FROM public.sounds WHERE creator_id = uid AND status = 'published';
  SELECT COALESCE(SUM(play_count), 0) INTO plays FROM public.sounds WHERE creator_id = uid AND status = 'published';
  SELECT COUNT(*) INTO likes_count
  FROM public.favourites f
  JOIN public.sounds s ON s.id = f.sound_id
  WHERE s.creator_id = uid;
  SELECT COALESCE(AVG(average_rating), 0) INTO avg_rating
  FROM public.sounds
  WHERE creator_id = uid AND status = 'published' AND average_rating IS NOT NULL;
  SELECT COALESCE(length(trim(bio)), 0), COALESCE(length(trim(bio)) > 10, false)
  INTO bio_len, bio_ok
  FROM public.creator_profiles WHERE user_id = uid;

  SELECT status INTO latest_status
  FROM public.creator_verifications
  WHERE user_id = uid
  ORDER BY created_at DESC
  LIMIT 1;

  eligible := pub_count >= min_sounds
    AND plays >= min_plays
    AND likes_count >= min_likes
    AND avg_rating >= min_rating
    AND bio_ok;

  RETURN jsonb_build_object(
    'eligible', eligible,
    'can_earn', COALESCE((SELECT can_earn FROM public.creator_profiles WHERE user_id = uid), false),
    'is_verified', COALESCE((SELECT is_verified FROM public.creator_profiles WHERE user_id = uid), false),
    'has_blue_badge', COALESCE((SELECT has_blue_badge FROM public.creator_profiles WHERE user_id = uid), false),
    'latest_status', latest_status,
    'requirements', jsonb_build_array(
      jsonb_build_object(
        'key', 'sounds',
        'label', format('Publish at least %s sounds', min_sounds),
        'required', min_sounds,
        'current', pub_count,
        'met', pub_count >= min_sounds
      ),
      jsonb_build_object(
        'key', 'plays',
        'label', format('Reach at least %s total plays', min_plays),
        'required', min_plays,
        'current', plays,
        'met', plays >= min_plays
      ),
      jsonb_build_object(
        'key', 'likes',
        'label', format('Earn at least %s likes across your sounds', min_likes),
        'required', min_likes,
        'current', likes_count,
        'met', likes_count >= min_likes
      ),
      jsonb_build_object(
        'key', 'rating',
        'label', format('Maintain average rating of %s+', min_rating),
        'required', min_rating,
        'current', round(avg_rating, 2),
        'met', avg_rating >= min_rating
      ),
      jsonb_build_object(
        'key', 'bio',
        'label', 'Complete creator bio (more than 10 characters)',
        'required', 11,
        'current', bio_len,
        'met', bio_ok
      ),
      jsonb_build_object(
        'key', 'identity',
        'label', 'Verify identity with National ID, Voters ID, Driver license, or other government ID',
        'required', 1,
        'current', CASE WHEN latest_status IN ('pending', 'approved') THEN 1 ELSE 0 END,
        'met', latest_status IN ('pending', 'approved')
      )
    )
  );
END;
$$;
