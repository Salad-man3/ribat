import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavButton } from '../components/ui/nav-button';
import { Button } from '../components/ui/button';
import { formatDateTime } from '../lib/domain';
import { db } from './db';
import { KIT_STALE_MS, syncNow, useLive } from './outbox';

function useOnline() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

/** Decision 9.6: how many changes wait and when the phone last synced; SYNC-13: what the server did not keep. */
export function SyncStatus() {
  const { t, i18n } = useTranslation();
  const online = useOnline();
  const [busy, setBusy] = useState(false);
  const state = useLive(async () => {
    const kit = await db.kit.get('current');
    const queued = await db.outbox.toArray();
    const mine = queued.filter((e) => e.ownerMemberId === kit?.kit.memberId).length;
    return {
      kit: kit?.kit,
      mine,
      others: queued.length - mine,
      lastSyncedAt: (await db.meta.get('lastSyncedAt'))?.value as number | undefined,
      needsLogin: (await db.meta.get('needsLogin'))?.value === true,
      results: await db.results.orderBy('at').reverse().toArray(),
    };
  });
  if (!state) return null;

  const stale = state.kit && Date.now() - new Date(state.kit.generatedAt).getTime() > KIT_STALE_MS;
  const sync = async () => {
    setBusy(true);
    await syncNow().finally(() => setBusy(false));
  };

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-sm">
        <div className="grid">
          <span className={state.mine ? 'font-semibold text-ink' : 'text-muted'}>
            {!online
              ? state.mine
                ? t('classMode.sync.offlineQueued', { count: state.mine })
                : t('classMode.sync.offline')
              : state.mine
                ? t('classMode.sync.queued', { count: state.mine })
                : t('classMode.sync.synced')}
          </span>
          <span className="text-xs text-muted">
            {state.lastSyncedAt
              ? t('classMode.sync.lastSynced', {
                  time: formatDateTime(new Date(state.lastSyncedAt).toISOString(), i18n.language),
                })
              : t('classMode.sync.never')}
          </span>
        </div>
        {state.mine > 0 && online ? (
          <Button variant="ghost" onClick={() => void sync()} disabled={busy}>
            {t('classMode.sync.now')}
          </Button>
        ) : null}
      </div>

      {state.needsLogin ? (
        <p role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
          {t('classMode.sync.needsLogin', { count: state.mine })}
          <NavButton to="/login" state={{ from: '/teach' }} className="font-semibold underline">
            {t('classMode.sync.signIn')}
          </NavButton>
        </p>
      ) : null}
      {stale ? (
        <p role="status" className="rounded-xl bg-gold/15 px-3 py-2 text-sm text-ink">
          {t('classMode.sync.stale')}
        </p>
      ) : null}
      {state.others > 0 ? (
        <p className="text-xs text-muted">{t('classMode.sync.otherAccount', { count: state.others })}</p>
      ) : null}

      {state.results.length ? (
        <section className="grid gap-1 rounded-xl border border-danger/30 bg-danger-soft p-3 text-sm">
          <h2 className="font-semibold text-danger">{t('classMode.sync.conflicts')}</h2>
          <ul className="grid gap-1">
            {state.results.map((r) => (
              <li key={r.idempotencyKey} className="flex items-center justify-between gap-2">
                <span>
                  {t(`classMode.syncType.${r.type.replace('.', '_')}`)} —{' '}
                  {r.status === 'superseded'
                    ? t('classMode.sync.superseded')
                    : t('classMode.sync.rejected', { message: r.error?.message ?? '' })}
                </span>
                <Button variant="ghost" className="min-h-9 px-2" onClick={() => void db.results.delete(r.idempotencyKey)}>
                  {t('classMode.sync.dismiss')}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
