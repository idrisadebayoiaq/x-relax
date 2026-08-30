'use client';

import { FormEvent, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(
    params.get('error') === 'not_admin' ? 'This account is not an admin.' : null,
  );
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { data, error: signError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (signError) {
      setBusy(false);
      setError(signError.message);
      return;
    }

    const { data: admin } = await supabase
      .from('admin_profiles')
      .select('role')
      .eq('user_id', data.user.id)
      .maybeSingle();

    if (!admin) {
      await supabase.auth.signOut();
      setBusy(false);
      setError('This account is not an admin.');
      return;
    }

    router.replace('/');
    router.refresh();
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-background text-foreground">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md border border-border bg-surface p-8 rounded-xl"
      >
        <h1 className="text-2xl font-bold tracking-tight">X-Relax Admin</h1>
        <p className="text-muted text-sm mt-2 mb-6">
          Email sign-in for Super / Finance / Content / Support admins. Super admin is assigned automatically for{' '}
          <strong>quoreebadebayo@gmail.com</strong> on signup.
        </p>

        <label className="block text-xs uppercase tracking-wider text-muted mb-2">Email</label>
        <input
          className="w-full border border-border bg-background text-foreground rounded-lg px-3 py-2 mb-4 outline-none"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <label className="block text-xs uppercase tracking-wider text-muted mb-2">Password</label>
        <input
          className="w-full border border-border bg-background text-foreground rounded-lg px-3 py-2 mb-4 outline-none"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error ? <p className="text-sm mb-4">{error}</p> : null}

        <ThemeToggle />
        <div className="h-3" />
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-accent text-on-accent py-2.5 font-semibold disabled:opacity-60"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}
