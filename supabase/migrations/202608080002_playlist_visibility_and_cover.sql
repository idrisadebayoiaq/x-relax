-- Public/private playlists + cover from first track
ALTER TABLE public.playlists
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'private',
  ADD COLUMN IF NOT EXISTS cover_url text;

DO $$ BEGIN
  ALTER TABLE public.playlists DROP CONSTRAINT IF EXISTS playlists_visibility_check;
  ALTER TABLE public.playlists
    ADD CONSTRAINT playlists_visibility_check
    CHECK (visibility IN ('private', 'public'));
EXCEPTION WHEN others THEN NULL;
END $$;

DROP POLICY IF EXISTS "Own playlists" ON public.playlists;
CREATE POLICY "Own playlists"
  ON public.playlists FOR ALL
  USING (user_id = auth.uid() OR is_admin())
  WITH CHECK (user_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "Read public playlists" ON public.playlists;
CREATE POLICY "Read public playlists"
  ON public.playlists FOR SELECT
  USING (visibility = 'public' OR user_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "Own playlist items" ON public.playlist_items;
CREATE POLICY "Own playlist items"
  ON public.playlist_items FOR ALL
  USING (
    is_admin()
    OR EXISTS (
      SELECT 1 FROM public.playlists p
      WHERE p.id = playlist_id AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    is_admin()
    OR EXISTS (
      SELECT 1 FROM public.playlists p
      WHERE p.id = playlist_id AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Read public playlist items" ON public.playlist_items;
CREATE POLICY "Read public playlist items"
  ON public.playlist_items FOR SELECT
  USING (
    is_admin()
    OR EXISTS (
      SELECT 1 FROM public.playlists p
      WHERE p.id = playlist_id
        AND (p.visibility = 'public' OR p.user_id = auth.uid())
    )
  );

CREATE OR REPLACE FUNCTION public.sync_playlist_cover()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pid uuid;
  cover text;
BEGIN
  pid := COALESCE(NEW.playlist_id, OLD.playlist_id);
  SELECT s.cover_url INTO cover
  FROM public.playlist_items pi
  JOIN public.sounds s ON s.id = pi.sound_id
  WHERE pi.playlist_id = pid
  ORDER BY pi.position ASC, pi.added_at ASC
  LIMIT 1;

  UPDATE public.playlists
  SET cover_url = cover,
      updated_at = now()
  WHERE id = pid;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS playlist_items_sync_cover ON public.playlist_items;
CREATE TRIGGER playlist_items_sync_cover
AFTER INSERT OR UPDATE OR DELETE ON public.playlist_items
FOR EACH ROW EXECUTE FUNCTION public.sync_playlist_cover();
