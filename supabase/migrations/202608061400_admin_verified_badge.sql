-- Admin verified badge (super-admin grants) + unverified sender flags

ALTER TABLE public.admin_profiles
  ADD COLUMN IF NOT EXISTS has_verified_badge boolean NOT NULL DEFAULT false;

UPDATE public.admin_profiles
SET has_verified_badge = true
WHERE role = 'super';

ALTER TABLE public.support_messages
  ADD COLUMN IF NOT EXISTS sender_verified boolean;

ALTER TABLE public.payment_messages
  ADD COLUMN IF NOT EXISTS sender_verified boolean;

DROP FUNCTION IF EXISTS public.admin_list_admins();

CREATE FUNCTION public.admin_list_admins()
RETURNS TABLE(
  user_id uuid,
  email text,
  display_name text,
  admin_role admin_role,
  has_verified_badge boolean,
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
    (ap.has_verified_badge OR ap.role = 'super') AS has_verified_badge,
    ap.created_at
  FROM public.admin_profiles ap
  JOIN auth.users u ON u.id = ap.user_id
  LEFT JOIN public.profiles p ON p.id = ap.user_id
  ORDER BY ap.created_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_admins() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_admin_verified_badge(
  p_user_id uuid,
  p_enabled boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_role admin_role;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Super admin only';
  END IF;

  SELECT role INTO target_role FROM public.admin_profiles WHERE user_id = p_user_id;
  IF target_role IS NULL THEN
    RAISE EXCEPTION 'Admin not found';
  END IF;

  IF target_role = 'super' THEN
    UPDATE public.admin_profiles
    SET has_verified_badge = true, updated_at = now()
    WHERE user_id = p_user_id;
    RETURN;
  END IF;

  UPDATE public.admin_profiles
  SET has_verified_badge = COALESCE(p_enabled, false), updated_at = now()
  WHERE user_id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_admin_verified_badge(uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_has_verified_badge(uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_profiles ap
    WHERE ap.user_id = uid
      AND (ap.has_verified_badge = true OR ap.role = 'super')
  );
$$;

GRANT EXECUTE ON FUNCTION public.admin_has_verified_badge(uuid) TO authenticated, anon;
