'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/', label: 'Dashboard' },
  { href: '/payments', label: 'Payments' },
  { href: '/moderation', label: 'Moderation' },
  { href: '/verifications', label: 'Verifications' },
  { href: '/withdrawals', label: 'Withdrawals' },
  { href: '/reports', label: 'Reports' },
  { href: '/support', label: 'Support' },
  { href: '/featured', label: 'Featured' },
  { href: '/announcements', label: 'Announcements' },
  { href: '/releases', label: 'App releases' },
  { href: '/settings', label: 'Settings' },
  { href: '/audit', label: 'Audit log' },
];

export function AdminNav({ isSuper }: { isSuper: boolean }) {
  const pathname = usePathname();
  const items = isSuper ? [...NAV, { href: '/admins', label: 'Admin team' }] : NAV;

  return (
    <nav className="flex md:flex-col gap-1 overflow-x-auto pb-2 md:pb-0">
      {items.map((item) => {
        const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`px-3 py-2 rounded-lg text-sm whitespace-nowrap ${
              active ? 'bg-accent text-on-accent' : 'text-muted hover:bg-surface hover:text-foreground'
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
