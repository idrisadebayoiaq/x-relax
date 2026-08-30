'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export function DailyPickForm({
  sounds,
  currentId,
}: {
  sounds: { id: string; title: string }[];
  currentId: string;
}) {
  const [soundId, setSoundId] = useState(currentId);
  const router = useRouter();

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    const { error } = await supabase.from('app_settings').upsert({
      key: 'daily_pick_sound_id',
      value: JSON.parse(JSON.stringify(soundId)),
      updated_at: new Date().toISOString(),
    });
    if (error) alert(error.message);
    else {
      await supabase.rpc('log_admin_action', {
        p_action: 'set_daily_pick',
        p_entity_type: 'app_settings',
        p_meta: { sound_id: soundId },
      });
      router.refresh();
    }
  };

  return (
    <form onSubmit={onSubmit} className="border border-border rounded-xl p-4 space-y-3">
      <select
        className="w-full border border-border rounded-lg px-3 py-2 bg-background"
        value={soundId}
        onChange={(e) => setSoundId(e.target.value)}
      >
        <option value="">Select a published sound</option>
        {sounds.map((s) => (
          <option key={s.id} value={s.id}>
            {s.title}
          </option>
        ))}
      </select>
      <button className="rounded-lg bg-accent text-on-accent px-4 py-2 font-semibold">
        Save daily pick
      </button>
    </form>
  );
}
