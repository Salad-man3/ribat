import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import type {
  EnrollmentWarning,
  MoveEnrollmentResult,
  PlacementBoard,
} from '@ribat/shared';
import { apiFetch } from '../api/api-fetch';
import {
  HalaqaPickerDialog,
  PLACEMENT_UNASSIGNED,
} from '../components/HalaqaPickerDialog';
import { Button } from '../components/ui/button';
import { BackLink, Card, ErrorText, inputClass } from '../components/ui/form';
import { normalizeArabic } from '../lib/domain';
import { cn } from '../lib/utils';
import { HalaqaListPane } from './placement/HalaqaListPane';
import {
  type DragPayload,
  type UndoAction,
} from './placement/placement-shared';
import { StudentRow } from './placement/StudentRow';

function useDesktopDrag() {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const sync = () => setEnabled(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  return enabled;
}

export function StaffPlacementPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const board = useQuery({
    queryKey: ['staff-placement'],
    queryFn: () => apiFetch<PlacementBoard>('/api/v1/staff/placement'),
  });
  const [globalSearch, setGlobalSearch] = useState('');
  const [rosterFilter, setRosterFilter] = useState('');
  const [halaqaSearch, setHalaqaSearch] = useState('');
  const [activeDrag, setActiveDrag] = useState<DragPayload | null>(null);
  const [picker, setPicker] = useState<
    null | { mode: 'transfer'; payload: DragPayload } | { mode: 'switch' }
  >(null);
  const [pendingConfirm, setPendingConfirm] = useState<{
    warnings: EnrollmentWarning[];
    run: () => void;
    name: string;
  } | null>(null);
  const [undo, setUndo] = useState<UndoAction | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const dragEnabled = useDesktopDrag();

  const data = board.data;
  const selectedId =
    searchParams.get('h') ?? data?.columns[0]?.courseId ?? PLACEMENT_UNASSIGNED;

  useEffect(() => {
    if (!data?.columns.length) return;
    const h = searchParams.get('h');
    const valid =
      h === PLACEMENT_UNASSIGNED || data.columns.some((c) => c.courseId === h);
    if (!h || !valid) {
      setSearchParams(
        { h: data.columns[0]?.courseId ?? PLACEMENT_UNASSIGNED },
        { replace: true },
      );
    }
  }, [data, searchParams, setSearchParams]);

  const setSelectedHalaqa = (id: string) => {
    setSearchParams({ h: id }, { replace: true });
    setGlobalSearch('');
  };

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ['staff-placement'] });

  const moveMut = useMutation({
    mutationFn: (input: {
      fromCourseId: string;
      enrollmentId: string;
      toCourseId: string;
    }) =>
      apiFetch<MoveEnrollmentResult>(
        `/api/v1/courses/${input.fromCourseId}/enrollments/${input.enrollmentId}/move`,
        {
          method: 'POST',
          body: JSON.stringify({ toCourseId: input.toCourseId }),
        },
      ),
    onSuccess: async (result, vars) => {
      await refresh();
      setUndo({
        type: 'move',
        fromCourseId: vars.toCourseId,
        toCourseId: vars.fromCourseId,
        enrollmentId: result.toEnrollment.id,
        memberId: result.toEnrollment.memberId,
        memberName: result.toEnrollment.memberName,
      });
      setFlash(t('placement.moved'));
      if (result.warnings.length) {
        setPendingConfirm({
          warnings: result.warnings,
          name: result.toEnrollment.memberName,
          run: () => setPendingConfirm(null),
        });
      }
      setTimeout(() => setFlash(null), 4000);
    },
  });

  const withdrawMut = useMutation({
    mutationFn: (input: { courseId: string; enrollmentId: string }) =>
      apiFetch(
        `/api/v1/courses/${input.courseId}/enrollments/${input.enrollmentId}`,
        {
          method: 'DELETE',
        },
      ),
    onSuccess: async () => {
      await refresh();
      setFlash(t('placement.withdrawn'));
      setTimeout(() => setFlash(null), 4000);
    },
  });

  const enrollMut = useMutation({
    mutationFn: (input: { courseId: string; memberId: string }) =>
      apiFetch(`/api/v1/courses/${input.courseId}/enrollments`, {
        method: 'POST',
        body: JSON.stringify({ memberId: input.memberId }),
      }),
    onSuccess: async () => {
      await refresh();
      setFlash(t('placement.moved'));
      setTimeout(() => setFlash(null), 4000);
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: dragEnabled ? 8 : 99999 },
    }),
  );

  const globalNeedle = normalizeArabic(globalSearch.trim());
  const rosterNeedle = normalizeArabic(rosterFilter.trim());
  const halaqaNeedle = normalizeArabic(halaqaSearch.trim());

  const columnsWithCounts = useMemo(
    () =>
      (data?.columns ?? []).map((c) => ({
        courseId: c.courseId,
        courseName: c.courseName,
        count: c.students.length,
      })),
    [data?.columns],
  );

  const filteredSidebarColumns = columnsWithCounts.filter(
    (c) =>
      !halaqaNeedle || normalizeArabic(c.courseName).includes(halaqaNeedle),
  );

  const flatStudents = useMemo(() => {
    if (!data) return [];
    const rows: { payload: DragPayload; halaqaName: string }[] = [];
    for (const col of data.columns) {
      for (const s of col.students) {
        rows.push({
          halaqaName: col.courseName,
          payload: {
            kind: 'enrolled',
            enrollmentId: s.enrollmentId,
            memberId: s.memberId,
            memberName: s.memberName,
            fromCourseId: col.courseId,
          },
        });
      }
    }
    for (const s of data.unassigned) {
      rows.push({
        halaqaName: t('placement.unassigned'),
        payload: {
          kind: 'unassigned',
          memberId: s.memberId,
          memberName: s.memberName,
        },
      });
    }
    return rows;
  }, [data, t]);

  const globalMatches = globalNeedle
    ? flatStudents.filter((row) =>
        normalizeArabic(row.payload.memberName).includes(globalNeedle),
      )
    : [];

  const selectedColumn = data?.columns.find((c) => c.courseId === selectedId);
  const isUnassignedView = selectedId === PLACEMENT_UNASSIGNED;

  const rosterPayloads: DragPayload[] = useMemo(() => {
    if (!data) return [];
    if (isUnassignedView) {
      return data.unassigned.map((s) => ({
        kind: 'unassigned' as const,
        memberId: s.memberId,
        memberName: s.memberName,
      }));
    }
    return (selectedColumn?.students ?? []).map((s) => ({
      kind: 'enrolled' as const,
      enrollmentId: s.enrollmentId,
      memberId: s.memberId,
      memberName: s.memberName,
      fromCourseId: selectedId,
    }));
  }, [data, isUnassignedView, selectedColumn, selectedId]);

  const filteredRoster = rosterPayloads.filter(
    (p) =>
      !rosterNeedle || normalizeArabic(p.memberName).includes(rosterNeedle),
  );

  const rosterTitle = isUnassignedView
    ? t('placement.unassigned')
    : (selectedColumn?.courseName ?? '…');
  const rosterCount = isUnassignedView
    ? (data?.unassigned.length ?? 0)
    : (selectedColumn?.students.length ?? 0);

  const applyTarget = (payload: DragPayload, targetId: string) => {
    if (targetId === PLACEMENT_UNASSIGNED) {
      if (payload.kind !== 'enrolled') return;
      setUndo({
        type: 'withdraw',
        fromCourseId: payload.fromCourseId,
        enrollmentId: payload.enrollmentId,
        memberId: payload.memberId,
        memberName: payload.memberName,
      });
      withdrawMut.mutate({
        courseId: payload.fromCourseId,
        enrollmentId: payload.enrollmentId,
      });
      return;
    }
    if (payload.kind === 'unassigned') {
      setUndo({
        type: 'enroll',
        toCourseId: targetId,
        memberId: payload.memberId,
        memberName: payload.memberName,
      });
      enrollMut.mutate({ courseId: targetId, memberId: payload.memberId });
      return;
    }
    if (payload.fromCourseId === targetId) return;
    setUndo({
      type: 'move',
      fromCourseId: payload.fromCourseId,
      toCourseId: targetId,
      enrollmentId: payload.enrollmentId,
      memberId: payload.memberId,
      memberName: payload.memberName,
    });
    moveMut.mutate({
      fromCourseId: payload.fromCourseId,
      enrollmentId: payload.enrollmentId,
      toCourseId: targetId,
    });
  };

  const onDragEnd = (event: DragEndEvent) => {
    setActiveDrag(null);
    if (!dragEnabled) return;
    const payload = event.active.data.current as DragPayload | undefined;
    if (!payload || !event.over) return;
    const overId = String(event.over.id);
    if (overId.startsWith('course:') || overId === PLACEMENT_UNASSIGNED) {
      const target =
        overId === PLACEMENT_UNASSIGNED
          ? PLACEMENT_UNASSIGNED
          : overId.replace(/^course:/, '');
      applyTarget(payload, target);
    }
  };

  const runUndo = async () => {
    if (!undo) return;
    const last = undo;
    setUndo(null);
    if (last.type === 'move') {
      await refresh();
      const fresh = queryClient.getQueryData<PlacementBoard>([
        'staff-placement',
      ]);
      const list = fresh?.columns.find(
        (c) => c.courseId === last.fromCourseId,
      )?.students;
      const row = list?.find((s) => s.memberId === last.memberId);
      const enrollmentId = row?.enrollmentId ?? last.enrollmentId;
      await moveMut.mutateAsync({
        fromCourseId: last.fromCourseId,
        enrollmentId,
        toCourseId: last.toCourseId,
      });
    } else if (last.type === 'withdraw') {
      await enrollMut.mutateAsync({
        courseId: last.fromCourseId,
        memberId: last.memberId,
      });
    } else if (last.type === 'enroll') {
      const col = board.data?.columns.find(
        (c) => c.courseId === last.toCourseId,
      );
      const row = col?.students.find((s) => s.memberId === last.memberId);
      if (row) {
        await withdrawMut.mutateAsync({
          courseId: last.toCourseId,
          enrollmentId: row.enrollmentId,
        });
      }
    }
  };

  const pickerPayload =
    picker?.mode === 'transfer' ? picker.payload : undefined;

  const body = (
    <div className="flex min-h-0 flex-1 flex-col gap-4 md:flex-row">
      <HalaqaListPane
        columns={filteredSidebarColumns}
        unassignedCount={data?.unassigned.length ?? 0}
        selectedId={selectedId}
        halaqaSearch={halaqaSearch}
        onHalaqaSearchChange={setHalaqaSearch}
        onSelect={setSelectedHalaqa}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <button
          type="button"
          className="mb-3 flex w-full items-center justify-between gap-2 rounded-xl border border-line bg-surface px-4 py-3 text-start md:hidden"
          onClick={() => setPicker({ mode: 'switch' })}
        >
          <span>
            <span className="block text-xs text-muted">
              {t('placement.chooseHalaqa')}
            </span>
            <span className="font-semibold">{rosterTitle}</span>
          </span>
          <span className="text-sm text-muted tabular-nums">{rosterCount}</span>
        </button>
        {!globalNeedle ? (
          <>
            <header className="mb-2 hidden md:block">
              <h2 className="text-lg font-semibold">{rosterTitle}</h2>
              <p className="text-sm text-muted tabular-nums">{rosterCount}</p>
            </header>
            <input
              type="search"
              className={cn(inputClass, 'mb-3')}
              placeholder={t('placement.search')}
              value={rosterFilter}
              onChange={(e) => setRosterFilter(e.target.value)}
            />
            <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-xl border border-line bg-paper/30 p-2">
              {filteredRoster.length === 0 ? (
                <li className="px-3 py-6 text-center text-sm text-muted">
                  {t('students.empty')}
                </li>
              ) : (
                filteredRoster.map((payload) => (
                  <StudentRow
                    key={
                      payload.kind === 'enrolled'
                        ? payload.enrollmentId
                        : payload.memberId
                    }
                    payload={payload}
                    dragEnabled={dragEnabled}
                    onTransfer={() => setPicker({ mode: 'transfer', payload })}
                  />
                ))
              )}
            </ul>
          </>
        ) : (
          <>
            <p className="mb-2 text-sm text-muted">
              {t('placement.searchAllStudents')}
            </p>
            <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-xl border border-line bg-paper/30 p-2">
              {globalMatches.length === 0 ? (
                <li className="px-3 py-6 text-center text-sm text-muted">
                  {t('members.empty')}
                </li>
              ) : (
                globalMatches.map((row) => (
                  <StudentRow
                    key={
                      row.payload.kind === 'enrolled'
                        ? row.payload.enrollmentId
                        : row.payload.memberId
                    }
                    payload={row.payload}
                    dragEnabled={false}
                    halaqaLabel={t('placement.inHalaqa', {
                      name: row.halaqaName,
                    })}
                    onTransfer={() =>
                      setPicker({ mode: 'transfer', payload: row.payload })
                    }
                  />
                ))
              )}
            </ul>
          </>
        )}
      </div>
    </div>
  );

  return (
    <section className="grid gap-6">
      <BackLink to="/staff">{t('nav.staff')}</BackLink>
      <header>
        <h1 className="text-2xl font-bold">{t('placement.title')}</h1>
        <p className="mt-1 text-sm text-muted">{t('placement.hint')}</p>
      </header>
      <input
        type="search"
        className={inputClass}
        placeholder={t('placement.searchAllStudents')}
        value={globalSearch}
        onChange={(e) => setGlobalSearch(e.target.value)}
      />
      {flash ? (
        <p role="status" className="text-sm font-medium text-accent">
          {flash}{' '}
          {undo ? (
            <button
              type="button"
              className="underline"
              onClick={() => void runUndo()}
            >
              {t('placement.undo')}
            </button>
          ) : null}
        </p>
      ) : null}
      {board.isError ? <ErrorText error={board.error} /> : null}
      {!data ? (
        <p className="text-sm text-muted">…</p>
      ) : dragEnabled ? (
        <DndContext
          sensors={sensors}
          onDragStart={(e: DragStartEvent) => {
            setActiveDrag((e.active.data.current as DragPayload) ?? null);
          }}
          onDragEnd={onDragEnd}
        >
          {body}
          <DragOverlay>
            {activeDrag ? (
              <div className="rounded-lg border border-accent bg-surface px-3 py-2 text-sm font-medium shadow-lg">
                {activeDrag.memberName}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        body
      )}
      <HalaqaPickerDialog
        open={picker !== null}
        mode={picker?.mode ?? 'switch'}
        studentName={
          pickerPayload?.kind === 'enrolled' ||
          pickerPayload?.kind === 'unassigned'
            ? pickerPayload.memberName
            : undefined
        }
        columns={columnsWithCounts}
        unassignedCount={data?.unassigned.length ?? 0}
        highlightCourseId={selectedId}
        fromCourseId={
          pickerPayload?.kind === 'enrolled' ? pickerPayload.fromCourseId : null
        }
        canRemoveFromHalaqa={pickerPayload?.kind === 'enrolled'}
        onPick={(targetId) => {
          if (picker?.mode === 'switch') {
            setSelectedHalaqa(targetId);
            setPicker(null);
            return;
          }
          if (picker?.mode === 'transfer') {
            applyTarget(picker.payload, targetId);
            setPicker(null);
          }
        }}
        onClose={() => setPicker(null)}
      />
      {pendingConfirm ? (
        <Card
          title={t('placement.confirmWarnings', { name: pendingConfirm.name })}
        >
          <ul className="mb-3 list-disc ps-5 text-sm text-danger">
            {pendingConfirm.warnings.map((w) => (
              <li key={w.code + w.message}>
                {t(`students.warning.${w.code}`)} — {w.message}
              </li>
            ))}
          </ul>
          <Button type="button" onClick={() => pendingConfirm.run()}>
            {t('classMode.save')}
          </Button>
        </Card>
      ) : null}
    </section>
  );
}
