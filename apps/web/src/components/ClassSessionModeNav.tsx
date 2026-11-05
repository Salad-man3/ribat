import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router';
import { Segmented } from './ui/form';

type Mode = 'overview' | 'attendance' | 'hifz';

/** Overview, attendance, and recitation on `/teach/:id` (+ `/attendance`, `/hifz`). */
export function ClassSessionModeNav({ sessionId }: { sessionId: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const mode: Mode = pathname.endsWith('/hifz')
    ? 'hifz'
    : pathname.endsWith('/attendance')
      ? 'attendance'
      : 'overview';
  return (
    <Segmented
      value={mode}
      onChange={(next) => {
        if (next === 'hifz') navigate(`/teach/${sessionId}/hifz`);
        else if (next === 'attendance')
          navigate(`/teach/${sessionId}/attendance`);
        else navigate(`/teach/${sessionId}`);
      }}
      options={[
        { value: 'overview', label: t('classMode.overview') },
        { value: 'attendance', label: t('classMode.attendance') },
        { value: 'hifz', label: t('classMode.hifz') },
      ]}
      aria-label={t('classMode.sessionMode')}
    />
  );
}
