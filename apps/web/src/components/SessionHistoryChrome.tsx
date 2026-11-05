import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';
import { useFormatDates } from '../lib/calendar';
import { cn } from '../lib/utils';

export function SessionHistoryChrome({
  sessionDate,
  canEdit,
  editing,
  onEditingChange,
}: {
  sessionDate: string;
  canEdit: boolean;
  editing: boolean;
  onEditingChange: (v: boolean) => void;
}) {
  const { t } = useTranslation();
  const { formatDate } = useFormatDates();
  return (
    <div
      role="status"
      className={cn(
        'flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm',
        editing
          ? 'border-accent bg-accent-soft'
          : 'border-line bg-paper text-muted',
      )}
    >
      <span>
        {t('classMode.historyBanner', { date: formatDate(sessionDate) })}
      </span>
      {canEdit ? (
        <Button
          type="button"
          variant="ghost"
          className="min-h-9 px-2 text-xs font-semibold"
          onClick={() => onEditingChange(!editing)}
        >
          {editing
            ? t('classMode.historyViewOnly')
            : t('classMode.historyEdit')}
        </Button>
      ) : null}
    </div>
  );
}
