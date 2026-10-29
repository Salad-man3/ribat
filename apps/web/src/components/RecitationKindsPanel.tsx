import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { RecitationKindResponse } from '@ribat/shared';
import { apiFetch } from '../api/api-fetch';
import { Button } from './ui/button';
import { Card, Empty, Field, inputClass } from './ui/form';

export function RecitationKindsPanel() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const kinds = useQuery({
    queryKey: ['recitation-kinds'],
    queryFn: () => apiFetch<RecitationKindResponse[]>('/api/v1/recitation-kinds'),
  });

  const create = useMutation({
    mutationFn: () =>
      apiFetch<RecitationKindResponse>('/api/v1/recitation-kinds', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim() }),
      }),
    onSuccess: async () => {
      setName('');
      await queryClient.invalidateQueries({ queryKey: ['recitation-kinds'] });
    },
  });

  const archive = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/recitation-kinds/${id}/archive`, { method: 'POST' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['recitation-kinds'] });
    },
  });

  return (
    <Card title={t('hifz.kindsTitle')}>
      <p className="text-sm text-muted">{t('hifz.kindsHint')}</p>
      <div className="mt-3 flex gap-2">
        <Field label={t('hifz.kindName')} className="flex-1">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Button
          className="self-end"
          disabled={!name.trim() || create.isPending}
          onClick={() => void create.mutate()}
        >
          {t('tags.add')}
        </Button>
      </div>
      {kinds.isError ? null : kinds.data?.length === 0 ? <Empty>{t('hifz.noKinds')}</Empty> : null}
      <ul className="mt-3 grid gap-1 text-sm">
        {kinds.data?.map((k) => (
          <li key={k.id} className="flex items-center justify-between rounded-lg bg-paper px-3 py-2">
            <span>{k.name}</span>
            <Button variant="ghost" onClick={() => void archive.mutate(k.id)}>{t('members.delete')}</Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
