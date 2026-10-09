import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  AddCourseMaterialInput,
  CourseMaterialResponse,
  MaterialTrack,
} from '@ribat/shared';
import { apiFetch } from '../../api/api-fetch';
import { courseKey, useMaterials } from '../../api/courses';
import { Button } from '../../components/ui/button';
import {
  Badge,
  Card,
  Empty,
  ErrorText,
  inputClass,
} from '../../components/ui/form';
import type { SectionProps } from './types';

export function MaterialsSection({
  course,
  canEdit,
}: SectionProps & { canEdit: boolean }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const key = courseKey(course.id, 'materials');
  const linked = useQuery({
    queryKey: key,
    queryFn: () =>
      apiFetch<CourseMaterialResponse[]>(
        `/api/v1/courses/${course.id}/materials`,
      ),
  });
  const catalogue = useMaterials();
  const tracks: MaterialTrack[] =
    course.type === 'BOTH' ? ['MEMORIZATION', 'EXPLANATION'] : [course.type];
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [materialId, setMaterialId] = useState('');
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<'TEXT' | 'BOOK'>('TEXT');
  const [track, setTrack] = useState<MaterialTrack>(tracks[0]);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: key });
    await queryClient.invalidateQueries({ queryKey: ['materials'] });
  };
  const add = useMutation({
    mutationFn: () => {
      const body: AddCourseMaterialInput =
        mode === 'existing'
          ? { materialId, track }
          : { newMaterial: { kind, title: title.trim() }, track };
      return apiFetch(`/api/v1/courses/${course.id}/materials`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
    onSuccess: async () => {
      setMaterialId('');
      setTitle('');
      await refresh();
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/courses/${course.id}/materials/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: refresh,
  });
  const used = new Set((linked.data ?? []).map((m) => m.materialId));

  return (
    <Card title={t('materials.courseTitle')}>
      {linked.data?.length === 0 ? (
        <Empty>{t('materials.courseEmpty')}</Empty>
      ) : null}
      <ul className="grid gap-2">
        {(linked.data ?? []).map((row) => (
          <li
            key={row.id}
            className="flex items-center justify-between gap-2 rounded-lg bg-paper px-3 py-2 text-sm"
          >
            <span>
              <span className="font-medium">{row.material.title}</span>
              {row.material.totalPages ? (
                <span className="ms-2 text-xs text-muted">
                  {t('materials.pages', { count: row.material.totalPages })}
                </span>
              ) : null}
            </span>
            <span className="flex items-center gap-2">
              <Badge tone="accent">{t(`materials.track.${row.track}`)}</Badge>
              {canEdit ? (
                <button
                  type="button"
                  className="text-xs text-danger underline"
                  onClick={() => remove.mutate(row.materialId)}
                >
                  {t('common.remove')}
                </button>
              ) : null}
            </span>
          </li>
        ))}
      </ul>

      {canEdit ? (
        <form
          className="mt-4 grid gap-3 border-t border-line pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            add.mutate();
          }}
        >
          <div className="flex gap-4 text-sm">
            {(['existing', 'new'] as const).map((value) => (
              <label key={value} className="flex items-center gap-1.5">
                <input
                  type="radio"
                  className="accent-accent"
                  checked={mode === value}
                  onChange={() => setMode(value)}
                />
                {t(`materials.mode.${value}`)}
              </label>
            ))}
          </div>
          {mode === 'existing' ? (
            <select
              className={inputClass}
              value={materialId}
              onChange={(e) => setMaterialId(e.target.value)}
              required
            >
              <option value="">{t('common.choose')}</option>
              {(catalogue.data ?? [])
                .filter((m) => !used.has(m.id))
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
            </select>
          ) : (
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <input
                className={inputClass}
                placeholder={t('materials.titleLabel')}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
              <select
                className={`${inputClass} w-auto`}
                value={kind}
                onChange={(e) => setKind(e.target.value as 'TEXT' | 'BOOK')}
              >
                <option value="TEXT">{t('materials.kind.TEXT')}</option>
                <option value="BOOK">{t('materials.kind.BOOK')}</option>
              </select>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {tracks.length > 1 ? (
              <select
                className={`${inputClass} w-auto`}
                value={track}
                onChange={(e) => setTrack(e.target.value as MaterialTrack)}
              >
                {tracks.map((value) => (
                  <option key={value} value={value}>
                    {t(`materials.track.${value}`)}
                  </option>
                ))}
              </select>
            ) : null}
            <Button type="submit" disabled={add.isPending}>
              {t('materials.add')}
            </Button>
          </div>
          {add.isError ? <ErrorText error={add.error} /> : null}
          {remove.isError ? <ErrorText error={remove.error} /> : null}
        </form>
      ) : null}
    </Card>
  );
}
