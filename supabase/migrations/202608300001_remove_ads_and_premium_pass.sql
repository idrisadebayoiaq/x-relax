-- Remove AdMob / Premium Pass entitlements.
-- Free users no longer earn Premium from ads. Paid subscriptions only.

DROP FUNCTION IF EXISTS public.claim_premium_pass();

CREATE OR REPLACE FUNCTION public.user_has_premium(uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = uid AND p.premium_status = 'subscribed'
  )
  OR EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.user_id = uid AND s.status = 'active'
      AND (s.is_lifetime OR s.ends_at IS NULL OR s.ends_at > now())
  );
$function$;

CREATE OR REPLACE FUNCTION public.refresh_profile_premium_status(uid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  has_sub boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.user_id = uid AND s.status = 'active'
      AND (s.is_lifetime OR s.ends_at IS NULL OR s.ends_at > now())
  ) INTO has_sub;

  UPDATE public.profiles
  SET premium_status = CASE
    WHEN has_sub THEN 'subscribed'::public.premium_status
    ELSE 'none'::public.premium_status
  END
  WHERE id = uid;
END;
$function$;

UPDATE public.premium_passes
SET ends_at = now()
WHERE ends_at > now();

UPDATE public.profiles p
SET premium_status = 'none'
WHERE p.premium_status = 'pass'
  AND NOT EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.user_id = p.id AND s.status = 'active'
      AND (s.is_lifetime OR s.ends_at IS NULL OR s.ends_at > now())
  );

UPDATE public.app_settings
SET
  value = (value - 'ads_enabled' - 'premium_pass_ads_required'),
  updated_at = now()
WHERE key = 'feature_flags';

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
      'Hi %s — welcome to X-Relax. Upload calming sounds, grow your audience, and earn from the Premium pool. Premium listeners get unlimited listening, loop, Sleep Time, downloads, and Mix Studio.',
      display
    );
  elsif is_super then
    welcome_body := format(
      'Hi %s — your Super Admin account is ready. Use the admin web dashboard to run payments, moderation, and announcements.',
      display
    );
  else
    welcome_body := format(
      'Hi %s — breathe easy. Explore calming sounds and save favourites. Free accounts unlock 7 sounds a day. Upgrade to Premium anytime for unlimited listening, loop, Sleep Time, downloads, and Mix Studio.',
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
