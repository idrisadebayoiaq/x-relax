import { createClient } from '@/lib/supabase/server';
import { ModerationActions } from './ModerationActions';

export default async function ModerationPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('sounds')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  return (
    <div>
      <h1 className="text-3xl font-bold">Sound moderation</h1>
      <p className="text-muted mt-2 mb-6">Publish or reject pending uploads</p>
      <div className="space-y-3">
        {(data ?? []).map((sound) => (
          <div key={sound.id} className="border border-border rounded-xl p-4 bg-surface">
            <div className="font-semibold">{sound.title}</div>
            <div className="text-sm text-muted mt-1">{sound.description ?? 'No description'}</div>
            <div className="mt-3">
              <ModerationActions id={sound.id} />
            </div>
          </div>
        ))}
        {!data?.length ? <p className="text-muted">No pending sounds.</p> : null}
      </div>
    </div>
  );
}
