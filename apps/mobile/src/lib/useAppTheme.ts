import { useContext } from 'react';
import { useColorScheme } from 'react-native';
import { resolveColors, type ThemeColors, type ThemePreference } from './theme';
import { ThemeContext } from './ThemeProvider';

/** Uses ThemeProvider preference when available; otherwise system scheme. */
export function useAppTheme(_preference?: ThemePreference): {
  colors: ThemeColors;
  isDark: boolean;
} {
  const ctx = useContext(ThemeContext);
  const systemScheme = useColorScheme();
  if (ctx) return { colors: ctx.colors, isDark: ctx.isDark };
  const colors = resolveColors(_preference ?? 'system', systemScheme);
  return { colors, isDark: colors.scheme === 'dark' };
}

export type { ThemeColors, ThemePreference };
