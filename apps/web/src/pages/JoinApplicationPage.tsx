import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';
import type {
  CreateJoinApplicationInput,
  GuardianRelation,
  PublicOrganizationJoinInfo,
} from '@ribat/shared';
import { apiFetch } from '../api/api-fetch';
import { Button } from '../components/ui/button';
import { ErrorText, Field, inputClass, PageHeader } from '../components/ui/form';
import { NotFoundPage } from './NotFoundPage';

const RELATIONS: GuardianRelation[] = ['FATHER', 'MOTHER', 'OTHER'];

export function JoinApplicationPage() {
  const { slug = '' } = useParams();
  const { t } = useTranslation();
  const org = useQuery({
    queryKey: ['public-join', slug],
    queryFn: () =>
      apiFetch<PublicOrganizationJoinInfo>(
        `/api/v1/public/organizations/${encodeURIComponent(slug)}/join`,
      ),
    retry: false,
  });

  const [kind, setKind] = useState<'STUDENT' | 'GUARDIAN'>('STUDENT');
  const [phone, setPhone] = useState('');
  const [firstName, setFirstName] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [wardFirst, setWardFirst] = useState('');
  const [wardFather, setWardFather] = useState('');
  const [wardFamily, setWardFamily] = useState('');
  const [wardBirth, setWardBirth] = useState('');
  const [wardRelation, setWardRelation] = useState<GuardianRelation>('FATHER');
  const [submitted, setSubmitted] = useState(false);

  const apply = useMutation({
    mutationFn: (body: CreateJoinApplicationInput) =>
      apiFetch<{ id: string }>(
        `/api/v1/public/organizations/${encodeURIComponent(slug)}/join-applications`,
        { method: 'POST', body: JSON.stringify(body) },
      ),
    onSuccess: () => setSubmitted(true),
  });

  if (org.isError) return <NotFoundPage />;
  if (org.isLoading) return null;

  const mosqueName = org.data?.name ?? '';

  if (submitted) {
    return (
      <section className="mx-auto grid max-w-lg gap-4 px-4 py-10">
        <PageHeader title={t('join.submittedTitle')} subtitle={t('join.submittedHint', { mosque: mosqueName })} />
      </section>
    );
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (kind === 'STUDENT') {
      apply.mutate({
        kind: 'STUDENT',
        phone,
        firstName,
        fatherName,
        familyName,
        birthDate,
      });
    } else {
      apply.mutate({
        kind: 'GUARDIAN',
        phone,
        firstName,
        fatherName,
        familyName,
        wards: [
          {
            firstName: wardFirst,
            fatherName: wardFather,
            familyName: wardFamily,
            birthDate: wardBirth,
            relation: wardRelation,
          },
        ],
      });
    }
  };

  return (
    <section className="mx-auto grid max-w-lg gap-6 px-4 py-10">
      <PageHeader title={t('join.title', { mosque: mosqueName })} subtitle={t('join.subtitle')} />
      <div className="flex gap-2">
        <Button
          type="button"
          variant={kind === 'STUDENT' ? 'primary' : 'ghost'}
          onClick={() => setKind('STUDENT')}
        >
          {t('join.student')}
        </Button>
        <Button
          type="button"
          variant={kind === 'GUARDIAN' ? 'primary' : 'ghost'}
          onClick={() => setKind('GUARDIAN')}
        >
          {t('join.guardian')}
        </Button>
      </div>
      <form className="grid gap-4" onSubmit={submit}>
        <Field label={t('auth.phone')}>
          <input
            dir="ltr"
            className={inputClass}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
        </Field>
        <Field label={t('members.firstName')}>
          <input className={inputClass} value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
        </Field>
        <Field label={t('members.fatherName')}>
          <input className={inputClass} value={fatherName} onChange={(e) => setFatherName(e.target.value)} required />
        </Field>
        <Field label={t('members.familyName')}>
          <input className={inputClass} value={familyName} onChange={(e) => setFamilyName(e.target.value)} required />
        </Field>
        {kind === 'STUDENT' ? (
          <Field label={t('members.birthDate')}>
            <input
              type="date"
              className={inputClass}
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              required
            />
          </Field>
        ) : (
          <div className="grid gap-3 rounded-xl border border-line p-4">
            <p className="text-sm font-medium">{t('join.wardSection')}</p>
            <Field label={t('members.firstName')}>
              <input className={inputClass} value={wardFirst} onChange={(e) => setWardFirst(e.target.value)} required />
            </Field>
            <Field label={t('members.fatherName')}>
              <input className={inputClass} value={wardFather} onChange={(e) => setWardFather(e.target.value)} required />
            </Field>
            <Field label={t('members.familyName')}>
              <input className={inputClass} value={wardFamily} onChange={(e) => setWardFamily(e.target.value)} required />
            </Field>
            <Field label={t('members.birthDate')}>
              <input
                type="date"
                className={inputClass}
                value={wardBirth}
                onChange={(e) => setWardBirth(e.target.value)}
                required
              />
            </Field>
            <Field label={t('join.wardRelation')}>
              <select
                className={inputClass}
                value={wardRelation}
                onChange={(e) => setWardRelation(e.target.value as GuardianRelation)}
              >
                {RELATIONS.map((r) => (
                  <option key={r} value={r}>
                    {t(`guardians.relation.${r}`)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        )}
        {apply.isError ? <ErrorText error={apply.error} /> : null}
        <Button type="submit" disabled={apply.isPending}>
          {t('join.submit')}
        </Button>
      </form>
    </section>
  );
}
