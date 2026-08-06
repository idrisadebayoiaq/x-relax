'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { getAdminDashboardUrl } from '@/lib/admin-url';
import { PlayerBar } from '@/components/PlayerBar';

const MAIN_NAV = [
  { href: '/', label: 'Home', icon: '⌂' },
  { href: '/search', label: 'Search', icon: '⌕' },
  { href: '/library', label: 'Library', icon: '☰' },
  { href: '/premium', label: 'Premium', icon: '◆' },
  { href: '/mix', label: 'Mix Studio', icon: '◎' },
  { href: '/profile', label: 'Profile', icon: '☺' },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isCreator, isAdmin, canUseMixes, profile, signOut } = useAuth();

  const isAuthPage =
    pathname.startsWith('/login') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/legal');

  if (isAuthPage) return <>{children}</>;

  return (
    <div className="min-h-screen flex">
      <aside className="hidden lg:flex w-64 flex-col border-r border-border bg-surface p-5 gap-1 sticky top-0 h-screen">
        <div className="mb-6">
          <p className="text-2xl font-serif font-bold tracking-tight">X-Relax</p>
          <p className="text-sm text-muted mt-1">{profile?.display_name ?? 'Welcome'}</p>
        </div>
        {MAIN_NAV.map((item) => {
          const active = pathname === item.href;
          const locked = item.href === '/mix' && !canUseMixes;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-xl px-3 py-2.5 text-sm flex items-center gap-2 ${
                active ? 'bg-foreground text-background' : 'hover:bg-background'
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
              {locked ? <span className="text-[10px] opacity-70">Premium</span> : null}
            </Link>
          );
        })}
        {isCreator ? (
          <>
            <p className="text-[11px] uppercase tracking-wider text-muted mt-4 mb-1 px-2">Creator</p>
            <Link href="/creator" className="rounded-xl px-3 py-2 text-sm hover:bg-background">
              Dashboard
            </Link>
            <Link href="/creator/upload" className="rounded-xl px-3 py-2 text-sm hover:bg-background">
              Upload
            </Link>
            <Link href="/creator/sounds" className="rounded-xl px-3 py-2 text-sm hover:bg-background">
              My sounds
            </Link>
            <Link href="/creator/verification" className="rounded-xl px-3 py-2 text-sm hover:bg-background">
              Verification
            </Link>
            <Link href="/creator/withdrawals" className="rounded-xl px-3 py-2 text-sm hover:bg-background">
              Withdrawals
            </Link>
          </>
        ) : (
          <Link href="/creator/become" className="rounded-xl px-3 py-2 text-sm hover:bg-background mt-4">
            Become a creator
          </Link>
        )}
        {isAdmin ? (
          <>
            <p className="text-[11px] uppercase tracking-wider text-muted mt-4 mb-1 px-2">Admin</p>
            <a
              href={getAdminDashboardUrl()}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl px-3 py-2 text-sm hover:bg-background block"
            >
              Admin dashboard ↗
            </a>
          </>
        ) : null}
        <div className="mt-auto pt-4 border-t border-border">
          <Link href="/download" className="block rounded-xl px-3 py-2 text-sm hover:bg-background">
            Download app
          </Link>
          <Link href="/notifications" className="block rounded-xl px-3 py-2 text-sm hover:bg-background">
            Notifications
          </Link>
          <Link href="/legal/privacy" className="block rounded-xl px-3 py-2 text-sm hover:bg-background">
            Legal
          </Link>
          <button
            type="button"
            onClick={() => void signOut()}
            className="w-full text-left rounded-xl px-3 py-2 text-sm hover:bg-background mt-1"
          >
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden border-b border-border px-4 py-3 flex items-center justify-between sticky top-0 bg-background z-20">
          <p className="font-serif font-bold text-xl">X-Relax</p>
          <nav className="flex gap-3 text-sm overflow-x-auto">
            {MAIN_NAV.slice(0, 5).map((item) => (
              <Link key={item.href} href={item.href} className={pathname === item.href ? 'font-bold' : 'text-muted'}>
                {item.label}
              </Link>
            ))}
          </nav>
        </header>
        <main className="flex-1 p-4 md:p-6 pb-28">{children}</main>
        <PlayerBar />
      </div>
    </div>
  );
}
