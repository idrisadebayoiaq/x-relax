-- Hide / block new Premium plan requests while a paid subscription is still active.
-- Lifetime never reopens. Monthly / yearly reopen after ends_at.

CREATE OR REPLACE FUNCTION public.user_has_active_premium(uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.user_id = uid
      AND s.status = 'active'
      AND (s.is_lifetime OR s.ends_at IS NULL OR s.ends_at > now())
  );
$$;

CREATE OR REPLACE FUNCTION public.user_has_premium(uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT public.user_has_active_premium(uid);
$$;

CREATE OR REPLACE FUNCTION public.user_premium_access(uid uuid DEFAULT auth.uid())
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  sub public.subscriptions;
  plan public.subscription_plans;
  pending boolean;
BEGIN
  SELECT s.* INTO sub
  FROM public.subscriptions s
  WHERE s.user_id = uid
    AND s.status = 'active'
    AND (s.is_lifetime OR s.ends_at IS NULL OR s.ends_at > now())
  ORDER BY s.is_lifetime DESC, s.ends_at DESC NULLS LAST, s.starts_at DESC
  LIMIT 1;

  IF FOUND THEN
    SELECT * INTO plan FROM public.subscription_plans WHERE id = sub.plan_id;
    RETURN jsonb_build_object(
      'is_premium', true,
      'is_lifetime', COALESCE(sub.is_lifetime, plan.duration_days IS NULL),
      'can_purchase', false,
      'ends_at', sub.ends_at,
      'plan_name', plan.name,
      'plan_code', plan.code,
      'pending_payment', false,
      'reason', CASE
        WHEN COALESCE(sub.is_lifetime, plan.duration_days IS NULL) THEN 'lifetime'
        ELSE 'active'
      END
    );
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.payment_requests pr
    JOIN public.subscription_plans sp ON sp.id = pr.plan_id
    WHERE pr.user_id = uid
      AND pr.status = 'pending'
      AND COALESCE(sp.code, '') <> 'creator_blue_badge'
  ) INTO pending;

  RETURN jsonb_build_object(
    'is_premium', false,
    'is_lifetime', false,
    'can_purchase', NOT pending,
    'ends_at', NULL,
    'plan_name', NULL,
    'plan_code', NULL,
    'pending_payment', pending,
    'reason', CASE WHEN pending THEN 'pending_payment' ELSE 'none' END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.user_can_create_payment_request(p_plan_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  plan public.subscription_plans;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  SELECT * INTO plan FROM public.subscription_plans WHERE id = p_plan_id;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF plan.code = 'creator_blue_badge' THEN
    RETURN true;
  END IF;

  IF public.user_has_active_premium(auth.uid()) THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.payment_requests pr
    JOIN public.subscription_plans sp ON sp.id = pr.plan_id
    WHERE pr.user_id = auth.uid()
      AND pr.status = 'pending'
      AND COALESCE(sp.code, '') <> 'creator_blue_badge'
  ) THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

DROP POLICY IF EXISTS "Users create payment requests" ON public.payment_requests;
CREATE POLICY "Users create payment requests"
  ON public.payment_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.user_can_create_payment_request(plan_id)
  );

GRANT EXECUTE ON FUNCTION public.user_has_active_premium(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_premium(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.user_premium_access(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_create_payment_request(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_review_payment(
  p_payment_id uuid,
  p_status payment_status,
  p_note text DEFAULT NULL
)
RETURNS payment_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  req public.payment_requests;
  plan public.subscription_plans;
  ends timestamptz;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT * INTO req FROM public.payment_requests WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment not found'; END IF;

  UPDATE public.payment_requests
  SET status = p_status, admin_note = COALESCE(p_note, admin_note), updated_at = now()
  WHERE id = p_payment_id
  RETURNING * INTO req;

  IF p_status = 'approved' THEN
    SELECT * INTO plan FROM public.subscription_plans WHERE id = req.plan_id;
    IF plan.code = 'creator_blue_badge' THEN
      INSERT INTO public.creator_profiles (user_id, has_blue_badge, updated_at)
      VALUES (req.user_id, true, now())
      ON CONFLICT (user_id) DO UPDATE SET has_blue_badge = true, updated_at = now();
      INSERT INTO public.notifications (user_id, title, body, data)
      VALUES (
        req.user_id,
        'Blue verified badge activated',
        'Your creator verified badge payment was approved.',
        jsonb_build_object('payment_id', req.id, 'badge', 'blue')
      );
    ELSE
      UPDATE public.subscriptions
      SET status = 'cancelled'
      WHERE user_id = req.user_id AND status = 'active';

      IF plan.duration_days IS NULL THEN ends := NULL;
      ELSE ends := now() + make_interval(days => plan.duration_days); END IF;

      INSERT INTO public.subscriptions (user_id, plan_id, starts_at, ends_at, is_lifetime, status, source)
      VALUES (req.user_id, req.plan_id, now(), ends, plan.duration_days IS NULL, 'active', 'payment');

      PERFORM public.refresh_profile_premium_status(req.user_id);
      INSERT INTO public.notifications (user_id, title, body, data)
      VALUES (
        req.user_id,
        'Premium activated',
        'Your payment was approved. Enjoy Premium.',
        jsonb_build_object('payment_id', req.id)
      );
    END IF;
  ELSIF p_status IN ('rejected', 'need_more_info', 'refunded') THEN
    INSERT INTO public.notifications (user_id, title, body, data)
    VALUES (
      req.user_id,
      'Payment update',
      'Your payment status is now: ' || p_status::text,
      jsonb_build_object('payment_id', req.id, 'status', p_status)
    );
  END IF;
  RETURN req;
END;
$$;

CREATE OR REPLACE FUNCTION public.expire_due_subscriptions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  n integer;
BEGIN
  UPDATE public.subscriptions
  SET status = 'expired'
  WHERE status = 'active'
    AND COALESCE(is_lifetime, false) = false
    AND ends_at IS NOT NULL
    AND ends_at <= now();
  GET DIAGNOSTICS n = ROW_COUNT;

  UPDATE public.profiles p
  SET premium_status = 'none', updated_at = now()
  WHERE p.premium_status = 'subscribed'
    AND NOT public.user_has_active_premium(p.id);

  RETURN n;
END;
$$;

-- Keep one active subscription per user (latest).
UPDATE public.subscriptions s
SET status = 'cancelled'
WHERE s.status = 'active'
  AND s.ctid <> (
    SELECT s2.ctid
    FROM public.subscriptions s2
    WHERE s2.user_id = s.user_id
      AND s2.status = 'active'
    ORDER BY s2.is_lifetime DESC, s2.starts_at DESC
    LIMIT 1
  );

SELECT public.expire_due_subscriptions();

DO $$
BEGIN
  PERFORM cron.unschedule(jobid)
  FROM cron.job
  WHERE jobname = 'xrelax-expire-subscriptions';
EXCEPTION
  WHEN undefined_table OR undefined_function THEN
    NULL;
END
$$;

SELECT cron.schedule(
  'xrelax-expire-subscriptions',
  '15 * * * *',
  $$SELECT public.expire_due_subscriptions();$$
);
