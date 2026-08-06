-- Update Premium subscription plan prices (USD + NGN)
UPDATE public.subscription_plans
SET price_usd = 2, price_ngn = 2000
WHERE code = 'monthly';

UPDATE public.subscription_plans
SET price_usd = 5, price_ngn = 5000
WHERE code = 'quarterly';

UPDATE public.subscription_plans
SET price_usd = 10, price_ngn = 10000
WHERE code = 'yearly';

UPDATE public.subscription_plans
SET price_usd = 50, price_ngn = 50000
WHERE code = 'lifetime';
