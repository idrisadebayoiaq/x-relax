'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import type { Category, Sound } from '@/types/database';

export default function CreatorUploadPage() {
  const router = useRouter();
  const { user, isCreator } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [audio, setAudio] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    createClient().from('categories').select('*').order('sort_order').then(({ data }) => {
      setCategories((data as Category[]) ?? []);
      if (data?.[0]) setCategoryId(data[0].id);
    });
  }, []);

  if (!isCreator) return <p className="text-muted">Creator access required.</p>;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !audio || !title.trim()) return alert('Title and audio file required.');
    setBusy(true);
    const supabase = createClient();
    const soundId = crypto.randomUUID();
    const audioPath = `${user.id}/${soundId}/audio.${audio.name.split('.').pop()}`;
    const { error: audioErr } = await supabase.storage.from('sounds').upload(audioPath, audio);
    if (audioErr) {
      setBusy(false);
      return alert(audioErr.message);
    }
    let coverPath: string | null = null;
    if (cover) {
      coverPath = `${user.id}/${soundId}/cover.${cover.name.split('.').pop()}`;
      await supabase.storage.from('sounds').upload(coverPath, cover);
    }
    const { error } = await supabase.from('sounds').insert({
      id: soundId,
      creator_id: user.id,
      title: title.trim(),
      description: description.trim() || null,
      audio_path: audioPath,
      cover_url: coverPath ? supabase.storage.from('sounds').getPublicUrl(coverPath).data.publicUrl : null,
      status: 'pending',
      duration_seconds: 0,
    });
    if (categoryId) {
      await supabase.from('sound_categories').insert({ sound_id: soundId, category_id: categoryId });
    }
    setBusy(false);
    if (error) return alert(error.message);
    alert('Submitted for moderation.');
    router.push('/creator/sounds');
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <Link href="/creator" className="text-sm text-muted underline">← Creator</Link>
      <h1 className="text-3xl font-serif font-bold">Upload sound</h1>
      <form onSubmit={submit} className="card p-6 space-y-4">
        <input className="input" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <textarea className="input min-h-[80px]" placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
        <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <label className="block text-sm">Audio file<input type="file" accept="audio/*" className="block mt-1" onChange={(e) => setAudio(e.target.files?.[0] ?? null)} required /></label>
        <label className="block text-sm">Cover image<input type="file" accept="image/*" className="block mt-1" onChange={(e) => setCover(e.target.files?.[0] ?? null)} /></label>
        <button type="submit" className="btn btn-primary w-full" disabled={busy}>{busy ? 'Uploading…' : 'Submit for review'}</button>
      </form>
    </div>
  );
}
