'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { recordAnalyticsEvent } from '@/lib/analytics';

const SKIP = ['/admin', '/login'];

export function AnalyticsBeacon() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    if (SKIP.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) return;
    const referrer = typeof document !== 'undefined' ? document.referrer || undefined : undefined;
    void recordAnalyticsEvent({
      eventType: 'web_visit',
      path: pathname,
      referrer,
      source: 'web_app',
      platform: 'web',
    });
  }, [pathname]);

  return null;
}
