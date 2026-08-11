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
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';

export type ThemePreference = 'system' | 'light' | 'dark';

type ThemeContextValue = {
  preference: ThemePreference;
  resolved: 'light' | 'dark';
  setPreference: (next: ThemePreference) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);
const THEME_KEY = 'xrelax.theme.preference.v1';

function resolveTheme(preference: ThemePreference): 'light' | 'dark' {
  if (preference === 'light' || preference === 'dark') return preference;
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user, profile, refreshProfile } = useAuth();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [resolved, setResolved] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const stored = localStorage.getItem(THEME_KEY) as ThemePreference | null;
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      setPreferenceState(stored);
      return;
    }
    const fromProfile = profile?.theme_preference as ThemePreference | undefined;
    if (fromProfile === 'light' || fromProfile === 'dark' || fromProfile === 'system') {
      setPreferenceState(fromProfile);
    }
  }, [profile?.theme_preference]);

  useEffect(() => {
    const apply = () => {
      const next = resolveTheme(preference);
      setResolved(next);
      document.documentElement.dataset.theme = next;
      document.documentElement.style.colorScheme = next;
    };
    apply();
    if (preference !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => apply();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [preference]);

  const setPreference = useCallback(
    async (next: ThemePreference) => {
      setPreferenceState(next);
      localStorage.setItem(THEME_KEY, next);
      if (user) {
        await createClient()
          .from('profiles')
          .update({ theme_preference: next, updated_at: new Date().toISOString() })
          .eq('id', user.id);
        await refreshProfile();
      }
    },
    [user, refreshProfile],
  );

  const value = useMemo(
    () => ({ preference, resolved, setPreference }),
    [preference, resolved, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useWebTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useWebTheme must be used within ThemeProvider');
  return ctx;
}
