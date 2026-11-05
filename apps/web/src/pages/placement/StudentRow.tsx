import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/ui/button';
import { cn } from '../../lib/utils';
import { dragId, type DragPayload } from './placement-shared';

export function StudentRow({
  payload,
  dragEnabled,
  halaqaLabel,
  onTransfer,
}: {
  payload: DragPayload;
  dragEnabled: boolean;
  halaqaLabel?: string;
  onTransfer: () => void;
}) {
  const { t } = useTranslation();
  const id = dragId(payload);
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id,
      data: payload,
      disabled: !dragEnabled,
    });
  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center justify-between gap-2 rounded-xl border border-line bg-surface px-3 py-2',
        isDragging && 'opacity-40',
      )}
    >
      <div className="min-w-0 flex-1">
        {dragEnabled ? (
          <button
            type="button"
            className="block w-full touch-none text-start font-medium md:cursor-grab md:active:cursor-grabbing"
            dir="auto"
            {...listeners}
            {...attributes}
          >
            {payload.memberName}
          </button>
        ) : (
          <span dir="auto" className="block font-medium">
            {payload.memberName}
          </span>
        )}
        {halaqaLabel ? (
          <span className="mt-0.5 block text-xs text-muted">{halaqaLabel}</span>
        ) : null}
      </div>
      <Button
        type="button"
        variant="ghost"
        className="min-h-10 shrink-0 px-3 text-xs font-semibold text-accent"
        onClick={onTransfer}
      >
        {t('placement.transfer')}
      </Button>
    </li>
  );
}
