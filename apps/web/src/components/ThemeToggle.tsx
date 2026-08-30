'use client';

import { useEffect, useState } from 'react';
import { useWebTheme, type ThemePreference } from '@/lib/theme-context';

const OPTIONS: [ThemePreference, string][] = [
  ['system', 'System'],
  ['light', 'Light'],
  ['dark', 'Dark'],
];

export function ThemeToggle() {
  const { preference, setPreference } = useWebTheme();
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  return (
    <div className="flex rounded-xl border border-border overflow-hidden">
      {OPTIONS.map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => void setPreference(key)}
          className={`flex-1 px-2 py-1.5 text-[11px] font-medium ${
            ready && preference === key
              ? 'bg-accent text-on-accent'
              : 'bg-background text-muted hover:text-foreground'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
