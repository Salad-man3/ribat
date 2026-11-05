import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { inputClass } from './ui/form';
import { normalizeArabic } from '../lib/domain';
import { cn } from '../lib/utils';

export const PLACEMENT_UNASSIGNED = '__unassigned__';

export type HalaqaPickerMode = 'transfer' | 'switch';

type Column = { courseId: string; courseName: string; count: number };

type Props = {
  open: boolean;
  mode: HalaqaPickerMode;
  studentName?: string;
  columns: Column[];
  unassignedCount: number;
  /** Highlight in switch mode; in transfer mode the student's current halaqa (disabled). */
  highlightCourseId: string | null;
  /** Source halaqa when moving an enrolled student (row disabled). */
  fromCourseId?: string | null;
  canRemoveFromHalaqa: boolean;
  onPick: (targetId: string) => void;
  onClose: () => void;
};

export function HalaqaPickerDialog({
  open,
  mode,
  studentName,
  columns,
  unassignedCount,
  highlightCourseId,
  fromCourseId,
  canRemoveFromHalaqa,
  onPick,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const [query, setQuery] = useState('');
  const [focusIndex, setFocusIndex] = useState(0);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open) {
      setQuery('');
      setFocusIndex(0);
      if (!el.open) el.showModal();
      queueMicrotask(() => searchRef.current?.focus());
    } else if (el.open) {
      el.close();
    }
  }, [open]);

  const needle = normalizeArabic(query.trim());
  const filtered = columns.filter(
    (c) => !needle || normalizeArabic(c.courseName).includes(needle),
  );
  const showUnassigned =
    !needle || normalizeArabic(t('placement.unassigned')).includes(needle);

  const selectableIds = [
    ...filtered.map((c) => c.courseId),
    ...(showUnassigned && mode === 'switch' ? [PLACEMENT_UNASSIGNED] : []),
    ...(showUnassigned && mode === 'transfer' && canRemoveFromHalaqa
      ? [PLACEMENT_UNASSIGNED]
      : []),
  ];

  const pick = (targetId: string) => {
    onPick(targetId);
    onClose();
  };

  const onDialogClose = () => {
    if (open) onClose();
  };

  const onListKeyDown = (e: React.KeyboardEvent) => {
    if (!selectableIds.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusIndex((i) => Math.min(i + 1, selectableIds.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const id = selectableIds[focusIndex];
      if (id) pick(id);
    }
  };

  const title =
    mode === 'switch'
      ? t('placement.chooseHalaqa')
      : t('placement.transferStudent', { name: studentName ?? '' });

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onDialogClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className={cn(
        'fixed inset-x-0 bottom-0 top-auto m-0 max-h-[85dvh] w-full max-w-none border border-line bg-surface p-0 text-ink shadow-xl',
        'rounded-t-2xl md:inset-auto md:bottom-auto md:top-auto md:m-auto md:max-h-[min(60dvh,32rem)] md:w-[28rem] md:rounded-2xl',
      )}
    >
      <div className="flex max-h-[inherit] flex-col p-4">
        <header className="mb-3 flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-base font-semibold">
            {title}
          </h2>
          <button
            type="button"
            className="min-h-10 min-w-10 rounded-lg text-muted hover:bg-paper"
            aria-label={t('classMode.cancel')}
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <input
          ref={searchRef}
          type="search"
          className={inputClass}
          placeholder={t('placement.searchHalaqat')}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setFocusIndex(0);
          }}
          onKeyDown={onListKeyDown}
        />
        <ul
          role="listbox"
          className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain"
          onKeyDown={onListKeyDown}
        >
          {filtered.map((col) => {
            const disabled =
              mode === 'transfer' && fromCourseId === col.courseId;
            const isCurrent =
              highlightCourseId === col.courseId ||
              fromCourseId === col.courseId;
            const rowFocus = selectableIds[focusIndex] === col.courseId;
            return (
              <li key={col.courseId}>
                <button
                  type="button"
                  role="option"
                  disabled={disabled}
                  aria-selected={rowFocus}
                  tabIndex={rowFocus ? 0 : -1}
                  className={cn(
                    'flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-start text-sm',
                    disabled
                      ? 'cursor-not-allowed opacity-50'
                      : 'hover:bg-paper',
                    rowFocus && 'bg-accent-soft ring-1 ring-accent/40',
                    mode === 'switch' &&
                      highlightCourseId === col.courseId &&
                      'font-semibold text-accent',
                  )}
                  onClick={() => !disabled && pick(col.courseId)}
                >
                  <span dir="auto">{col.courseName}</span>
                  <span className="shrink-0 text-xs text-muted tabular-nums">
                    {col.count}
                    {isCurrent && mode === 'transfer' ? (
                      <span className="ms-1">({t('placement.current')})</span>
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })}
          {mode === 'switch' && showUnassigned ? (
            <li className="mt-1 border-t border-line pt-1">
              <button
                type="button"
                role="option"
                aria-selected={
                  selectableIds[focusIndex] === PLACEMENT_UNASSIGNED
                }
                tabIndex={
                  selectableIds[focusIndex] === PLACEMENT_UNASSIGNED ? 0 : -1
                }
                className={cn(
                  'flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-start text-sm hover:bg-paper',
                  highlightCourseId === PLACEMENT_UNASSIGNED &&
                    'font-semibold text-accent',
                  selectableIds[focusIndex] === PLACEMENT_UNASSIGNED &&
                    'bg-accent-soft ring-1 ring-accent/40',
                )}
                onClick={() => pick(PLACEMENT_UNASSIGNED)}
              >
                <span>{t('placement.unassigned')}</span>
                <span className="text-xs text-muted tabular-nums">
                  {unassignedCount}
                </span>
              </button>
            </li>
          ) : null}
          {mode === 'transfer' && canRemoveFromHalaqa && showUnassigned ? (
            <li className="mt-2 border-t border-line pt-2">
              <button
                type="button"
                role="option"
                className={cn(
                  'w-full rounded-lg px-3 py-2.5 text-start text-sm font-medium text-danger hover:bg-danger-soft',
                  selectableIds[focusIndex] === PLACEMENT_UNASSIGNED &&
                    'ring-1 ring-danger/40',
                )}
                onClick={() => pick(PLACEMENT_UNASSIGNED)}
              >
                {t('placement.removeFromHalaqa')}
              </button>
            </li>
          ) : null}
          {filtered.length === 0 && !showUnassigned ? (
            <li className="px-3 py-4 text-center text-sm text-muted">
              {t('members.empty')}
            </li>
          ) : null}
        </ul>
      </div>
    </dialog>
  );
}
