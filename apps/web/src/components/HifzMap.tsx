import { useTranslation } from 'react-i18next';
import type { MemberProgressResponse } from '@ribat/shared';
import { cn } from '../lib/utils';

type Hifz = NonNullable<MemberProgressResponse['hifz']>;

export function HifzMap({ hifz }: { hifz: Hifz }) {
  const { t } = useTranslation();
  const memorized = new Set(hifz.juzMemorized);
  const testOf = new Map(hifz.juzTests.map((row) => [row.juz, row]));
  const awqafOf = new Map<number, Hifz['awqafByJuz'][number][]>();
  for (const row of hifz.awqafByJuz) {
    awqafOf.set(row.juz, [...(awqafOf.get(row.juz) ?? []), row]);
  }

  return (
    <div className="grid gap-2">
      <p className="text-xs text-muted">{t('hifz.mapHint')}</p>
      <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-6">
        {Array.from({ length: 30 }, (_, i) => i + 1).map((juz) => {
          const test = testOf.get(juz);
          const awqaf = awqafOf.get(juz)?.[0];
          const filled = memorized.has(juz);
          return (
            <div
              key={juz}
              title={
                test
                  ? t('hifz.juzTestTooltip', { juz, score: test.score, passed: test.passed })
                  : awqaf
                    ? t('hifz.awqafTooltip', { juz, level: awqaf.level, passed: awqaf.passed })
                    : filled
                      ? t('hifz.juzMemorized', { juz })
                      : t('hifz.juzEmpty', { juz })
              }
              className={cn(
                'flex min-h-11 flex-col items-center justify-center rounded-lg border text-xs font-semibold',
                filled ? 'border-accent bg-accent-soft text-accent-strong' : 'border-line bg-paper text-muted',
                test && (test.passed ? 'ring-2 ring-accent/40' : 'ring-2 ring-danger/40'),
                awqaf && 'underline decoration-gold decoration-2 underline-offset-2',
              )}
            >
              <span>{juz}</span>
              {test ? (
                <span className="text-[10px] font-normal">{test.score}</span>
              ) : null}
            </div>
          );
        })}
      </div>
      <ul className="flex flex-wrap gap-3 text-xs text-muted">
        <li className="flex items-center gap-1.5">
          <span className="size-3 rounded border border-accent bg-accent-soft" />
          {t('hifz.legendMemorized')}
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-3 rounded border border-line ring-2 ring-accent/40" />
          {t('hifz.legendTestPass')}
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-3 rounded border border-line underline decoration-gold"> </span>
          {t('hifz.legendAwqaf')}
        </li>
      </ul>
    </div>
  );
}
