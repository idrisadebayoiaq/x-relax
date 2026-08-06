import { createClient } from '@/lib/supabase/server';
import { FeaturedForm } from './FeaturedForm';
import { DailyPickForm } from './DailyPickForm';

export default async function FeaturedPage() {
  const supabase = await createClient();
  const [{ data: collections }, { data: sounds }, { data: daily }] = await Promise.all([
    supabase
      .from('featured_collections')
      .select('*')
      .order('sort_order', { ascending: true }),
    supabase
      .from('sounds')
      .select('id, title')
      .eq('status', 'published')
      .order('title'),
    supabase.from('app_settings').select('value').eq('key', 'daily_pick_sound_id').maybeSingle(),
  ]);

  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-bold">Featured & Daily Pick</h1>
      <p className="text-muted mt-2 mb-6">Home screen curation</p>

      <h2 className="text-xl font-semibold mb-3">Collections</h2>
      <div className="space-y-2 mb-8">
        {(collections ?? []).map((c) => (
          <div key={c.id} className="border border-border rounded-lg p-3 bg-surface">
            <div className="font-medium">{c.title}</div>
            <div className="text-sm text-muted">
              {c.is_active ? 'Active' : 'Inactive'} · sort {c.sort_order}
            </div>
          </div>
        ))}
      </div>
      <FeaturedForm />

      <h2 className="text-xl font-semibold mt-10 mb-3">Daily Relaxation Pick</h2>
      <DailyPickForm
        sounds={sounds ?? []}
        currentId={(daily?.value as string) ?? ''}
      />
    </div>
  );
}
