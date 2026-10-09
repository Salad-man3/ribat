import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../../api/api-fetch';
import { cn } from '../../lib/utils';

export const inputClass =
  'min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink placeholder:text-muted/70 focus:border-accent focus:outline-none';

export function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label
      className={cn('grid gap-1.5 text-sm font-medium text-ink', className)}
    >
      {label}
      {children}
    </label>
  );
}

export function Card({
  title,
  actions,
  children,
  className,
}: {
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'rounded-2xl border border-line bg-surface p-4 sm:p-5',
        className,
      )}
    >
      {title || actions ? (
        <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
          {title ? (
            <h2 className="text-base font-semibold">{title}</h2>
          ) : (
            <span />
          )}
          {actions}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle ? (
          <p className="mt-1 text-sm text-muted">{subtitle}</p>
        ) : null}
      </div>
      {actions}
    </header>
  );
}

/** Translated error code plus the API's field details, if any. */
export function ErrorText({ error }: { error: unknown }) {
  const { t } = useTranslation();
  if (!error) return null;
  const body = error instanceof ApiError ? error.body.error : null;
  const code = body?.code ?? 'INTERNAL_ERROR';
  const details = body?.details ? Object.entries(body.details) : [];
  return (
    <div
      role="alert"
      className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger"
    >
      <p>{t(`errors.${code}`)}</p>
      {details.length ? (
        <ul className="mt-1 list-disc ps-5 text-xs">
          {details.map(([key, value]) => (
            <li key={key}>
              {key}: {Array.isArray(value) ? value.join(', ') : String(value)}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
      {children}
    </p>
  );
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'accent' | 'danger';
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        tone === 'neutral' && 'bg-paper text-muted',
        tone === 'accent' && 'bg-accent-soft text-accent',
        tone === 'danger' && 'bg-danger-soft text-danger',
      )}
    >
      {children}
    </span>
  );
}
