-- Profile edit fields: bio, city, banner
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS banner_url text;

COMMENT ON COLUMN public.profiles.bio IS 'Public short bio for profile';
COMMENT ON COLUMN public.profiles.city IS 'City / locality for profile';
COMMENT ON COLUMN public.profiles.banner_url IS 'Optional profile banner image URL';
