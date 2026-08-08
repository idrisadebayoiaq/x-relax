'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/** Horizontal content rail with hidden scrollbars and optional chevron controls. */
export function HorizontalRail({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const update = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setCanLeft(el.scrollLeft > 8);
    setCanRight(max > 8 && el.scrollLeft < max - 8);
  };

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
    };
  }, [children]);

  const scrollBy = (dir: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.min(360, el.clientWidth * 0.75), behavior: 'smooth' });
  };

  return (
    <div className={`relative group/rail ${className}`}>
      {canLeft ? (
        <button
          type="button"
          aria-label="Scroll left"
          onClick={() => scrollBy(-1)}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 hidden md:flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface/95 shadow-lg hover:bg-background"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      ) : null}
      {canRight ? (
        <button
          type="button"
          aria-label="Scroll right"
          onClick={() => scrollBy(1)}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 hidden md:flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface/95 shadow-lg hover:bg-background"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      ) : null}
      <div ref={scrollerRef} className="rail-scroll flex gap-4 px-0.5">
        {children}
      </div>
    </div>
  );
}
