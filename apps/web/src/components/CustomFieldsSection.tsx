import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type {
  CustomFieldEntityType,
  CustomFieldDefinitionResponse,
  CustomValues,
} from '@ribat/shared';
import { apiFetch } from '../api/api-fetch';
import { Field, inputClass } from './ui/form';

function activeFields(rows: CustomFieldDefinitionResponse[]) {
  return rows.filter((row) => !row.archivedAt);
}

export function CustomFieldsSection({
  entityType,
  values,
  onChange,
  titleKey = 'settings.extraFields.sectionTitle',
}: {
  entityType: CustomFieldEntityType;
  values: CustomValues;
  onChange: (next: CustomValues) => void;
  titleKey?: string;
}) {
  const { t } = useTranslation();
  const defs = useQuery({
    queryKey: ['custom-fields', entityType],
    queryFn: () =>
      apiFetch<CustomFieldDefinitionResponse[]>(
        `/api/v1/custom-fields?entityType=${entityType}`,
      ),
  });
  const fields = activeFields(defs.data ?? []);
  if (!fields.length) return null;

  const setValue = (key: string, raw: string | number | boolean) => {
    const next = { ...values };
    if (raw === '' || raw === false) delete next[key];
    else next[key] = raw as CustomValues[string];
    onChange(next);
  };

  return (
    <fieldset className="grid gap-3 rounded-xl border border-line p-4">
      <legend className="px-1 text-sm font-semibold text-ink">
        {t(titleKey)}
      </legend>
      {fields.map((field) => (
        <Field key={field.id} label={field.label}>
          {field.type === 'BOOLEAN' ? (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="accent-accent"
                checked={Boolean(values[field.key])}
                onChange={(e) => setValue(field.key, e.target.checked)}
              />
              {t('settings.extraFields.types.BOOLEAN')}
            </label>
          ) : (
            <input
              className={inputClass}
              type={
                field.type === 'NUMBER'
                  ? 'number'
                  : field.type === 'DATE'
                    ? 'date'
                    : 'text'
              }
              value={String(values[field.key] ?? '')}
              onChange={(e) => {
                const v = e.target.value;
                if (field.type === 'NUMBER') {
                  setValue(field.key, v === '' ? '' : Number(v));
                } else {
                  setValue(field.key, v);
                }
              }}
            />
          )}
        </Field>
      ))}
    </fieldset>
  );
}
