'use client';

import { useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';

export function ServiceWorkerRegister() {
  const { canDownloadOffline, loading } = useAuth();

  useEffect(() => {
    if (loading || !canDownloadOffline || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  }, [canDownloadOffline, loading]);

  return null;
}
