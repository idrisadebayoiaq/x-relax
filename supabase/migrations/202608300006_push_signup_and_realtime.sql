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
  push_on boolean;
begin
  meta_name := nullif(trim(coalesce(NEW.raw_user_meta_data->>'display_name', '')), '');
  country := nullif(upper(trim(coalesce(NEW.raw_user_meta_data->>'country_code', ''))), '');
  is_super := lower(coalesce(NEW.email, '')) = 'quoreebadebayo@gmail.com';
  push_on := coalesce((NEW.raw_user_meta_data->>'push_enabled')::boolean, true);

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

  insert into public.profiles (id, display_name, role, country_code, push_enabled)
  values (NEW.id, display, final_role, country, push_on)
  on conflict (id) do update
    set
      display_name = coalesce(excluded.display_name, public.profiles.display_name),
      country_code = coalesce(excluded.country_code, public.profiles.country_code),
      push_enabled = excluded.push_enabled,
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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;
