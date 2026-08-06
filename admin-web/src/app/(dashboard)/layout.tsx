import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { SignOutButton } from '@/components/SignOutButton';

const NAV = [
  { href: '/', label: 'Overview' },
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

const SUPER_NAV = [{ href: '/admins', label: 'Admin team' }];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: admin } = user
    ? await supabase
        .from('admin_profiles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle()
    : { data: null };

  return (
    <div className="min-h-screen bg-background text-foreground md:flex">
      <aside className="md:w-56 border-b md:border-b-0 md:border-r border-border p-4 md:min-h-screen">
        <div className="font-bold text-lg mb-1">X-Relax</div>
        <div className="text-xs text-muted mb-6 uppercase tracking-wider">
          {admin?.role ?? 'admin'}
        </div>
        <nav className="flex md:flex-col gap-2 overflow-x-auto pb-2 md:pb-0">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="px-3 py-2 rounded-lg border border-transparent hover:border-border hover:bg-surface whitespace-nowrap text-sm"
            >
              {item.label}
            </Link>
          ))}
          {admin?.role === 'super'
            ? SUPER_NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="px-3 py-2 rounded-lg border border-transparent hover:border-border hover:bg-surface whitespace-nowrap text-sm"
                >
                  {item.label}
                </Link>
              ))
            : null}
        </nav>
        <div className="mt-8 text-xs text-muted break-all">{user?.email}</div>
        <div className="mt-3">
          <SignOutButton />
        </div>
      </aside>
      <main className="flex-1 p-6 md:p-8">{children}</main>
    </div>
  );
}
