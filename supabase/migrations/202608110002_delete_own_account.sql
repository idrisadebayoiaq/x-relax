-- Allow users to permanently delete their own account
CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;

  DELETE FROM public.listening_history WHERE user_id = uid;
  DELETE FROM public.favourites WHERE user_id = uid;
  DELETE FROM public.downloads WHERE user_id = uid;
  DELETE FROM public.playlist_items WHERE playlist_id IN (SELECT id FROM public.playlists WHERE user_id = uid);
  DELETE FROM public.playlists WHERE user_id = uid;
  DELETE FROM public.creator_follows WHERE follower_id = uid OR creator_id = uid;
  DELETE FROM public.notifications WHERE user_id = uid;
  DELETE FROM public.sound_play_events WHERE user_id = uid;

  UPDATE public.sounds SET status = 'archived', updated_at = now() WHERE creator_id = uid;

  DELETE FROM public.creator_profiles WHERE user_id = uid;
  DELETE FROM public.admin_profiles WHERE user_id = uid;
  DELETE FROM public.profiles WHERE id = uid;

  BEGIN
    DELETE FROM auth.users WHERE id = uid;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM, 'partial', true);
  END;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.delete_own_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;
