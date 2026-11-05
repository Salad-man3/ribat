import { SURAH_BY_NUMBER } from '@ribat/quran-data';
import type {
  LastRecitation,
  MemorizationSummaryResponse,
} from '@ribat/shared';
import type { TFunction } from 'i18next';
import { formatDateTime, type DateCalendar } from './domain';

export function describeLastRecitation(
  log: LastRecitation,
  t: TFunction,
  language: string,
  calendar: DateCalendar = 'gregorian',
) {
  const date = formatDateTime(log.loggedAt, language, calendar);
  const type = t(`classMode.type.${log.type}`);
  if (log.surahStart && log.ayahStart && log.surahEnd && log.ayahEnd) {
    const name = (n: number) => {
      const surah = SURAH_BY_NUMBER.get(n);
      return language === 'ar' ? surah?.nameAr : surah?.nameEn;
    };
    return t('classMode.lastRecitation', {
      type,
      fromSurah: name(log.surahStart),
      from: log.ayahStart,
      toSurah: name(log.surahEnd),
      to: log.ayahEnd,
      pageFrom: log.pageFrom,
      pageTo: log.pageTo,
      date,
    });
  }
  return t('classMode.lastRecitationPages', {
    type,
    pageFrom: log.pageFrom,
    pageTo: log.pageTo,
    date,
  });
}

export function sameAsPosition(
  log: LastRecitation,
  position: Pick<
    MemorizationSummaryResponse,
    'lastSurah' | 'lastAyah' | 'lastPageReached'
  >,
) {
  if (log.surahEnd && log.ayahEnd && position.lastSurah && position.lastAyah)
    return (
      position.lastSurah === log.surahEnd && position.lastAyah === log.ayahEnd
    );
  return (
    position.lastPageReached != null && position.lastPageReached === log.pageTo
  );
}
