'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

const NAV = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/payments', label: 'Payments' },
  { href: '/admin/moderation', label: 'Moderation' },
  { href: '/admin/verifications', label: 'Verifications' },
  { href: '/admin/withdrawals', label: 'Withdrawals' },
  { href: '/admin/reports', label: 'Reports' },
  { href: '/admin/support', label: 'Support' },
  { href: '/admin/featured', label: 'Featured' },
  { href: '/admin/announcements', label: 'Announcements' },
  { href: '/admin/releases', label: 'App releases' },
  { href: '/admin/settings', label: 'Settings' },
  { href: '/admin/audit', label: 'Audit log' },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isAdmin, adminProfile, loading } = useAuth();
  const isSuper = adminProfile?.role === 'super';

  if (loading) {
    return <p className="text-muted p-8">Loading…</p>;
  }

  if (!isAdmin) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center space-y-3">
        <h1 className="text-2xl font-serif font-bold">Admin only</h1>
        <p className="text-muted">You do not have access to the admin dashboard.</p>
        <Link href="/" className="underline text-sm">
          Back to home
        </Link>
      </div>
    );
  }

  const items = isSuper ? [...NAV, { href: '/admin/admins', label: 'Admin team' }] : NAV;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted">Admin dashboard</p>
          <h1 className="text-2xl font-serif font-bold">Operations</h1>
          <p className="text-sm text-muted mt-1">
            Role: {adminProfile?.role ?? 'admin'} · only visible to admins
          </p>
        </div>
        <Link href="/" className="chip">
          ← Back to app
        </Link>
      </div>

      <nav className="flex gap-2 overflow-x-auto pb-3 mb-6 border-b border-border">
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`chip whitespace-nowrap ${active ? 'chip-active' : ''}`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}
