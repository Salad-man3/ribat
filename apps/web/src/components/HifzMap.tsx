import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { JuzFill } from '@ribat/shared';
import { cn } from '../lib/utils';

type Awqaf = { juz: number; level: string; passed: boolean };

export function HifzLegend() {
  const { t } = useTranslation();
  return (
    <ul className="flex flex-wrap gap-3 text-xs text-muted">
      <li className="flex items-center gap-1.5">
        <span className="size-3 rounded bg-accent" />
        {t('hifz.legendMosque')}
      </li>
      <li className="flex items-center gap-1.5">
        <span className="hifz-prior-swatch size-3 rounded border border-line" />
        {t('hifz.legendPrior')}
      </li>
      <li className="flex items-center gap-1.5">
        <span className="size-3 rounded bg-gold" />
        {t('hifz.legendCertified')}
      </li>
    </ul>
  );
}

export function HifzMap({
  hifz,
  showLegend = true,
}: {
  hifz: {
    juzFills?: JuzFill[];
    awqafByJuz?: Awqaf[];
  };
  showLegend?: boolean;
}) {
  const { t } = useTranslation();
  const fillOf = new Map((hifz.juzFills ?? []).map((row) => [row.juz, row]));
  const awqafOf = new Map<number, Awqaf>();
  for (const row of hifz.awqafByJuz ?? []) awqafOf.set(row.juz, row);

  return (
    <div className="grid gap-2">
      {showLegend ? (
        <p className="text-xs text-muted">{t('hifz.mapHint')}</p>
      ) : null}
      <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-6">
        {Array.from({ length: 30 }, (_, i) => i + 1).map((juz) => (
          <JuzCell
            key={juz}
            juz={juz}
            fill={fillOf.get(juz)}
            awqaf={awqafOf.get(juz)}
          />
        ))}
      </div>
      {showLegend ? (
        <>
          <HifzLegend />
          {hifz.awqafByJuz?.length ? (
            <p className="text-xs text-muted">{t('hifz.legendAwqaf')}</p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function JuzCell({
  juz,
  fill,
  awqaf,
}: {
  juz: number;
  fill?: JuzFill;
  awqaf?: Awqaf;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const total = fill?.totalPages || 1;
  const prior = fill ? (fill.initialPages / total) * 100 : 0;
  const mosque = fill ? (fill.newPages / total) * 100 : 0;
  const certified = fill?.certified ?? false;
  useEffect(() => {
    const el = ref.current;
    if (!el || certified) return;
    el.style.setProperty('--prior', `${prior}%`);
    el.style.setProperty('--mosque', `${mosque}%`);
  }, [prior, mosque, certified]);

  const label = certified
    ? t('hifz.juzCertified', { juz })
    : fill && (fill.newPages || fill.initialPages)
      ? t('hifz.juzFill', {
          juz,
          newPages: fill.newPages,
          initialPages: fill.initialPages,
          totalPages: fill.totalPages,
        })
      : t('hifz.juzEmpty', { juz });

  return (
    <div
      ref={ref}
      title={
        awqaf
          ? `${label}. ${t('hifz.awqafTooltip', { juz, level: awqaf.level, passed: awqaf.passed })}`
          : label
      }
      className={cn(
        'flex min-h-11 items-center justify-center rounded-lg border text-xs font-semibold',
        certified
          ? 'border-gold bg-gold text-ink'
          : 'hifz-fill border-line text-ink',
        !certified && mosque >= 55 && 'text-white',
        awqaf &&
          !certified &&
          'underline decoration-gold decoration-2 underline-offset-2',
      )}
    >
      <span>{juz}</span>
    </div>
  );
}
