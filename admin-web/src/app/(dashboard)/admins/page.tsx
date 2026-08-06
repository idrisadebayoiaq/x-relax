import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { AdminsManager } from './AdminsManager';

export default async function AdminsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: admin } = await supabase
    .from('admin_profiles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (admin?.role !== 'super') {
    return (
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Admin team</h1>
        <p className="text-muted mt-4">Only super admins can manage the admin team.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">Admin team</h1>
      <p className="text-muted mt-2 mb-8">
        Add finance, content, or support admins. They can sign in here with the same email they use on the app or website.
      </p>
      <AdminsManager />
    </div>
  );
}
