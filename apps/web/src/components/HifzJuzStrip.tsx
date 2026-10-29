import { cn } from '../lib/utils';

/** Compact 30-juz strip for class roster and halaqa wall (memorized only). */
export function HifzJuzStrip({ juzMemorized }: { juzMemorized: number[] }) {
  const filled = new Set(juzMemorized);
  return (
    <div
      className="grid grid-cols-[repeat(30,minmax(0,1fr))] gap-px"
      aria-hidden
    >
      {Array.from({ length: 30 }, (_, i) => i + 1).map((juz) => (
        <div
          key={juz}
          title={String(juz)}
          className={cn(
            'flex aspect-square min-w-0 items-center justify-center rounded-sm border text-[9px] font-semibold leading-none',
            filled.has(juz)
              ? 'border-accent bg-accent-soft text-accent-strong'
              : 'border-line bg-paper text-muted/70',
          )}
        >
          {juz}
        </div>
      ))}
    </div>
  );
}
