-- Restrict offline downloads to Premium / admin only (server-side)
CREATE OR REPLACE FUNCTION public.user_can_download_offline(uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.user_has_premium(uid), false)
    OR EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.user_id = uid)
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = uid AND p.role = 'admin');
$$;

GRANT EXECUTE ON FUNCTION public.user_can_download_offline(uuid) TO authenticated, anon;

DROP POLICY IF EXISTS "Own downloads" ON public.downloads;

CREATE POLICY "Own downloads select"
  ON public.downloads FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Own downloads update"
  ON public.downloads FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Own downloads delete"
  ON public.downloads FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Premium own downloads insert"
  ON public.downloads FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.user_can_download_offline(auth.uid())
  );
