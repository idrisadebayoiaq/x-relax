-- App APK releases for website download page
CREATE TABLE IF NOT EXISTS public.app_releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'coming_soon'
    CHECK (status IN ('coming_soon', 'available', 'archived')),
  apk_path text,
  file_size_bytes bigint,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_releases_status_sort_idx
  ON public.app_releases (status, sort_order DESC, created_at DESC);

ALTER TABLE public.app_releases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read app releases" ON public.app_releases;
CREATE POLICY "Public read app releases"
  ON public.app_releases FOR SELECT
  USING (status != 'archived');

DROP POLICY IF EXISTS "Admins manage app releases" ON public.app_releases;
CREATE POLICY "Admins manage app releases"
  ON public.app_releases FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

GRANT SELECT ON public.app_releases TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.app_releases TO authenticated;

INSERT INTO storage.buckets (id, name, public)
VALUES ('app-releases', 'app-releases', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Public read app release APKs" ON storage.objects;
CREATE POLICY "Public read app release APKs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'app-releases');

DROP POLICY IF EXISTS "Admins upload app release APKs" ON storage.objects;
CREATE POLICY "Admins upload app release APKs"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'app-releases'
    AND (
      EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    )
  );

DROP POLICY IF EXISTS "Admins update app release APKs" ON storage.objects;
CREATE POLICY "Admins update app release APKs"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'app-releases'
    AND (
      EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    )
  );

DROP POLICY IF EXISTS "Admins delete app release APKs" ON storage.objects;
CREATE POLICY "Admins delete app release APKs"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'app-releases'
    AND (
      EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    )
  );
