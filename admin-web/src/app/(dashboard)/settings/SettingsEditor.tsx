'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { appAlert } from '@/components/AppDialog';


export function SettingsEditor({
  settingKey,
  initialValue,
}: {
  settingKey: string;
  initialValue: string;
}) {
  const [value, setValue] = useState(initialValue);
  const router = useRouter();

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const parsed = JSON.parse(value);
      const supabase = createClient();
      const { error } = await supabase.from('app_settings').upsert({
        key: settingKey,
        value: parsed,
        updated_at: new Date().toISOString(),
      });
      if (error) appAlert(error.message);
      else {
        await supabase.rpc('log_admin_action', {
          p_action: 'update_app_settings',
          p_entity_type: 'app_settings',
          p_meta: { key: settingKey },
        });
        router.refresh();
        appAlert('Saved');
      }
    } catch {
      appAlert('Invalid JSON');
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <textarea
        className="w-full min-h-40 border border-border rounded-xl p-3 font-mono text-sm bg-background"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <button className="rounded-lg bg-accent text-on-accent px-4 py-2 font-semibold">
        Save {settingKey}
      </button>
    </form>
  );
}
