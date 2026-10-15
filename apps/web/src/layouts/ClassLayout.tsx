import { Link, Outlet } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Emblem } from '../components/Emblem';
import { useBackgroundSync } from '../offline/outbox';

/**
 * Class mode lives outside the signed-in shell: it must open with no network (SYNC-14),
 * when `/auth/me` cannot answer. Everything below reads the cached kit.
 */
export function ClassLayout() {
  const { t, i18n } = useTranslation();
  useBackgroundSync();
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 bg-chrome text-chrome-ink">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-2 px-4 py-2">
          <Link to="/" className="flex items-center gap-2">
            <Emblem />
            <span className="font-semibold">{t('classMode.title')}</span>
          </Link>
          <button
            type="button"
            className="min-h-11 rounded-lg px-3 text-sm text-chrome-ink hover:bg-white/10"
            onClick={() => void i18n.changeLanguage(i18n.language === 'ar' ? 'en' : 'ar')}
          >
            {i18n.language === 'ar' ? t('switchToEnglish') : t('switchToArabic')}
          </button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl px-4 py-4">
        <Outlet />
      </main>
    </div>
  );
}
