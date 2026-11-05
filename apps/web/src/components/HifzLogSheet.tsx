import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { pageForAyah, SURAH_BY_NUMBER, SURAHs } from '@ribat/quran-data';
import type {
  ClassKitTodayLog,
  Grade,
  MemorizationSummaryResponse,
  RecitationKindResponse,
} from '@ribat/shared';
import { ApiError, apiFetch } from '../api/api-fetch';
import { Button } from './ui/button';
import { Field, SwitchField, inputClass } from './ui/form';
import {
  applyHifzShortcut,
  isValidAyahRangeState,
  continuationRangeFromPosition,
  mergeStartManual,
  rangeStats,
  setEndManual,
  stepEndByPage,
  stepEndBySurah,
  toAyahRangeInput,
  type AyahRangeState,
} from '../lib/hifz-range-shortcuts';
import { cn } from '../lib/utils';
import { dropQueued, enqueue, localIso, refreshKit } from '../offline/outbox';
import type { OutboxEntry } from '../offline/db';

const GRADES: Grade[] = ['EXCELLENT', 'VERY_GOOD', 'GOOD', 'REPEAT'];
type KitMaterial = {
  materialId: string;
  kind: string;
  title: string;
};

type Student = {
  memberId: string;
  name: string;
};

function describePosition(
  p: MemorizationSummaryResponse | undefined,
  material: KitMaterial,
  t: (key: string, options?: Record<string, unknown>) => string,
  language: string,
) {
  if (!p?.lastPageReached) return t('classMode.noPosition');
  if (material.kind === 'QURAN' && p.lastSurah && p.lastAyah) {
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

function surahLabel(surah: number, language: string) {
  const meta = SURAH_BY_NUMBER.get(surah);
  if (!meta) return String(surah);
  return language === 'ar' ? meta.nameAr : meta.nameEn;
}

function rangeSummary(
  range: AyahRangeState,
  language: string,
  t: (key: string, options?: Record<string, unknown>) => string,
) {
  const fromPage = pageForAyah({
    surah: range.surahStart,
    ayah: range.ayahStart,
  });
  const toPage = pageForAyah({ surah: range.surahEnd, ayah: range.ayahEnd });
  return t('classMode.rangeSummary', {
    fromSurah: surahLabel(range.surahStart, language),
    fromAyah: range.ayahStart,
    fromPage,
    toSurah: surahLabel(range.surahEnd, language),
    toAyah: range.ayahEnd,
    toPage,
  });
}

function resetFromPosition(pos: MemorizationSummaryResponse | undefined): {
  range: AyahRangeState;
  endLocked: boolean;
} {
  return { range: continuationRangeFromPosition(pos), endLocked: false };
}

export function HifzLogSheet({
  student,
  courseId,
  materials,
  recitationKinds,
  positionFor,
  syncedLogs,
  pending,
  onSaved,
  onRefresh,
  embedded = false,
  online = false,
  readOnly = false,
  capturedAt,
}: {
  student: Student;
  courseId: string;
  materials: KitMaterial[];
  recitationKinds: RecitationKindResponse[];
  positionFor: (materialId: string) => MemorizationSummaryResponse | undefined;
  syncedLogs: ClassKitTodayLog[];
  pending: OutboxEntry[];
  onSaved?: () => void;
  /** Staff lobby: POST logs live instead of the offline outbox. */
  online?: boolean;
  onRefresh?: () => void;
  /** When set (e.g. history session), the log is recorded at this instant. */
  capturedAt?: string;
  readOnly?: boolean;
  /** Inline on ClassSessionPage: hide duplicate header and heavy range pickers. */
  embedded?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const [materialId, setMaterialId] = useState(materials[0].materialId);
  const material = materials.find((m) => m.materialId === materialId)!;
  const position = positionFor(materialId);
  const quran = material.kind === 'QURAN';

  const [type, setType] = useState<'NEW' | 'REVISION'>('NEW');
  const [recitationKindId, setRecitationKindId] = useState<
    string | undefined
  >();
  const [range, setRange] = useState<AyahRangeState>(() =>
    continuationRangeFromPosition(positionFor(materials[0].materialId)),
  );
  const [, setEndLocked] = useState(false);

  const nextPage = Math.min(604, (position?.lastPageReached ?? 0) + 1);
  const [pages, setPages] = useState({ pageFrom: nextPage, pageTo: nextPage });

  useEffect(() => {
    const pos = positionFor(materialId);
    const { range: next, endLocked: locked } = resetFromPosition(pos);
    setRange(next);
    setEndLocked(locked);
    const page = Math.min(604, (pos?.lastPageReached ?? 0) + 1);
    setPages({ pageFrom: page, pageTo: page });
    setDidntPass(false);
  }, [student.memberId, materialId]);

  const [grade, setGrade] = useState<Grade>('GOOD');
  const [didntPass, setDidntPass] = useState(false);
  const [mistakes, setMistakes] = useState(0);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [voiding, setVoiding] = useState(false);

  const pendingLogs = pending.filter((e) => e.type === 'memorization.log');
  const num = (value: string, max = Infinity) =>
    Math.min(max, Math.max(1, Number(value) || 1));

  const surahOptions = SURAHs.map((s) => (
    <option key={s.number} value={s.number}>
      {s.number}. {i18n.language === 'ar' ? s.nameAr : s.nameEn}
    </option>
  ));

  const lockAndSetRange = (next: AyahRangeState | null) => {
    if (!next) return;
    setRange(next);
    setEndLocked(true);
  };

  const stats = quran ? rangeStats(range) : null;

  const save = async () => {
    if (readOnly) return;
    setError(null);
    if (quran && !isValidAyahRangeState(range))
      return setError(t('classMode.invalidRange'));
    try {
      const when = capturedAt ?? localIso();
      const payload = {
        memberId: student.memberId,
        materialId,
        courseId,
        type: recitationKindId ? 'NEW' : type,
        ...(quran ? { range: toAyahRangeInput(range) } : pages),
        ...(didntPass
          ? { grade: null, countsProgress: false }
          : { grade, countsProgress: true }),
        mistakes,
        ...(note.trim() ? { note: note.trim() } : {}),
        ...(recitationKindId ? { recitationKindId } : {}),
      };
      if (online) {
        await apiFetch('/api/v1/memorization/logs', {
          method: 'POST',
          body: JSON.stringify({
            ...payload,
            idempotencyKey: crypto.randomUUID(),
            capturedAt: when,
          }),
        });
        onRefresh?.();
      } else {
        await enqueue({ type: 'memorization.log', payload });
      }
      if (quran) {
        if (didntPass) {
          const { range: next, endLocked: locked } =
            resetFromPosition(position);
          setRange(next);
          setEndLocked(locked);
        } else {
          setRange(
            continuationRangeFromPosition({
              lastSurah: range.surahEnd,
              lastAyah: range.ayahEnd,
            }),
          );
          setEndLocked(false);
        }
      }
      onSaved?.();
    } catch {
      setError(t('classMode.saveFailed'));
    }
  };

  const undoPending = async (key: string) => {
    await dropQueued(key);
  };

  const voidSynced = async (logId: string) => {
    setVoiding(true);
    setError(null);
    try {
      await apiFetch(`/api/v1/memorization/logs/${logId}/void`, {
        method: 'POST',
        body: JSON.stringify({ reason: t('classMode.voidReason') }),
      });
      await refreshKit().catch(() => undefined);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401)
        setError(t('classMode.voidNeedsOnline'));
      else setError(t('classMode.voidFailed'));
    } finally {
      setVoiding(false);
    }
  };

  return (
    <div
      className={
        embedded
          ? 'grid gap-3 border-t border-line pt-3'
          : 'grid gap-4 rounded-2xl border border-line bg-surface p-4'
      }
    >
      {embedded ? null : (
        <div>
          <p dir="auto" className="text-lg font-semibold">
            {student.name}
          </p>
          <div className="mt-2 rounded-xl border border-line bg-paper px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              {t('classMode.lastPositionHeading')}
            </p>
            <p className="mt-0.5 text-sm font-medium">
              {describePosition(position, material, t, i18n.language)}
            </p>
            {quran ? (
              <button
                type="button"
                className="mt-2 text-xs font-semibold text-accent underline"
                onClick={() => {
                  const { range: next, endLocked: locked } =
                    resetFromPosition(position);
                  setRange(next);
                  setEndLocked(locked);
                }}
              >
                {t('classMode.continueFromHere')}
              </button>
            ) : null}
          </div>
        </div>
      )}

      {materials.length > 1 ? (
        <Field label={t('classMode.material')}>
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
        </Field>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        {(['NEW', 'REVISION'] as const).map((value) => (
          <Button
            key={value}
            variant={type === value && !recitationKindId ? 'primary' : 'ghost'}
            className="w-full"
            onClick={() => {
              setRecitationKindId(undefined);
              setType(value);
            }}
          >
            {t(`classMode.type.${value}`)}
          </Button>
        ))}
        {recitationKinds.map((kind) => (
          <Button
            key={kind.id}
            variant={recitationKindId === kind.id ? 'primary' : 'ghost'}
            className="col-span-2 w-full sm:col-span-1"
            onClick={() => {
              setRecitationKindId(kind.id);
              setType('NEW');
            }}
          >
            {kind.name}
          </Button>
        ))}
      </div>

      {quran ? (
        <div className="grid gap-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label={t('classMode.from')}>
              <select
                className={cn(inputClass, 'mb-2')}
                value={range.surahStart}
                onChange={(e) => {
                  const surah = Number(e.target.value);
                  const max = SURAH_BY_NUMBER.get(surah)!.ayahCount;
                  const ayah = Math.min(range.ayahStart, max);
                  setRange(mergeStartManual(range, { surah, ayah }));
                }}
              >
                {surahOptions}
              </select>
              <input
                className={inputClass}
                inputMode="numeric"
                aria-label={t('classMode.fromAyah')}
                value={range.ayahStart}
                onChange={(e) => {
                  const max =
                    SURAH_BY_NUMBER.get(range.surahStart)?.ayahCount ?? 1;
                  const ayah = num(e.target.value, max);
                  setRange(
                    mergeStartManual(range, { surah: range.surahStart, ayah }),
                  );
                }}
              />
            </Field>
            <Field label={t('classMode.to')}>
              <select
                className={cn(inputClass, 'mb-2')}
                value={range.surahEnd}
                onChange={(e) => {
                  const surah = Number(e.target.value);
                  const max = SURAH_BY_NUMBER.get(surah)!.ayahCount;
                  const ayah = Math.min(range.ayahEnd, max);
                  const next = setEndManual(range, { surah, ayah });
                  if (next) lockAndSetRange(next);
                }}
              >
                {surahOptions}
              </select>
              <input
                className={inputClass}
                inputMode="numeric"
                aria-label={t('classMode.toAyah')}
                value={range.ayahEnd}
                onChange={(e) => {
                  const max =
                    SURAH_BY_NUMBER.get(range.surahEnd)?.ayahCount ?? 1;
                  const ayah = num(e.target.value, max);
                  const next = setEndManual(range, {
                    surah: range.surahEnd,
                    ayah,
                  });
                  if (next) lockAndSetRange(next);
                }}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                className="shrink-0 px-3"
                onClick={() => lockAndSetRange(stepEndByPage(range, -1))}
              >
                −
              </Button>
              <span className="flex-1 text-center text-xs font-medium">
                {t('classMode.stepPage')}
              </span>
              <Button
                variant="ghost"
                className="shrink-0 px-3"
                onClick={() => lockAndSetRange(stepEndByPage(range, 1))}
              >
                +
              </Button>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                className="shrink-0 px-3"
                onClick={() => lockAndSetRange(stepEndBySurah(range, -1))}
              >
                −
              </Button>
              <span className="flex-1 text-center text-xs font-medium">
                {t('classMode.stepSurah')}
              </span>
              <Button
                variant="ghost"
                className="shrink-0 px-3"
                onClick={() => lockAndSetRange(stepEndBySurah(range, 1))}
              >
                +
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="ghost"
              className="w-full"
              onClick={() =>
                lockAndSetRange(applyHifzShortcut('endOfPage', range))
              }
            >
              {t('classMode.shortcut.endOfPage')}
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() =>
                lockAndSetRange(applyHifzShortcut('endOfSurah', range))
              }
            >
              {t('classMode.shortcut.endOfSurah')}
            </Button>
          </div>

          <div className="rounded-xl border border-line bg-paper px-3 py-2 text-sm">
            <p className="font-medium">
              {rangeSummary(range, i18n.language, t)}
            </p>
            {stats ? (
              <p className="mt-1 text-muted">
                {t('classMode.rangeStats', stats)}
              </p>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="grid gap-2">
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
      )}

      <SwitchField
        label={t('classMode.didntPass')}
        checked={didntPass}
        onChange={setDidntPass}
      />

      {!didntPass ? (
        <div className="grid grid-cols-2 gap-2">
          {GRADES.map((value) => (
            <Button
              key={value}
              variant={grade === value ? 'primary' : 'ghost'}
              className="w-full"
              onClick={() => setGrade(value)}
            >
              {t(`classMode.grade.${value}`)}
            </Button>
          ))}
        </div>
      ) : null}

      {!didntPass ? (
        <div className="grid gap-2">
          <span className="text-sm font-medium">{t('classMode.mistakes')}</span>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              className="shrink-0 px-4"
              aria-label={t('classMode.fewerMistakes')}
              onClick={() => setMistakes(Math.max(0, mistakes - 1))}
            >
              −
            </Button>
            <input
              className={cn(inputClass, 'text-center')}
              inputMode="numeric"
              value={mistakes}
              onChange={(e) =>
                setMistakes(Math.max(0, Number(e.target.value) || 0))
              }
            />
            <Button
              variant="ghost"
              className="shrink-0 px-4"
              aria-label={t('classMode.moreMistakes')}
              onClick={() => setMistakes(mistakes + 1)}
            >
              +
            </Button>
          </div>
        </div>
      ) : null}

      <Field label={t('classMode.note')}>
        <input
          className={inputClass}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      {!readOnly ? (
        <Button className="w-full" onClick={() => void save()}>
          {t('classMode.save')}
        </Button>
      ) : null}

      {!embedded && (pendingLogs.length > 0 || syncedLogs.length > 0) ? (
        <div className="grid gap-1 rounded-xl border border-line bg-paper p-2 text-sm">
          <p className="font-medium">{t('classMode.todayEntries')}</p>
          {pendingLogs.map((e) => (
            <div
              key={e.idempotencyKey}
              className="flex items-center justify-between gap-2"
            >
              <span className="text-muted">{t('classMode.pendingEntry')}</span>
              <Button
                variant="ghost"
                onClick={() => void undoPending(e.idempotencyKey)}
              >
                {t('classMode.undoPending')}
              </Button>
            </div>
          ))}
          {syncedLogs.map((l) => (
            <div key={l.id} className="flex items-center justify-between gap-2">
              <span className="text-muted">
                {t(`classMode.type.${l.type}`)} · {l.pageFrom}–{l.pageTo}
                {!l.countsProgress ? ` · ${t('classMode.didntPassShort')}` : ''}
              </span>
              <Button
                variant="ghost"
                disabled={voiding}
                onClick={() => void voidSynced(l.id)}
              >
                {t('classMode.voidLog')}
              </Button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
