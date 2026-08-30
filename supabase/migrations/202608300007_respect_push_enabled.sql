CREATE OR REPLACE FUNCTION public.dispatch_push_on_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  secret text;
  req_id bigint;
  enabled boolean;
begin
  select coalesce(p.push_enabled, true) into enabled
  from public.profiles p
  where p.id = NEW.user_id;

  if enabled is false then
    return NEW;
  end if;

  select ds.decrypted_secret into secret
  from vault.decrypted_secrets ds
  where ds.name = 'push_dispatch_secret'
  limit 1;

  if secret is null or length(secret) = 0 then
    return NEW;
  end if;

  select net.http_post(
    url := 'https://bfilhkxyjiofkfqwqyep.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-secret', secret
    ),
    body := jsonb_build_object(
      'user_ids', jsonb_build_array(NEW.user_id),
      'title', NEW.title,
      'body', coalesce(NEW.body, ''),
      'data', coalesce(NEW.data, '{}'::jsonb),
      'skipInApp', true
    )
  ) into req_id;

  return NEW;
exception when others then
  return NEW;
end;
$function$;
