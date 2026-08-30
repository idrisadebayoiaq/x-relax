'use client';

import { AnalyticsBeacon } from '@/components/AnalyticsBeacon';
import { OfflineProvider } from '@/components/OfflineProvider';
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister';
import { AuthProvider } from '@/lib/auth-context';
import { PlayerProvider } from '@/lib/player-context';
import { ThemeProvider } from '@/lib/theme-context';
import { WebSettingsProvider } from '@/lib/settings-context';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ThemeProvider>
        <WebSettingsProvider>
          <OfflineProvider>
            <PlayerProvider>
              <ServiceWorkerRegister />
              <AnalyticsBeacon />
              {children}
            </PlayerProvider>
          </OfflineProvider>
        </WebSettingsProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
