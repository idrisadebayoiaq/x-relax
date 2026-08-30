'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { COUNTRIES } from '@/lib/countries';
import type { SignupRole } from '@/types/database';

export default function SignupPage() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<SignupRole>('listener');
  const [countryCode, setCountryCode] = useState('');
  const [enablePush, setEnablePush] = useState(true);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreedToTerms) {
      setError('Please agree to the Terms of Use and Privacy Policy');
      return;
    }
    if (!countryCode) {
      setError('Please select your country');
      return;
    }
    setBusy(true);
    setError(null);
    const { error: err } = await signUp({
      email,
      password,
      displayName,
      role,
      countryCode,
      enablePush,
    });
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
        <input
          className="input"
          placeholder="Display name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
        />
        <input
          className="input"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="input"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
        />
        <label className="block space-y-1">
          <span className="text-xs uppercase tracking-wide text-muted">Country</span>
          <select
            className="input w-full"
            value={countryCode}
            onChange={(e) => setCountryCode(e.target.value)}
            required
          >
            <option value="">Select your country</option>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-2">
          {(['listener', 'creator'] as SignupRole[]).map((r) => (
            <button
              key={r}
              type="button"
              className={`chip ${role === r ? 'chip-active' : ''}`}
              onClick={() => setRole(r)}
            >
              {r === 'listener' ? 'Listener' : 'Creator'}
            </button>
          ))}
        </div>
        <label className="flex items-start gap-3 rounded-2xl border border-border px-4 py-3 cursor-pointer">
          <input
            type="checkbox"
            className="mt-1"
            checked={enablePush}
            onChange={(e) => setEnablePush(e.target.checked)}
          />
          <span>
            <span className="block font-semibold">Enable push notifications</span>
            <span className="block text-xs text-muted mt-0.5">
              Stay on until you turn them off in Settings. You will not be asked again.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-3 rounded-2xl border border-border px-4 py-3 cursor-pointer">
          <input
            type="checkbox"
            className="mt-1"
            checked={agreedToTerms}
            onChange={(e) => setAgreedToTerms(e.target.checked)}
          />
          <span className="text-sm">
            I agree to the{' '}
            <Link href="/legal/terms" className="underline font-semibold" target="_blank">
              Terms of Use
            </Link>{' '}
            and{' '}
            <Link href="/legal/privacy" className="underline font-semibold" target="_blank">
              Privacy Policy
            </Link>
          </span>
        </label>
        <button type="submit" className="btn btn-primary w-full" disabled={busy || !agreedToTerms}>
          {busy ? 'Creating…' : 'Sign up'}
        </button>
        <p className="text-sm text-muted">
          Already have an account?{' '}
          <Link href="/login" className="underline">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
