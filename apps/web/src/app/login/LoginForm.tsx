'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await signIn({ email, password });
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    router.replace(params.get('next') || '/');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={submit} className="card w-full max-w-md p-8 space-y-4">
        <h1 className="text-3xl font-serif font-bold">Sign in</h1>
        <p className="text-muted text-sm">Welcome back to X-Relax</p>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <input className="input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className="input" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button type="submit" className="btn btn-primary w-full" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="text-sm text-muted">
          <Link href="/forgot-password" className="underline">Forgot password?</Link>
          {' · '}
          <Link href="/signup" className="underline">Create account</Link>
        </p>
      </form>
    </div>
  );
}
