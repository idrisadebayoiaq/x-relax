import { useMemo } from 'react';
import { useColorScheme } from 'react-native';
import {
  resolveColors,
  type ThemeColors,
  type ThemePreference,
} from './theme';

/** Phase 0: system-driven theme. User override comes in Phase 1. */
export function useAppTheme(preference: ThemePreference = 'system'): {
  colors: ThemeColors;
  isDark: boolean;
} {
  const systemScheme = useColorScheme();
  const colors = useMemo(
    () => resolveColors(preference, systemScheme),
    [preference, systemScheme],
  );
  const isDark = colors.background === '#000000';
  return { colors, isDark };
}
