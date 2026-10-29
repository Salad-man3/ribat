import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';
import { NavButton } from '../components/ui/nav-button';
import { SURAH_BY_NUMBER } from '@ribat/quran-data';
import type {
  AttendanceStatus,
  ClassKit,
  MemorizationSummaryResponse,
} from '@ribat/shared';
import { Button } from '../components/ui/button';
import { Empty, Field, inputClass } from '../components/ui/form';
import { formatDate, formatTimeRange, normalizeArabic } from '../lib/domain';
import { cn } from '../lib/utils';
import { db, type OutboxEntry } from '../offline/db';
import { enqueue, syncNow, useLive } from '../offline/outbox';
import { HifzJuzStrip } from '../components/HifzJuzStrip';
import { HifzLogSheet } from '../components/HifzLogSheet';
import { quickMemorizationLog } from '../lib/class-mode-quick-log';
import { SyncStatus } from '../offline/SyncStatus';

type KitSession = ClassKit['sessions'][number];
type KitMaterial = ClassKit['materials'][number];
type Student = KitSession['roster'][number];
type OpenPanel = { enrollmentId: string; mode: 'test' | 'hifz' } | null;

const TONE: Record<AttendanceStatus | 'none', string> = {
  none: 'border-line bg-surface text-muted',
  PRESENT: 'border-accent bg-accent-soft text-accent-strong',
  ABSENT: 'border-danger/40 bg-danger-soft text-danger',
  LATE: 'border-gold bg-gold/15 text-ink',
  EXCUSED: 'border-line bg-paper text-ink',
};

const STATUSES: AttendanceStatus[] = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'];
/** WF-05: attendance, recitations and explanation pages for one session, all through the outbox. */
export function ClassSessionPage() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const data = useLive(async () => {
    const row = await db.kit.get('current');
    const kit = row?.kit;
    const session =
      kit?.sessions.find((s) => s.id === id) ?? row?.previous?.sessions.find((s) => s.id === id);
    const source = kit?.sessions.some((s) => s.id === id) ? kit : row?.previous;
    const courseId = session?.courseId;
    const pending = (await db.outbox.orderBy('queuedAt').toArray()).filter((e) => {
      if (e.type === 'attendance.mark' || e.type === 'material.log')
        return e.payload.sessionId === id;
      if (!courseId) return false;
      if (e.type === 'memorization.log' || e.type === 'memorization.test')
        return e.payload.courseId === courseId;
      return false;
    });
    return { session, kit: source, pending };
  }, [id]);
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

  if (!data) return null;
  const { session, kit, pending } = data;
  if (!session || !kit)
    return (
      <section className="grid gap-4">
        <NavButton to="/teach" className="text-sm text-accent"><span className="inline-block rtl:rotate-180">←</span> {t('classMode.back')}</NavButton>
        <Empty>{t('classMode.noKit')}</Empty>
      </section>
    );

  const marks = new Map<string, AttendanceStatus>();
  for (const e of pending)
    if (e.type === 'attendance.mark') marks.set(e.payload.enrollmentId, e.payload.status);
  const statusOf = (s: Student) => marks.get(s.enrollmentId) ?? s.attendance ?? 'none';

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

  const materials = kit.materials.filter((m) => m.courseId === session.courseId);
  const memorization = materials.filter((m) => m.track === 'MEMORIZATION');
  const explanation = materials.filter((m) => m.track === 'EXPLANATION');
  const quranMaterial = memorization.find((m) => m.kind === 'QURAN');
  const positionOf = (memberId: string, materialId: string) =>
    kit.positions.find((p) => p.memberId === memberId && p.materialId === materialId);
  const juzMapOf = (memberId: string, materialId: string) =>
    kit.memberHifzMaps?.find(
      (m) => m.memberId === memberId && m.materialId === materialId,
    )?.juzMemorized;

  const mark = (s: Student, status: AttendanceStatus) =>
    enqueue({ type: 'attendance.mark', payload: { sessionId: session.id, enrollmentId: s.enrollmentId, status } });
  const unmarked = session.roster.filter((s) => statusOf(s) === 'none');
  const counts = Object.fromEntries(STATUSES.map((st) => [st, session.roster.filter((s) => statusOf(s) === st).length]));
  const marked = session.roster.length - unmarked.length;
  const needle = normalizeArabic(query.trim());
  const shown = session.roster.length > 8 && needle
    ? session.roster.filter((s) => normalizeArabic(s.name).includes(needle))
    : session.roster;

  return (
    <section className="grid gap-4">
      <NavButton to="/teach" className="text-sm text-accent"><span className="inline-block rtl:rotate-180">←</span> {t('classMode.back')}</NavButton>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{session.courseName}</h1>
          <p className="text-sm text-muted">
            {formatDate(session.date, i18n.language)} ·{' '}
            {formatTimeRange(session.startsAt, session.endsAt, i18n.language, kit.timezone)}
          </p>
        </div>
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

      {shown.length === 0 ? <Empty>{t('classMode.noMatch')}</Empty> : null}
      {quranMaterial && kit.memberHifzMaps?.length ? (
        <p className="text-xs text-muted">{t('hifz.legendMemorized')}</p>
      ) : null}
      <ul className="grid gap-2">
        {shown.map((s) => {
          const status = statusOf(s);
          const first = memorization[0];
          const position = first ? positionOf(s.memberId, first.materialId) : undefined;
          const queued = pendingForMember(s.memberId).length;
          const today = loggedToday(s.memberId);
          const panelOpen = open?.enrollmentId === s.enrollmentId;
          const juzMap =
            first && first.kind === 'QURAN' ? juzMapOf(s.memberId, first.materialId) : undefined;
          return (
            <li key={s.enrollmentId} className="rounded-2xl border border-line bg-surface p-3">
              <div className="flex items-center gap-2">
                <div className="grid min-w-0 flex-1">
                  <span dir="auto" className="truncate text-start font-medium">{s.name}</span>
                  <span className="truncate text-xs text-muted">
                    {position && first ? describePosition(position, first, t, i18n.language) : t('classMode.noPosition')}
                    {today ? ` · ${t('classMode.loggedToday')}` : ''}
                    {queued ? ` · ${t('classMode.queuedLogs', { count: queued })}` : ''}
                  </span>
                </div>
                {memorization.length && first ? (
                  <div className="flex shrink-0 flex-wrap justify-end gap-1">
                    <Button
                      variant="ghost"
                      className="min-h-11 px-2 text-sm font-semibold text-accent"
                      disabled={today}
                      onClick={() =>
                        void quickMemorizationLog({
                          memberId: s.memberId,
                          courseId: session.courseId,
                          materialId: first.materialId,
                          materialKind: first.kind,
                          position,
                        }).then((ok) => {
                          if (ok) setSaved(s.enrollmentId);
                        })
                      }
                    >
                      {t('classMode.quickLog')}
                    </Button>
                    <Button
                      variant="ghost"
                      className="min-h-11 px-2 text-sm font-semibold"
                      onClick={() =>
                        setOpen(
                          panelOpen && open?.mode === 'hifz'
                            ? null
                            : { enrollmentId: s.enrollmentId, mode: 'hifz' },
                        )
                      }
                    >
                      {t('classMode.logRecitation')}
                    </Button>
                    {quranMaterial ? (
                      <Button
                        variant="ghost"
                        className="min-h-11 px-2"
                        onClick={() =>
                          setOpen(
                            panelOpen && open?.mode === 'test'
                              ? null
                              : { enrollmentId: s.enrollmentId, mode: 'test' },
                          )
                        }
                      >
                        {t('classMode.juzTest')}
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>
              {juzMap ? (
                <div className="mt-2">
                  <HifzJuzStrip juzMemorized={juzMap} />
                </div>
              ) : null}
              <div role="radiogroup" aria-label={s.name} className="mt-2 grid grid-cols-2 gap-1 sm:grid-cols-4">
                {STATUSES.map((st) => (
                  <button
                    key={st}
                    type="button"
                    role="radio"
                    aria-checked={status === st}
                    onClick={() => void mark(s, st)}
                    className={cn('min-h-11 rounded-lg border px-1 text-sm font-medium', status === st ? TONE[st] : TONE.none)}
                  >
                    {t(`classMode.status.${st}`)}
                  </button>
                ))}
              </div>
              {saved === s.enrollmentId ? <p role="status" className="mt-2 text-sm text-accent">{t('classMode.logSaved')}</p> : null}
              {panelOpen && open?.mode === 'hifz' && first ? (
                <HifzLogSheet
                  embedded
                  student={s}
                  courseId={session.courseId}
                  materials={memorization}
                  recitationKinds={kit.recitationKinds}
                  positionFor={(materialId) => positionOf(s.memberId, materialId)}
                  syncedLogs={syncedLogsFor(s.memberId)}
                  pending={pendingForMember(s.memberId)}
                  onSaved={() => {
                    setSaved(s.enrollmentId);
                    setOpen(null);
                  }}
                />
              ) : null}
              {panelOpen && open?.mode === 'test' && quranMaterial ? (
                <JuzTestForm
                  student={s}
                  courseId={session.courseId}
                  materialId={quranMaterial.materialId}
                  passMark={session.testPassMark}
                  onDone={(ok) => {
                    setOpen(null);
                    if (ok) setSaved(s.enrollmentId);
                  }}
                />
              ) : null}
            </li>
          );
        })}
      </ul>

      {explanation.length ? (
        <PagesForm session={session} materials={explanation} kit={kit} pending={pending} />
      ) : null}

      <div className="sticky z-10 grid gap-2 rounded-2xl border border-line bg-surface/95 p-3 shadow-lg backdrop-blur bottom-0 max-md:bottom-[calc(4.25rem+env(safe-area-inset-bottom,0px))]">
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-medium">
          {STATUSES.map((st) => (
            <span key={st} className={cn('rounded-full border px-2 py-0.5', TONE[st])}>
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
          <div className="h-full bg-accent" style={{ width: `${session.roster.length ? (marked / session.roster.length) * 100 : 0}%` }} />
        </div>
        {unmarked.length ? (
          <Button onClick={() => void Promise.all(unmarked.map((s) => mark(s, 'PRESENT')))}>
            {t('classMode.markAllPresent')} ({unmarked.length})
          </Button>
        ) : null}
      </div>
    </section>
  );
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
    return t('classMode.last', { page: p.lastPageReached, surah: name, ayah: p.lastAyah });
  }
  return p.lastPageReached ? t('classMode.lastPage', { page: p.lastPageReached }) : t('classMode.noPosition');
}

function JuzTestForm({
  student,
  courseId,
  materialId,
  passMark,
  onDone,
}: {
  student: Student;
  courseId: string;
  materialId: string;
  passMark: number;
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
      onDone(true);
    } catch {
      setError(t('classMode.testFailed'));
    }
  };

  return (
    <div className="mt-3 grid gap-3 border-t border-line pt-3">
      <p className="text-sm text-muted">{t('classMode.passMarkHint', { mark: passMark })}</p>
      <Field label={t('classMode.juz')}>
        <select className={inputClass} value={juz} onChange={(e) => setJuz(Number(e.target.value))}>
          {Array.from({ length: 30 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </Field>
      <Field label={t('classMode.score')}>
        <input
          className={inputClass}
          inputMode="numeric"
          value={score}
          onChange={(e) => setScore(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
        />
      </Field>
      <Field label={t('classMode.note')}>
        <input className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      <div className="flex gap-2">
        <Button className="flex-1" onClick={() => void save()}>{t('classMode.saveTest')}</Button>
        <Button variant="ghost" onClick={() => onDone(false)}>{t('classMode.cancel')}</Button>
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
        <select className={inputClass} value={materialId} onChange={(e) => setMaterialId(e.target.value)}>
          {materials.map((m) => (
            <option key={m.materialId} value={m.materialId}>{m.title}</option>
          ))}
        </select>
      ) : (
        <p className="text-sm text-muted">{materials[0].title}</p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Field label={t('classMode.fromPage')}>
          <input className={inputClass} inputMode="numeric" value={pages.pageFrom} onChange={(e) => setPages({ ...pages, pageFrom: num(e.target.value) })} />
        </Field>
        <Field label={t('classMode.toPage')}>
          <input className={inputClass} inputMode="numeric" value={pages.pageTo} onChange={(e) => setPages({ ...pages, pageTo: num(e.target.value) })} />
        </Field>
      </div>
      <Field label={t('classMode.note')}>
        <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <Button onClick={() => void save()}>{t('classMode.save')}</Button>
      {done ? <p role="status" className="text-sm text-accent">{t('classMode.pagesSaved')}</p> : null}
    </section>
  );
}
