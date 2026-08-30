'use client';

import { FormEvent, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { appAlert } from '@/components/AppDialog';

type Collection = { id: string; title: string; description: string | null; is_active: boolean };
type SoundOption = { id: string; title: string };

export default function AdminFeaturedPage() {
  const { isAdmin } = useAuth();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [sounds, setSounds] = useState<SoundOption[]>([]);
  const [dailyPick, setDailyPick] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const load = async () => {
    const supabase = createClient();
    const [{ data: cols }, { data: soundRows }, { data: setting }] = await Promise.all([
      supabase.from('featured_collections').select('id, title, description, is_active').order('sort_order'),
      supabase.from('sounds').select('id, title').eq('status', 'published').order('title').limit(200),
      supabase.from('app_settings').select('value').eq('key', 'daily_pick_sound_id').maybeSingle(),
    ]);
    setCollections((cols as Collection[]) ?? []);
    setSounds((soundRows as SoundOption[]) ?? []);
    const value = setting?.value;
    setDailyPick(typeof value === 'string' ? value : '');
  };

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin]);

  const createCollection = async (e: FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    const { error } = await supabase.from('featured_collections').insert({
      title: title.trim(),
      description: description.trim() || null,
      is_active: true,
      sort_order: 99,
    });
    if (error) appAlert(error.message);
    else {
      setTitle('');
      setDescription('');
      void load();
    }
  };

  const saveDailyPick = async (e: FormEvent) => {
    e.preventDefault();
    const { error } = await createClient().from('app_settings').upsert({
      key: 'daily_pick_sound_id',
      value: dailyPick,
      updated_at: new Date().toISOString(),
    });
    if (error) appAlert(error.message);
    else appAlert('Daily pick saved.');
  };

  if (!isAdmin) return null;

  return (
    <div className="space-y-8 max-w-2xl">
      <h2 className="text-xl font-semibold">Featured & daily pick</h2>

      <form onSubmit={saveDailyPick} className="card p-4 space-y-3">
        <p className="font-semibold">Daily pick</p>
        <select className="input" value={dailyPick} onChange={(e) => setDailyPick(e.target.value)}>
          <option value="">Select a published sound</option>
          {sounds.map((s) => (
            <option key={s.id} value={s.id}>{s.title}</option>
          ))}
        </select>
        <button type="submit" className="btn btn-primary">Save daily pick</button>
      </form>

      <form onSubmit={createCollection} className="card p-4 space-y-3">
        <p className="font-semibold">Add collection</p>
        <input className="input" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <input className="input" placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
        <button type="submit" className="btn btn-primary">Create</button>
      </form>

      <div className="space-y-3">
        {collections.map((c) => (
          <div key={c.id} className="card p-4">
            <p className="font-semibold">{c.title}</p>
            <p className="text-sm text-muted">{c.description ?? (c.is_active ? 'Active' : 'Inactive')}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
