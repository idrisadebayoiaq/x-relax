-- Apply-to-earn identity verification + paid blue creator badge + withdrawal gate

ALTER TABLE public.creator_verifications
  ADD COLUMN IF NOT EXISTS document_type text;

ALTER TABLE public.creator_profiles
  ADD COLUMN IF NOT EXISTS has_blue_badge boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_earn boolean NOT NULL DEFAULT false;

-- Backfill: previously identity-verified creators can earn
UPDATE public.creator_profiles
SET can_earn = true
WHERE is_verified = true AND can_earn = false;

-- Blue verified badge product (not a Premium subscription)
INSERT INTO public.subscription_plans (code, name, duration_days, price_usd, price_ngn, is_active, sort_order)
SELECT 'creator_blue_badge', 'Creator Blue Verified Badge', NULL, 2.00, 1000.00, true, 100
WHERE NOT EXISTS (
  SELECT 1 FROM public.subscription_plans WHERE code = 'creator_blue_badge'
);

UPDATE public.subscription_plans
SET name = 'Creator Blue Verified Badge',
    price_usd = 2.00,
    price_ngn = 1000.00,
    is_active = true,
    sort_order = 100
WHERE code = 'creator_blue_badge';

-- Requirements helper for Apply to Earn UI
CREATE OR REPLACE FUNCTION public.get_creator_earn_requirements()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  pub_count int := 0;
  plays bigint := 0;
  avg_rating numeric := 0;
  bio_ok boolean := false;
  bio_len int := 0;
  min_sounds int := 20;
  min_plays int := 5000;
  min_rating numeric := 4.5;
  settings jsonb;
  latest_status text;
  eligible boolean;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.creator_profiles WHERE user_id = uid) THEN
    RAISE EXCEPTION 'Creator profile required';
  END IF;

  SELECT value INTO settings FROM public.app_settings WHERE key = 'creator_settings';
  IF settings IS NOT NULL THEN
    min_sounds := COALESCE((settings->'verification'->>'min_sounds')::int, (settings->>'verification_min_sounds')::int, 20);
    min_plays := COALESCE((settings->'verification'->>'min_plays')::int, (settings->>'verification_min_plays')::int, 5000);
    min_rating := COALESCE((settings->'verification'->>'min_rating')::numeric, (settings->>'verification_min_rating')::numeric, 4.5);
  END IF;

  SELECT COUNT(*) INTO pub_count FROM public.sounds WHERE creator_id = uid AND status = 'published';
  SELECT COALESCE(SUM(play_count), 0) INTO plays FROM public.sounds WHERE creator_id = uid AND status = 'published';
  SELECT COALESCE(AVG(average_rating), 0) INTO avg_rating
  FROM public.sounds
  WHERE creator_id = uid AND status = 'published' AND average_rating IS NOT NULL;
  SELECT COALESCE(length(trim(bio)), 0), COALESCE(length(trim(bio)) > 10, false)
  INTO bio_len, bio_ok
  FROM public.creator_profiles WHERE user_id = uid;

  SELECT status INTO latest_status
  FROM public.creator_verifications
  WHERE user_id = uid
  ORDER BY created_at DESC
  LIMIT 1;

  eligible := pub_count >= min_sounds
    AND plays >= min_plays
    AND avg_rating >= min_rating
    AND bio_ok;

  RETURN jsonb_build_object(
    'eligible', eligible,
    'can_earn', COALESCE((SELECT can_earn FROM public.creator_profiles WHERE user_id = uid), false),
    'is_verified', COALESCE((SELECT is_verified FROM public.creator_profiles WHERE user_id = uid), false),
    'has_blue_badge', COALESCE((SELECT has_blue_badge FROM public.creator_profiles WHERE user_id = uid), false),
    'latest_status', latest_status,
    'requirements', jsonb_build_array(
      jsonb_build_object(
        'key', 'sounds',
        'label', format('Publish at least %s sounds', min_sounds),
        'required', min_sounds,
        'current', pub_count,
        'met', pub_count >= min_sounds
      ),
      jsonb_build_object(
        'key', 'plays',
        'label', format('Reach at least %s total plays', min_plays),
        'required', min_plays,
        'current', plays,
        'met', plays >= min_plays
      ),
      jsonb_build_object(
        'key', 'rating',
        'label', format('Maintain average rating of %s+', min_rating),
        'required', min_rating,
        'current', round(avg_rating, 2),
        'met', avg_rating >= min_rating
      ),
      jsonb_build_object(
        'key', 'bio',
        'label', 'Complete creator bio (more than 10 characters)',
        'required', 11,
        'current', bio_len,
        'met', bio_ok
      ),
      jsonb_build_object(
        'key', 'identity',
        'label', 'Verify identity with National ID, Voters ID, Driver license, or other government ID',
        'required', 1,
        'current', CASE WHEN latest_status IN ('pending', 'approved') THEN 1 ELSE 0 END,
        'met', latest_status IN ('pending', 'approved')
      )
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_creator_earn_requirements() TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_creator_verification(
  p_document_path text,
  p_note text DEFAULT NULL,
  p_document_type text DEFAULT NULL
)
RETURNS creator_verifications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  req jsonb;
  row public.creator_verifications;
  doc_type text := lower(trim(COALESCE(p_document_type, 'other')));
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_document_path IS NULL OR length(trim(p_document_path)) = 0 THEN
    RAISE EXCEPTION 'Identity document required';
  END IF;

  IF doc_type NOT IN ('national_id', 'voters_id', 'drivers_license', 'passport', 'other') THEN
    doc_type := 'other';
  END IF;

  req := public.get_creator_earn_requirements();
  IF NOT COALESCE((req->>'eligible')::boolean, false) THEN
    RAISE EXCEPTION 'Earning requirements not met. Complete the requirements before verifying your identity.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.creator_verifications
    WHERE user_id = uid AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'You already have a pending earning application';
  END IF;

  IF COALESCE((SELECT can_earn FROM public.creator_profiles WHERE user_id = uid), false) THEN
    RAISE EXCEPTION 'You are already approved to earn';
  END IF;

  INSERT INTO public.creator_verifications (user_id, document_path, document_type, note, status)
  VALUES (uid, p_document_path, doc_type, p_note, 'pending')
  RETURNING * INTO row;

  PERFORM public.notify_admins(
    'Earning application',
    'A creator applied to earn and submitted identity verification',
    jsonb_build_object('verification_id', row.id, 'document_type', doc_type)
  );

  RETURN row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_creator_verification(text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.review_creator_verification(
  p_id uuid,
  p_status text,
  p_admin_note text DEFAULT NULL
)
RETURNS creator_verifications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row public.creator_verifications;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF p_status NOT IN ('approved', 'rejected') THEN RAISE EXCEPTION 'Invalid status'; END IF;

  UPDATE public.creator_verifications
  SET status = p_status,
      admin_note = p_admin_note,
      reviewed_at = now(),
      reviewed_by = auth.uid()
  WHERE id = p_id
  RETURNING * INTO row;

  IF NOT FOUND THEN RAISE EXCEPTION 'Not found'; END IF;

  IF p_status = 'approved' THEN
    UPDATE public.creator_profiles
    SET is_verified = true,
        can_earn = true,
        level = 'verified'
    WHERE user_id = row.user_id;
  END IF;

  INSERT INTO public.notifications (user_id, title, body, data)
  VALUES (
    row.user_id,
    CASE WHEN p_status = 'approved' THEN 'Earning approved' ELSE 'Earning application rejected' END,
    COALESCE(
      p_admin_note,
      CASE
        WHEN p_status = 'approved' THEN 'You can now earn and request withdrawals.'
        ELSE 'Your earning application was rejected.'
      END
    ),
    jsonb_build_object('verification_id', row.id, 'status', p_status)
  );

  RETURN row;
END;
$$;

CREATE OR REPLACE FUNCTION public.request_withdrawal(
  p_amount numeric,
  p_currency text,
  p_payout_method text DEFAULT NULL,
  p_payout_details jsonb DEFAULT '{}'::jsonb
)
RETURNS withdrawal_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  earned numeric := 0;
  withdrawn numeric := 0;
  min_amount numeric := 20;
  row public.withdrawal_requests;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_currency NOT IN ('USD', 'NGN') THEN RAISE EXCEPTION 'Invalid currency'; END IF;
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Invalid amount'; END IF;

  IF NOT COALESCE((SELECT can_earn FROM public.creator_profiles WHERE user_id = uid), false)
     AND NOT COALESCE((SELECT is_verified FROM public.creator_profiles WHERE user_id = uid), false) THEN
    RAISE EXCEPTION 'Apply to earn and get identity approved before requesting withdrawals';
  END IF;

  IF p_currency = 'USD' THEN
    SELECT COALESCE(SUM(amount_usd), 0) INTO earned FROM public.creator_earnings WHERE user_id = uid;
    min_amount := 20;
  ELSE
    SELECT COALESCE(SUM(amount_ngn), 0) INTO earned FROM public.creator_earnings WHERE user_id = uid;
    min_amount := 10000;
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO withdrawn
  FROM public.withdrawal_requests
  WHERE user_id = uid AND currency = p_currency AND status IN ('pending', 'approved', 'paid');

  IF p_amount < min_amount THEN
    RAISE EXCEPTION 'Minimum withdrawal is % %', min_amount, p_currency;
  END IF;
  IF p_amount > (earned - withdrawn) THEN
    RAISE EXCEPTION 'Insufficient earnings balance';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.withdrawal_requests
    WHERE user_id = uid AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'You already have a pending withdrawal';
  END IF;

  INSERT INTO public.withdrawal_requests (
    user_id, amount, currency, payout_method, payout_details, status
  ) VALUES (
    uid, p_amount, p_currency, p_payout_method, COALESCE(p_payout_details, '{}'::jsonb), 'pending'
  ) RETURNING * INTO row;

  PERFORM public.notify_admins(
    'Withdrawal request',
    'A creator requested a payout',
    jsonb_build_object('withdrawal_id', row.id)
  );

  RETURN row;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_review_payment(
  p_payment_id uuid,
  p_status payment_status,
  p_note text DEFAULT NULL
)
RETURNS payment_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req public.payment_requests;
  plan public.subscription_plans;
  ends timestamptz;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

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
      ON CONFLICT (user_id) DO UPDATE
      SET has_blue_badge = true, updated_at = now();

      INSERT INTO public.notifications (user_id, title, body, data)
      VALUES (
        req.user_id,
        'Blue verified badge activated',
        'Your creator verified badge payment was approved.',
        jsonb_build_object('payment_id', req.id, 'badge', 'blue')
      );
    ELSE
      IF plan.duration_days IS NULL THEN
        ends := NULL;
      ELSE
        ends := now() + make_interval(days => plan.duration_days);
      END IF;

      INSERT INTO public.subscriptions (user_id, plan_id, starts_at, ends_at, is_lifetime, status, source)
      VALUES (
        req.user_id,
        req.plan_id,
        now(),
        ends,
        plan.duration_days IS NULL,
        'active',
        'payment'
      );

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
