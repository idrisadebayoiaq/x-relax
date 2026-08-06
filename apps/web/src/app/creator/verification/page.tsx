'use client';

import Link from 'next/link';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';

export default function CreatorVerificationPage() {
  const { user, isCreator } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  if (!isCreator) return <p className="text-muted">Creator access required.</p>;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !file) return;
    setBusy(true);
    const supabase = createClient();
    const path = `${user.id}/id.${file.name.split('.').pop()}`;
    const { error: upErr } = await supabase.storage.from('artist-documents').upload(path, file, { upsert: true });
    if (upErr) {
      setBusy(false);
      return alert(upErr.message);
    }
    const { error } = await supabase.from('creator_verifications').upsert({
      user_id: user.id,
      document_path: path,
      status: 'pending',
      submitted_at: new Date().toISOString(),
    });
    setBusy(false);
    if (error) alert(error.message);
    else alert('Verification submitted.');
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <Link href="/creator" className="text-sm text-muted underline">← Creator</Link>
      <h1 className="text-3xl font-serif font-bold">Verification</h1>
      <form onSubmit={submit} className="card p-6 space-y-4">
        <p className="text-sm text-muted">Upload a government ID to get verified.</p>
        <input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <button type="submit" className="btn btn-primary w-full" disabled={busy}>Submit</button>
      </form>
    </div>
  );
}
