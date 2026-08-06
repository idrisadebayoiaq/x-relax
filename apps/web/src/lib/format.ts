export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function formatPlayCount(count: number | null | undefined): string {
  const n = Number(count ?? 0);
  if (!Number.isFinite(n) || n <= 0) return '0 plays';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M plays`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K plays`;
  return `${Math.floor(n)} play${n === 1 ? '' : 's'}`;
}

export function formatRatingSummary(
  average: number | null | undefined,
  count: number | null | undefined,
): string {
  const n = Number(count ?? 0);
  if (!n) return 'No ratings';
  const avg = Number(average ?? 0);
  return `★ ${avg.toFixed(1)} (${n})`;
}

const MOOD_PALETTES: [string, string][] = [
  ['#0B1C1D', '#2F5D5E'],
  ['#14110F', '#8A6A45'],
  ['#0E1620', '#3A4F63'],
  ['#161412', '#6B5E4E'],
  ['#0C1814', '#3F6B5A'],
  ['#1A1410', '#7A5840'],
];

export function moodPaletteFor(seed: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return MOOD_PALETTES[Math.abs(hash) % MOOD_PALETTES.length];
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}
export function formatMs(ms: number) {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
