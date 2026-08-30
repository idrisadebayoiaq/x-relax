import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return NextResponse.json({ ok: false, error: 'missing_env' }, { status: 500 });
  }

  const supabase = createClient(url, key);
  const { data, error } = await supabase.rpc('supabase_keep_alive', { p_source: 'web_cron' });
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, ...(data ?? {}) });
}

export async function POST() {
  return GET();
}
