import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate, useNavigate } from 'react-router';
import { apiFetch } from '../api/api-fetch';
import { login } from '../api/auth';
import { Button } from '../components/ui/button';
import { ErrorText, Field, inputClass } from '../components/ui/form';
import { useMe } from '../hooks/use-me';
import { AuthLayout } from '../layouts/AuthLayout';

/** Fictional accounts from apps/api/prisma/seed.ts. Shown only in demo builds. */
const DEMO_PASSWORD = 'demo-ribat-2026';
const DEMO_LOGINS = [
  { role: 'SHEIKH', phone: '+963999001001' },
  { role: 'ORG_ADMIN', phone: '+963999001010' },
  { role: 'MEMBER', phone: '+963999001030' },
  { role: 'GUARDIAN', phone: '+963999001050' },
  { role: 'otherOrg', phone: '+963999002001' },
] as const;

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const me = useMe();
  const setup = useQuery({
    queryKey: ['setup-status'],
    queryFn: () => apiFetch<{ setupRequired: boolean }>('/api/v1/setup/status'),
  });
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  const signIn = useMutation({
    mutationFn: (input: { phone: string; password: string }) => login(input),
    onSuccess: (data) => {
      queryClient.setQueryData(['me'], data);
      navigate('/', { replace: true });
    },
  });

  if (setup.data?.setupRequired)
    return <Navigate to="/setup/organization" replace />;
  if (me.data) return <Navigate to="/" replace />;

  return (
    <AuthLayout title={t('auth.loginTitle')}>
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          signIn.mutate({ phone, password });
        }}
      >
        <Field label={t('auth.phone')}>
          <input
            className={inputClass}
            dir="ltr"
            inputMode="tel"
            placeholder="+963…"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            autoComplete="tel"
            required
          />
        </Field>
        <Field label={t('auth.password')}>
          <input
            type="password"
            className={inputClass}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </Field>
        {signIn.isError ? <ErrorText error={signIn.error} /> : null}
        <Button type="submit" disabled={signIn.isPending}>
          {t('auth.signIn')}
        </Button>
        <Link
          className="text-center text-sm text-accent underline underline-offset-4"
          to="/setup/password"
        >
          {t('auth.haveSetupCode')}
        </Link>
      </form>

      {import.meta.env.VITE_DEMO === 'true' ? (
        <div className="mt-6 border-t border-line pt-5">
          <p className="text-sm font-medium">{t('auth.demoTitle')}</p>
          <p className="mt-1 text-xs text-muted">{t('auth.demoHint')}</p>
          <div className="mt-3 grid gap-2">
            {DEMO_LOGINS.map((account) => (
              <Button
                key={account.phone}
                variant="ghost"
                className="justify-between"
                disabled={signIn.isPending}
                onClick={() =>
                  signIn.mutate({
                    phone: account.phone,
                    password: DEMO_PASSWORD,
                  })
                }
              >
                <span>
                  {account.role === 'otherOrg'
                    ? t('auth.demoOtherOrg')
                    : t(`roles.${account.role}`)}
                </span>
                <span dir="ltr" className="font-mono text-xs text-muted">
                  {account.phone}
                </span>
              </Button>
            ))}
          </div>
        </div>
      ) : null}
    </AuthLayout>
  );
}
