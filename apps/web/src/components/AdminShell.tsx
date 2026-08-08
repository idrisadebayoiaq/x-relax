'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ArrowLeft,
  BadgeCheck,
  Banknote,
  FileWarning,
  Flag,
  Headphones,
  LayoutDashboard,
  LifeBuoy,
  Megaphone,
  Settings,
  Shield,
  Sparkles,
  Users,
  Wallet,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

const NAV = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard },
  { href: '/admin/payments', label: 'Payments', icon: Banknote },
  { href: '/admin/moderation', label: 'Moderation', icon: FileWarning },
  { href: '/admin/verifications', label: 'Verifications', icon: BadgeCheck },
  { href: '/admin/withdrawals', label: 'Withdrawals', icon: Wallet },
  { href: '/admin/reports', label: 'Reports', icon: Flag },
  { href: '/admin/support', label: 'Support', icon: LifeBuoy },
  { href: '/admin/featured', label: 'Featured', icon: Sparkles },
  { href: '/admin/announcements', label: 'Announcements', icon: Megaphone },
  { href: '/admin/releases', label: 'App releases', icon: Headphones },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
  { href: '/admin/audit', label: 'Audit log', icon: Shield },
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

  const items = isSuper
    ? [...NAV, { href: '/admin/admins', label: 'Admin team', icon: Users }]
    : NAV;

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
        <Link href="/" className="chip inline-flex items-center gap-1.5">
          <ArrowLeft size={14} />
          Back to app
        </Link>
      </div>

      <nav className="flex gap-2 overflow-x-auto rail-scroll pb-3 mb-6 border-b border-border">
        {items.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`chip whitespace-nowrap inline-flex items-center gap-1.5 ${
                active ? 'chip-active' : ''
              }`}
            >
              <Icon size={14} strokeWidth={active ? 2.25 : 1.75} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}
