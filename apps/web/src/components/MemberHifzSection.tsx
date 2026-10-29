import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SURAH_BY_NUMBER, SURAHs, validateRange } from '@ribat/quran-data';
import type {
  AwqafExamLevel,
  CreateAwqafExamInput,
  CreateMemorizationLogInput,
  MemorizationLogResponse,
} from '@ribat/shared';
import { ApiError, apiFetch } from '../api/api-fetch';
import { resolveQuranLogRange, type QuranRangeMode } from '../lib/quran-log-range';
import { HifzMap } from './HifzMap';
import { Button } from './ui/button';
import { Card, Empty, Field, inputClass } from './ui/form';
import { useProgress } from './family';

const AWQAF_LEVELS: AwqafExamLevel[] = [
  'AJZA_3',
  'AJZA_5',
  'AJZA_10',
  'AJZA_15',
  'KHATMAH',
];

export function MemberHifzSection({ memberId }: { memberId: string }) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const progress = useProgress(memberId);
  const logs = useQuery({
    queryKey: ['memorization-logs', memberId],
    queryFn: () =>
      apiFetch<MemorizationLogResponse[]>(
        `/api/v1/memorization/logs?memberId=${memberId}&limit=20`,
      ),
  });

  const voidLog = useMutation({
    mutationFn: async (logId: string) => {
      await apiFetch(`/api/v1/memorization/logs/${logId}/void`, {
        method: 'POST',
        body: JSON.stringify({ reason: t('classMode.voidReason') }),
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['memorization-logs', memberId] }),
        queryClient.invalidateQueries({ queryKey: ['progress', memberId] }),
      ]);
    },
  });

  if (progress.isError) return null;
  const p = progress.data;
  if (!p?.hifz) return null;
  const quranMaterialId = p.summaries.find((s) => s.materialKind === 'QURAN')?.materialId;

  return (
    <div className="grid gap-4">
      <Card title={t('hifz.mapTitle')}>
        <HifzMap hifz={p.hifz} />
      </Card>
      <StaffInitialForm memberId={memberId} materialId={quranMaterialId} />
      <AwqafExamForm memberId={memberId} />
      <Card title={t('hifz.recentLogs')}>
        {!logs.data?.length ? <Empty>{t('hifz.noLogs')}</Empty> : null}
        <ul className="grid gap-1 text-sm">
          {logs.data?.filter((l) => !l.voidedAt).map((l) => (
            <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-paper px-3 py-2">
              <span>
                {t(`classMode.type.${l.type}`)} · {l.pageFrom}–{l.pageTo}
              </span>
              <span className="flex items-center gap-2">
                <span className="text-xs text-muted">{new Date(l.loggedAt).toLocaleString(i18n.language)}</span>
                <Button
                  variant="ghost"
                  disabled={voidLog.isPending}
                  onClick={() => void voidLog.mutate(l.id)}
                >
                  {t('classMode.voidLog')}
                </Button>
              </span>
            </li>
          ))}
        </ul>
        {voidLog.error instanceof ApiError ? (
          <p className="mt-2 text-sm text-danger">{t('classMode.voidFailed')}</p>
        ) : null}
      </Card>
    </div>
  );
}

function StaffInitialForm({
  memberId,
  materialId,
}: {
  memberId: string;
  materialId?: string;
}) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [rangeMode, setRangeMode] = useState<QuranRangeMode>('PAGE');
  const [range, setRange] = useState({ surahStart: 114, ayahStart: 1, surahEnd: 114, ayahEnd: 6 });
  const [pages, setPages] = useState({ pageFrom: 582, pageTo: 604 });
  const [surahPages, setSurahPages] = useState({ surah: 114, pageFrom: 582, pageTo: 604 });

  const surahOptions = SURAHs.map((s) => (
    <option key={s.number} value={s.number}>
      {s.number}. {i18n.language === 'ar' ? s.nameAr : s.nameEn}
    </option>
  ));
  const num = (value: string, max = Infinity) => Math.min(max, Math.max(1, Number(value) || 1));
  const startCount = SURAH_BY_NUMBER.get(range.surahStart)!.ayahCount;
  const endCount = SURAH_BY_NUMBER.get(range.surahEnd)!.ayahCount;

  const save = useMutation({
    mutationFn: async () => {
      if (!materialId) throw new Error('no quran');
      const resolved = resolveQuranLogRange(rangeMode, range, pages, surahPages);
      if (!resolved || !validateRange({
        start: { surah: resolved.surahStart, ayah: resolved.ayahStart },
        end: { surah: resolved.surahEnd, ayah: resolved.ayahEnd },
      }))
        throw new Error('range');
      const body: CreateMemorizationLogInput = {
        memberId,
        materialId,
        courseId: null,
        type: 'INITIAL',
        range: resolved,
        mistakes: 0,
        countsProgress: true,
        idempotencyKey: crypto.randomUUID(),
      };
      await apiFetch('/api/v1/memorization/logs', { method: 'POST', body: JSON.stringify(body) });
    },
    onSuccess: async () => {
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['progress', memberId] });
      await queryClient.invalidateQueries({ queryKey: ['memorization-logs', memberId] });
    },
  });

  if (!materialId) return null;

  return (
    <Card title={t('hifz.initialTitle')}>
      <p className="text-sm text-muted">{t('hifz.initialHint')}</p>
      {!open ? (
        <Button variant="ghost" onClick={() => setOpen(true)}>{t('hifz.addInitial')}</Button>
      ) : (
        <div className="grid gap-2">
          <div className="flex flex-wrap gap-1">
            {(['PAGE', 'AYAH', 'SURAH_PAGE'] as const).map((mode) => (
              <Button key={mode} variant={rangeMode === mode ? 'primary' : 'ghost'} onClick={() => setRangeMode(mode)}>
                {t(`classMode.rangeMode.${mode}`)}
              </Button>
            ))}
          </div>
          {rangeMode === 'AYAH' ? (
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
              </Field>
            </div>
          ) : null}
          {rangeMode === 'PAGE' ? (
            <div className="grid grid-cols-2 gap-2">
              <Field label={t('classMode.fromPage')}>
                <input className={inputClass} value={pages.pageFrom} onChange={(e) => setPages({ ...pages, pageFrom: Number(e.target.value) || 1 })} />
              </Field>
              <Field label={t('classMode.toPage')}>
                <input className={inputClass} value={pages.pageTo} onChange={(e) => setPages({ ...pages, pageTo: Number(e.target.value) || 1 })} />
              </Field>
            </div>
          ) : null}
          {rangeMode === 'SURAH_PAGE' ? (
            <div className="grid grid-cols-2 gap-2">
              <Field label={t('classMode.fromSurah')}>
                <select className={inputClass} value={surahPages.surah} onChange={(e) => setSurahPages({ ...surahPages, surah: Number(e.target.value) })}>
                  {surahOptions}
                </select>
              </Field>
              <span />
              <Field label={t('classMode.fromPage')}>
                <input className={inputClass} value={surahPages.pageFrom} onChange={(e) => setSurahPages({ ...surahPages, pageFrom: num(e.target.value, 604) })} />
              </Field>
              <Field label={t('classMode.toPage')}>
                <input className={inputClass} value={surahPages.pageTo} onChange={(e) => setSurahPages({ ...surahPages, pageTo: num(e.target.value, 604) })} />
              </Field>
            </div>
          ) : null}
          <Button disabled={save.isPending} onClick={() => void save.mutate()}>{t('classMode.save')}</Button>
        </div>
      )}
    </Card>
  );
}

function AwqafExamForm({ memberId }: { memberId: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const exams = useQuery({
    queryKey: ['awqaf', memberId],
    queryFn: () => apiFetch(`/api/v1/members/${memberId}/awqaf-exams`),
  });
  const [level, setLevel] = useState<AwqafExamLevel>('AJZA_5');
  const [juz, setJuz] = useState(1);
  const [passed, setPassed] = useState(true);
  const [score, setScore] = useState<number | ''>('');

  const save = useMutation({
    mutationFn: async () => {
      const body: CreateAwqafExamInput = {
        level,
        juzResults: [{ juz, passed, score: score === '' ? undefined : score }],
      };
      await apiFetch(`/api/v1/members/${memberId}/awqaf-exams`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['awqaf', memberId] }),
        queryClient.invalidateQueries({ queryKey: ['progress', memberId] }),
      ]);
    },
  });

  return (
    <Card title={t('hifz.awqafTitle')}>
      <p className="text-sm text-muted">{t('hifz.awqafHint')}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label={t('hifz.awqafLevel')}>
          <select className={inputClass} value={level} onChange={(e) => setLevel(e.target.value as AwqafExamLevel)}>
            {AWQAF_LEVELS.map((l) => (
              <option key={l} value={l}>{t(`hifz.level.${l}`)}</option>
            ))}
          </select>
        </Field>
        <Field label={t('classMode.juz')}>
          <input className={inputClass} type="number" min={1} max={30} value={juz} onChange={(e) => setJuz(Number(e.target.value))} />
        </Field>
        <Field label={t('hifz.passed')}>
          <select className={inputClass} value={passed ? 'yes' : 'no'} onChange={(e) => setPassed(e.target.value === 'yes')}>
            <option value="yes">{t('hifz.yes')}</option>
            <option value="no">{t('hifz.no')}</option>
          </select>
        </Field>
        <Field label={t('classMode.score')}>
          <input className={inputClass} value={score} onChange={(e) => setScore(e.target.value === '' ? '' : Number(e.target.value))} />
        </Field>
      </div>
      <Button className="mt-2" disabled={save.isPending} onClick={() => void save.mutate()}>{t('hifz.recordAwqaf')}</Button>
      {Array.isArray(exams.data) && exams.data.length > 0 ? (
        <ul className="mt-3 grid gap-1 text-sm">
          {(exams.data as { id: string; level: string; attemptNo: number }[]).slice(0, 5).map((e) => (
            <li key={e.id}>{t(`hifz.level.${e.level as AwqafExamLevel}`)} · {t('family.attempt', { n: e.attemptNo })}</li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}
