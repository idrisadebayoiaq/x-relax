'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export function ActionButton({
  label,
  onAction,
  primary = false,
}: {
  label: string;
  onAction: () => Promise<void>;
  primary?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <button
      disabled={pending}
      className={
        primary
          ? 'rounded-lg bg-foreground text-background px-3 py-1.5 text-sm font-semibold disabled:opacity-50'
          : 'rounded-lg border border-border px-3 py-1.5 text-sm disabled:opacity-50'
      }
      onClick={() =>
        start(async () => {
          await onAction();
          router.refresh();
        })
      }
    >
      {pending ? '…' : label}
    </button>
  );
}

export function useAdminClient() {
  return createClient();
}
