import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !key) {
    return Response.json({ ok: false, error: 'missing_env' }, { status: 500 });
  }

  const supabase = createClient(url, key);
  const { data, error } = await supabase.rpc('supabase_keep_alive', { p_source: 'edge_function' });

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true, ...((data as object) ?? {}) }, {
    headers: { 'Access-Control-Allow-Origin': '*' },
  });
});
