import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Navigate } from 'react-router';
import type { SetupOrganizationInput } from '@ribat/shared';
import { apiFetch } from '../api/api-fetch';
import { Button } from '../components/ui/button';

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
    latitude: 33.5138,
    longitude: 36.2765,
    prayerMethod: 'UmmAlQura',
    locale: 'ar',
    sheikh: { firstName: '', fatherName: '', familyName: '', phone: '' },
  });

  const submit = useMutation({
    mutationFn: () =>
      apiFetch<{ setupCode: string }>('/api/v1/setup/organization', {
        method: 'POST',
        body: JSON.stringify(form),
      }),
    onSuccess: (data) => setIssuedCode(data.setupCode),
  });

  if (setup.data && !setup.data.setupRequired) {
    return <Navigate to="/login" replace />;
  }

  if (issuedCode) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <h1 className="text-2xl font-semibold">{t('setup.codeTitle')}</h1>
        <p className="mt-2 text-sm text-slate-600">{t('setup.codeHint')}</p>
        <p className="mt-4 rounded-lg bg-slate-900 p-4 font-mono text-lg text-white">{issuedCode}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <h1 className="text-2xl font-semibold">{t('setup.title')}</h1>
      <div className="mt-4 grid gap-3">
        <input
          className="min-h-11 rounded-lg border px-3"
          placeholder={t('setup.mosqueName')}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <input
          className="min-h-11 rounded-lg border px-3"
          placeholder={t('setup.sheikhPhone')}
          value={form.sheikh.phone}
          onChange={(e) => setForm({ ...form, sheikh: { ...form.sheikh, phone: e.target.value } })}
        />
      </div>
      <Button className="mt-4" type="button" onClick={() => submit.mutate()} disabled={submit.isPending}>
        {t('setup.submit')}
      </Button>
    </div>
  );
}
