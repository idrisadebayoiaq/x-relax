export type ThemeColors = {
  background: string;
  surface: string;
  border: string;
  text: string;
  textMuted: string;
  icon: string;
  inverse: string;
  inverseText: string;
  splashBackground: string;
  success: string;
  danger: string;
};

export const darkColors: ThemeColors = {
  background: '#000000',
  surface: '#171717',
  border: '#262626',
  text: '#FFFFFF',
  textMuted: '#A3A3A3',
  icon: '#FFFFFF',
  inverse: '#FFFFFF',
  inverseText: '#000000',
  splashBackground: '#000000',
  success: '#FFFFFF',
  danger: '#FFFFFF',
};

export const lightColors: ThemeColors = {
  background: '#FFFFFF',
  surface: '#F5F5F5',
  border: '#E5E5E5',
  text: '#000000',
  textMuted: '#525252',
  icon: '#000000',
  inverse: '#000000',
  inverseText: '#FFFFFF',
  splashBackground: '#FFFFFF',
  success: '#000000',
  danger: '#000000',
};

export type ThemePreference = 'system' | 'light' | 'dark';

export function resolveColors(
  preference: ThemePreference,
  systemScheme: string | null | undefined,
): ThemeColors {
  const scheme =
    preference === 'system'
      ? systemScheme === 'light'
        ? 'light'
        : 'dark'
      : preference;
  return scheme === 'light' ? lightColors : darkColors;
}
