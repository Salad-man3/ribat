import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost';
};

export function Button({ className, variant = 'primary', ...props }: Props) {
  return (
    <button
      className={cn(
        'inline-flex min-h-11 items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition',
        variant === 'primary' && 'bg-slate-900 text-white hover:bg-slate-800',
        variant === 'ghost' && 'border border-slate-300 bg-white hover:bg-slate-50',
        className,
      )}
      {...props}
    />
  );
}
