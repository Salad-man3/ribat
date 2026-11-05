import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  type OrgPrayerTimesResponse,
  type OrganizationResponse,
  type UpdateOrganizationInput,
} from '@ribat/shared';
import {
  WHATSAPP_SETUP_PLACEHOLDERS,
  defaultWhatsappSetupTemplate,
} from '../lib/whatsapp-setup';
import { apiFetch } from '../api/api-fetch';
import {
  baseFromOrg,
  PrayerTimesEditor,
} from '../components/PrayerTimesEditor';
import { CustomFieldsDefinitionsPanel } from '../components/CustomFieldsDefinitionsPanel';
import { RecitationKindsPanel } from '../components/RecitationKindsPanel';
import { TagsSettingsPanel } from '../components/TagsSettingsPanel';
import { Button } from '../components/ui/button';
import {
  Card,
  ErrorText,
  Field,
  inputClass,
  PageHeader,
  Segmented,
  SwitchField,
} from '../components/ui/form';

import { PRAYER_METHODS, PRAYERS } from '../lib/domain';

type HubSection = 'mosque' | 'extraFields';
type MosqueTab = 'general' | 'messages';

export function OrganizationPage() {
  const { t } = useTranslation();
  const [section, setSection] = useState<HubSection>('mosque');
  const [mosqueTab, setMosqueTab] = useState<MosqueTab>('general');
  const org = useQuery({
    queryKey: ['organization'],
    queryFn: () => apiFetch<OrganizationResponse>('/api/v1/organization'),
  });
  const times = useQuery({
    queryKey: ['organization', 'prayer-times'],
    queryFn: () =>
      apiFetch<OrgPrayerTimesResponse>('/api/v1/organization/prayer-times'),
  });
  if (org.isError) return <ErrorText error={org.error} />;
  if (!org.data || !times.data) return <p className="text-sm text-muted">…</p>;
  return (
    <section className="grid gap-6">
      <PageHeader chrome title={t('settings.title')} subtitle={org.data.slug} />
      <Segmented
        value={section}
        onChange={setSection}
        aria-label={t('settings.title')}
        options={(
          [
            ['mosque', 'settings.hub.mosque'],
            ['extraFields', 'settings.hub.extraFields'],
          ] as const
        ).map(([value, labelKey]) => ({
          value,
          label: t(labelKey),
        }))}
      />
      {section === 'extraFields' ? (
        <div className="grid gap-6">
          {org.data.tagsEnabled ? <TagsSettingsPanel /> : null}
          <CustomFieldsDefinitionsPanel />
          <RecitationKindsPanel />
        </div>
      ) : (
        <>
          <Segmented
            value={mosqueTab}
            onChange={setMosqueTab}
            aria-label={t('settings.hub.mosque')}
            options={(['general', 'messages'] as const).map((value) => ({
              value,
              label: t(`organization.tabs.${value}`),
            }))}
          />
          {mosqueTab === 'general' ? (
            <GeneralOrganizationForm org={org.data} times={times.data} />
          ) : (
            <MessagesOrganizationForm org={org.data} />
          )}
        </>
      )}
    </section>
  );
}

function GeneralOrganizationForm({
  org,
  times,
}: {
  org: OrganizationResponse;
  times: OrgPrayerTimesResponse;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: org.name,
    timezone: org.timezone,
    latitude: org.latitude,
    longitude: org.longitude,
    prayerMethod: org.prayerMethod,
    prayerOffsets: org.prayerOffsets,
    locale: org.locale,
    pointsEnabled: org.pointsEnabled,
    tagsEnabled: org.tagsEnabled,
    whatsappSetupTemplate: org.whatsappSetupTemplate,
  } satisfies UpdateOrganizationInput);

  const save = useMutation({
    mutationFn: () =>
      apiFetch<OrganizationResponse>('/api/v1/organization', {
        method: 'PATCH',
        body: JSON.stringify(form),
      }),
    onSuccess: async (data) => {
      queryClient.setQueryData(['organization'], data);
      await queryClient.invalidateQueries({ queryKey: ['me'] });
      await queryClient.invalidateQueries({
        queryKey: ['organization', 'prayer-times'],
      });
      if (data.tagsEnabled) {
        await queryClient.invalidateQueries({ queryKey: ['tags'] });
      }
    },
  });

  return (
    <form
      className="grid gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <Card title={t('organization.general')}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('organization.name')}>
            <input
              className={inputClass}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </Field>
          <Field label={t('organization.locale')}>
            <select
              className={inputClass}
              value={form.locale}
              onChange={(e) =>
                setForm({ ...form, locale: e.target.value as 'ar' | 'en' })
              }
            >
              <option value="ar">العربية</option>
              <option value="en">English</option>
            </select>
          </Field>
          <div className="sm:col-span-2 grid gap-2">
            <SwitchField
              label={t('organization.pointsEnabled')}
              checked={form.pointsEnabled}
              onChange={(pointsEnabled) => setForm({ ...form, pointsEnabled })}
            />
            <SwitchField
              label={t('organization.tagsEnabled')}
              hint={t('organization.tagsEnabledHint')}
              checked={form.tagsEnabled}
              onChange={(tagsEnabled) => setForm({ ...form, tagsEnabled })}
            />
          </div>
        </div>
      </Card>

      <Card title={t('organization.prayer')}>
        <p className="mb-4 text-sm text-muted">{t('prayer.orgHint')}</p>
        <PrayerTimesEditor
          lookupPath="/api/v1/prayer-times/lookup"
          initial={baseFromOrg(times.times, org.prayerOffsets)}
          initialMethod={org.prayerMethod}
          onChange={(patch) => setForm((current) => ({ ...current, ...patch }))}
        />
        <details className="mt-5 text-sm">
          <summary className="cursor-pointer text-muted">
            {t('prayer.advanced')}
          </summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label={t('organization.timezone')}>
              <input
                className={inputClass}
                dir="ltr"
                value={form.timezone}
                onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                required
              />
            </Field>
            <Field label={t('organization.prayerMethod')}>
              <select
                className={inputClass}
                value={form.prayerMethod}
                onChange={(e) =>
                  setForm({
                    ...form,
                    prayerMethod: e.target.value as typeof form.prayerMethod,
                  })
                }
              >
                {PRAYER_METHODS.map((method) => (
                  <option key={method} value={method}>
                    {t(`prayer.methods.${method}`)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('organization.latitude')}>
              <input
                type="number"
                step="any"
                min={-90}
                max={90}
                className={inputClass}
                dir="ltr"
                value={form.latitude}
                onChange={(e) =>
                  setForm({ ...form, latitude: Number(e.target.value) })
                }
              />
            </Field>
            <Field label={t('organization.longitude')}>
              <input
                type="number"
                step="any"
                min={-180}
                max={180}
                className={inputClass}
                dir="ltr"
                value={form.longitude}
                onChange={(e) =>
                  setForm({ ...form, longitude: Number(e.target.value) })
                }
              />
            </Field>
          </div>
          <p className="mt-4 text-xs text-muted">
            {t('organization.offsets')}:{' '}
            <span dir="ltr">
              {PRAYERS.map((p) => `${p} ${form.prayerOffsets[p] ?? 0}`).join(
                ' · ',
              )}
            </span>
          </p>
        </details>
      </Card>

      {save.isError ? <ErrorText error={save.error} /> : null}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={save.isPending}>
          {t('common.save')}
        </Button>
        {save.isSuccess ? (
          <span className="text-sm text-accent">{t('common.saved')}</span>
        ) : null}
      </div>
    </form>
  );
}

function MessagesOrganizationForm({ org }: { org: OrganizationResponse }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [template, setTemplate] = useState(
    org.whatsappSetupTemplate ?? defaultWhatsappSetupTemplate(org.locale),
  );

  const save = useMutation({
    mutationFn: (body: UpdateOrganizationInput) =>
      apiFetch<OrganizationResponse>('/api/v1/organization', {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    onSuccess: async (data) => {
      queryClient.setQueryData(['organization'], data);
      setTemplate(
        data.whatsappSetupTemplate ?? defaultWhatsappSetupTemplate(data.locale),
      );
    },
  });

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate({ whatsappSetupTemplate: template });
      }}
    >
      <Card title={t('organization.messages.whatsappTitle')}>
        <p className="mb-3 text-sm text-muted">
          {t('organization.messages.whatsappHint')}
        </p>
        <p className="mb-2 text-xs text-muted">
          {t('organization.messages.placeholders')}:{' '}
          <span dir="ltr">{WHATSAPP_SETUP_PLACEHOLDERS.join(' ')}</span>
        </p>
        <textarea
          className={`${inputClass} min-h-48 font-mono text-sm`}
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
          dir={org.locale === 'ar' ? 'rtl' : 'ltr'}
        />
      </Card>
      {save.isError ? <ErrorText error={save.error} /> : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={save.isPending}>
          {t('common.save')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={save.isPending}
          onClick={() => save.mutate({ whatsappSetupTemplate: null })}
        >
          {t('organization.messages.resetDefault')}
        </Button>
        {save.isSuccess ? (
          <span className="text-sm text-accent">{t('common.saved')}</span>
        ) : null}
      </div>
    </form>
  );
}
