import { createClient } from '@/lib/supabase/server';
import { SignOutButton } from '@/components/SignOutButton';
import { AdminNav } from '@/components/AdminNav';
import { ThemeToggle } from '@/components/ThemeToggle';

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
      <aside className="md:w-64 md:shrink-0 border-b md:border-b-0 md:border-r border-border p-5 md:min-h-screen md:sticky md:top-0">
        <div className="mb-8">
          <div className="text-lg font-bold tracking-tight">X-Relax</div>
          <div className="text-xs text-muted mt-1 uppercase tracking-wider">
            {admin?.role ?? 'admin'} dashboard
          </div>
        </div>
        <AdminNav isSuper={admin?.role === 'super'} />
        <div className="mt-8">
          <div className="text-[11px] uppercase tracking-wider text-muted mb-2">Appearance</div>
          <ThemeToggle />
        </div>
        <div className="mt-10 pt-6 border-t border-border">
          <div className="text-xs text-muted break-all">{user?.email}</div>
          <div className="mt-3">
            <SignOutButton />
          </div>
        </div>
      </aside>
      <main className="flex-1 p-6 md:p-10 max-w-6xl">{children}</main>
    </div>
  );
}
