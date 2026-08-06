'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
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
  const blockedOffline = !loading && !online && !offlineAllowed;

  const value = useMemo(
    () => ({ online, offlineAllowed, blockedOffline }),
    [online, offlineAllowed, blockedOffline],
  );

  if (blockedOffline) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 text-center">
        <div className="card max-w-md p-8 space-y-3">
          <h1 className="text-2xl font-serif font-bold">You&apos;re offline</h1>
          <p className="text-muted">
            Free accounts need an internet connection to listen. Upgrade to Premium to download sounds
            and use X-Relax offline.
          </p>
          <a href="/premium" className="btn btn-primary inline-block">View Premium</a>
        </div>
      </div>
    );
  }

  return (
    <OfflineContext.Provider value={value}>
      {!online && offlineAllowed ? (
        <div className="bg-foreground text-background text-center text-sm py-2 px-4">
          Offline mode · only downloaded sounds are available
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
