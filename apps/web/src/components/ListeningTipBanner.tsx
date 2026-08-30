'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const STORAGE_KEY = 'xrelax:headset_listening_tip_v2';

/** One-time tip on first visit: headset + Premium benefits. */
export function ListeningTipBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    } catch {
      // ignore
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
      <div className="card max-w-md w-full p-6 text-center space-y-4">
        <p className="text-xs uppercase tracking-widest text-muted">Welcome tip</p>
        <h2 className="text-2xl font-serif font-bold">For the best experience</h2>
        <p className="text-muted">
          Use your headset, earpods, or airpiece to enjoy these calming sounds.
        </p>
        <div className="text-left rounded-2xl border border-border p-4 space-y-2 text-sm">
          <p className="font-semibold">Premium unlocks</p>
          <ul className="text-muted space-y-1 list-disc pl-5">
            <li>Unlimited listening every day</li>
            <li>Loop sounds and Sleep Time schedules</li>
            <li>Offline downloads and Mix Studio</li>
            <li>Sleep timer, Mix Studio, and more</li>
          </ul>
        </div>
        <div className="flex flex-col gap-2">
          <Link href="/premium" className="btn btn-primary w-full" onClick={dismiss}>
            Explore Premium
          </Link>
          <button type="button" className="btn btn-outline w-full" onClick={dismiss}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
