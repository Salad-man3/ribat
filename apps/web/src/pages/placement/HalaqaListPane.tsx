import { useDroppable } from '@dnd-kit/core';
import { useTranslation } from 'react-i18next';
import { inputClass } from '../../components/ui/form';
import { cn } from '../../lib/utils';
import { PLACEMENT_UNASSIGNED } from './placement-shared';

function HalaqaListRow({
  rowId,
  label,
  count,
  selected,
  onSelect,
}: {
  rowId: string;
  label: string;
  count: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: rowId });
  return (
    <li ref={setNodeRef}>
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-start text-sm',
          selected && 'bg-accent-soft font-semibold text-accent-strong',
          isOver && 'ring-2 ring-accent/50',
          !selected && 'hover:bg-paper',
        )}
      >
        <span dir="auto" className="min-w-0 truncate">
          {label}
        </span>
        <span className="shrink-0 text-xs text-muted tabular-nums">
          {count}
        </span>
      </button>
    </li>
  );
}

export function HalaqaListPane({
  columns,
  unassignedCount,
  selectedId,
  halaqaSearch,
  onHalaqaSearchChange,
  onSelect,
}: {
  columns: { courseId: string; courseName: string; count: number }[];
  unassignedCount: number;
  selectedId: string;
  halaqaSearch: string;
  onHalaqaSearchChange: (v: string) => void;
  onSelect: (id: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <aside className="hidden min-h-0 flex-col md:flex md:w-64 md:shrink-0">
      <input
        type="search"
        className={cn(inputClass, 'mb-2')}
        placeholder={t('placement.searchHalaqat')}
        value={halaqaSearch}
        onChange={(e) => onHalaqaSearchChange(e.target.value)}
      />
      <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-xl border border-line bg-paper/40 p-1">
        {columns.map((col) => (
          <HalaqaListRow
            key={col.courseId}
            rowId={`course:${col.courseId}`}
            label={col.courseName}
            count={col.count}
            selected={selectedId === col.courseId}
            onSelect={() => onSelect(col.courseId)}
          />
        ))}
        <li className="mt-1 border-t border-line pt-1">
          <HalaqaListRow
            rowId={PLACEMENT_UNASSIGNED}
            label={t('placement.unassigned')}
            count={unassignedCount}
            selected={selectedId === PLACEMENT_UNASSIGNED}
            onSelect={() => onSelect(PLACEMENT_UNASSIGNED)}
          />
        </li>
      </ul>
    </aside>
  );
}
