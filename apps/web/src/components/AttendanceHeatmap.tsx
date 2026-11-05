import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AttendanceStatus } from '@ribat/shared';
import { useProgress } from './family';
import { Card, Empty, ErrorText, Segmented } from './ui/form';
import { buildAttendanceGrid } from '../lib/attendance-grid';
import {
  formatGregorianNumeric,
  LOBBY_WEEKDAY_ORDER,
  today,
} from '../lib/domain';
import { cn } from '../lib/utils';

const TONE: Record<AttendanceStatus | 'none', string> = {
  none: 'border-line bg-surface',
  PRESENT: 'border-accent bg-accent-soft',
  ABSENT: 'border-danger/40 bg-danger-soft',
  LATE: 'border-gold bg-gold/15',
  EXCUSED: 'border-line bg-paper',
};

type WindowDays = 30 | 90;

export function AttendanceHeatmap({ memberId }: { memberId: string }) {
  const { t, i18n } = useTranslation();
  const progress = useProgress(memberId);
  const [windowDays, setWindowDays] = useState<WindowDays>(30);

  const grid = useMemo(() => {
    const history = progress.data?.attendanceHistory ?? [];
    return buildAttendanceGrid(history, today(), windowDays);
  }, [progress.data?.attendanceHistory, windowDays]);

  if (progress.isError) return <ErrorText error={progress.error} />;
  if (progress.isLoading) return <p className="text-sm text-muted">…</p>;

  const locale = i18n.language;
  const formatRate = (rate: number | null) =>
    rate === null
      ? '—'
      : new Intl.NumberFormat(locale, {
          style: 'percent',
          maximumFractionDigits: 0,
        }).format(rate);

  const statusLabel = (status: AttendanceStatus | null) =>
    status ? t(`classMode.status.${status}`) : t('classMode.status.none');

  const hasAnyMark = grid.weeks.some((w) =>
    w.some((c) => c.inWindow && c.status !== null),
  );

  return (
    <Card title={t('attendanceGrid.title')}>
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Segmented
            value={String(windowDays)}
            onChange={(v) => setWindowDays(Number(v) as WindowDays)}
            aria-label={t('attendanceGrid.window')}
            options={[
              { value: '30', label: t('attendanceGrid.days30') },
              { value: '90', label: t('attendanceGrid.days90') },
            ]}
          />
          <p className="text-sm text-muted">
            {t('attendanceGrid.rate', { rate: formatRate(grid.rate) })}
          </p>
        </div>

        {!hasAnyMark ? (
          <Empty>{t('attendanceGrid.empty')}</Empty>
        ) : (
          <>
            <div className="overflow-x-auto">
              <div className="inline-grid min-w-full gap-1">
                <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted">
                  {LOBBY_WEEKDAY_ORDER.map((wd) => (
                    <span key={wd}>{t(`schedule.weekdays.${wd}`)}</span>
                  ))}
                </div>
                {grid.weeks.map((week, wi) => (
                  <div key={wi} className="grid grid-cols-7 gap-1">
                    {week.map((cell) => {
                      const tone = cell.status ? TONE[cell.status] : TONE.none;
                      const label = `${formatGregorianNumeric(cell.date)} · ${statusLabel(cell.status)}`;
                      return (
                        <div
                          key={cell.date}
                          title={label}
                          aria-label={label}
                          className={cn(
                            'aspect-square min-h-8 rounded border',
                            tone,
                            !cell.inWindow && 'opacity-30',
                          )}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
            <ul className="flex flex-wrap gap-3 text-xs text-muted">
              {(['PRESENT', 'LATE', 'ABSENT', 'EXCUSED'] as const).map((s) => (
                <li key={s} className="flex items-center gap-1.5">
                  <span className={cn('size-3 rounded border', TONE[s])} />
                  {t(`classMode.status.${s}`)}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Card>
  );
}
