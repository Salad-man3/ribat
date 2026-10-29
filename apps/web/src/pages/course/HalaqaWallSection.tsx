import { useQuery } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { SURAH_BY_NUMBER } from '@ribat/quran-data';
import type { CourseHalaqaWall } from '@ribat/shared';
import { apiFetch } from '../../api/api-fetch';
import { courseKey } from '../../api/courses';
import { HifzJuzStrip } from '../../components/HifzJuzStrip';
import { Card, Empty } from '../../components/ui/form';
import type { SectionProps } from './types';

function describePosition(
  row: CourseHalaqaWall['students'][number],
  language: string,
  t: TFunction,
) {
  const p = row.position;
  if (!p?.lastPageReached) return t('classMode.noPosition');
  if (p.lastSurah && p.lastAyah) {
    const surah = SURAH_BY_NUMBER.get(p.lastSurah);
    const name = language === 'ar' ? surah?.nameAr : surah?.nameEn;
    return t('classMode.last', { page: p.lastPageReached, surah: name, ayah: p.lastAyah });
  }
  return t('classMode.lastPage', { page: p.lastPageReached });
}

export function HalaqaWallSection({ course }: SectionProps) {
  const { t, i18n } = useTranslation();
  const wall = useQuery({
    queryKey: courseKey(course.id, 'halaqa-wall'),
    queryFn: () =>
      apiFetch<CourseHalaqaWall>(`/api/v1/courses/${course.id}/halaqa-wall`),
  });

  if (wall.isLoading) return null;
  if (wall.isError || !wall.data) return null;

  const data = wall.data;

  return (
    <Card title={t('hifz.halaqaWallTitle')}>
      {data.explanation?.totalPages ? (
        <p className="mb-3 text-sm text-muted">
          {t('classMode.bookProgress', {
            page: data.explanation.pageTo,
            total: data.explanation.totalPages,
          })}{' '}
          · {data.explanation.title}
        </p>
      ) : null}
      {!data.students.length ? <Empty>{t('groups.noStudents')}</Empty> : null}
      {data.students.some((s) => s.juzMemorized) ? (
        <p className="mb-2 text-xs text-muted">{t('hifz.legendMemorized')}</p>
      ) : null}
      <ul className="grid gap-2">
        {data.students.map((s) => (
          <li
            key={s.memberId}
            className="grid gap-2 rounded-xl border border-line bg-paper px-3 py-2 text-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span dir="auto" className="font-medium">
                {s.name}
              </span>
              <span className="text-xs text-muted">
                {describePosition(s, i18n.language, t)}
                {s.loggedToday
                  ? ` · ${t('classMode.loggedToday')}${s.todayLogCount > 1 ? ` (${s.todayLogCount})` : ''}`
                  : ''}
              </span>
            </div>
            {s.juzMemorized ? <HifzJuzStrip juzMemorized={s.juzMemorized} /> : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}
