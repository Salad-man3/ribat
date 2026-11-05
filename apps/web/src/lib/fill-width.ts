import { useEffect, useRef, type RefObject } from 'react';

/** Sets `--fill` on the element for `w-(--fill)` without a style attribute (CSP). */
export function useFillWidthPct<E extends HTMLElement>(
  pct: number,
): RefObject<E | null> {
  const ref = useRef<E>(null);
  useEffect(() => {
    ref.current?.style.setProperty('--fill', `${pct}%`);
  }, [pct]);
  return ref;
}
