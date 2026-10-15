import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { SURAH_BY_NUMBER, SURAHs, validateRange } from '@ribat/quran-data';
import type { AttendanceStatus, ClassKit, Grade, MemorizationSummaryResponse } from '@ribat/shared';
import { Button } from '../components/ui/button';
import { Empty, Field, inputClass } from '../components/ui/form';
import { formatDate, formatTimeRange, normalizeArabic } from '../lib/domain';
import { cn } from '../lib/utils';
import { db } from '../offline/db';
import { enqueue, useLive } from '../offline/outbox';
import { SyncStatus } from '../offline/SyncStatus';

type KitSession = ClassKit['sessions'][number];
type KitMaterial = ClassKit['materials'][number];
type Student = KitSession['roster'][number];

const TONE: Record<AttendanceStatus | 'none', string> = {
  none: 'border-line bg-surface text-muted',
  PRESENT: 'border-accent bg-accent-soft text-accent-strong',
  ABSENT: 'border-danger/40 bg-danger-soft text-danger',
  LATE: 'border-gold bg-gold/15 text-ink',
  EXCUSED: 'border-line bg-paper text-ink',
};

const STATUSES: AttendanceStatus[] = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'];
const GRADES: Grade[] = ['EXCELLENT', 'VERY_GOOD', 'GOOD', 'REPEAT'];

/** WF-05: attendance, recitations and explanation pages for one session, all through the outbox. */
export function ClassSessionPage() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const data = useLive(async () => {
    const row = await db.kit.get('current');
    const kit = row?.kit;
    // The session keeps its own date: after midnight it is still found in yesterday's kit.
    const session =
      kit?.sessions.find((s) => s.id === id) ?? row?.previous?.sessions.find((s) => s.id === id);
    const source = kit?.sessions.some((s) => s.id === id) ? kit : row?.previous;
    const pending = (await db.outbox.orderBy('queuedAt').toArray()).filter(
      (e) => 'sessionId' in e.payload ? e.payload.sessionId === id : e.type === 'memorization.log',
    );
    return { session, kit: source, pending };
  }, [id]);
  const [open, setOpen] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(null), 3000);
    return () => clearTimeout(timer);
  }, [saved]);

  if (!data) return null;
  const { session, kit, pending } = data;
  if (!session || !kit)
    return (
      <section className="grid gap-4">
        <Link to="/teach" className="text-sm text-accent"><span className="inline-block rtl:rotate-180">←</span> {t('classMode.back')}</Link>
        <Empty>{t('classMode.noKit')}</Empty>
      </section>
    );

  // Local marks win over the kit until the server answers (decision 9.4 applies on refresh).
  const marks = new Map<string, AttendanceStatus>();
  for (const e of pending)
    if (e.type === 'attendance.mark') marks.set(e.payload.enrollmentId, e.payload.status);
  const statusOf = (s: Student) => marks.get(s.enrollmentId) ?? s.attendance ?? 'none';
  const queuedLogs = (memberId: string) =>
    pending.filter((e) => e.type === 'memorization.log' && e.payload.memberId === memberId && e.payload.courseId === session.courseId).length;

  const materials = kit.materials.filter((m) => m.courseId === session.courseId);
  const memorization = materials.filter((m) => m.track === 'MEMORIZATION');
  const explanation = materials.filter((m) => m.track === 'EXPLANATION');
  const positionOf = (memberId: string, materialId: string) =>
    kit.positions.find((p) => p.memberId === memberId && p.materialId === materialId);

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
      <Link to="/teach" className="text-sm text-accent"><span className="inline-block rtl:rotate-180">←</span> {t('classMode.back')}</Link>
      <div>
        <h1 className="text-xl font-semibold">{session.courseName}</h1>
        <p className="text-sm text-muted">
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

      {shown.length === 0 ? <Empty>{t('classMode.noMatch')}</Empty> : null}
      <ul className="grid gap-2">
        {shown.map((s) => {
          const status = statusOf(s);
          const first = memorization[0];
          const position = first ? positionOf(s.memberId, first.materialId) : undefined;
          const queued = queuedLogs(s.memberId);
          return (
            <li key={s.enrollmentId} className="rounded-2xl border border-line bg-surface p-3">
              <div className="flex items-center gap-2">
                <div className="grid min-w-0 flex-1">
                  <span dir="auto" className="truncate text-start font-medium">{s.name}</span>
                  <span className="truncate text-xs text-muted">
                    {position ? describePosition(position, first, t, i18n.language) : t('classMode.noPosition')}
                    {queued ? ` · ${t('classMode.queuedLogs', { count: queued })}` : ''}
                  </span>
                </div>
                {memorization.length ? (
                  <Button variant="ghost" onClick={() => setOpen(open === s.enrollmentId ? null : s.enrollmentId)}>
                    {t('classMode.log')}
                  </Button>
                ) : null}
              </div>
              <div role="radiogroup" aria-label={s.name} className="mt-2 grid grid-cols-4 gap-1">
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
              {open === s.enrollmentId ? (
                <LogForm
                  student={s}
                  courseId={session.courseId}
                  materials={memorization}
                  positionOf={positionOf}
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
        <PagesForm session={session} materials={explanation} />
      ) : null}

      <div className="sticky bottom-0 z-10 grid gap-2 rounded-2xl border border-line bg-surface/95 p-3 shadow-lg backdrop-blur">
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

/** WF-05 step 4: type, range, grade, mistakes. Defaults start where the student stopped. */
function LogForm({
  student,
  courseId,
  materials,
  positionOf,
  onDone,
}: {
  student: Student;
  courseId: string;
  materials: KitMaterial[];
  positionOf: (memberId: string, materialId: string) => MemorizationSummaryResponse | undefined;
  onDone: (saved: boolean) => void;
}) {
  const { t, i18n } = useTranslation();
  const [materialId, setMaterialId] = useState(materials[0].materialId);
  const material = materials.find((m) => m.materialId === materialId)!;
  const position = positionOf(student.memberId, materialId);

  const startSurah = position?.lastSurah ?? 1;
  const lastAyah = position?.lastAyah ?? 0;
  const startAyah = Math.min(lastAyah + 1, SURAH_BY_NUMBER.get(startSurah)!.ayahCount);
  const [type, setType] = useState<'NEW' | 'REVISION'>('NEW');
  const [range, setRange] = useState({ surahStart: startSurah, ayahStart: startAyah, surahEnd: startSurah, ayahEnd: startAyah });
  const nextPage = (position?.lastPageReached ?? 0) + 1;
  const [pages, setPages] = useState({ pageFrom: nextPage, pageTo: nextPage });
  const [grade, setGrade] = useState<Grade>('GOOD');
  const [mistakes, setMistakes] = useState(0);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const quran = material.kind === 'QURAN';
  const save = async () => {
    if (
      quran &&
      !validateRange({
        start: { surah: range.surahStart, ayah: range.ayahStart },
        end: { surah: range.surahEnd, ayah: range.ayahEnd },
      })
    )
      return setError(t('classMode.invalidRange'));
    try {
      await enqueue({
        type: 'memorization.log',
        payload: {
          memberId: student.memberId,
          materialId,
          courseId,
          type,
          ...(quran ? { range } : pages),
          grade,
          mistakes,
          ...(note.trim() ? { note: note.trim() } : {}),
        },
      });
      onDone(true);
    } catch {
      setError(t('classMode.invalidRange'));
    }
  };

  const surahOptions = SURAHs.map((s) => (
    <option key={s.number} value={s.number}>
      {s.number}. {i18n.language === 'ar' ? s.nameAr : s.nameEn}
    </option>
  ));
  const num = (value: string, max = Infinity) => Math.min(max, Math.max(1, Number(value) || 1));
  const startCount = SURAH_BY_NUMBER.get(range.surahStart)!.ayahCount;
  const endCount = SURAH_BY_NUMBER.get(range.surahEnd)!.ayahCount;

  return (
    <div className="mt-3 grid gap-3 border-t border-line pt-3">
      {materials.length > 1 ? (
        <Field label={t('classMode.material')}>
          <select className={inputClass} value={materialId} onChange={(e) => setMaterialId(e.target.value)}>
            {materials.map((m) => (
              <option key={m.materialId} value={m.materialId}>{m.title}</option>
            ))}
          </select>
        </Field>
      ) : null}
      <div className="flex gap-2">
        {(['NEW', 'REVISION'] as const).map((value) => (
          <Button key={value} variant={type === value ? 'primary' : 'ghost'} className="flex-1" onClick={() => setType(value)}>
            {t(`classMode.type.${value}`)}
          </Button>
        ))}
      </div>
      {quran ? (
        <div className="grid grid-cols-2 gap-2">
          <Field label={t('classMode.fromSurah')}>
            <select
              className={inputClass}
              value={range.surahStart}
              onChange={(e) => {
                const surah = Number(e.target.value);
                setRange({ surahStart: surah, ayahStart: 1, surahEnd: surah, ayahEnd: 1 });
              }}
            >
              {surahOptions}
            </select>
          </Field>
          <Field label={t('classMode.fromAyah')}>
            <input className={inputClass} inputMode="numeric" value={range.ayahStart} onChange={(e) => setRange({ ...range, ayahStart: num(e.target.value, startCount) })} />
            <span className="text-xs font-normal text-muted">/ {startCount}</span>
          </Field>
          <Field label={t('classMode.toSurah')}>
            <select className={inputClass} value={range.surahEnd} onChange={(e) => {
                const surahEnd = Number(e.target.value);
                setRange({ ...range, surahEnd, ayahEnd: Math.min(range.ayahEnd, SURAH_BY_NUMBER.get(surahEnd)!.ayahCount) });
              }}>
              {surahOptions}
            </select>
          </Field>
          <Field label={t('classMode.toAyah')}>
            <input className={inputClass} inputMode="numeric" value={range.ayahEnd} onChange={(e) => setRange({ ...range, ayahEnd: num(e.target.value, endCount) })} />
            <span className="text-xs font-normal text-muted">/ {endCount}</span>
          </Field>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Field label={t('classMode.fromPage')}>
            <input className={inputClass} inputMode="numeric" value={pages.pageFrom} onChange={(e) => setPages({ ...pages, pageFrom: num(e.target.value) })} />
          </Field>
          <Field label={t('classMode.toPage')}>
            <input className={inputClass} inputMode="numeric" value={pages.pageTo} onChange={(e) => setPages({ ...pages, pageTo: num(e.target.value) })} />
          </Field>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {GRADES.map((value) => (
          <Button key={value} variant={grade === value ? 'primary' : 'ghost'} onClick={() => setGrade(value)}>
            {t(`classMode.grade.${value}`)}
          </Button>
        ))}
      </div>
      <div className="grid grid-cols-[11rem_1fr] gap-2">
        <div role="group" aria-label={t('classMode.mistakes')} className="grid gap-1.5 text-sm font-medium text-ink">
          {t('classMode.mistakes')}
          <div className="flex gap-1">
            <Button variant="ghost" className="px-3" aria-label={t('classMode.fewerMistakes')} onClick={() => setMistakes(Math.max(0, mistakes - 1))}>−</Button>
            <input className={cn(inputClass, 'min-w-0 text-center')} inputMode="numeric" value={mistakes} onChange={(e) => setMistakes(Math.max(0, Number(e.target.value) || 0))} />
            <Button variant="ghost" className="px-3" aria-label={t('classMode.moreMistakes')} onClick={() => setMistakes(mistakes + 1)}>+</Button>
          </div>
        </div>
        <Field label={t('classMode.note')}>
          <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      <div className="flex gap-2">
        <Button className="flex-1" onClick={() => void save()}>{t('classMode.save')}</Button>
        <Button variant="ghost" onClick={() => onDone(false)}>{t('classMode.cancel')}</Button>
      </div>
    </div>
  );
}

/** Decision 7.1: explanation pages are logged once for the class (or the teacher's group). */
function PagesForm({ session, materials }: { session: KitSession; materials: KitMaterial[] }) {
  const { t } = useTranslation();
  const [materialId, setMaterialId] = useState(materials[0].materialId);
  const [pages, setPages] = useState({ pageFrom: 1, pageTo: 1 });
  const [note, setNote] = useState('');
  const [done, setDone] = useState(false);
  const num = (value: string) => Math.max(1, Number(value) || 1);

  const save = async () => {
    await enqueue({
      type: 'material.log',
      payload: {
        sessionId: session.id,
        materialId,
        groupId: session.groupIds[0] ?? null,
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
