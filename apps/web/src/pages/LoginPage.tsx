import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate, useNavigate } from 'react-router';
import { apiFetch } from '../api/api-fetch';
import { login } from '../api/auth';
import { Button } from '../components/ui/button';
import { useMe } from '../hooks/use-me';

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
    mutationFn: () => login({ phone, password }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['me'] });
      navigate('/', { replace: true });
    },
  });

  if (setup.data?.setupRequired) {
    return <Navigate to="/setup/organization" replace />;
  }
  if (me.data) return <Navigate to="/" replace />;

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-4">
      <h1 className="text-2xl font-semibold">{t('auth.loginTitle')}</h1>
      <label className="grid gap-1 text-sm">
        {t('auth.phone')}
        <input
          className="min-h-11 rounded-lg border border-slate-300 px-3"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          autoComplete="tel"
        />
      </label>
      <label className="grid gap-1 text-sm">
        {t('auth.password')}
        <input
          type="password"
          className="min-h-11 rounded-lg border border-slate-300 px-3"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
        />
      </label>
      {signIn.isError ? (
        <p className="text-sm text-red-700">{t('auth.loginFailed')}</p>
      ) : null}
      <Button type="button" onClick={() => signIn.mutate()} disabled={signIn.isPending}>
        {t('auth.signIn')}
      </Button>
      <Link className="text-sm text-slate-600 underline" to="/setup/password">
        {t('auth.haveSetupCode')}
      </Link>
    </div>
  );
}
