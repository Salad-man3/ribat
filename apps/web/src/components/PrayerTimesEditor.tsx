import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  PrayerLookupResponse,
  PrayerMethod,
  PrayerOffsets,
  PrayerTimes,
} from '@ribat/shared';
import { apiFetch } from '../api/api-fetch';
import { fromMinutes, PRAYER_METHODS, PRAYERS, toMinutes } from '../lib/domain';
import { Button } from './ui/button';
import { ErrorText, Field, inputClass } from './ui/form';

export type PrayerSettingsPatch = {
  latitude?: number;
  longitude?: number;
  timezone?: string;
  prayerMethod?: PrayerMethod;
  prayerOffsets: PrayerOffsets;
};

type Base = { computed: PrayerTimes; edited: PrayerTimes };

/** Offsets that turn Ribat's calculated times into the times the mosque approved. */
function offsetsFrom(base: Base): PrayerOffsets {
  return Object.fromEntries(
    PRAYERS.map((p) => [
      p,
      toMinutes(base.edited[p]) - toMinutes(base.computed[p]),
    ]),
  ) as PrayerOffsets;
}

/**
 * OQ-9. The creator types a city, sees that day's times pulled from Aladhan, and accepts
 * or edits each one. Ribat stores the location, method and per-prayer offsets, and
 * computes every later day itself.
 */
export function PrayerTimesEditor({
  lookupPath,
  initial,
  initialMethod = 'MuslimWorldLeague',
  onChange,
}: {
  lookupPath: string;
  /** Current times, when the mosque already has settings. */
  initial?: Base;
  initialMethod?: PrayerMethod;
  onChange: (patch: PrayerSettingsPatch) => void;
}) {
  const { t } = useTranslation();
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [method, setMethod] = useState<PrayerMethod>(initialMethod);
  const [base, setBase] = useState<Base | undefined>(initial);
  const [place, setPlace] = useState<PrayerLookupResponse | null>(null);

  const lookup = useMutation({
    mutationFn: () => {
      const params = new URLSearchParams({ city, method });
      if (country.trim()) params.set('country', country.trim());
      return apiFetch<PrayerLookupResponse>(`${lookupPath}?${params}`);
    },
    onSuccess: (data) => {
      const next = { computed: data.computed, edited: data.reference };
      setPlace(data);
      setBase(next);
      onChange({
        latitude: data.latitude,
        longitude: data.longitude,
        timezone: data.timezone,
        prayerMethod: data.method,
        prayerOffsets: offsetsFrom(next),
      });
    },
  });

  const edit = (prayer: (typeof PRAYERS)[number], value: string) => {
    if (!base || !value) return;
    const next = { ...base, edited: { ...base.edited, [prayer]: value } };
    setBase(next);
    onChange({ prayerOffsets: offsetsFrom(next) });
  };

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={t('prayer.city')}>
          <input
            className={inputClass}
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder={t('prayer.cityPlaceholder')}
          />
        </Field>
        <Field label={t('prayer.country')}>
          <input
            className={inputClass}
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder={t('prayer.countryPlaceholder')}
          />
        </Field>
        <Field label={t('organization.prayerMethod')}>
          <select
            className={inputClass}
            value={method}
            onChange={(e) => setMethod(e.target.value as PrayerMethod)}
          >
            {PRAYER_METHODS.map((m) => (
              <option key={m} value={m}>
                {t(`prayer.methods.${m}`)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div>
        <Button
          variant="ghost"
          disabled={city.trim().length < 2 || lookup.isPending}
          onClick={() => lookup.mutate()}
        >
          {lookup.isPending ? '…' : t('prayer.lookup')}
        </Button>
      </div>
      {lookup.isError ? <ErrorText error={lookup.error} /> : null}
      {place ? (
        <p className="text-sm text-muted">
          {place.displayName} · <span dir="ltr">{place.timezone}</span> ·{' '}
          {t('prayer.sourceNote')}
        </p>
      ) : null}

      {base ? (
        <div>
          <p className="mb-2 text-xs text-muted">{t('prayer.editHint')}</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {PRAYERS.map((prayer) => {
              const diff =
                toMinutes(base.edited[prayer]) -
                toMinutes(base.computed[prayer]);
              return (
                <div key={prayer} className="grid gap-1.5">
                  <label className="grid gap-1.5 text-sm font-medium text-ink">
                    {t(`organization.prayers.${prayer}`)}
                    <input
                      type="time"
                      dir="ltr"
                      className={inputClass}
                      value={base.edited[prayer]}
                      onChange={(e) => edit(prayer, e.target.value)}
                    />
                  </label>
                  <span className="text-xs text-muted">
                    {t('prayer.calculated')}{' '}
                    <span dir="ltr">{base.computed[prayer]}</span>
                    {diff ? (
                      <span dir="ltr" className="ms-1 text-accent">
                        ({diff > 0 ? '+' : ''}
                        {diff})
                      </span>
                    ) : null}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Rebuild "calculated" times from the org's displayed times and stored offsets. */
export function baseFromOrg(times: PrayerTimes, offsets: PrayerOffsets): Base {
  return {
    edited: times,
    computed: Object.fromEntries(
      PRAYERS.map((p) => [
        p,
        fromMinutes(toMinutes(times[p]) - (offsets[p] ?? 0)),
      ]),
    ) as PrayerTimes,
  };
}
