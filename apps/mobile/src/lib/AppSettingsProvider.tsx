import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import NetInfo from '@react-native-community/netinfo';
import {
  DEFAULT_APP_SETTINGS,
  loadAppSettings,
  saveAppSettings,
  type AppSettings,
  type AudioQuality,
  type DownloadNetworkMode,
} from './appSettings';

type SettingsContextValue = {
  settings: AppSettings;
  online: boolean;
  isWifi: boolean;
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>;
  setDownloadNetwork: (mode: DownloadNetworkMode) => Promise<void>;
  setVolume: (volume: number) => Promise<void>;
  setAudioQuality: (quality: AudioQuality) => Promise<void>;
};

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [online, setOnline] = useState(true);
  const [isWifi, setIsWifi] = useState(true);

  useEffect(() => {
    void loadAppSettings().then(setSettings);
  }, []);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      setOnline(!!state.isConnected);
      setIsWifi(state.type === 'wifi' || state.type === 'ethernet');
    });
    return () => unsub();
  }, []);

  const updateSettings = useCallback(async (patch: Partial<AppSettings>) => {
    const next = await saveAppSettings(patch);
    setSettings(next);
  }, []);

  const setDownloadNetwork = useCallback(
    async (mode: DownloadNetworkMode) => updateSettings({ downloadNetwork: mode }),
    [updateSettings],
  );
  const setVolume = useCallback(
    async (volume: number) => updateSettings({ volume }),
    [updateSettings],
  );
  const setAudioQuality = useCallback(
    async (quality: AudioQuality) => updateSettings({ audioQuality: quality }),
    [updateSettings],
  );

  const value = useMemo(
    () => ({
      settings,
      online,
      isWifi,
      updateSettings,
      setDownloadNetwork,
      setVolume,
      setAudioQuality,
    }),
    [settings, online, isWifi, updateSettings, setDownloadNetwork, setVolume, setAudioQuality],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useAppSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useAppSettings must be used within AppSettingsProvider');
  return ctx;
}
