import { useTranslation } from 'react-i18next';
import type { MembershipRole } from '@ribat/shared';
import { Button } from '../components/ui/button';
import { ThemePicker } from '../components/ThemePicker';
import { cn } from '../lib/utils';

const rowClass =
  'flex min-h-11 w-full items-center rounded-lg px-3 text-start text-sm font-medium text-chrome-ink hover:bg-white/10';

type Props = {
  variant: 'sidebar' | 'drawer';
  phone?: string;
  role?: MembershipRole;
  activeView: 'ADMIN' | 'MEMBER' | null;
  onToggleView: () => void;
  togglePending: boolean;
  onSignOut: () => void;
  onLanguage: () => void;
};

export function ShellAccount({
  variant,
  phone,
  role,
  activeView,
  onToggleView,
  togglePending,
  onSignOut,
  onLanguage,
}: Props) {
  const { t, i18n } = useTranslation();

  const items = (
    <>
      {activeView ? (
        <Button
          type="button"
          variant="chrome"
          className={cn(rowClass, 'justify-start')}
          onClick={onToggleView}
          disabled={togglePending}
        >
          {activeView === 'ADMIN'
            ? t('shell.switchToMember')
            : t('shell.switchToAdmin')}
        </Button>
      ) : null}
      <Button
        type="button"
        variant="chrome"
        className={cn(rowClass, 'justify-start')}
        onClick={onLanguage}
      >
        {i18n.language === 'ar' ? t('switchToEnglish') : t('switchToArabic')}
      </Button>
      <ThemePicker
        variant="chrome"
        className={cn(rowClass, 'justify-start border-0')}
      />
      <Button
        type="button"
        variant="chrome"
        className={cn(rowClass, 'justify-start text-chrome-muted hover:text-chrome-ink')}
        onClick={onSignOut}
      >
        {t('shell.signOut')}
      </Button>
    </>
  );

  if (variant === 'drawer') {
    return (
      <div className="grid gap-0.5 border-t border-white/20 pt-4">
        {phone && role ? (
          <p className="px-3 pb-2 text-xs text-chrome-muted">
            {phone} · {t(`roles.${role}`)}
          </p>
        ) : null}
        {items}
      </div>
    );
  }

  return (
    <details className="group border-t border-white/20 pt-3">
      <summary
        className={cn(
          rowClass,
          'cursor-pointer list-none [&::-webkit-details-marker]:hidden',
        )}
      >
        <span className="min-w-0 flex-1 truncate">
          {phone ?? t('shell.accountMenu')}
          {role ? (
            <span className="mt-0.5 block truncate text-xs font-normal text-chrome-muted">
              {t(`roles.${role}`)}
            </span>
          ) : null}
        </span>
        <span className="text-xs text-chrome-muted" aria-hidden>
          ▾
        </span>
      </summary>
      <div className="mt-1 grid gap-0.5">{items}</div>
    </details>
  );
}
