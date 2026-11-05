import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';
import { useCalendar } from '../lib/calendar';
import { cn } from '../lib/utils';

export function CalendarPicker({
  className,
  variant = 'ghost',
}: {
  className?: string;
  variant?: 'primary' | 'ghost' | 'danger' | 'chrome';
}) {
  const { t } = useTranslation();
  const { calendar, setCalendar } = useCalendar();
  const next = calendar === 'gregorian' ? 'hijri' : 'gregorian';
  return (
    <Button
      type="button"
      variant={variant}
      className={cn(className, 'justify-start')}
      onClick={() => setCalendar(next)}
    >
      {calendar === 'gregorian'
        ? t('calendar.useHijri')
        : t('calendar.useGregorian')}
    </Button>
  );
}
