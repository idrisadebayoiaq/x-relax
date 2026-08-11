'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type DownloadNetworkMode = 'wifi' | 'cellular';
export type AudioQuality = 'auto' | 'high' | 'data_saver';

export type WebAppSettings = {
  downloadNetwork: DownloadNetworkMode;
  volume: number;
  audioQuality: AudioQuality;
};

const KEY = 'xrelax.web.settings.v1';
const DEFAULTS: WebAppSettings = {
  downloadNetwork: 'cellular',
  volume: 1,
  audioQuality: 'auto',
};

type Ctx = {
  settings: WebAppSettings;
  updateSettings: (patch: Partial<WebAppSettings>) => void;
};

const SettingsContext = createContext<Ctx | undefined>(undefined);

export function WebSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<WebAppSettings>(DEFAULTS);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setSettings({ ...DEFAULTS, ...(JSON.parse(raw) as Partial<WebAppSettings>) });
    } catch {
      /* ignore */
    }
  }, []);

  const updateSettings = useCallback((patch: Partial<WebAppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      localStorage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const value = useMemo(() => ({ settings, updateSettings }), [settings, updateSettings]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useWebSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useWebSettings must be used within WebSettingsProvider');
  return ctx;
}
