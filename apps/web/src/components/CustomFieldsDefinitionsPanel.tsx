import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  CreateCustomFieldInput,
  CustomFieldDefinitionResponse,
  CustomFieldEntityType,
  CustomFieldType,
} from '@ribat/shared';
import { apiFetch } from '../api/api-fetch';
import { Button } from './ui/button';
import { Card, ErrorText, Field, inputClass } from './ui/form';

const ENTITIES: CustomFieldEntityType[] = ['MEMBER', 'COURSE', 'PROGRAM', 'MATERIAL'];
const TYPES: CustomFieldType[] = ['TEXT', 'NUMBER', 'DATE', 'BOOLEAN'];

export function CustomFieldsDefinitionsPanel() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [entityType, setEntityType] = useState<CustomFieldEntityType>('MEMBER');
  const [label, setLabel] = useState('');
  const [type, setType] = useState<CustomFieldType>('TEXT');

  const list = useQuery({
    queryKey: ['custom-fields'],
    queryFn: () =>
      apiFetch<CustomFieldDefinitionResponse[]>('/api/v1/custom-fields'),
  });

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ['custom-fields'] });

  const create = useMutation({
    mutationFn: (input: CreateCustomFieldInput) =>
      apiFetch<CustomFieldDefinitionResponse>('/api/v1/custom-fields', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: async () => {
      setLabel('');
      await refresh();
    },
  });

  const archive = useMutation({
    mutationFn: (id: string) =>
      apiFetch<CustomFieldDefinitionResponse>(
        `/api/v1/custom-fields/${id}/archive`,
        { method: 'POST' },
      ),
    onSuccess: refresh,
  });

  const rows = (list.data ?? []).filter(
    (row) => row.entityType === entityType && !row.archivedAt,
  );

  return (
    <Card title={t('settings.extraFields.title')}>
      <p className="mb-4 text-sm text-muted">{t('settings.extraFields.hint')}</p>
      {list.isError ? <ErrorText error={list.error} /> : null}
      <Field label={t('settings.extraFields.entity')}>
        <select
          className={inputClass}
          value={entityType}
          onChange={(e) => setEntityType(e.target.value as CustomFieldEntityType)}
        >
          {ENTITIES.map((value) => (
            <option key={value} value={value}>
              {t(`settings.extraFields.entities.${value}`)}
            </option>
          ))}
        </select>
      </Field>
      <form
        className="mt-4 grid gap-3 sm:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate({ entityType, label, type });
        }}
      >
        <Field label={t('settings.extraFields.label')}>
          <input
            className={inputClass}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            required
          />
        </Field>
        <Field label={t('settings.extraFields.type')}>
          <select
            className={inputClass}
            value={type}
            onChange={(e) => setType(e.target.value as CustomFieldType)}
          >
            {TYPES.map((value) => (
              <option key={value} value={value}>
                {t(`settings.extraFields.types.${value}`)}
              </option>
            ))}
          </select>
        </Field>
        <div className="flex items-end">
          <Button type="submit" disabled={create.isPending}>
            {t('settings.extraFields.add')}
          </Button>
        </div>
      </form>
      {create.isError ? <ErrorText error={create.error} /> : null}
      <ul className="mt-6 divide-y divide-line">
        {rows.length === 0 ? (
          <li className="py-4 text-sm text-muted">
            {t('settings.extraFields.empty')}
          </li>
        ) : (
          rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-2 py-3"
            >
              <span>
                <span className="font-medium">{row.label}</span>
                <span className="ms-2 text-xs text-muted">
                  {t(`settings.extraFields.types.${row.type}`)}
                </span>
              </span>
              <Button
                type="button"
                variant="ghost"
                disabled={archive.isPending}
                onClick={() => archive.mutate(row.id)}
              >
                {t('settings.extraFields.archive')}
              </Button>
            </li>
          ))
        )}
      </ul>
      {archive.isError ? <ErrorText error={archive.error} /> : null}
    </Card>
  );
}
