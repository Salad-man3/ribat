import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useSearchParams } from 'react-router';
import { SURAH_BY_NUMBER } from '@ribat/quran-data';
import type { ClassKit, MemorizationSummaryResponse } from '@ribat/shared';
import { HifzLogSheet } from '../components/HifzLogSheet';
import { NavButton } from '../components/ui/nav-button';
import { Empty, inputClass } from '../components/ui/form';
import { formatDate, formatTimeRange, normalizeArabic } from '../lib/domain';
import { cn } from '../lib/utils';
import { db } from '../offline/db';
import { syncNow, useLive } from '../offline/outbox';
import { SyncStatus } from '../offline/SyncStatus';

type KitSession = ClassKit['sessions'][number];
type Student = KitSession['roster'][number];

function describePositionShort(
  p: MemorizationSummaryResponse | undefined,
  language: string,
  t: (key: string, options?: Record<string, unknown>) => string,
) {
  if (!p?.lastPageReached) return t('classMode.noPosition');
  if (p.lastSurah && p.lastAyah) {
    const surah = SURAH_BY_NUMBER.get(p.lastSurah);
    const name = language === 'ar' ? surah?.nameAr : surah?.nameEn;
    return t('classMode.last', { page: p.lastPageReached, surah: name, ayah: p.lastAyah });
  }
  return t('classMode.lastPage', { page: p.lastPageReached });
}

/** WF-05 tasmīʿ: one student sheet, separate from attendance on ClassSessionPage. */
export function HifzLogPage() {
  const { id } = useParams();
  const [search, setSearchParams] = useSearchParams();
  const { t, i18n } = useTranslation();
  const [query, setQuery] = useState('');
  const [savedFlash, setSavedFlash] = useState<string | null>(null);

  const data = useLive(async () => {
    const row = await db.kit.get('current');
    const kit = row?.kit;
    const session =
      kit?.sessions.find((s) => s.id === id) ?? row?.previous?.sessions.find((s) => s.id === id);
    const source = kit?.sessions.some((s) => s.id === id) ? kit : row?.previous;
    const courseId = session?.courseId;
    const pending = (await db.outbox.orderBy('queuedAt').toArray()).filter((e) => {
      if (!courseId) return false;
      if (e.type === 'memorization.log' || e.type === 'memorization.test')
        return e.payload.courseId === courseId;
      return false;
    });
    return { session, kit: source, pending };
  }, [id]);

  useEffect(() => {
    if (navigator.onLine) void syncNow();
  }, []);

  useEffect(() => {
    if (!savedFlash) return;
    const timer = setTimeout(() => setSavedFlash(null), 3000);
    return () => clearTimeout(timer);
  }, [savedFlash]);

  if (!data) return null;
  const { session, kit, pending } = data;
  if (!session || !kit)
    return (
      <section className="grid gap-4">
        <NavButton to="/teach" className="text-sm text-accent">
          <span className="inline-block rtl:rotate-180">←</span> {t('classMode.back')}
        </NavButton>
        <Empty>{t('classMode.noKit')}</Empty>
      </section>
    );

  const materials = kit.materials.filter((m) => m.courseId === session.courseId);
  const memorization = materials.filter((m) => m.track === 'MEMORIZATION');
  const firstMat = memorization[0];
  const positionOf = (memberId: string, materialId: string) =>
    kit.positions.find((p) => p.memberId === memberId && p.materialId === materialId);

  const pendingForMember = (memberId: string) =>
    pending.filter(
      (e) =>
        (e.type === 'memorization.log' || e.type === 'memorization.test') &&
        e.payload.memberId === memberId,
    );
  const syncedLogsFor = (memberId: string) =>
    kit.todayLogs.filter((l) => l.memberId === memberId);
  const loggedToday = (memberId: string) =>
    syncedLogsFor(memberId).length > 0 || pendingForMember(memberId).length > 0;

  const needle = normalizeArabic(query.trim());
  const roster =
    session.roster.length > 8 && needle
      ? session.roster.filter((s) => normalizeArabic(s.name).includes(needle))
      : session.roster;

  const pick = search.get('student');
  const selected: Student | undefined =
    roster.find((s) => s.enrollmentId === pick) ??
    session.roster.find((s) => s.enrollmentId === pick) ??
    session.roster[0];

  const selectStudent = (s: Student) => {
    setSearchParams({ student: s.enrollmentId }, { replace: true });
  };

  if (!memorization.length) {
    return (
      <section className="grid gap-4">
        <NavButton to={`/teach/${session.id}`} className="text-sm text-accent">
          <span className="inline-block rtl:rotate-180">←</span> {t('classMode.backToAttendance')}
        </NavButton>
        <Empty>{t('classMode.noMemorizationMaterial')}</Empty>
      </section>
    );
  }

  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,16rem)_1fr] lg:items-start">
      <div className="grid gap-3 lg:sticky lg:top-4">
        <NavButton to={`/teach/${session.id}`} className="text-sm text-accent">
          <span className="inline-block rtl:rotate-180">←</span> {t('classMode.backToAttendance')}
        </NavButton>
        <div>
          <h1 className="text-xl font-bold">{session.courseName}</h1>
          <p className="text-sm text-muted">{t('classMode.hifzTitle')}</p>
          <p className="text-xs text-muted">
            {formatDate(session.date, i18n.language)} ·{' '}
            {formatTimeRange(session.startsAt, session.endsAt, i18n.language, kit.timezone)}
          </p>
        </div>
        <SyncStatus />
        {session.roster.length > 8 ? (
          <input
            type="search"
            className={inputClass}
            placeholder={t('classMode.search')}
            aria-label={t('classMode.search')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        ) : null}
        <label className="grid gap-1.5 text-sm font-medium lg:hidden">
          {t('classMode.pickStudent')}
          <select
            className={inputClass}
            value={selected?.enrollmentId ?? ''}
            onChange={(e) => {
              const s = roster.find((r) => r.enrollmentId === e.target.value);
              if (s) selectStudent(s);
            }}
          >
            {roster.map((s) => {
              const pos = firstMat ? positionOf(s.memberId, firstMat.materialId) : undefined;
              const hint = loggedToday(s.memberId) ? ` · ${t('classMode.loggedToday')}` : '';
              return (
                <option key={s.enrollmentId} value={s.enrollmentId}>
                  {s.name}
                  {hint}
                  {pos?.lastPageReached ? ` (${describePositionShort(pos, i18n.language, t)})` : ''}
                </option>
              );
            })}
          </select>
        </label>
        <ul className="hidden max-h-[calc(100dvh-12rem)] gap-1 overflow-y-auto lg:grid">
          {roster.map((s) => {
            const active = selected?.enrollmentId === s.enrollmentId;
            const pos = firstMat ? positionOf(s.memberId, firstMat.materialId) : undefined;
            return (
              <li key={s.enrollmentId}>
                <button
                  type="button"
                  onClick={() => selectStudent(s)}
                  className={cn(
                    'w-full rounded-xl border px-3 py-2 text-start text-sm transition',
                    active
                      ? 'border-accent bg-accent-soft'
                      : 'border-line bg-surface hover:border-accent/50',
                  )}
                >
                  <span dir="auto" className="block font-medium">
                    {s.name}
                  </span>
                  <span className="block truncate text-xs text-muted">
                    {describePositionShort(pos, i18n.language, t)}
                    {loggedToday(s.memberId) ? ` · ${t('classMode.loggedToday')}` : ''}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="grid gap-3">
        {savedFlash ? (
          <p role="status" className="text-sm text-accent">
            {t('classMode.logSaved')}
          </p>
        ) : null}
        {selected ? (
          <HifzLogSheet
            key={selected.enrollmentId}
            student={selected}
            courseId={session.courseId}
            materials={memorization}
            recitationKinds={kit.recitationKinds}
            positionFor={(materialId) => positionOf(selected.memberId, materialId)}
            syncedLogs={syncedLogsFor(selected.memberId)}
            pending={pendingForMember(selected.memberId)}
            onSaved={() => setSavedFlash(selected.enrollmentId)}
          />
        ) : (
          <Empty>{t('classMode.pickStudent')}</Empty>
        )}
      </div>
    </section>
  );
}
