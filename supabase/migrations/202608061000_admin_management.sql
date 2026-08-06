-- Super-admin RPCs to manage admin team + ensure super admin email on signup

CREATE OR REPLACE FUNCTION public.admin_list_admins()
RETURNS TABLE (
  user_id uuid,
  email text,
  display_name text,
  admin_role public.admin_role,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Super admin only';
  END IF;

  RETURN QUERY
  SELECT
    ap.user_id,
    u.email::text,
    p.display_name,
    ap.role,
    ap.created_at
  FROM public.admin_profiles ap
  JOIN auth.users u ON u.id = ap.user_id
  LEFT JOIN public.profiles p ON p.id = ap.user_id
  ORDER BY ap.created_at ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_add_admin(
  p_email text,
  p_role public.admin_role DEFAULT 'support'::public.admin_role
)
RETURNS public.admin_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_id uuid;
  row public.admin_profiles;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Super admin only';
  END IF;

  IF p_role = 'super'::public.admin_role THEN
    RAISE EXCEPTION 'Use a non-super role or promote manually in database';
  END IF;

  SELECT u.id INTO target_id
  FROM auth.users u
  WHERE lower(trim(u.email)) = lower(trim(p_email))
  LIMIT 1;

  IF target_id IS NULL THEN
    RAISE EXCEPTION 'No account found for that email. Ask them to sign up on the app or website first.';
  END IF;

  UPDATE public.profiles
  SET role = 'admin'::public.user_role, updated_at = now()
  WHERE id = target_id;

  INSERT INTO public.admin_profiles (user_id, role, updated_at)
  VALUES (target_id, p_role, now())
  ON CONFLICT (user_id) DO UPDATE
  SET role = EXCLUDED.role, updated_at = now()
  RETURNING * INTO row;

  PERFORM public.log_admin_action(
    'add_admin',
    'admin_profile',
    target_id,
    jsonb_build_object('email', lower(trim(p_email)), 'role', p_role::text)
  );

  RETURN row;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_remove_admin(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  super_count integer;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Super admin only';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot remove your own admin access';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.admin_profiles
    WHERE user_id = p_user_id AND role = 'super'::public.admin_role
  ) THEN
    SELECT count(*)::integer INTO super_count
    FROM public.admin_profiles
    WHERE role = 'super'::public.admin_role;

    IF super_count <= 1 THEN
      RAISE EXCEPTION 'Cannot remove the last super admin';
    END IF;
  END IF;

  DELETE FROM public.admin_profiles WHERE user_id = p_user_id;

  UPDATE public.profiles
  SET
    role = CASE
      WHEN EXISTS (SELECT 1 FROM public.creator_profiles cp WHERE cp.user_id = p_user_id)
        THEN 'creator'::public.user_role
      ELSE 'listener'::public.user_role
    END,
    updated_at = now()
  WHERE id = p_user_id AND role = 'admin'::public.user_role;

  PERFORM public.log_admin_action(
    'remove_admin',
    'admin_profile',
    p_user_id,
    '{}'::jsonb
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_admin_role(
  p_user_id uuid,
  p_role public.admin_role
)
RETURNS public.admin_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row public.admin_profiles;
  super_count integer;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Super admin only';
  END IF;

  IF p_role = 'super'::public.admin_role AND p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Only the database owner can grant super via SQL';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.admin_profiles
    WHERE user_id = p_user_id AND role = 'super'::public.admin_role
  ) AND p_role <> 'super'::public.admin_role AND p_user_id = auth.uid() THEN
    SELECT count(*)::integer INTO super_count
    FROM public.admin_profiles
    WHERE role = 'super'::public.admin_role;
    IF super_count <= 1 THEN
      RAISE EXCEPTION 'Cannot demote the last super admin';
    END IF;
  END IF;

  UPDATE public.admin_profiles
  SET role = p_role, updated_at = now()
  WHERE user_id = p_user_id
  RETURNING * INTO row;

  IF row IS NULL THEN
    RAISE EXCEPTION 'Admin profile not found';
  END IF;

  PERFORM public.log_admin_action(
    'update_admin_role',
    'admin_profile',
    p_user_id,
    jsonb_build_object('role', p_role::text)
  );

  RETURN row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_admins() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_add_admin(text, public.admin_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_remove_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_admin_role(uuid, public.admin_role) TO authenticated;

-- Promote quoreebadebayo@gmail.com if the account already exists
DO $$
DECLARE
  uid uuid;
BEGIN
  SELECT id INTO uid
  FROM auth.users
  WHERE lower(email) = 'quoreebadebayo@gmail.com'
  LIMIT 1;

  IF uid IS NOT NULL THEN
    UPDATE public.profiles
    SET role = 'admin'::public.user_role, updated_at = now()
    WHERE id = uid;

    INSERT INTO public.admin_profiles (user_id, role, updated_at)
    VALUES (uid, 'super'::public.admin_role, now())
    ON CONFLICT (user_id) DO UPDATE
    SET role = 'super'::public.admin_role, updated_at = now();
  END IF;
END $$;
