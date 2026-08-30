'use client';

import { useEffect, useState } from 'react';
import { useAdminTheme, type ThemePreference } from '@/lib/theme-provider';

const OPTIONS: [ThemePreference, string][] = [
  ['system', 'System'],
  ['light', 'Light'],
  ['dark', 'Dark'],
];

export function ThemeToggle() {
  const { preference, setPreference } = useAdminTheme();
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  return (
    <div className="flex rounded-lg border border-border overflow-hidden">
      {OPTIONS.map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => setPreference(key)}
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
