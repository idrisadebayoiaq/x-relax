ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS push_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.profiles.push_enabled IS
  'User wants device push. Stays on after signup until they turn it off.';

CREATE OR REPLACE FUNCTION public.set_push_preference(p_enabled boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.profiles
  SET push_enabled = p_enabled, updated_at = now()
  WHERE id = auth.uid();

  IF NOT p_enabled THEN
    DELETE FROM public.device_push_tokens WHERE user_id = auth.uid();
  END IF;

  RETURN jsonb_build_object('ok', true, 'push_enabled', p_enabled);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_push_preference(boolean) TO authenticated;
