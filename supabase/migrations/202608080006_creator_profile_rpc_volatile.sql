CREATE OR REPLACE FUNCTION public.get_creator_public_profile(p_creator_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v jsonb;
BEGIN
  PERFORM public.refresh_creator_monthly_listeners(p_creator_id);

  INSERT INTO public.creator_profiles (user_id)
  SELECT p_creator_id
  WHERE EXISTS (
    SELECT 1 FROM public.sounds s
    WHERE s.creator_id = p_creator_id AND s.status = 'published'
  )
  ON CONFLICT (user_id) DO NOTHING;

  SELECT jsonb_build_object(
    'id', p.id,
    'display_name', COALESCE(cp.display_name, p.display_name),
    'avatar_url', p.avatar_url,
    'banner_url', cp.banner_url,
    'bio', cp.bio,
    'is_verified', COALESCE(cp.is_verified, false) OR COALESCE(cp.has_blue_badge, false),
    'country_code', p.country_code,
    'follower_count', COALESCE(cp.follower_count, 0),
    'monthly_listeners', COALESCE(cp.monthly_listeners, 0),
    'is_following', EXISTS (
      SELECT 1 FROM public.creator_follows f
      WHERE f.creator_id = p.id AND f.follower_id = auth.uid()
    )
  )
  INTO v
  FROM public.profiles p
  LEFT JOIN public.creator_profiles cp ON cp.user_id = p.id
  WHERE p.id = p_creator_id
    AND (
      p.role IN ('creator', 'admin')
      OR cp.user_id IS NOT NULL
      OR EXISTS (
        SELECT 1 FROM public.sounds s
        WHERE s.creator_id = p.id AND s.status = 'published'
      )
    );

  RETURN v;
END;
$$;
