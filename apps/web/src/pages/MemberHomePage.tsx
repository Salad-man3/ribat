import { useTranslation } from 'react-i18next';
import { MemberTodaySection, WeekTimetable } from '../components/family';
import { PageHeader } from '../components/ui/form';

export function MemberHomePage() {
  const { t } = useTranslation();
  return (
    <section className="grid gap-6">
      <PageHeader chrome title={t('member.homeTitle')} />
      <MemberTodaySection />
      <WeekTimetable />
    </section>
  );
}
