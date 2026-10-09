import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/button';
import { Emblem } from '../components/Emblem';

export function AuthLayout({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const { t, i18n } = useTranslation();
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-chrome px-4 py-10 text-chrome-ink">
      <div className="flex flex-col items-center text-center">
        <Emblem className="mb-3 size-12" />
        <p className="text-3xl font-semibold">{t('appName')}</p>
        <p className="mt-1 text-sm text-chrome-muted">{t('tagline')}</p>
      </div>
      <main className="w-full max-w-md rounded-2xl border-t-4 border-gold bg-surface p-6 text-ink shadow-lg shadow-chrome-deep/40">
        <h1 className="mb-5 text-xl font-semibold">{title}</h1>
        {children}
      </main>
      <Button
        variant="ghost"
        className="border-white/20 bg-transparent text-chrome-ink hover:bg-white/10"
        onClick={() =>
          void i18n.changeLanguage(i18n.language === 'ar' ? 'en' : 'ar')
        }
      >
        {i18n.language === 'ar' ? t('switchToEnglish') : t('switchToArabic')}
      </Button>
    </div>
  );
}
