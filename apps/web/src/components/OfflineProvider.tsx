'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { isOnline } from '@/lib/offline-storage';

type OfflineContextValue = {
  online: boolean;
  offlineAllowed: boolean;
  blockedOffline: boolean;
};

const OfflineContext = createContext<OfflineContextValue | undefined>(undefined);

export function OfflineProvider({ children }: { children: ReactNode }) {
  const { canDownloadOffline, loading } = useAuth();
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(isOnline());
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const offlineAllowed = canDownloadOffline;
  // Never hard-block the whole app — let users open Library / Downloads offline.
  const blockedOffline = false;

  const value = useMemo(
    () => ({ online, offlineAllowed, blockedOffline }),
    [online, offlineAllowed, blockedOffline],
  );

  return (
    <OfflineContext.Provider value={value}>
      {!online ? (
        <div className="bg-foreground text-background text-center text-sm py-2 px-4 space-y-1">
          <p>Offline mode · only downloaded sounds can play</p>
          {!offlineAllowed && !loading ? (
            <p>
              Free accounts need Premium to download.{' '}
              <Link href="/premium" className="underline">
                Upgrade
              </Link>
            </p>
          ) : (
            <p>
              Open{' '}
              <Link href="/library" className="underline">
                Library → Downloads
              </Link>
            </p>
          )}
        </div>
      ) : null}
      {children}
    </OfflineContext.Provider>
  );
}

export function useOffline() {
  const ctx = useContext(OfflineContext);
  if (!ctx) throw new Error('useOffline must be used within OfflineProvider');
  return ctx;
}
