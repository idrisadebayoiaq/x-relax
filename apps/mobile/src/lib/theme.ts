export type ThemeColors = {
  scheme: 'light' | 'dark';
  background: string;
  surface: string;
  elevated: string;
  border: string;
  text: string;
  textMuted: string;
  icon: string;
  inverse: string;
  inverseText: string;
  accent: string;
  accentSoft: string;
  onAccent: string;
  brand: string;
  gradientTop: string;
  splashBackground: string;
  success: string;
  danger: string;
};

export const darkColors: ThemeColors = {
  scheme: 'dark',
  background: '#061428',
  surface: '#0C1E3D',
  elevated: '#122850',
  border: '#C9A227',
  text: '#FFFFFF',
  textMuted: '#F0D56A',
  icon: '#FFD54A',
  inverse: '#FFD54A',
  inverseText: '#061428',
  accent: '#FFD54A',
  accentSoft: 'rgba(255, 213, 74, 0.18)',
  onAccent: '#061428',
  brand: '#5B8FFF',
  gradientTop: '#0C1E3D',
  splashBackground: '#061428',
  success: '#4ADE80',
  danger: '#F87171',
};

export const lightColors: ThemeColors = {
  scheme: 'light',
  background: '#FFFFFF',
  surface: '#FFF8E1',
  elevated: '#FFFFFF',
  border: '#E2C86A',
  text: '#0A1B36',
  textMuted: '#0B3D91',
  icon: '#0B3D91',
  inverse: '#F5C400',
  inverseText: '#0A1B36',
  accent: '#F5C400',
  accentSoft: 'rgba(245, 196, 0, 0.16)',
  onAccent: '#0A1B36',
  brand: '#0B3D91',
  gradientTop: '#FFF3BF',
  splashBackground: '#FFFFFF',
  success: '#15803D',
  danger: '#B91C1C',
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
