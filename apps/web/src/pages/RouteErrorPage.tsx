import { isRouteErrorResponse, Link, useRouteError } from 'react-router';
import { useTranslation } from 'react-i18next';

function errorMessage(error: unknown): string {
  if (isRouteErrorResponse(error)) {
    return `${error.status} ${error.statusText}${error.data ? `: ${String(error.data)}` : ''}`;
  }
  if (error instanceof Error) return error.message;
  return String(error);
}

function errorStack(error: unknown): string | null {
  if (error instanceof Error && error.stack) return error.stack;
  return null;
}

export function RouteErrorPage() {
  const { t } = useTranslation();
  const error = useRouteError();
  const message = errorMessage(error);
  const stack = errorStack(error);
  const showDetails = import.meta.env.DEV;

  return (
    <section className="mx-auto grid max-w-2xl gap-4 px-4 py-16">
      <h1 className="text-xl font-semibold">{t('errors.unexpectedTitle')}</h1>
      <p className="text-sm text-muted">{t('errors.unexpectedBody')}</p>
      {showDetails ? (
        <div className="rounded-2xl border border-line bg-surface p-4">
          <p className="text-xs font-medium text-muted">{t('errors.devDetails')}</p>
          <p className="mt-2 font-mono text-sm break-words">{message}</p>
          {stack ? (
            <pre
              dir="ltr"
              className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words font-mono text-xs text-muted"
            >
              {stack}
            </pre>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink hover:bg-accent-strong"
          onClick={() => window.location.reload()}
        >
          {t('errors.reload')}
        </button>
        <Link
          to="/"
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium text-ink hover:bg-paper"
        >
          {t('notFound.home')}
        </Link>
      </div>
    </section>
  );
}
