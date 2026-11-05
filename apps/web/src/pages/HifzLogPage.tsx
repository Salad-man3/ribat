import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useParams, useSearchParams } from 'react-router';
import { SURAH_BY_NUMBER } from '@ribat/quran-data';
import type {
  AttendanceStatus,
  ClassKit,
  MemorizationSummaryResponse,
} from '@ribat/shared';
import { presentIfUnmarked } from '../lib/class-mode-attendance';
import { HifzLogSheet } from '../components/HifzLogSheet';
import { NavButton } from '../components/ui/nav-button';
import { Empty, inputClass } from '../components/ui/form';
import { useFormatDates } from '../lib/calendar';
import { formatTimeRange, normalizeArabic, today } from '../lib/domain';
import { canEditHistorySession, isHistorySession } from '../lib/session-mode';
import { useActiveMembership } from '../hooks/use-me';
import { SessionHistoryChrome } from '../components/SessionHistoryChrome';
import { cn } from '../lib/utils';
import { syncNow } from '../offline/outbox';
import { SyncStatus } from '../offline/SyncStatus';
import { ClassSessionModeNav } from '../components/ClassSessionModeNav';
import { useClassSessionView } from './class-session/use-class-session-view';

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
    return t('classMode.last', {
      page: p.lastPageReached,
      surah: name,
      ayah: p.lastAyah,
    });
  }
  return t('classMode.lastPage', { page: p.lastPageReached });
}

/** WF-05 tasmīʿ: one student sheet, separate from attendance on ClassSessionPage. */
export function HifzLogPage() {
  const { id } = useParams();
  const [search, setSearchParams] = useSearchParams();
  const { t, i18n } = useTranslation();
  const { formatDate } = useFormatDates();
  const [query, setQuery] = useState('');
  const [savedFlash, setSavedFlash] = useState<string | null>(null);
  const location = useLocation();
  const { can } = useActiveMembership();
  const staffUser = can('courses.manage');
  const courseReturn =
    (location.state as { coursePath?: string } | undefined)?.coursePath ?? null;
  const [editingHistory, setEditingHistory] = useState(false);
  const { view, markOnline, refreshOnline } = useClassSessionView(id);

  useEffect(() => {
    if (navigator.onLine) void syncNow();
  }, []);

  useEffect(() => {
    if (!savedFlash) return;
    const timer = setTimeout(() => setSavedFlash(null), 3000);
    return () => clearTimeout(timer);
  }, [savedFlash]);

  if (view.status === 'loading') return null;
  if (view.status === 'missing') {
    return (
      <section className="grid gap-4">
        <NavButton to="/staff" className="text-sm text-accent">
          <span className="inline-block rtl:rotate-180">←</span>{' '}
          {t('nav.staff')}
        </NavButton>
        <Empty>{t('classMode.noSession')}</Empty>
      </section>
    );
  }

  const { session, kit, pending, mode } = view;
  const dayToday = today();
  const history = isHistorySession(session.date, dayToday);
  const canEditHist = canEditHistorySession(session.date, dayToday, staffUser);
  const readOnly = history && !editingHistory;
  const markMode = history || mode === 'online' ? 'online' : mode;
  const backTo = courseReturn ?? (mode === 'online' ? '/staff' : '/teach');
  const backLabel = courseReturn
    ? t('courses.tabSessions')
    : mode === 'online'
      ? t('nav.staff')
      : t('classMode.back');

  const marks = new Map<string, AttendanceStatus>();
  for (const e of pending)
    if (e.type === 'attendance.mark')
      marks.set(e.payload.enrollmentId, e.payload.status);
  const statusOf = (s: Student) =>
    marks.get(s.enrollmentId) ?? s.attendance ?? 'none';

  const materials = kit.materials.filter(
    (m) => m.courseId === session.courseId,
  );
  const memorization = materials.filter((m) => m.track === 'MEMORIZATION');
  const firstMat = memorization[0];
  const positionOf = (memberId: string, materialId: string) =>
    kit.positions.find(
      (p) => p.memberId === memberId && p.materialId === materialId,
    );

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
        <NavButton to={backTo} className="text-sm text-accent">
          <span className="inline-block rtl:rotate-180">←</span> {backLabel}
        </NavButton>
        <div>
          <h1 className="text-xl font-bold">{session.courseName}</h1>
          <p className="text-sm text-muted">
            {formatDate(session.date)} ·{' '}
            {formatTimeRange(
              session.startsAt,
              session.endsAt,
              i18n.language,
              kit.timezone,
            )}
          </p>
        </div>
        <ClassSessionModeNav sessionId={session.id} />
        <Empty>{t('classMode.noMemorizationMaterial')}</Empty>
      </section>
    );
  }

  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,16rem)_1fr] lg:items-start">
      <div className="grid gap-3 lg:sticky lg:top-4">
        <NavButton to={backTo} className="text-sm text-accent">
          <span className="inline-block rtl:rotate-180">←</span> {backLabel}
        </NavButton>
        {history ? (
          <SessionHistoryChrome
            sessionDate={session.date}
            canEdit={canEditHist}
            editing={editingHistory}
            onEditingChange={setEditingHistory}
          />
        ) : null}
        <div>
          <h1 className="text-xl font-bold">{session.courseName}</h1>
          <p className="text-sm text-muted">
            {formatDate(session.date)} ·{' '}
            {formatTimeRange(
              session.startsAt,
              session.endsAt,
              i18n.language,
              kit.timezone,
            )}
          </p>
        </div>
        <ClassSessionModeNav sessionId={session.id} />
        {!history && mode === 'kit' ? <SyncStatus /> : null}
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
              const pos = firstMat
                ? positionOf(s.memberId, firstMat.materialId)
                : undefined;
              const hint = loggedToday(s.memberId)
                ? ` · ${t('classMode.loggedToday')}`
                : '';
              return (
                <option key={s.enrollmentId} value={s.enrollmentId}>
                  {s.name}
                  {hint}
                  {pos?.lastPageReached
                    ? ` (${describePositionShort(pos, i18n.language, t)})`
                    : ''}
                </option>
              );
            })}
          </select>
        </label>
        <ul className="hidden max-h-[calc(100dvh-12rem)] gap-1 overflow-y-auto lg:grid">
          {roster.map((s) => {
            const active = selected?.enrollmentId === s.enrollmentId;
            const pos = firstMat
              ? positionOf(s.memberId, firstMat.materialId)
              : undefined;
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
                    {loggedToday(s.memberId)
                      ? ` · ${t('classMode.loggedToday')}`
                      : ''}
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
            positionFor={(materialId) =>
              positionOf(selected.memberId, materialId)
            }
            syncedLogs={syncedLogsFor(selected.memberId)}
            pending={pendingForMember(selected.memberId)}
            online={markMode === 'online'}
            readOnly={readOnly}
            capturedAt={history ? session.startsAt : undefined}
            onRefresh={refreshOnline}
            onSaved={() => {
              if (
                markMode === 'online' &&
                markOnline &&
                statusOf(selected) === 'none'
              ) {
                void markOnline(selected.enrollmentId, 'PRESENT');
              } else {
                void presentIfUnmarked(
                  session.id,
                  selected.enrollmentId,
                  statusOf(selected),
                );
              }
              setSavedFlash(selected.enrollmentId);
            }}
          />
        ) : (
          <Empty>{t('classMode.pickStudent')}</Empty>
        )}
      </div>
    </section>
  );
}
