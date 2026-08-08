-- Follows, country, creator public profile, play geo, publish notify

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS country_code text;

COMMENT ON COLUMN public.profiles.country_code IS 'ISO 3166-1 alpha-2, e.g. NG, US';

ALTER TABLE public.creator_profiles
  ADD COLUMN IF NOT EXISTS banner_url text,
  ADD COLUMN IF NOT EXISTS monthly_listeners bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS follower_count bigint NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.creator_follows (
  follower_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, creator_id),
  CHECK (follower_id <> creator_id)
);

CREATE INDEX IF NOT EXISTS creator_follows_creator_idx ON public.creator_follows (creator_id);
CREATE INDEX IF NOT EXISTS creator_follows_follower_idx ON public.creator_follows (follower_id);

ALTER TABLE public.creator_follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone authenticated can read follows" ON public.creator_follows;
CREATE POLICY "Anyone authenticated can read follows"
  ON public.creator_follows FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users follow creators" ON public.creator_follows;
CREATE POLICY "Users follow creators"
  ON public.creator_follows FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = follower_id);

DROP POLICY IF EXISTS "Users unfollow creators" ON public.creator_follows;
CREATE POLICY "Users unfollow creators"
  ON public.creator_follows FOR DELETE
  TO authenticated
  USING (auth.uid() = follower_id);

CREATE OR REPLACE FUNCTION public.sync_creator_follower_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.creator_profiles
      SET follower_count = COALESCE(follower_count, 0) + 1,
          updated_at = now()
    WHERE user_id = NEW.creator_id;
    -- Auto-create creator_profiles row if missing
    IF NOT FOUND THEN
      INSERT INTO public.creator_profiles (user_id, follower_count)
      VALUES (NEW.creator_id, 1)
      ON CONFLICT (user_id) DO UPDATE
        SET follower_count = COALESCE(public.creator_profiles.follower_count, 0) + 1;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.creator_profiles
      SET follower_count = GREATEST(0, COALESCE(follower_count, 0) - 1),
          updated_at = now()
    WHERE user_id = OLD.creator_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_creator_follower_count ON public.creator_follows;
CREATE TRIGGER trg_sync_creator_follower_count
  AFTER INSERT OR DELETE ON public.creator_follows
  FOR EACH ROW EXECUTE FUNCTION public.sync_creator_follower_count();

CREATE TABLE IF NOT EXISTS public.sound_play_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sound_id uuid NOT NULL REFERENCES public.sounds (id) ON DELETE CASCADE,
  creator_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  listener_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  country_code text,
  played_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sound_play_events_creator_played_idx
  ON public.sound_play_events (creator_id, played_at DESC);
CREATE INDEX IF NOT EXISTS sound_play_events_sound_idx
  ON public.sound_play_events (sound_id, played_at DESC);

ALTER TABLE public.sound_play_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Creators read own play events" ON public.sound_play_events;
CREATE POLICY "Creators read own play events"
  ON public.sound_play_events FOR SELECT
  TO authenticated
  USING (
    creator_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.admin_profiles a WHERE a.user_id = auth.uid())
  );

CREATE OR REPLACE FUNCTION public.record_sound_listen(
  p_sound_id uuid,
  p_listened_seconds integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_creator uuid;
  v_country text;
  v_count bigint;
  v_already boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('counted', false, 'reason', 'anonymous');
  END IF;

  SELECT creator_id INTO v_creator FROM public.sounds WHERE id = p_sound_id;
  SELECT country_code INTO v_country FROM public.profiles WHERE id = v_uid;

  SELECT EXISTS (
    SELECT 1 FROM public.sound_play_events e
    WHERE e.sound_id = p_sound_id
      AND e.listener_id = v_uid
      AND e.played_at > now() - interval '45 seconds'
  ) INTO v_already;

  IF NOT v_already AND COALESCE(p_listened_seconds, 0) >= 5 THEN
    UPDATE public.sounds
      SET play_count = play_count + 1,
          updated_at = now()
    WHERE id = p_sound_id
    RETURNING play_count INTO v_count;

    INSERT INTO public.sound_play_events (sound_id, creator_id, listener_id, country_code)
    VALUES (p_sound_id, v_creator, v_uid, v_country);

    RETURN jsonb_build_object('counted', true, 'play_count', v_count);
  END IF;

  SELECT play_count INTO v_count FROM public.sounds WHERE id = p_sound_id;
  RETURN jsonb_build_object('counted', false, 'play_count', v_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_followers_on_publish()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
BEGIN
  IF NEW.status = 'published'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'published')
     AND NEW.creator_id IS NOT NULL THEN
    SELECT COALESCE(cp.display_name, p.display_name, 'A creator')
      INTO v_name
    FROM public.profiles p
    LEFT JOIN public.creator_profiles cp ON cp.user_id = p.id
    WHERE p.id = NEW.creator_id;

    INSERT INTO public.notifications (user_id, title, body, data)
    SELECT
      f.follower_id,
      'New release',
      v_name || ' published "' || NEW.title || '"',
      jsonb_build_object(
        'type', 'new_release',
        'sound_id', NEW.id,
        'creator_id', NEW.creator_id
      )
    FROM public.creator_follows f
    WHERE f.creator_id = NEW.creator_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_followers_on_publish ON public.sounds;
CREATE TRIGGER trg_notify_followers_on_publish
  AFTER INSERT OR UPDATE OF status ON public.sounds
  FOR EACH ROW EXECUTE FUNCTION public.notify_followers_on_publish();

CREATE OR REPLACE FUNCTION public.refresh_creator_monthly_listeners(p_creator_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.creator_profiles cp
  SET monthly_listeners = COALESCE(sub.cnt, 0),
      updated_at = now()
  FROM (
    SELECT e.creator_id, COUNT(DISTINCT e.listener_id)::bigint AS cnt
    FROM public.sound_play_events e
    WHERE e.played_at > now() - interval '30 days'
      AND e.creator_id IS NOT NULL
      AND (p_creator_id IS NULL OR e.creator_id = p_creator_id)
    GROUP BY e.creator_id
  ) sub
  WHERE cp.user_id = sub.creator_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.creator_profile_analytics(p_creator_id uuid DEFAULT auth.uid())
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := COALESCE(p_creator_id, auth.uid());
  v_result jsonb;
  v_is_owner boolean;
BEGIN
  IF v_uid IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;

  v_is_owner := auth.uid() = v_uid
    OR EXISTS (SELECT 1 FROM public.admin_profiles a WHERE a.user_id = auth.uid());

  IF NOT v_is_owner THEN
    SELECT jsonb_build_object(
      'follower_count', COALESCE(cp.follower_count, 0),
      'monthly_listeners', COALESCE(cp.monthly_listeners, 0),
      'published_sounds', (
        SELECT COUNT(*) FROM public.sounds s
        WHERE s.creator_id = v_uid AND s.status = 'published'
      ),
      'total_plays', (
        SELECT COALESCE(SUM(s.play_count), 0) FROM public.sounds s
        WHERE s.creator_id = v_uid AND s.status = 'published'
      ),
      'total_likes', (
        SELECT COUNT(*) FROM public.favourites f
        JOIN public.sounds s ON s.id = f.sound_id
        WHERE s.creator_id = v_uid
      )
    )
    INTO v_result
    FROM public.creator_profiles cp
    WHERE cp.user_id = v_uid;

    RETURN COALESCE(v_result, '{}'::jsonb);
  END IF;

  SELECT jsonb_build_object(
    'follower_count', COALESCE(cp.follower_count, 0),
    'new_followers_7d', (
      SELECT COUNT(*) FROM public.creator_follows f
      WHERE f.creator_id = v_uid AND f.created_at > now() - interval '7 days'
    ),
    'monthly_listeners', COALESCE(cp.monthly_listeners, 0),
    'published_sounds', (
      SELECT COUNT(*) FROM public.sounds s
      WHERE s.creator_id = v_uid AND s.status = 'published'
    ),
    'total_plays', (
      SELECT COALESCE(SUM(s.play_count), 0) FROM public.sounds s
      WHERE s.creator_id = v_uid AND s.status = 'published'
    ),
    'plays_7d', (
      SELECT COUNT(*) FROM public.sound_play_events e
      WHERE e.creator_id = v_uid AND e.played_at > now() - interval '7 days'
    ),
    'total_likes', (
      SELECT COUNT(*) FROM public.favourites f
      JOIN public.sounds s ON s.id = f.sound_id
      WHERE s.creator_id = v_uid
    ),
    'new_likes_7d', (
      SELECT COUNT(*) FROM public.favourites f
      JOIN public.sounds s ON s.id = f.sound_id
      WHERE s.creator_id = v_uid AND f.created_at > now() - interval '7 days'
    ),
    'total_saves', (
      SELECT COUNT(*) FROM public.playlist_items pi
      JOIN public.sounds s ON s.id = pi.sound_id
      WHERE s.creator_id = v_uid
    ),
    'top_countries', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
      FROM (
        SELECT COALESCE(NULLIF(e.country_code, ''), 'XX') AS country_code,
               COUNT(*)::bigint AS plays
        FROM public.sound_play_events e
        WHERE e.creator_id = v_uid
        GROUP BY 1
        ORDER BY plays DESC
        LIMIT 8
      ) t
    ),
    'sounds', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
      FROM (
        SELECT s.id, s.title, s.cover_url, s.play_count, s.status, s.created_at,
          (SELECT COUNT(*) FROM public.favourites f WHERE f.sound_id = s.id) AS likes,
          (SELECT COUNT(*) FROM public.playlist_items pi WHERE pi.sound_id = s.id) AS saves
        FROM public.sounds s
        WHERE s.creator_id = v_uid
        ORDER BY s.created_at DESC
        LIMIT 40
      ) t
    )
  )
  INTO v_result
  FROM public.creator_profiles cp
  WHERE cp.user_id = v_uid;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_creator_public_profile(p_creator_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v jsonb;
BEGIN
  PERFORM public.refresh_creator_monthly_listeners(p_creator_id);

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
  JOIN public.creator_profiles cp ON cp.user_id = p.id
  WHERE p.id = p_creator_id
    AND p.role IN ('creator', 'admin');

  RETURN v;
END;
$$;

-- Backfill follower counts
UPDATE public.creator_profiles cp
SET follower_count = COALESCE((
  SELECT COUNT(*) FROM public.creator_follows f WHERE f.creator_id = cp.user_id
), 0);

-- Save country from signup metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  meta_name text;
  requested text;
  final_role public.user_role;
  is_super boolean;
  display text;
  welcome_body text;
  country text;
begin
  meta_name := nullif(trim(coalesce(NEW.raw_user_meta_data->>'display_name', '')), '');
  country := nullif(upper(trim(coalesce(NEW.raw_user_meta_data->>'country_code', ''))), '');
  is_super := lower(coalesce(NEW.email, '')) = 'quoreebadebayo@gmail.com';

  if is_super then
    final_role := 'admin'::public.user_role;
  else
    requested := lower(coalesce(NEW.raw_user_meta_data->>'role', 'listener'));
    if requested = 'creator' then
      final_role := 'creator'::public.user_role;
    else
      final_role := 'listener'::public.user_role;
    end if;
  end if;

  display := coalesce(meta_name, split_part(coalesce(NEW.email, 'user'), '@', 1));

  insert into public.profiles (id, display_name, role, country_code)
  values (NEW.id, display, final_role, country)
  on conflict (id) do update
    set
      display_name = coalesce(excluded.display_name, public.profiles.display_name),
      country_code = coalesce(excluded.country_code, public.profiles.country_code),
      role = case
        when is_super then 'admin'::public.user_role
        else public.profiles.role
      end;

  if final_role = 'creator' then
    insert into public.creator_profiles (user_id)
    values (NEW.id)
    on conflict (user_id) do nothing;
  end if;

  if is_super then
    insert into public.admin_profiles (user_id, role)
    values (NEW.id, 'super'::public.admin_role)
    on conflict (user_id) do update set role = 'super'::public.admin_role;
  end if;

  if final_role = 'creator' then
    welcome_body := format(
      'Hi %s — welcome to X-Relax. Upload calming sounds, grow your audience, and earn from the Premium pool.',
      display
    );
  elsif is_super then
    welcome_body := format(
      'Hi %s — your Super Admin account is ready. Use the admin web dashboard to run payments, moderation, and announcements.',
      display
    );
  else
    welcome_body := format(
      'Hi %s — breathe easy. Explore calming sounds, save favourites, and unlock Premium anytime for downloads, mixes, and an ad-free experience.',
      display
    );
  end if;

  insert into public.notifications (user_id, title, body, data)
  values (
    NEW.id,
    'Welcome to X-Relax',
    welcome_body,
    jsonb_build_object('type', 'welcome', 'role', final_role::text)
  );

  return NEW;
end;
$function$;
