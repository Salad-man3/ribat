import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useParams, useSearchParams } from 'react-router';
import { NavButton } from '../components/ui/nav-button';
import { SURAH_BY_NUMBER } from '@ribat/quran-data';
import type {
  AttendanceStatus,
  ClassKit,
  MemorizationSummaryResponse,
} from '@ribat/shared';
import { Button } from '../components/ui/button';
import { Empty, Field, inputClass } from '../components/ui/form';
import { useCalendar, useFormatDates } from '../lib/calendar';
import { formatTimeRange, normalizeArabic, today } from '../lib/domain';
import { canEditHistorySession, isHistorySession } from '../lib/session-mode';
import { useActiveMembership } from '../hooks/use-me';
import { SessionHistoryChrome } from '../components/SessionHistoryChrome';
import { useFillWidthPct } from '../lib/fill-width';
import { cn } from '../lib/utils';
import type { OutboxEntry } from '../offline/db';
import { enqueue, syncNow } from '../offline/outbox';
import {
  markAttendance,
  useClassSessionView,
} from './class-session/use-class-session-view';
import { HifzLegend, HifzMap } from '../components/HifzMap';
import { MemberNameLink } from '../components/MemberNameLink';
import { HifzLogSheet } from '../components/HifzLogSheet';
import { describeLastRecitation, sameAsPosition } from '../lib/last-recitation';
import { SyncStatus } from '../offline/SyncStatus';
import { ClassSessionModeNav } from '../components/ClassSessionModeNav';
import { presentIfUnmarked } from '../lib/class-mode-attendance';

type KitSession = ClassKit['sessions'][number];
type KitMaterial = ClassKit['materials'][number];
type Student = KitSession['roster'][number];
type MemberHifzMap = NonNullable<ClassKit['memberHifzMaps']>[number];
type OpenPanel = { mode: 'test' | 'hifz' } | null;

const TONE: Record<AttendanceStatus | 'none', string> = {
  none: 'border-line bg-surface text-muted',
  PRESENT: 'border-accent bg-accent-soft text-accent-strong',
  ABSENT: 'border-danger/40 bg-danger-soft text-danger',
  LATE: 'border-gold bg-gold/15 text-ink',
  EXCUSED: 'border-line bg-paper text-ink',
};

const STATUSES: AttendanceStatus[] = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'];

function RosterProgressFill({
  marked,
  total,
}: {
  marked: number;
  total: number;
}) {
  const pct = total ? (marked / total) * 100 : 0;
  const ref = useFillWidthPct<HTMLDivElement>(pct);
  return <div ref={ref} className="h-full w-(--fill) bg-accent" />;
}

function describePosition(
  p: MemorizationSummaryResponse,
  material: KitMaterial,
  t: (key: string, options?: Record<string, unknown>) => string,
  language: string,
) {
  if (material.kind === 'QURAN' && p.lastSurah && p.lastAyah) {
    const surah = SURAH_BY_NUMBER.get(p.lastSurah);
    const name = language === 'ar' ? surah?.nameAr : surah?.nameEn;
    return t('classMode.last', {
      page: p.lastPageReached,
      surah: name,
      ayah: p.lastAyah,
    });
  }
  return p.lastPageReached
    ? t('classMode.lastPage', { page: p.lastPageReached })
    : t('classMode.noPosition');
}

function StudentProgressText({
  student,
  first,
  position,
  juzMap,
  today,
  queued,
  hideName,
}: {
  student: Student;
  first: KitMaterial | undefined;
  position: MemorizationSummaryResponse | undefined;
  juzMap: MemberHifzMap | undefined;
  today: boolean;
  queued: number;
  hideName?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const { calendar } = useCalendar();
  return (
    <div className="grid gap-1">
      {hideName ? null : (
        <MemberNameLink
          memberId={student.memberId}
          className="text-start text-base"
        >
          {student.name}
        </MemberNameLink>
      )}
      {juzMap?.lastLog ? (
        <p className="text-sm text-muted">
          {describeLastRecitation(juzMap.lastLog, t, i18n.language, calendar)}
        </p>
      ) : (
        <p className="text-sm text-muted">
          {position && first
            ? describePosition(position, first, t, i18n.language)
            : t('classMode.noPosition')}
        </p>
      )}
      {juzMap?.lastLog &&
      position &&
      first &&
      !sameAsPosition(juzMap.lastLog, position) ? (
        <p className="text-sm text-muted">
          {describePosition(position, first, t, i18n.language)}
        </p>
      ) : null}
      {today || queued ? (
        <p className="text-xs text-muted">
          {today ? t('classMode.loggedToday') : null}
          {today && queued ? ' · ' : null}
          {queued ? t('classMode.queuedLogs', { count: queued }) : null}
        </p>
      ) : null}
    </div>
  );
}

/** WF-05: roster overview, attendance, and per-member detail for one session. */
export function ClassSessionPage() {
  const { id } = useParams();
  const location = useLocation();
  const { pathname } = location;
  const [searchParams, setSearchParams] = useSearchParams();
  const { can } = useActiveMembership();
  const staffUser = can('courses.manage');
  const courseReturn =
    (location.state as { coursePath?: string } | undefined)?.coursePath ?? null;
  const [editingHistory, setEditingHistory] = useState(false);
  const attendanceView = pathname.endsWith('/attendance');
  const memberPick = searchParams.get('member');
  const { t, i18n } = useTranslation();
  const { formatDate } = useFormatDates();
  const { view, markOnline, refreshOnline } = useClassSessionView(id);
  const [open, setOpen] = useState<OpenPanel>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(null), 3000);
    return () => clearTimeout(timer);
  }, [saved]);
  useEffect(() => {
    if (navigator.onLine) void syncNow();
  }, []);

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

  const marks = new Map<string, AttendanceStatus>();
  for (const e of pending)
    if (e.type === 'attendance.mark')
      marks.set(e.payload.enrollmentId, e.payload.status);
  const statusOf = (s: Student) =>
    marks.get(s.enrollmentId) ?? s.attendance ?? 'none';

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

  const materials = kit.materials.filter(
    (m) => m.courseId === session.courseId,
  );
  const memorization = materials.filter((m) => m.track === 'MEMORIZATION');
  const explanation = materials.filter((m) => m.track === 'EXPLANATION');
  const quranMaterial = memorization.find((m) => m.kind === 'QURAN');
  const first = memorization[0];
  const positionOf = (memberId: string, materialId: string) =>
    kit.positions.find(
      (p) => p.memberId === memberId && p.materialId === materialId,
    );
  const juzMapOf = (memberId: string, materialId: string) =>
    kit.memberHifzMaps?.find(
      (m) => m.memberId === memberId && m.materialId === materialId,
    );

  const mark = (s: Student, status: AttendanceStatus) => {
    if (readOnly) return;
    void markAttendance(
      markMode,
      session.id,
      s.enrollmentId,
      status,
      markOnline,
    );
  };

  const afterMemorizationSaved = async (s: Student) => {
    if (mode === 'online' && markOnline && statusOf(s) === 'none') {
      await markOnline(s.enrollmentId, 'PRESENT');
    } else {
      await presentIfUnmarked(session.id, s.enrollmentId, statusOf(s));
    }
    setSaved(s.enrollmentId);
  };

  const unmarked = session.roster.filter((s) => statusOf(s) === 'none');
  const counts = Object.fromEntries(
    STATUSES.map((st) => [
      st,
      session.roster.filter((s) => statusOf(s) === st).length,
    ]),
  );
  const marked = session.roster.length - unmarked.length;
  const needle = normalizeArabic(query.trim());
  const shown =
    session.roster.length > 8 && needle
      ? session.roster.filter((s) => normalizeArabic(s.name).includes(needle))
      : session.roster;

  const selectedMember: Student | undefined =
    memberPick && !attendanceView
      ? (session.roster.find((s) => s.enrollmentId === memberPick) ??
        shown.find((s) => s.enrollmentId === memberPick))
      : undefined;

  const openMember = (enrollmentId: string) => {
    setSearchParams({ member: enrollmentId }, { replace: true });
  };
  const closeMember = () => {
    setSearchParams({}, { replace: true });
    setOpen(null);
  };

  const header = (
    <>
      <NavButton to={backTo} className="text-sm text-accent">
        <span className="inline-block rtl:rotate-180">←</span>{' '}
        {courseReturn
          ? t('courses.tabSessions')
          : mode === 'online'
            ? t('nav.staff')
            : t('classMode.back')}
      </NavButton>
      {history ? (
        <SessionHistoryChrome
          sessionDate={session.date}
          canEdit={canEditHist}
          editing={editingHistory}
          onEditingChange={setEditingHistory}
        />
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{session.courseName}</h1>
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
      </div>
      <ClassSessionModeNav sessionId={session.id} />
      {!history ? <SyncStatus /> : null}
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
    </>
  );

  if (selectedMember) {
    const s = selectedMember;
    const status = statusOf(s);
    const position = first
      ? positionOf(s.memberId, first.materialId)
      : undefined;
    const juzMap =
      first && first.kind === 'QURAN'
        ? juzMapOf(s.memberId, first.materialId)
        : undefined;
    const queued = pendingForMember(s.memberId).length;
    const today = loggedToday(s.memberId);

    return (
      <section className="grid gap-4">
        {header}
        <button
          type="button"
          onClick={closeMember}
          className="text-start text-sm font-medium text-accent"
        >
          <span className="inline-block rtl:rotate-180">←</span>{' '}
          {t('classMode.backToRoster')}
        </button>
        <div className="rounded-2xl border border-line bg-surface p-4">
          <StudentProgressText
            student={s}
            first={first}
            position={position}
            juzMap={juzMap}
            today={today}
            queued={queued}
          />
          {status !== 'none' ? (
            <span
              className={cn(
                'mt-2 inline-block rounded-full border px-2 py-0.5 text-xs',
                TONE[status],
              )}
            >
              {t(`classMode.status.${status}`)}
            </span>
          ) : null}
          {quranMaterial ? (
            <div className="mt-4">
              <HifzLegend />
              <HifzMap
                showLegend={false}
                hifz={{ juzFills: juzMap?.juzFills }}
              />
            </div>
          ) : null}
          {memorization.length && first ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="ghost"
                className="min-h-11 px-2 text-sm font-semibold text-accent"
                onClick={() =>
                  setOpen(open?.mode === 'hifz' ? null : { mode: 'hifz' })
                }
              >
                {t('classMode.recordRecitation')}
              </Button>
              {quranMaterial ? (
                <Button
                  variant="ghost"
                  className="min-h-11 px-2 text-sm"
                  onClick={() =>
                    setOpen(open?.mode === 'test' ? null : { mode: 'test' })
                  }
                >
                  {t('classMode.juzTest')}
                </Button>
              ) : null}
              <NavButton
                to={`/teach/${session.id}/hifz?student=${s.enrollmentId}`}
                className="min-h-11 rounded-lg px-3 text-sm font-medium text-accent"
              >
                {t('classMode.hifz')}
              </NavButton>
            </div>
          ) : null}
          {saved === s.enrollmentId ? (
            <p role="status" className="mt-2 text-sm text-accent">
              {t('classMode.logSaved')}
            </p>
          ) : null}
          {open?.mode === 'hifz' && first ? (
            <HifzLogSheet
              embedded
              student={s}
              courseId={session.courseId}
              materials={memorization}
              recitationKinds={kit.recitationKinds}
              positionFor={(materialId) => positionOf(s.memberId, materialId)}
              syncedLogs={syncedLogsFor(s.memberId)}
              pending={pendingForMember(s.memberId)}
              online={markMode === 'online'}
              readOnly={readOnly}
              capturedAt={history ? session.startsAt : undefined}
              onRefresh={refreshOnline}
              onSaved={() => {
                void afterMemorizationSaved(s);
                setOpen(null);
              }}
            />
          ) : null}
          {open?.mode === 'test' && quranMaterial ? (
            <JuzTestForm
              student={s}
              sessionId={session.id}
              courseId={session.courseId}
              materialId={quranMaterial.materialId}
              passMark={session.testPassMark}
              attendanceStatus={status}
              onDone={(ok) => {
                setOpen(null);
                if (ok) void afterMemorizationSaved(s);
              }}
            />
          ) : null}
        </div>
      </section>
    );
  }

  if (attendanceView) {
    return (
      <section className="grid gap-4">
        {header}
        {shown.length === 0 ? <Empty>{t('classMode.noMatch')}</Empty> : null}
        <ul className="grid gap-2">
          {shown.map((s) => {
            const status = statusOf(s);
            return (
              <li
                key={s.enrollmentId}
                className="rounded-2xl border border-line bg-surface p-3"
              >
                <span dir="auto" className="mb-2 block font-medium">
                  {s.name}
                </span>
                <div
                  role="radiogroup"
                  aria-label={s.name}
                  className="grid grid-cols-2 gap-1 sm:grid-cols-4"
                >
                  {STATUSES.map((st) => (
                    <button
                      key={st}
                      type="button"
                      role="radio"
                      aria-checked={status === st}
                      onClick={() => void mark(s, st)}
                      className={cn(
                        'min-h-11 rounded-lg border px-1 text-sm font-medium',
                        status === st ? TONE[st] : TONE.none,
                      )}
                    >
                      {t(`classMode.status.${st}`)}
                    </button>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
        {explanation.length ? (
          <PagesForm
            session={session}
            materials={explanation}
            kit={kit}
            pending={pending}
          />
        ) : null}
        <div className="sticky z-10 grid gap-2 rounded-2xl border border-line bg-surface/95 p-3 shadow-lg backdrop-blur bottom-0 max-md:bottom-[calc(4.25rem+env(safe-area-inset-bottom,0px))]">
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-medium">
            {STATUSES.map((st) => (
              <span
                key={st}
                className={cn('rounded-full border px-2 py-0.5', TONE[st])}
              >
                {t(`classMode.status.${st}`)} {counts[st]}
              </span>
            ))}
            <span className={cn('rounded-full border px-2 py-0.5', TONE.none)}>
              {t('classMode.status.none')} {unmarked.length}
            </span>
          </div>
          <div
            role="progressbar"
            aria-label={t('classMode.progress')}
            aria-valuemin={0}
            aria-valuemax={session.roster.length}
            aria-valuenow={marked}
            className="h-1.5 overflow-hidden rounded bg-line"
          >
            <RosterProgressFill marked={marked} total={session.roster.length} />
          </div>
          {unmarked.length && !readOnly ? (
            <Button
              onClick={() =>
                void Promise.all(unmarked.map((s) => mark(s, 'PRESENT')))
              }
            >
              {t('classMode.markAllPresent')} ({unmarked.length})
            </Button>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <section className="grid gap-4">
      {header}
      {session.roster.length === 0 ? (
        <div className="grid gap-2">
          <Empty>{t('students.empty')}</Empty>
          <NavButton
            to="/staff/placement"
            className="text-sm font-semibold text-accent"
          >
            {t('placement.title')}
          </NavButton>
        </div>
      ) : null}
      {shown.length === 0 && session.roster.length > 0 ? (
        <Empty>{t('classMode.noMatch')}</Empty>
      ) : null}
      <ul className="grid gap-2">
        {shown.map((s) => {
          const status = statusOf(s);
          const position = first
            ? positionOf(s.memberId, first.materialId)
            : undefined;
          const queued = pendingForMember(s.memberId).length;
          const today = loggedToday(s.memberId);
          const juzMap =
            first && first.kind === 'QURAN'
              ? juzMapOf(s.memberId, first.materialId)
              : undefined;
          return (
            <li
              key={s.enrollmentId}
              className="rounded-2xl border border-line bg-surface p-3"
            >
              <MemberNameLink memberId={s.memberId} className="mb-1 text-base">
                {s.name}
              </MemberNameLink>
              <button
                type="button"
                onClick={() => openMember(s.enrollmentId)}
                className="w-full text-start transition hover:opacity-90"
              >
                <StudentProgressText
                  student={s}
                  first={first}
                  position={position}
                  juzMap={juzMap}
                  today={today}
                  queued={queued}
                  hideName
                />
                {status !== 'none' ? (
                  <span
                    className={cn(
                      'mt-2 inline-block rounded-full border px-2 py-0.5 text-xs',
                      TONE[status],
                    )}
                  >
                    {t(`classMode.status.${status}`)}
                  </span>
                ) : null}
              </button>
              {memorization.length ? (
                <div className="mt-2 border-t border-line pt-2">
                  <NavButton
                    to={`/teach/${session.id}/hifz?student=${s.enrollmentId}`}
                    className="min-h-10 rounded-lg px-3 text-sm font-semibold text-accent"
                  >
                    {t('classMode.hifz')}
                  </NavButton>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {explanation.length ? (
        <PagesForm
          session={session}
          materials={explanation}
          kit={kit}
          pending={pending}
        />
      ) : null}
    </section>
  );
}

function JuzTestForm({
  student,
  sessionId,
  courseId,
  materialId,
  passMark,
  attendanceStatus,
  onDone,
}: {
  student: Student;
  sessionId: string;
  courseId: string;
  materialId: string;
  passMark: number;
  attendanceStatus: AttendanceStatus | 'none';
  onDone: (saved: boolean) => void;
}) {
  const { t } = useTranslation();
  const [juz, setJuz] = useState(30);
  const [score, setScore] = useState(80);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    try {
      await enqueue({
        type: 'memorization.test',
        payload: {
          memberId: student.memberId,
          materialId,
          courseId,
          scopeType: 'JUZ',
          juz,
          score,
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        },
      });
      await presentIfUnmarked(
        sessionId,
        student.enrollmentId,
        attendanceStatus,
      );
      onDone(true);
    } catch {
      setError(t('classMode.testFailed'));
    }
  };

  return (
    <div className="mt-3 grid gap-3 border-t border-line pt-3">
      <p className="text-sm text-muted">
        {t('classMode.passMarkHint', { mark: passMark })}
      </p>
      <Field label={t('classMode.juz')}>
        <select
          className={inputClass}
          value={juz}
          onChange={(e) => setJuz(Number(e.target.value))}
        >
          {Array.from({ length: 30 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t('classMode.score')}>
        <input
          className={inputClass}
          inputMode="numeric"
          value={score}
          onChange={(e) =>
            setScore(Math.min(100, Math.max(0, Number(e.target.value) || 0)))
          }
        />
      </Field>
      <Field label={t('classMode.note')}>
        <input
          className={inputClass}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </Field>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button className="flex-1" onClick={() => void save()}>
          {t('classMode.saveTest')}
        </Button>
        <Button variant="ghost" onClick={() => onDone(false)}>
          {t('classMode.cancel')}
        </Button>
      </div>
    </div>
  );
}

function PagesForm({
  session,
  materials,
  kit,
  pending,
}: {
  session: KitSession;
  materials: KitMaterial[];
  kit: ClassKit;
  pending: OutboxEntry[];
}) {
  const { t } = useTranslation();
  const groupId = session.groupIds[0] ?? null;
  const [materialId, setMaterialId] = useState(materials[0].materialId);
  const material = materials.find((m) => m.materialId === materialId)!;

  const furthestPage = useMemo(() => {
    const fromKit = kit.explanationProgress.find(
      (p) =>
        p.sessionId === session.id &&
        p.materialId === materialId &&
        (p.groupId ?? null) === groupId,
    )?.pageTo;
    let fromPending = 0;
    for (const e of pending) {
      if (
        e.type === 'material.log' &&
        e.payload.sessionId === session.id &&
        e.payload.materialId === materialId &&
        (e.payload.groupId ?? null) === groupId
      )
        fromPending = Math.max(fromPending, e.payload.pageTo);
    }
    return Math.max(fromKit ?? 0, fromPending);
  }, [kit.explanationProgress, pending, session.id, materialId, groupId]);

  const nextFrom = furthestPage > 0 ? furthestPage + 1 : 1;
  const [pages, setPages] = useState({ pageFrom: nextFrom, pageTo: nextFrom });
  useEffect(() => {
    setPages({ pageFrom: nextFrom, pageTo: nextFrom });
  }, [nextFrom, materialId]);

  const [note, setNote] = useState('');
  const [done, setDone] = useState(false);
  const num = (value: string) => Math.max(1, Number(value) || 1);
  const total = material.totalPages;

  const save = async () => {
    await enqueue({
      type: 'material.log',
      payload: {
        sessionId: session.id,
        materialId,
        groupId,
        ...pages,
        ...(note.trim() ? { note: note.trim() } : {}),
      },
    });
    setDone(true);
    setNote('');
  };

  return (
    <section className="grid gap-3 rounded-2xl border border-line bg-surface p-4">
      <h2 className="font-semibold">{t('classMode.explanation')}</h2>
      {total ? (
        <p className="text-sm text-muted">
          {t('classMode.bookProgress', {
            page: furthestPage || pages.pageTo,
            total,
          })}
        </p>
      ) : null}
      {materials.length > 1 ? (
        <select
          className={inputClass}
          value={materialId}
          onChange={(e) => setMaterialId(e.target.value)}
        >
          {materials.map((m) => (
            <option key={m.materialId} value={m.materialId}>
              {m.title}
            </option>
          ))}
        </select>
      ) : (
        <p className="text-sm text-muted">{materials[0].title}</p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Field label={t('classMode.fromPage')}>
          <input
            className={inputClass}
            inputMode="numeric"
            value={pages.pageFrom}
            onChange={(e) =>
              setPages({ ...pages, pageFrom: num(e.target.value) })
            }
          />
        </Field>
        <Field label={t('classMode.toPage')}>
          <input
            className={inputClass}
            inputMode="numeric"
            value={pages.pageTo}
            onChange={(e) =>
              setPages({ ...pages, pageTo: num(e.target.value) })
            }
          />
        </Field>
      </div>
      <Field label={t('classMode.note')}>
        <input
          className={inputClass}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>
      <Button onClick={() => void save()}>{t('classMode.save')}</Button>
      {done ? (
        <p role="status" className="text-sm text-accent">
          {t('classMode.pagesSaved')}
        </p>
      ) : null}
    </section>
  );
}
