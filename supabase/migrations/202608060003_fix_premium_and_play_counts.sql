-- Premium = paid pass/subscription only (not creator/admin role).
CREATE OR REPLACE FUNCTION public.user_has_premium(uid uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = uid AND p.premium_status IN ('pass', 'subscribed')
  )
  OR EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.user_id = uid AND s.status = 'active'
      AND (s.is_lifetime OR s.ends_at IS NULL OR s.ends_at > now())
  )
  OR EXISTS (
    SELECT 1 FROM public.premium_passes pp
    WHERE pp.user_id = uid AND pp.ends_at > now()
  );
$function$;

UPDATE public.sounds SET play_count = 0 WHERE status = 'published';

CREATE OR REPLACE FUNCTION public.record_sound_listen(p_sound_id uuid, p_listened_seconds integer DEFAULT 0)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_listened_seconds >= 15 THEN
    UPDATE public.sounds
    SET play_count = play_count + 1,
        updated_at = now()
    WHERE id = p_sound_id AND status = 'published';
  END IF;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.record_sound_listen(uuid, integer) TO anon, authenticated;
