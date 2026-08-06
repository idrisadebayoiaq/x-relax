'use client';

import { OfflineProvider } from '@/components/OfflineProvider';
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister';
import { AuthProvider } from '@/lib/auth-context';
import { PlayerProvider } from '@/lib/player-context';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <OfflineProvider>
        <PlayerProvider>
          <ServiceWorkerRegister />
          {children}
        </PlayerProvider>
      </OfflineProvider>
    </AuthProvider>
  );
}
