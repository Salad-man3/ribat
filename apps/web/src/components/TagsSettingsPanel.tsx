import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CreateTagInput, TagResponse } from '@ribat/shared';
import { apiFetch } from '../api/api-fetch';
import { Button } from './ui/button';
import { Card, ErrorText, Field, inputClass } from './ui/form';
import { cn } from '../lib/utils';

export function TagFilterChips({
  tags,
  value,
  onChange,
}: {
  tags: TagResponse[];
  value: string;
  onChange: (id: string) => void;
}) {
  const { t } = useTranslation();
  if (tags.length === 0) return null;
  const chip = (id: string, label: string) => (
    <button
      key={id}
      type="button"
      className={cn(
        'rounded-full border px-3 py-1 text-xs font-medium',
        value === id
          ? 'border-accent bg-accent/10 text-accent'
          : 'border-line text-muted',
      )}
      onClick={() => onChange(id)}
    >
      {label}
    </button>
  );
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-muted">{t('roles.filterByTag')}</span>
      {chip('all', t('roles.filterAll'))}
      {tags.map((tag) => chip(tag.id, tag.name))}
    </div>
  );
}

export function TagsSettingsPanel() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const list = useQuery({
    queryKey: ['tags'],
    queryFn: () => apiFetch<TagResponse[]>('/api/v1/tags'),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['tags'] });

  const create = useMutation({
    mutationFn: (input: CreateTagInput) =>
      apiFetch<TagResponse>('/api/v1/tags', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: async () => {
      setName('');
      await refresh();
    },
  });

  const update = useMutation({
    mutationFn: ({ id, name: next }: { id: string; name: string }) =>
      apiFetch<TagResponse>(`/api/v1/tags/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: next }),
      }),
    onSuccess: async () => {
      setEditingId(null);
      await refresh();
    },
  });

  const archive = useMutation({
    mutationFn: (id: string) =>
      apiFetch<TagResponse>(`/api/v1/tags/${id}/archive`, { method: 'POST' }),
    onSuccess: refresh,
  });

  return (
    <Card title={t('roles.tags.title')}>
      <p className="mb-4 text-sm text-muted">{t('roles.tags.hint')}</p>
      {list.isError ? <ErrorText error={list.error} /> : null}
      {create.isError ? <ErrorText error={create.error} /> : null}
      <div className="mb-4 flex flex-wrap gap-2">
        <Field label={t('roles.tags.new')} className="min-w-[12rem] flex-1">
          <input
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Button
          type="button"
          disabled={create.isPending || !name.trim()}
          onClick={() => {
            const trimmed = name.trim();
            if (trimmed) create.mutate({ name: trimmed });
          }}
        >
          {t('roles.tags.add')}
        </Button>
      </div>
      <ul className="grid gap-2">
        {(list.data ?? []).map((tag) => (
          <li
            key={tag.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line px-3 py-2"
          >
            {editingId === tag.id ? (
              <div className="flex flex-1 flex-wrap gap-2">
                <input
                  className={inputClass}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
                <Button
                  type="button"
                  disabled={update.isPending || !editName.trim()}
                  onClick={() => update.mutate({ id: tag.id, name: editName.trim() })}
                >
                  {t('common.save')}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setEditingId(null)}
                >
                  {t('common.cancel')}
                </Button>
              </div>
            ) : (
              <>
                <span className="font-medium">{tag.name}</span>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setEditingId(tag.id);
                      setEditName(tag.name);
                    }}
                  >
                    {t('common.edit')}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => archive.mutate(tag.id)}
                    disabled={archive.isPending}
                  >
                    {t('roles.tags.archive')}
                  </Button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
