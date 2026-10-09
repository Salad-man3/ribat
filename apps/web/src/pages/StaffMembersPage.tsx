import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import type { CreateMemberInput, MemberResponse } from '@ribat/shared';
import { apiFetch } from '../api/api-fetch';
import { useMembers } from '../api/members';
import { fullName } from '../components/MemberCard';
import { MemberForm } from '../components/MemberForm';
import {
  Badge,
  Card,
  Empty,
  ErrorText,
  inputClass,
  PageHeader,
} from '../components/ui/form';
import { cn } from '../lib/utils';

export function StaffMembersPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'ACTIVE' | 'ARCHIVED'>('ACTIVE');
  const members = useMembers(status, search);

  const createMember = useMutation({
    mutationFn: (input: CreateMemberInput) =>
      apiFetch<MemberResponse>('/api/v1/members', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: async (member) => {
      await queryClient.invalidateQueries({ queryKey: ['members'] });
      navigate(`/staff/members/${member.id}`);
    },
  });

  return (
    <section className="grid gap-6">
      <PageHeader title={t('members.title')} subtitle={t('members.subtitle')} />

      <details className="group rounded-2xl border border-line bg-surface">
        <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-accent">
          + {t('members.createTitle')}
        </summary>
        <div className="border-t border-line p-5">
          <MemberForm
            submitLabel={t('members.create')}
            pending={createMember.isPending}
            onSubmit={createMember.mutate}
          />
          {createMember.isError ? (
            <div className="mt-3">
              <ErrorText error={createMember.error} />
            </div>
          ) : null}
        </div>
      </details>

      <Card>
        <div className="mb-4 flex flex-wrap gap-3">
          <input
            type="search"
            className={cn(inputClass, 'max-w-xs flex-1')}
            placeholder={t('members.search')}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <div className="inline-flex rounded-lg border border-line p-0.5">
            {(['ACTIVE', 'ARCHIVED'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setStatus(value)}
                className={cn(
                  'rounded-md px-3 text-sm',
                  status === value
                    ? 'bg-accent text-white'
                    : 'text-muted hover:text-ink',
                )}
              >
                {t(`members.statusValue.${value}`)}
              </button>
            ))}
          </div>
        </div>
        {members.isError ? <ErrorText error={members.error} /> : null}
        {members.data?.length === 0 ? (
          <Empty>{t('members.empty')}</Empty>
        ) : null}
        <ul className="divide-y divide-line">
          {(members.data ?? []).map((member) => (
            <li key={member.id}>
              <Link
                to={`/staff/members/${member.id}`}
                className="flex items-center justify-between gap-3 rounded-lg px-2 py-3 hover:bg-paper"
              >
                <span>
                  <span className="block font-medium">{fullName(member)}</span>
                  <span className="block text-xs text-muted">
                    {member.birthDate}
                    {member.schoolGrade ? ` · ${member.schoolGrade}` : ''}
                  </span>
                </span>
                {member.phone ? (
                  <span dir="ltr" className="text-xs text-muted">
                    {member.phone}
                  </span>
                ) : (
                  <Badge>{t('members.noPhone')}</Badge>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}
