-- Mixes are user sessions (NOT a sound category). Concurrent layered playback.
CREATE TABLE IF NOT EXISTS public.mixes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  visibility text NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('private', 'public')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mixes
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'private';

CREATE TABLE IF NOT EXISTS public.mix_tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mix_id uuid NOT NULL REFERENCES public.mixes(id) ON DELETE CASCADE,
  sound_id uuid NOT NULL REFERENCES public.sounds(id) ON DELETE CASCADE,
  volume numeric NOT NULL DEFAULT 1.0 CHECK (volume >= 0 AND volume <= 1),
  position integer NOT NULL DEFAULT 0,
  UNIQUE (mix_id, sound_id)
);

ALTER TABLE public.mixes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mix_tracks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Own mixes" ON public.mixes;
CREATE POLICY "Own mixes" ON public.mixes
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Own mix tracks" ON public.mix_tracks;
CREATE POLICY "Own mix tracks" ON public.mix_tracks
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.mixes m WHERE m.id = mix_id AND m.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.mixes m WHERE m.id = mix_id AND m.user_id = auth.uid()));

INSERT INTO public.app_settings (key, value)
VALUES (
  'feature_flags',
  jsonb_build_object(
    'free_mix_track_limit', 2,
    'mixes_require_premium', true
  )
)
ON CONFLICT (key) DO UPDATE
SET value = COALESCE(public.app_settings.value, '{}'::jsonb)
  || jsonb_build_object(
    'free_mix_track_limit',
    COALESCE(public.app_settings.value->'free_mix_track_limit', '2'::jsonb),
    'mixes_require_premium',
    COALESCE(public.app_settings.value->'mixes_require_premium', 'true'::jsonb)
  );
