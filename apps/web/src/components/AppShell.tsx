'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import {
  Download,
  FileText,
  Gem,
  Home,
  Layers,
  Moon,
  LayoutDashboard,
  Library,
  LogOut,
  Mic,
  Music2,
  Search,
  Settings,
  Shield,
  Upload,
  User,
  Wallet,
  Bell,
  BadgeCheck,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { PlayerBar } from '@/components/PlayerBar';
import { SleepTimeWatcher } from '@/components/SleepTimeWatcher';
import { ThemeToggle } from '@/components/ThemeToggle';

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  locked?: boolean;
};

const MAIN_NAV: NavItem[] = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/search', label: 'Search', icon: Search },
  { href: '/library', label: 'Library', icon: Library },
  { href: '/premium', label: 'Premium', icon: Gem },
  { href: '/mix', label: 'Mix Studio', icon: Layers },
  { href: '/sleep', label: 'Sleep Time', icon: Moon },
  { href: '/profile', label: 'Profile', icon: User },
  { href: '/settings', label: 'Settings', icon: Settings },
];

const CREATOR_NAV: NavItem[] = [
  { href: '/creator', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/creator/upload', label: 'Upload', icon: Upload },
  { href: '/creator/sounds', label: 'My sounds', icon: Music2 },
  { href: '/creator/verification', label: 'Verification', icon: BadgeCheck },
  { href: '/creator/withdrawals', label: 'Withdrawals', icon: Wallet },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isCreator, isAdmin, canUseMixes, profile, signOut } = useAuth();

  const isAuthPage =
    pathname.startsWith('/login') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/legal');

  const isAdminPage = pathname.startsWith('/admin');

  if (isAuthPage) return <>{children}</>;

  if (isAdminPage) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <main className="p-4 md:p-6">{children}</main>
      </div>
    );
  }

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="min-h-screen flex">
      <aside className="hidden lg:flex w-64 flex-col border-r border-border bg-surface sticky top-0 h-screen">
        <div className="px-5 pt-5 pb-3 shrink-0">
          <p className="text-2xl font-serif font-bold tracking-tight">X-Relax</p>
          <p className="text-sm text-muted mt-1 truncate">{profile?.display_name ?? 'Welcome'}</p>
        </div>

        <div className="px-5 pb-3 shrink-0">
          <button
            type="button"
            onClick={() => router.push('/search')}
            className="w-full flex items-center gap-2 rounded-xl bg-background border border-border px-3 py-2.5 text-sm text-muted hover:text-foreground"
          >
            <Search className="h-4 w-4 shrink-0" />
            <span>Search sounds…</span>
          </button>
        </div>

        <nav className="flex-1 min-h-0 overflow-y-auto sidebar-scroll px-3 pb-4 space-y-0.5">
          {MAIN_NAV.map((item) => {
            const active = isActive(item.href);
            const locked = item.href === '/mix' && !canUseMixes;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-xl px-3 py-2.5 text-sm flex items-center gap-3 ${
                  active ? 'bg-accent text-on-accent' : 'hover:bg-background text-foreground'
                }`}
              >
                <Icon className="h-4.5 w-4.5 shrink-0" size={18} strokeWidth={active ? 2.25 : 1.75} />
                <span className="flex-1">{item.label}</span>
                {locked ? <span className="text-[10px] opacity-70">Premium</span> : null}
              </Link>
            );
          })}

          {isCreator ? (
            <>
              <p className="text-[11px] uppercase tracking-wider text-muted mt-5 mb-1.5 px-2">
                Creator
              </p>
              {CREATOR_NAV.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-xl px-3 py-2.5 text-sm flex items-center gap-3 ${
                      active ? 'bg-accent text-on-accent' : 'hover:bg-background text-foreground'
                    }`}
                  >
                    <Icon className="shrink-0" size={18} strokeWidth={active ? 2.25 : 1.75} />
                    {item.label}
                  </Link>
                );
              })}
            </>
          ) : (
            <Link
              href="/creator/become"
              className="rounded-xl px-3 py-2.5 text-sm flex items-center gap-3 hover:bg-background mt-4"
            >
              <Mic size={18} strokeWidth={1.75} className="shrink-0" />
              Become a creator
            </Link>
          )}

          {isAdmin ? (
            <>
              <p className="text-[11px] uppercase tracking-wider text-muted mt-5 mb-1.5 px-2">
                Admin
              </p>
              <Link
                href="/admin"
                className={`rounded-xl px-3 py-2.5 text-sm flex items-center gap-3 ${
                  pathname.startsWith('/admin')
                    ? 'bg-accent text-on-accent'
                    : 'hover:bg-background text-foreground'
                }`}
              >
                <Shield size={18} strokeWidth={1.75} className="shrink-0" />
                Admin dashboard
              </Link>
            </>
          ) : null}

          <div className="pt-4 mt-4 border-t border-border space-y-2">
            <p className="text-[11px] uppercase tracking-wider text-muted px-2">Appearance</p>
            <ThemeToggle />
          <div className="space-y-0.5">
            <Link
              href="/download"
              className="rounded-xl px-3 py-2.5 text-sm flex items-center gap-3 hover:bg-background"
            >
              <Download size={18} strokeWidth={1.75} className="shrink-0" />
              Download app
            </Link>
            <Link
              href="/notifications"
              className="rounded-xl px-3 py-2.5 text-sm flex items-center gap-3 hover:bg-background"
            >
              <Bell size={18} strokeWidth={1.75} className="shrink-0" />
              Notifications
            </Link>
            <Link
              href="/legal/privacy"
              className="rounded-xl px-3 py-2.5 text-sm flex items-center gap-3 hover:bg-background"
            >
              <FileText size={18} strokeWidth={1.75} className="shrink-0" />
              Legal
            </Link>
            <button
              type="button"
              onClick={() => void signOut()}
              className="w-full rounded-xl px-3 py-2.5 text-sm flex items-center gap-3 hover:bg-background text-left"
            >
              <LogOut size={18} strokeWidth={1.75} className="shrink-0" />
              Sign out
            </button>
          </div>
          </div>
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <header className="lg:hidden border-b border-border px-4 py-3 sticky top-0 bg-background z-20 shrink-0 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p className="font-serif font-bold text-xl shrink-0 text-foreground">X-Relax</p>
            <div className="w-40 shrink-0">
              <ThemeToggle />
            </div>
          </div>
          <nav className="flex gap-1 overflow-x-auto rail-scroll text-sm">
            {MAIN_NAV.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg whitespace-nowrap ${
                    active ? 'font-semibold bg-accent text-on-accent' : 'text-muted'
                  }`}
                >
                  <Icon size={15} strokeWidth={active ? 2.25 : 1.75} />
                  {item.label}
                </Link>
              );
            })}
            {isAdmin ? (
              <Link
                href="/admin"
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg whitespace-nowrap ${
                  pathname.startsWith('/admin') ? 'font-semibold bg-accent text-on-accent' : 'text-muted'
                }`}
              >
                <Shield size={15} />
                Admin
              </Link>
            ) : null}
          </nav>
        </header>
        <main className="flex-1 overflow-y-auto main-scroll p-4 md:p-6 pb-28">{children}</main>
        {user ? <SleepTimeWatcher /> : null}
        <PlayerBar />
      </div>
    </div>
  );
}
