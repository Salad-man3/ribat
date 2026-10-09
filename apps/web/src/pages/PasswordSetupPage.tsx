import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate, useNavigate } from 'react-router';
import { redeemSetup } from '../api/auth';
import { Button } from '../components/ui/button';
import { ErrorText, Field, inputClass } from '../components/ui/form';
import { useMe } from '../hooks/use-me';
import { AuthLayout } from '../layouts/AuthLayout';

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
    onSuccess: (data) => {
      queryClient.setQueryData(['me'], data);
      navigate('/', { replace: true });
    },
  });

  if (me.data) return <Navigate to="/" replace />;

  return (
    <AuthLayout title={t('auth.setupTitle')}>
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          submit.mutate();
        }}
      >
        <p className="text-sm text-muted">{t('auth.setupHint')}</p>
        <Field label={t('auth.phone')}>
          <input
            className={inputClass}
            dir="ltr"
            inputMode="tel"
            placeholder="+963…"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
        </Field>
        <Field label={t('auth.setupCode')}>
          <input
            className={`${inputClass} font-mono uppercase tracking-widest`}
            dir="ltr"
            maxLength={8}
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />
        </Field>
        <Field label={t('auth.newPassword')}>
          <input
            type="password"
            className={inputClass}
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>
        {submit.isError ? <ErrorText error={submit.error} /> : null}
        <Button type="submit" disabled={submit.isPending}>
          {t('auth.createPassword')}
        </Button>
        <Link
          className="text-center text-sm text-accent underline underline-offset-4"
          to="/login"
        >
          {t('auth.backToLogin')}
        </Link>
      </form>
    </AuthLayout>
  );
}
