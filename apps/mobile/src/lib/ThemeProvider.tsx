import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';
import { resolveColors, type ThemeColors, type ThemePreference } from './theme';
import { supabase } from './supabase';
import { useAuth } from '../features/auth/AuthProvider';

const THEME_KEY = 'xrelax.theme.preference.v1';

type ThemeContextValue = {
  preference: ThemePreference;
  colors: ThemeColors;
  isDark: boolean;
  setPreference: (next: ThemePreference) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export { ThemeContext };

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const { user, profile, refreshProfile } = useAuth();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await AsyncStorage.getItem(THEME_KEY);
      if (cancelled) return;
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        setPreferenceState(stored);
        return;
      }
      const fromProfile = profile?.theme_preference;
      if (fromProfile === 'light' || fromProfile === 'dark' || fromProfile === 'system') {
        setPreferenceState(fromProfile);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profile?.theme_preference]);

  const setPreference = useCallback(
    async (next: ThemePreference) => {
      setPreferenceState(next);
      await AsyncStorage.setItem(THEME_KEY, next);
      if (user) {
        await supabase
          .from('profiles')
          .update({ theme_preference: next, updated_at: new Date().toISOString() })
          .eq('id', user.id);
        await refreshProfile();
      }
    },
    [user, refreshProfile],
  );

  const colors = useMemo(
    () => resolveColors(preference, systemScheme),
    [preference, systemScheme],
  );
  const isDark = colors.scheme === 'dark';

  const value = useMemo(
    () => ({ preference, colors, isDark, setPreference }),
    [preference, colors, isDark, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
