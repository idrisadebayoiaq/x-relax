-- Session duration for saved mixes + optional linked personal sound in My Mix playlist
ALTER TABLE public.mixes
  ADD COLUMN IF NOT EXISTS duration_seconds integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sound_id uuid REFERENCES public.sounds(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS mixes_sound_id_idx ON public.mixes(sound_id);

COMMENT ON COLUMN public.mixes.duration_seconds IS 'Total seconds the user played this mix session before save';
COMMENT ON COLUMN public.mixes.sound_id IS 'Draft personal sound entry linked into My Mix playlist';
