import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type {
  OrgPrayerTimesResponse,
  Prayer,
  PrayerTimes,
  TimePoint,
} from '@ribat/shared';
import { apiFetch } from '../api/api-fetch';
import { fromMinutes, toMinutes } from '../lib/domain';
import { inputClass } from './ui/form';

export const PRAYER_ANCHORS: Prayer[] = [
  'FAJR',
  'SUNRISE',
  'DHUHR',
  'ASR',
  'MAGHRIB',
  'ISHA',
];

/** Today's clock time for a point, using the mosque's prayer times. */
export function resolveTimePoint(
  point: TimePoint,
  times?: PrayerTimes,
): string | null {
  if (point.anchor === 'FIXED') return point.time;
  if (!times) return null;
  return fromMinutes(
    toMinutes(times[point.prayer.toLowerCase() as keyof PrayerTimes]) +
      point.offsetMin,
  );
}

export function describeTimePoint(
  point: TimePoint,
  t: (k: string) => string,
): string {
  if (point.anchor === 'FIXED') return point.time;
  const offset = point.offsetMin
    ? ` ${point.offsetMin > 0 ? '+' : ''}${point.offsetMin}′`
    : '';
  return `${t(`organization.prayers.${point.prayer.toLowerCase()}`)}${offset}`;
}

export function useOrgPrayerTimes() {
  return useQuery({
    queryKey: ['organization', 'prayer-times'],
    queryFn: () =>
      apiFetch<OrgPrayerTimesResponse>('/api/v1/organization/prayer-times'),
  });
}

export function TimePointEditor({
  value,
  onChange,
  times,
}: {
  value: TimePoint;
  onChange: (p: TimePoint) => void;
  times?: PrayerTimes;
}) {
  const { t } = useTranslation();
  const preview = resolveTimePoint(value, times);
  return (
    <div className="grid gap-1">
      <div className="flex flex-wrap gap-1">
        <select
          aria-label={t('schedule.anchor')}
          className={`${inputClass} w-auto`}
          value={value.anchor === 'FIXED' ? 'FIXED' : value.prayer}
          onChange={(e) =>
            onChange(
              e.target.value === 'FIXED'
                ? { anchor: 'FIXED', time: preview ?? '16:00' }
                : {
                    anchor: 'PRAYER',
                    prayer: e.target.value as Prayer,
                    offsetMin: value.anchor === 'PRAYER' ? value.offsetMin : 0,
                  },
            )
          }
        >
          <option value="FIXED">{t('schedule.fixed')}</option>
          {PRAYER_ANCHORS.map((p) => (
            <option key={p} value={p}>
              {t(`organization.prayers.${p.toLowerCase()}`)}
            </option>
          ))}
        </select>
        {value.anchor === 'FIXED' ? (
          <input
            type="time"
            dir="ltr"
            aria-label={t('schedule.time')}
            className={`${inputClass} w-auto`}
            value={value.time}
            onChange={(e) =>
              e.target.value && onChange({ ...value, time: e.target.value })
            }
          />
        ) : (
          <input
            type="number"
            dir="ltr"
            step={5}
            aria-label={t('schedule.offset')}
            title={t('schedule.offset')}
            className={`${inputClass} w-20`}
            value={value.offsetMin}
            onChange={(e) =>
              onChange({ ...value, offsetMin: Number(e.target.value) })
            }
          />
        )}
      </div>
      {value.anchor === 'PRAYER' && preview ? (
        <span className="text-xs text-muted">
          {t('schedule.todayAt')} <span dir="ltr">{preview}</span>
        </span>
      ) : null}
    </div>
  );
}
