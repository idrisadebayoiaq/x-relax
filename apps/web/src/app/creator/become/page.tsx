'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { appAlert } from '@/components/AppDialog';

export default function BecomeCreatorPage() {
  const router = useRouter();
  const { refreshProfile } = useAuth();
  const [bio, setBio] = useState('');
  const [payoutMethod, setPayoutMethod] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await createClient().rpc('become_creator', {
      p_bio: bio.trim() || null,
      p_payout_method: payoutMethod.trim() || null,
    });
    setBusy(false);
    if (error) return appAlert(error.message);
    await refreshProfile();
    router.push('/creator');
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <Link href="/profile" className="text-sm text-muted underline">← Profile</Link>
      <h1 className="text-3xl font-serif font-bold">Become a Creator</h1>
      <form onSubmit={submit} className="card p-6 space-y-4">
        <textarea className="input min-h-[100px]" placeholder="Short bio" value={bio} onChange={(e) => setBio(e.target.value)} />
        <input className="input" placeholder="Payout method (Opay / USD bank)" value={payoutMethod} onChange={(e) => setPayoutMethod(e.target.value)} />
        <button type="submit" className="btn btn-primary w-full" disabled={busy}>Create creator profile</button>
      </form>
    </div>
  );
}
