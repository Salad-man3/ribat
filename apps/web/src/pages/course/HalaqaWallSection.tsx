import { useQuery } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { SURAH_BY_NUMBER } from '@ribat/quran-data';
import type { CourseHalaqaWall } from '@ribat/shared';
import { apiFetch } from '../../api/api-fetch';
import { courseKey } from '../../api/courses';
import { HifzLegend, HifzMap } from '../../components/HifzMap';
import { MemberNameLink } from '../../components/MemberNameLink';
import { Card, Empty } from '../../components/ui/form';
import { useCalendar } from '../../lib/calendar';
import {
  describeLastRecitation,
  sameAsPosition,
} from '../../lib/last-recitation';
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
    return t('classMode.last', {
      page: p.lastPageReached,
      surah: name,
      ayah: p.lastAyah,
    });
  }
  return t('classMode.lastPage', { page: p.lastPageReached });
}

export function HalaqaWallSection({ course }: SectionProps) {
  const { t, i18n } = useTranslation();
  const { calendar } = useCalendar();
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
      {data.students.some((s) => s.juzFills) ? <HifzLegend /> : null}
      <ul className="grid gap-2">
        {data.students.map((s) => {
          const place = describePosition(s, i18n.language, t);
          const last = s.lastLog
            ? describeLastRecitation(s.lastLog, t, i18n.language, calendar)
            : null;
          const showProgress = Boolean(
            s.lastLog &&
            s.position?.lastPageReached &&
            !sameAsPosition(s.lastLog, s.position),
          );
          return (
            <li
              key={s.memberId}
              className="grid gap-2 rounded-xl border border-line bg-paper px-3 py-2 text-sm"
            >
              <div className="grid gap-1">
                <MemberNameLink memberId={s.memberId} className="text-base">
                  {s.name}
                </MemberNameLink>
                <span className="text-muted">{last ?? place}</span>
                {showProgress ? (
                  <span className="text-muted">{place}</span>
                ) : null}
                {s.loggedToday ? (
                  <span className="text-xs text-muted">
                    {t('classMode.loggedToday')}
                    {s.todayLogCount > 1 ? ` (${s.todayLogCount})` : ''}
                  </span>
                ) : null}
              </div>
              {s.juzFills ? (
                <HifzMap showLegend={false} hifz={{ juzFills: s.juzFills }} />
              ) : null}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
