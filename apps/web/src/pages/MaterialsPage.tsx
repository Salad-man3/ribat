import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  CreateMaterialInput,
  MaterialResponse,
  UpdateMaterialInput,
} from '@ribat/shared';
import { apiFetch } from '../api/api-fetch';
import { useMaterials } from '../api/courses';
import { Button } from '../components/ui/button';
import {
  Badge,
  Card,
  ErrorText,
  Field,
  inputClass,
  PageHeader,
} from '../components/ui/form';

type Form = { title: string; author: string; totalPages: string; url: string };

const formFrom = (m?: MaterialResponse): Form => ({
  title: m?.title ?? '',
  author: m?.author ?? '',
  totalPages: m?.totalPages?.toString() ?? '',
  url: m?.url ?? '',
});

function payload(form: Form) {
  return {
    title: form.title.trim(),
    ...(form.author.trim() ? { author: form.author.trim() } : {}),
    ...(form.totalPages ? { totalPages: Number(form.totalPages) } : {}),
    ...(form.url.trim() ? { url: form.url.trim() } : {}),
  };
}

function MaterialFields({
  form,
  setForm,
}: {
  form: Form;
  setForm: (f: Form) => void;
}) {
  const { t } = useTranslation();
  const bind = (key: keyof Form) => ({
    value: form[key],
    onChange: (e: { target: { value: string } }) =>
      setForm({ ...form, [key]: e.target.value }),
  });
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label={t('materials.titleLabel')}>
        <input className={inputClass} required {...bind('title')} />
      </Field>
      <Field label={t('materials.author')}>
        <input className={inputClass} {...bind('author')} />
      </Field>
      <Field label={t('materials.totalPages')}>
        <input
          type="number"
          min={1}
          dir="ltr"
          className={inputClass}
          {...bind('totalPages')}
        />
      </Field>
      <Field label={t('materials.url')}>
        <input
          type="url"
          dir="ltr"
          className={inputClass}
          placeholder="https://"
          {...bind('url')}
        />
      </Field>
    </div>
  );
}

/** T201: the organization's catalogue, so a lifetime record survives across courses. */
export function MaterialsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const materials = useMaterials();
  const [form, setForm] = useState<Form>(formFrom());
  const [kind, setKind] = useState<'TEXT' | 'BOOK'>('TEXT');
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ['materials'] });
  const create = useMutation({
    mutationFn: () =>
      apiFetch('/api/v1/materials', {
        method: 'POST',
        body: JSON.stringify({
          kind,
          ...payload(form),
        } satisfies CreateMaterialInput),
      }),
    onSuccess: async () => {
      setForm(formFrom());
      await refresh();
    },
  });

  return (
    <section className="grid gap-6">
      <PageHeader
        title={t('materials.title')}
        subtitle={t('materials.subtitle')}
      />
      <details className="rounded-2xl border border-line bg-surface">
        <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-accent">
          + {t('materials.create')}
        </summary>
        <form
          className="grid gap-4 border-t border-line p-5"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <div className="flex gap-4 text-sm">
            {(['TEXT', 'BOOK'] as const).map((value) => (
              <label key={value} className="flex items-center gap-1.5">
                <input
                  type="radio"
                  className="accent-accent"
                  checked={kind === value}
                  onChange={() => setKind(value)}
                />
                {t(`materials.kind.${value}`)}
              </label>
            ))}
          </div>
          <MaterialFields form={form} setForm={setForm} />
          {create.isError ? <ErrorText error={create.error} /> : null}
          <div>
            <Button type="submit" disabled={create.isPending}>
              {t('materials.create')}
            </Button>
          </div>
        </form>
      </details>
      <Card>
        <ul className="divide-y divide-line">
          {(materials.data ?? []).map((m) => (
            <MaterialRow key={m.id} material={m} onChanged={refresh} />
          ))}
        </ul>
      </Card>
    </section>
  );
}

function MaterialRow({
  material,
  onChanged,
}: {
  material: MaterialResponse;
  onChanged: () => Promise<unknown>;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState<Form>(formFrom(material));
  const [editing, setEditing] = useState(false);
  const save = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/materials/${material.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload(form) satisfies UpdateMaterialInput),
      }),
    onSuccess: async () => {
      setEditing(false);
      await onChanged();
    },
  });
  const archive = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/materials/${material.id}/archive`, { method: 'POST' }),
    onSuccess: onChanged,
  });
  const system = material.kind === 'QURAN';

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>
          <span className="font-medium">{material.title}</span>
          <span className="ms-2 text-xs text-muted">
            {[
              material.author,
              material.totalPages
                ? t('materials.pages', { count: material.totalPages })
                : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </span>
        <span className="flex items-center gap-2">
          <Badge tone={system ? 'accent' : 'neutral'}>
            {t(`materials.kind.${material.kind}`)}
          </Badge>
          {!system ? (
            <>
              <button
                type="button"
                className="text-xs text-accent underline"
                onClick={() => setEditing(!editing)}
              >
                {t('common.edit')}
              </button>
              <button
                type="button"
                className="text-xs text-danger underline"
                onClick={() => archive.mutate()}
              >
                {t('materials.archive')}
              </button>
            </>
          ) : null}
        </span>
      </div>
      {editing ? (
        <form
          className="mt-3 grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <MaterialFields form={form} setForm={setForm} />
          <div>
            <Button type="submit" disabled={save.isPending}>
              {t('common.save')}
            </Button>
          </div>
        </form>
      ) : null}
      {save.isError ? <ErrorText error={save.error} /> : null}
      {archive.isError ? <ErrorText error={archive.error} /> : null}
    </li>
  );
}
