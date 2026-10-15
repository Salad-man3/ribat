import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Badge, Empty } from '../components/ui/form';
import { cn } from '../lib/utils';
import { formatDate, formatTimeRange } from '../lib/domain';
import { db } from '../offline/db';
import { syncNow, useLive } from '../offline/outbox';
import { SyncStatus } from '../offline/SyncStatus';

/** WF-05 step 1: the teacher's sessions for the day, from the cached kit. */
export function TodayPage() {
  const { t, i18n } = useTranslation();
  const row = useLive(async () => (await db.kit.get('current')) ?? null);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    // Entering class mode refreshes the kit while there is a connection.
    if (navigator.onLine) void syncNow();
  }, []);

  if (row === undefined) return null;
  const kit = row?.kit;
  // startsAt/endsAt are full instants, so a stale kit never shows a false "now".
  const sessions = kit ? [...kit.sessions].sort((a, b) => a.startsAt.localeCompare(b.startsAt)) : [];
  const nextId = sessions.find((s) => Date.parse(s.startsAt) > now)?.id;

  return (
    <section className="grid gap-4">
      <div>
        <h1 className="text-xl font-semibold">{t('classMode.today')}</h1>
        {kit ? <p className="text-sm text-muted">{formatDate(kit.date, i18n.language)}</p> : null}
      </div>
      <SyncStatus />
      {!kit ? (
        <Empty>{t('classMode.noKit')}</Empty>
      ) : sessions.length === 0 ? (
        <Empty>{t('classMode.noSessions')}</Empty>
      ) : (
        <ul className="grid gap-2">
          {sessions.map((s) => {
            const current = Date.parse(s.startsAt) <= now && now < Date.parse(s.endsAt);
            return (
            <li key={s.id}>
              <Link
                to={`/teach/${s.id}`}
                className={cn('flex items-center justify-between gap-3 rounded-2xl border bg-surface p-4 hover:border-accent', current ? 'border-accent ring-2 ring-accent/30' : 'border-line')}
              >
                <span className="grid">
                  <span className="flex items-center gap-2 font-semibold">
                    {s.courseName}
                    {current ? <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-ink">{t('classMode.now')}</span> : null}
                    {s.id === nextId ? <span className="rounded-full border border-gold bg-gold/20 px-2 py-0.5 text-xs font-medium text-ink">{t('classMode.next')}</span> : null}
                  </span>
                  <span className="text-sm text-muted">
                    {formatTimeRange(s.startsAt, s.endsAt, i18n.language, kit.timezone)}
                  </span>
                </span>
                <span className="grid justify-items-end gap-1">
                  <Badge>{t('classMode.students', { count: s.roster.length })}</Badge>
                  {s.topic ? <span className="text-xs text-muted">{s.topic}</span> : null}
                </span>
              </Link>
            </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
