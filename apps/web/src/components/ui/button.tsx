import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'danger';
};

export function Button({
  className,
  variant = 'primary',
  type = 'button',
  ...props
}: Props) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-50',
        variant === 'primary' && 'bg-accent text-white hover:bg-accent-strong',
        variant === 'ghost' &&
          'border border-line bg-surface text-ink hover:bg-paper',
        variant === 'danger' &&
          'border border-danger/30 bg-danger-soft text-danger hover:bg-danger hover:text-white',
        className,
      )}
      {...props}
    />
  );
}
