'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CoverArt } from '@/components/CoverArt';
import { useAuth } from '@/lib/auth-context';

export default function ProfilePage() {
  const { profile, isPremium, isAdmin, isCreator, updateProfile, signOut } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setDisplayName(profile?.display_name ?? '');
  }, [profile?.display_name]);

  const save = async () => {
    setBusy(true);
    setMessage(null);
    const { error } = await updateProfile({ displayName, avatarFile });
    setBusy(false);
    setMessage(error ?? 'Profile saved.');
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-3xl font-serif font-bold">Profile</h1>
      <div className="flex flex-col items-center gap-3">
        <CoverArt title={profile?.display_name ?? 'You'} uri={profile?.avatar_url} size={96} rounded={48} />
        <div className="flex flex-wrap gap-2 justify-center">
          <span className="chip">{profile?.role ?? 'listener'}</span>
          <span className="chip">{isPremium ? 'premium' : 'free'}</span>
          {isAdmin ? <span className="chip">admin</span> : null}
          {isCreator ? <span className="chip">creator</span> : null}
        </div>
      </div>
      <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Display name" />
      <input type="file" accept="image/*" onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)} />
      {message ? <p className="text-sm text-muted">{message}</p> : null}
      <button type="button" className="btn btn-primary w-full" disabled={busy} onClick={() => void save()}>Save profile</button>
      <div className="space-y-2">
        {!isCreator ? <Link href="/creator/become" className="card block p-4">Become a Creator</Link> : <Link href="/creator" className="card block p-4">Creator dashboard</Link>}
        {isAdmin ? <Link href="/admin" className="card block p-4">Admin dashboard</Link> : null}
        <Link href="/notifications" className="card block p-4">Notifications</Link>
        <Link href="/legal/privacy" className="card block p-4">Privacy Policy</Link>
        <Link href="/legal/terms" className="card block p-4">Terms of Use</Link>
        <button type="button" className="btn btn-outline w-full" onClick={() => void signOut()}>Sign out</button>
      </div>
    </div>
  );
}
