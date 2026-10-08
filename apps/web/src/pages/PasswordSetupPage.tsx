import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate, useNavigate } from 'react-router';
import { redeemSetup } from '../api/auth';
import { Button } from '../components/ui/button';
import { useMe } from '../hooks/use-me';

export function PasswordSetupPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const me = useMe();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');

  const submit = useMutation({
    mutationFn: () => redeemSetup({ phone, code, password }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['me'] });
      navigate('/', { replace: true });
    },
  });

  if (me.data) return <Navigate to="/" replace />;

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-4">
      <h1 className="text-2xl font-semibold">{t('auth.setupTitle')}</h1>
      <label className="grid gap-1 text-sm">
        {t('auth.phone')}
        <input className="min-h-11 rounded-lg border px-3" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </label>
      <label className="grid gap-1 text-sm">
        {t('auth.setupCode')}
        <input className="min-h-11 rounded-lg border px-3" value={code} onChange={(e) => setCode(e.target.value)} />
      </label>
      <label className="grid gap-1 text-sm">
        {t('auth.password')}
        <input
          type="password"
          className="min-h-11 rounded-lg border px-3"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      {submit.isError ? <p className="text-sm text-red-700">{t('auth.setupFailed')}</p> : null}
      <Button type="button" onClick={() => submit.mutate()} disabled={submit.isPending}>
        {t('auth.createPassword')}
      </Button>
      <Link className="text-sm underline" to="/login">
        {t('auth.backToLogin')}
      </Link>
    </div>
  );
}
