-- Fix infinite RLS recursion that broke admin APK uploads.
-- Storage policies were querying admin_profiles, whose FOR ALL policy also
-- queried admin_profiles without SECURITY DEFINER → recursion → opaque Storage error.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_profiles ap WHERE ap.user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_profiles ap
    WHERE ap.user_id = auth.uid()
      AND ap.role = 'super'
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;
REVOKE ALL ON FUNCTION public.is_super_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO anon, authenticated;

DROP POLICY IF EXISTS "Admin profiles readable by admins" ON public.admin_profiles;
CREATE POLICY "Admin profiles readable by admins"
  ON public.admin_profiles FOR SELECT
  USING (public.is_admin() OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Only super admins manage admin profiles" ON public.admin_profiles;
CREATE POLICY "Only super admins manage admin profiles"
  ON public.admin_profiles FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Admins manage app releases" ON public.app_releases;
DROP POLICY IF EXISTS "Admin manage app releases" ON public.app_releases;
CREATE POLICY "Admins manage app releases"
  ON public.app_releases FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins upload app release APKs" ON storage.objects;
CREATE POLICY "Admins upload app release APKs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'app-releases' AND public.is_admin());

DROP POLICY IF EXISTS "Admins update app release APKs" ON storage.objects;
CREATE POLICY "Admins update app release APKs"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'app-releases' AND public.is_admin())
  WITH CHECK (bucket_id = 'app-releases' AND public.is_admin());

DROP POLICY IF EXISTS "Admins delete app release APKs" ON storage.objects;
CREATE POLICY "Admins delete app release APKs"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'app-releases' AND public.is_admin());

UPDATE storage.buckets
SET allowed_mime_types = NULL,
    file_size_limit = 524288000
WHERE id = 'app-releases';
