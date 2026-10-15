import { useId } from 'react';
import type { KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';
import { THEMES, useTheme } from '../lib/theme';
import { cn } from '../lib/utils';

/** A themed mini card: chrome strip, paper body, gold dot. */
function Preview({ id, className }: { id: string; className?: string }) {
  return (
    <span
      data-theme={id}
      className={cn(
        'block h-10 overflow-hidden border border-line bg-paper',
        className,
      )}
    >
      <span className="flex h-3 items-center justify-end bg-chrome px-1">
        <span className="size-1.5 rounded-full bg-gold" />
      </span>
    </span>
  );
}

export function ThemePicker({ className }: { className?: string }) {
  const { t } = useTranslation();
  const { theme, setTheme, pattern, setPattern } = useTheme();
  const id = useId();

  // Radio-group arrows: move the choice with the keys, wrapping at the ends.
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[
      e.key
    ];
    if (!step) return;
    e.preventDefault();
    const next =
      THEMES[(THEMES.indexOf(theme) + step + THEMES.length) % THEMES.length];
    setTheme(next);
    e.currentTarget.querySelector<HTMLElement>(`[data-id="${next}"]`)?.focus();
  }

  return (
    <>
      <Button
        variant="ghost"
        className={className}
        popoverTarget={id}
        aria-haspopup="dialog"
      >
        {t('theme.button')}
      </Button>
      <div
        id={id}
        popover="auto"
        className="m-auto w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-line bg-surface p-3 text-ink shadow-xl backdrop:bg-black/30"
      >
        <p className="mb-3 text-sm font-semibold">{t('theme.title')}</p>
        <div
          role="radiogroup"
          aria-label={t('theme.title')}
          onKeyDown={onKeyDown}
          className="grid grid-cols-3 gap-2"
        >
          {THEMES.map((th) => (
            <button
              key={th}
              type="button"
              role="radio"
              aria-checked={theme === th}
              data-id={th}
              tabIndex={theme === th ? 0 : -1}
              onClick={() => setTheme(th)}
              className={cn(
                'grid gap-1 rounded-xl p-1 text-xs',
                theme === th && 'ring-2 ring-accent',
              )}
            >
              {th === 'auto' ? (
                <span className="flex">
                  <Preview id="emerald" className="flex-1 rounded-s-lg" />
                  <Preview id="qiyam" className="flex-1 rounded-e-lg" />
                </span>
              ) : (
                <Preview id={th} className="rounded-lg" />
              )}
              {t(`theme.names.${th}`)}
            </button>
          ))}
        </div>
        <label className="mt-3 flex min-h-11 items-center justify-between gap-3 text-sm">
          {t('theme.pattern')}
          <input
            type="checkbox"
            role="switch"
            checked={pattern}
            onChange={(e) => setPattern(e.target.checked)}
            className="size-5 accent-accent"
          />
        </label>
      </div>
    </>
  );
}
