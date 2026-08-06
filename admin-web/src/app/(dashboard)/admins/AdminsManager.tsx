'use client';

import { useEffect, useState } from 'react';
import { ActionButton } from '@/components/ActionButton';
import { createClient } from '@/lib/supabase/client';
import type { AdminListRow, AdminRole } from '@/types/database';

const ROLES: AdminRole[] = ['finance', 'content', 'support'];

export function AdminsManager() {
  const [rows, setRows] = useState<AdminListRow[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AdminRole>('support');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
    void load();
  }, []);

  const addAdmin = async () => {
    setError(null);
    const trimmed = email.trim();
    if (!trimmed) return;
    const { error: addError } = await createClient().rpc('admin_add_admin', {
      p_email: trimmed,
      p_role: role,
    });
    if (addError) {
      setError(addError.message);
      return;
    }
    setEmail('');
    void load();
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

  return (
    <div className="space-y-8 max-w-3xl">
      <div className="border border-border bg-surface rounded-xl p-5 space-y-4">
        <h2 className="font-semibold">Add admin</h2>
        <p className="text-sm text-muted">
          The person must already have an X-Relax account (app or website). Super admins are assigned automatically
          when <strong>quoreebadebayo@gmail.com</strong> signs up.
        </p>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <input
            className="w-full border border-border bg-background rounded-lg px-3 py-2"
            type="email"
            placeholder="user@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <select
            className="border border-border bg-background rounded-lg px-3 py-2"
            value={role}
            onChange={(e) => setRole(e.target.value as AdminRole)}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <ActionButton label="Add admin" primary onAction={addAdmin} />
        </div>
        {error ? <p className="text-sm">{error}</p> : null}
      </div>

      <div className="space-y-3">
        <h2 className="font-semibold">Admin team</h2>
        {loading ? <p className="text-sm text-muted">Loading…</p> : null}
        {rows.map((row) => (
          <div
            key={row.user_id}
            className="border border-border bg-surface rounded-xl p-4 flex flex-wrap items-center justify-between gap-3"
          >
            <div>
              <p className="font-semibold">{row.display_name ?? 'User'}</p>
              <p className="text-sm text-muted">{row.email}</p>
              <p className="text-xs text-muted mt-1">Added {new Date(row.created_at).toLocaleDateString()}</p>
            </div>
            <div className="flex items-center gap-2">
              {row.admin_role === 'super' ? (
                <span className="text-xs uppercase tracking-wider border border-border rounded-lg px-2 py-1">
                  super
                </span>
              ) : (
                <select
                  className="border border-border bg-background rounded-lg px-2 py-1 text-sm"
                  value={row.admin_role}
                  onChange={(e) => void changeRole(row.user_id, e.target.value as AdminRole)}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              )}
              {row.admin_role !== 'super' ? (
                <ActionButton label="Remove" onAction={async () => removeAdmin(row.user_id)} />
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
