'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';

type Thread = {
  id: string;
  subject: string | null;
  status: string;
  updated_at: string;
};

export default function AdminSupportPage() {
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState<Thread[]>([]);

  useEffect(() => {
    if (!isAdmin) return;
    createClient()
      .from('support_threads')
      .select('id, subject, status, updated_at')
      .order('updated_at', { ascending: false })
      .then(({ data }) => setRows((data as Thread[]) ?? []));
  }, [isAdmin]);

  if (!isAdmin) return null;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Support inbox</h2>
      <div className="space-y-3">
        {rows.map((row) => (
          <Link key={row.id} href={`/admin/support/${row.id}`} className="card block p-4">
            <p className="font-semibold">{row.subject ?? 'Support thread'}</p>
            <p className="text-sm text-muted">{row.status} · {new Date(row.updated_at).toLocaleString()}</p>
          </Link>
        ))}
        {!rows.length ? <p className="text-muted">No support threads.</p> : null}
      </div>
    </div>
  );
}
