import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <section className="grid place-items-center gap-3 py-16 text-center">
      <p className="text-5xl font-semibold text-accent">404</p>
      <h1 className="text-xl font-semibold">{t('notFound.title')}</h1>
      <p className="max-w-sm text-sm text-muted">{t('notFound.body')}</p>
      <Link
        to="/"
        className="text-sm font-medium text-accent underline underline-offset-4"
      >
        {t('notFound.home')}
      </Link>
    </section>
  );
}
