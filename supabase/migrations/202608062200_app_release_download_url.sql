-- Allow external APK URLs when the file is larger than Storage's global limit.
ALTER TABLE public.app_releases
  ADD COLUMN IF NOT EXISTS download_url text;

COMMENT ON COLUMN public.app_releases.download_url IS
  'Optional external APK URL (e.g. Expo artifact) when file is too large for Storage.';
