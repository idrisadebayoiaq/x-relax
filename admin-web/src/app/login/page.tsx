import { Suspense } from 'react';
import LoginForm from './LoginForm';

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="min-h-screen grid place-items-center">Loading…</main>}>
      <LoginForm />
    </Suspense>
  );
}
