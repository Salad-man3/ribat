import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { NavButton, ScrollButton } from './nav-button';
import { ApiError } from '../../api/api-fetch';
import { cn } from '../../lib/utils';

export const inputClass =
  'min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-base text-ink placeholder:text-muted/70 focus:border-accent focus:outline-none md:text-sm';

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
  /** Phone top bar already shows the section name — hide the duplicate title. */
  chrome,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  chrome?: boolean;
}) {
  return (
    <header className="grid gap-3 md:flex md:flex-wrap md:items-end md:justify-between">
      <div className={cn(chrome && 'max-md:sr-only')}>
        <h1 className="text-2xl font-bold md:text-3xl">{title}</h1>
        <TitleRule />
        {subtitle ? (
          <p className="mt-1 text-sm text-muted">{subtitle}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:flex-wrap md:items-center md:justify-end">
          {actions}
        </div>
      ) : null}
    </header>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  'aria-label': ariaLabel,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  'aria-label'?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="-mx-1 overflow-x-auto px-1 pb-0.5"
    >
      <div className="inline-flex min-w-min shrink-0 rounded-lg border border-line p-0.5">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={value === opt.value}
            onClick={() => onChange(opt.value)}
            className={cn(
              'min-h-11 shrink-0 rounded-md px-4 text-sm font-medium whitespace-nowrap',
              value === opt.value
                ? 'bg-accent text-accent-ink'
                : 'text-muted hover:bg-paper hover:text-ink',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function RecordRow({
  to,
  title,
  meta,
  badge,
  trailing,
  className,
}: {
  to: string;
  title: ReactNode;
  meta?: ReactNode;
  badge?: ReactNode;
  trailing?: ReactNode;
  className?: string;
}) {
  return (
    <NavButton
      to={to}
      className={cn(
        'flex min-h-11 items-center gap-3 rounded-lg px-2 py-2 hover:bg-paper',
        className,
      )}
    >
      <span className="min-w-0 flex-1 text-start">
        <span className="block font-medium">{title}</span>
        {meta ? (
          <span className="block truncate text-xs text-muted">{meta}</span>
        ) : null}
      </span>
      {badge}
      {trailing ?? (
        <span className="shrink-0 text-lg text-muted leading-none" aria-hidden>
          ›
        </span>
      )}
    </NavButton>
  );
}

/** Sticky in-page section jumps for long record screens. */
export function SectionNav({
  items,
}: {
  items: { id: string; label: string }[];
}) {
  if (items.length < 2) return null;
  return (
    <nav
      aria-label="Sections"
      className="sticky top-0 z-10 -mx-4 flex gap-1 overflow-x-auto border-b border-line bg-paper/95 px-4 py-2 backdrop-blur-sm md:static md:mx-0 md:border-0 md:bg-transparent md:px-0 md:py-0 md:backdrop-blur-none"
    >
      {items.map((item) => (
        <ScrollButton
          key={item.id}
          targetId={item.id}
          className="shrink-0 rounded-full border border-line bg-surface px-3 py-2 text-sm font-medium text-muted hover:border-accent hover:text-accent"
        >
          {item.label}
        </ScrollButton>
      ))}
    </nav>
  );
}

/** Rule, khatam, rule: the divider under every page title. */
export function TitleRule() {
  return (
    <svg
      viewBox="0 0 120 14"
      aria-hidden="true"
      className="mt-2 h-3.5 w-30 text-gold"
    >
      <path d="M0 7H46M74 7H120" stroke="currentColor" strokeWidth="1" />
      <g fill="none" stroke="currentColor" strokeWidth="1.2">
        <rect x="55" y="2" width="10" height="10" />
        <rect x="55" y="2" width="10" height="10" transform="rotate(45 60 7)" />
      </g>
      <circle cx="60" cy="7" r="1.6" fill="currentColor" />
    </svg>
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
      <p>
        {t(`errors.${code}`, {
          defaultValue: body?.message ?? t('errors.INTERNAL_ERROR'),
        })}
      </p>
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
    <p className="rounded-xl border border-dashed border-line bg-surface px-4 py-8 text-center text-sm text-muted">
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
