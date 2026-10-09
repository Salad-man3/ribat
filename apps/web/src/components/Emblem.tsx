import { cn } from '../lib/utils';

/** Eight-point star (khatam): two overlapping squares. Decorative only. */
export function Emblem({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cn('size-6 shrink-0 text-gold', className)}
    >
      <g fill="none" stroke="currentColor" strokeWidth="1.6">
        <rect x="5" y="5" width="14" height="14" />
        <rect x="5" y="5" width="14" height="14" transform="rotate(45 12 12)" />
      </g>
      <circle cx="12" cy="12" r="2.2" fill="currentColor" />
    </svg>
  );
}
