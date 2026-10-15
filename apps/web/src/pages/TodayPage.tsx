import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Badge, Empty } from '../components/ui/form';
import { formatDate, formatTime } from '../lib/domain';
import { db } from '../offline/db';
import { syncNow, useLive } from '../offline/outbox';
import { SyncStatus } from '../offline/SyncStatus';

/** WF-05 step 1: the teacher's sessions for the day, from the cached kit. */
export function TodayPage() {
  const { t, i18n } = useTranslation();
  const row = useLive(async () => (await db.kit.get('current')) ?? null);
  useEffect(() => {
    // Entering class mode refreshes the kit while there is a connection.
    if (navigator.onLine) void syncNow();
  }, []);

  if (row === undefined) return null;
  const kit = row?.kit;

  return (
    <section className="grid gap-4">
      <div>
        <h1 className="text-xl font-semibold">{t('classMode.today')}</h1>
        {kit ? <p className="text-sm text-muted">{formatDate(kit.date, i18n.language)}</p> : null}
      </div>
      <SyncStatus />
      {!kit ? (
        <Empty>{t('classMode.noKit')}</Empty>
      ) : kit.sessions.length === 0 ? (
        <Empty>{t('classMode.noSessions')}</Empty>
      ) : (
        <ul className="grid gap-2">
          {kit.sessions.map((s) => (
            <li key={s.id}>
              <Link
                to={`/teach/${s.id}`}
                className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4 hover:border-accent"
              >
                <span className="grid">
                  <span className="font-semibold">{s.courseName}</span>
                  <span className="text-sm text-muted" dir="ltr">
                    {formatTime(s.startsAt, i18n.language, kit.timezone)}–{formatTime(s.endsAt, i18n.language, kit.timezone)}
                  </span>
                </span>
                <span className="grid justify-items-end gap-1">
                  <Badge>{t('classMode.students', { count: s.roster.length })}</Badge>
                  {s.topic ? <span className="text-xs text-muted">{s.topic}</span> : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
