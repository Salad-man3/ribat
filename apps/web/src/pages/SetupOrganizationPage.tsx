import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, Navigate } from 'react-router';
import type {
  SetupOrganizationInput,
  SetupOrganizationResponse,
} from '@ribat/shared';
import { apiFetch } from '../api/api-fetch';
import { PrayerTimesEditor } from '../components/PrayerTimesEditor';
import { Button } from '../components/ui/button';
import { ErrorText, Field, inputClass } from '../components/ui/form';
import { AuthLayout } from '../layouts/AuthLayout';

export function SetupOrganizationPage() {
  const { t } = useTranslation();
  const setup = useQuery({
    queryKey: ['setup-status'],
    queryFn: () => apiFetch<{ setupRequired: boolean }>('/api/v1/setup/status'),
  });
  const [issuedCode, setIssuedCode] = useState<string | null>(null);
  const [form, setForm] = useState<SetupOrganizationInput>({
    name: '',
    timezone: 'Asia/Damascus',
    latitude: 33.5131,
    longitude: 36.3096,
    prayerMethod: 'MuslimWorldLeague',
    locale: 'ar',
    sheikh: { firstName: '', fatherName: '', familyName: '', phone: '' },
  });
  const setSheikh = (
    key: keyof SetupOrganizationInput['sheikh'],
    value: string,
  ) => setForm({ ...form, sheikh: { ...form.sheikh, [key]: value } });

  const submit = useMutation({
    mutationFn: () =>
      apiFetch<SetupOrganizationResponse>('/api/v1/setup/organization', {
        method: 'POST',
        body: JSON.stringify(form),
      }),
    onSuccess: (data) => setIssuedCode(data.setupCode),
  });

  if (issuedCode) {
    return (
      <AuthLayout title={t('setup.codeTitle')}>
        <p className="text-sm text-muted">{t('setup.codeHint')}</p>
        <p
          dir="ltr"
          className="my-5 rounded-xl bg-accent p-4 text-center font-mono text-2xl tracking-[0.3em] text-white"
        >
          {issuedCode}
        </p>
        <Link
          className="block text-center text-sm text-accent underline underline-offset-4"
          to="/setup/password"
        >
          {t('setup.continue')}
        </Link>
      </AuthLayout>
    );
  }
  if (setup.data && !setup.data.setupRequired)
    return <Navigate to="/login" replace />;

  return (
    <AuthLayout title={t('setup.title')}>
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          submit.mutate();
        }}
      >
        <Field label={t('setup.mosqueName')}>
          <input
            className={inputClass}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
        </Field>
        <div className="grid gap-2 border-t border-line pt-4">
          <p className="text-sm font-semibold">{t('organization.prayer')}</p>
          <p className="text-xs text-muted">{t('prayer.setupHint')}</p>
          <PrayerTimesEditor
            lookupPath="/api/v1/setup/prayer-times/lookup"
            onChange={(patch) =>
              setForm((current) => ({ ...current, ...patch }))
            }
          />
        </div>
        <p className="border-t border-line pt-4 text-sm font-semibold">
          {t('setup.sheikh')}
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label={t('members.firstName')}>
            <input
              className={inputClass}
              value={form.sheikh.firstName}
              onChange={(e) => setSheikh('firstName', e.target.value)}
              required
            />
          </Field>
          <Field label={t('members.fatherName')}>
            <input
              className={inputClass}
              value={form.sheikh.fatherName}
              onChange={(e) => setSheikh('fatherName', e.target.value)}
              required
            />
          </Field>
          <Field label={t('members.familyName')}>
            <input
              className={inputClass}
              value={form.sheikh.familyName}
              onChange={(e) => setSheikh('familyName', e.target.value)}
              required
            />
          </Field>
        </div>
        <Field label={t('setup.sheikhPhone')}>
          <input
            className={inputClass}
            dir="ltr"
            inputMode="tel"
            placeholder="+963…"
            value={form.sheikh.phone}
            onChange={(e) => setSheikh('phone', e.target.value)}
            required
          />
        </Field>
        {submit.isError ? <ErrorText error={submit.error} /> : null}
        <Button type="submit" disabled={submit.isPending}>
          {t('setup.submit')}
        </Button>
      </form>
    </AuthLayout>
  );
}
