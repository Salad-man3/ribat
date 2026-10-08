import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MemberResponse } from '@ribat/shared';
import { apiFetch } from '../api/api-fetch';
import { MemberCard } from '../components/MemberCard';
import { Button } from '../components/ui/button';

export function StaffMembersPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [firstName, setFirstName] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [familyName, setFamilyName] = useState('');
  const members = useQuery({
    queryKey: ['members'],
    queryFn: () => apiFetch<MemberResponse[]>('/api/v1/members'),
  });

  const createMember = useMutation({
    mutationFn: () =>
      apiFetch<MemberResponse>('/api/v1/members', {
        method: 'POST',
        body: JSON.stringify({
          firstName,
          fatherName,
          familyName,
          birthDate: '2015-01-01',
          joinedAt: new Date().toISOString().slice(0, 10),
        }),
      }),
    onSuccess: async () => {
      setFirstName('');
      setFatherName('');
      setFamilyName('');
      await queryClient.invalidateQueries({ queryKey: ['members'] });
    },
  });

  return (
    <section className="grid gap-4">
      <h1 className="text-2xl font-semibold">{t('members.title')}</h1>
      <form
        className="grid gap-2 rounded-xl border bg-white p-4"
        onSubmit={(event) => {
          event.preventDefault();
          createMember.mutate();
        }}
      >
        <p className="text-sm font-medium">{t('members.createTitle')}</p>
        <input className="min-h-11 rounded-lg border px-3" placeholder={t('members.firstName')} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        <input className="min-h-11 rounded-lg border px-3" placeholder={t('members.fatherName')} value={fatherName} onChange={(e) => setFatherName(e.target.value)} />
        <input className="min-h-11 rounded-lg border px-3" placeholder={t('members.familyName')} value={familyName} onChange={(e) => setFamilyName(e.target.value)} />
        <Button type="submit" disabled={createMember.isPending}>
          {t('members.create')}
        </Button>
      </form>
      <div className="grid gap-3">
        {(members.data ?? []).map((member) => (
          <MemberCard key={member.id} member={member} />
        ))}
      </div>
    </section>
  );
}
