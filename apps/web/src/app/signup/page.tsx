'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import type { SignupRole } from '@/types/database';

export default function SignupPage() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<SignupRole>('listener');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await signUp({ email, password, displayName, role });
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    router.replace('/');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={submit} className="card w-full max-w-md p-8 space-y-4">
        <h1 className="text-3xl font-serif font-bold">Create account</h1>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <input className="input" placeholder="Display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
        <input className="input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className="input" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
        <div className="flex gap-2">
          {(['listener', 'creator'] as SignupRole[]).map((r) => (
            <button key={r} type="button" className={`chip ${role === r ? 'chip-active' : ''}`} onClick={() => setRole(r)}>
              {r === 'listener' ? 'Listener' : 'Creator'}
            </button>
          ))}
        </div>
        <button type="submit" className="btn btn-primary w-full" disabled={busy}>
          {busy ? 'Creating…' : 'Sign up'}
        </button>
        <p className="text-sm text-muted">
          Already have an account? <Link href="/login" className="underline">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
