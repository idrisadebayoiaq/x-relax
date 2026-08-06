'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import type { AdminRole } from '@/types/database';

type AdminListRow = {
  user_id: string;
  email: string;
  display_name: string | null;
  admin_role: AdminRole;
  has_verified_badge: boolean;
  created_at: string;
};

const ROLES: AdminRole[] = ['finance', 'content', 'support'];

export default function AdminTeamPage() {
  const { isAdmin, adminProfile } = useAuth();
  const [rows, setRows] = useState<AdminListRow[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AdminRole>('support');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const isSuper = adminProfile?.role === 'super';

  const load = async () => {
    setLoading(true);
    setError(null);
    const { data, error: loadError } = await createClient().rpc('admin_list_admins');
    setLoading(false);
    if (loadError) {
      setError(loadError.message);
      return;
    }
    setRows((data as AdminListRow[]) ?? []);
  };

  useEffect(() => {
    if (isAdmin && isSuper) void load();
  }, [isAdmin, isSuper]);

  if (!isAdmin) return null;

  if (!isSuper) {
    return <p className="text-muted">Only super admins can manage the admin team.</p>;
  }

  const addAdmin = async () => {
    setError(null);
    const trimmed = email.trim();
    if (!trimmed) return;
    const { error: addError } = await createClient().rpc('admin_add_admin', {
      p_email: trimmed,
      p_role: role,
    });
    if (addError) setError(addError.message);
    else {
      setEmail('');
      void load();
    }
  };

  const removeAdmin = async (userId: string) => {
    if (!confirm('Remove admin access for this user?')) return;
    const { error: removeError } = await createClient().rpc('admin_remove_admin', {
      p_user_id: userId,
    });
    if (removeError) alert(removeError.message);
    else void load();
  };

  const changeRole = async (userId: string, nextRole: AdminRole) => {
    const { error: updateError } = await createClient().rpc('admin_update_admin_role', {
      p_user_id: userId,
      p_role: nextRole,
    });
    if (updateError) alert(updateError.message);
    else void load();
  };

  const setVerifiedBadge = async (userId: string, enabled: boolean) => {
    const { error: badgeError } = await createClient().rpc('admin_set_admin_verified_badge', {
      p_user_id: userId,
      p_enabled: enabled,
    });
    if (badgeError) alert(badgeError.message);
    else void load();
  };

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h2 className="text-xl font-semibold">Admin team</h2>
        <p className="text-sm text-muted mt-1">
          Super admins can grant the blue verified badge to other admins. Unverified admins show a
          warning when messaging users or posting announcements.
        </p>
      </div>
      <div className="card p-5 space-y-4">
        <p className="text-sm text-muted">
          Add finance, content, or support admins. They must already have an X-Relax account.
        </p>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <input
            className="input"
            type="email"
            placeholder="user@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <select className="input" value={role} onChange={(e) => setRole(e.target.value as AdminRole)}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <button type="button" className="btn btn-primary" onClick={() => void addAdmin()}>
            Add admin
          </button>
        </div>
        {error ? <p className="text-sm">{error}</p> : null}
      </div>

      <div className="space-y-3">
        {loading ? <p className="text-muted">Loading…</p> : null}
        {rows.map((row) => (
          <div key={row.user_id} className="card p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold flex items-center gap-2">
                {row.display_name ?? 'User'}
                {row.has_verified_badge ? (
                  <span className="text-xs uppercase tracking-wider text-blue-700">blue verified</span>
                ) : (
                  <span className="text-xs uppercase tracking-wider text-amber-700">unverified</span>
                )}
              </p>
              <p className="text-sm text-muted">{row.email}</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {row.admin_role === 'super' ? (
                <span className="chip chip-active">super · verified</span>
              ) : (
                <>
                  <select
                    className="input w-auto"
                    value={row.admin_role}
                    onChange={(e) => void changeRole(row.user_id, e.target.value as AdminRole)}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className={`chip ${row.has_verified_badge ? 'chip-active' : ''}`}
                    onClick={() => void setVerifiedBadge(row.user_id, !row.has_verified_badge)}
                  >
                    {row.has_verified_badge ? 'Revoke blue badge' : 'Grant blue badge'}
                  </button>
                  <button type="button" className="chip" onClick={() => void removeAdmin(row.user_id)}>
                    Remove
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
