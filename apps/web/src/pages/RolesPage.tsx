import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import type {
  AssignableRole,
  MembershipResponse,
  MembershipStatus,
  UpdateMembershipInput,
} from '@ribat/shared';
import { apiFetch } from '../api/api-fetch';
import { useMembers } from '../api/members';
import { fullName } from '../components/MemberCard';
import {
  Badge,
  Card,
  ErrorText,
  Field,
  inputClass,
  PageHeader,
} from '../components/ui/form';

const ASSIGNABLE: AssignableRole[] = ['ORG_ADMIN', 'MEMBER', 'GUARDIAN'];
const STATUSES: MembershipStatus[] = ['ACTIVE', 'SUSPENDED'];

export function RolesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [currentPassword, setCurrentPassword] = useState('');
  const memberships = useQuery({
    queryKey: ['memberships'],
    queryFn: () =>
      apiFetch<MembershipResponse[]>('/api/v1/memberships?limit=200'),
  });
  const members = useMembers();
  const nameOf = (memberId: string | null) => {
    const row = memberId
      ? members.data?.find((m) => m.id === memberId)
      : undefined;
    return row ? fullName(row) : '—';
  };

  const update = useMutation({
    mutationFn: ({
      id,
      ...patch
    }: { id: string } & Omit<UpdateMembershipInput, 'currentPassword'>) =>
      apiFetch<MembershipResponse>(`/api/v1/memberships/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ ...patch, currentPassword }),
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['memberships'] }),
  });

  return (
    <section className="grid gap-6">
      <PageHeader title={t('roles.title')} subtitle={t('roles.subtitle')} />
      <Card>
        <Field label={t('access.yourPassword')} className="max-w-xs">
          <input
            type="password"
            className={inputClass}
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </Field>
        <p className="mt-1 text-xs text-muted">{t('roles.passwordHint')}</p>
        {update.isError ? (
          <div className="mt-3">
            <ErrorText error={update.error} />
          </div>
        ) : null}
      </Card>
      <Card>
        <ul className="divide-y divide-line">
          {(memberships.data ?? []).map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <div>
                {row.memberId ? (
                  <Link
                    to={`/staff/members/${row.memberId}`}
                    className="font-medium hover:text-accent"
                  >
                    {nameOf(row.memberId)}
                  </Link>
                ) : (
                  <span className="font-medium">—</span>
                )}
                {row.status === 'SUSPENDED' ? (
                  <span className="ms-2">
                    <Badge tone="danger">
                      {t('roles.statusValue.SUSPENDED')}
                    </Badge>
                  </span>
                ) : null}
              </div>
              {row.role === 'SHEIKH' ? (
                <Badge tone="accent">{t('roles.SHEIKH')}</Badge>
              ) : (
                <div className="flex gap-2">
                  <select
                    aria-label={t('roles.label')}
                    className={`${inputClass} w-auto`}
                    value={row.role}
                    disabled={!currentPassword || update.isPending}
                    onChange={(e) =>
                      update.mutate({
                        id: row.id,
                        role: e.target.value as AssignableRole,
                      })
                    }
                  >
                    {ASSIGNABLE.map((role) => (
                      <option key={role} value={role}>
                        {t(`roles.${role}`)}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label={t('roles.status')}
                    className={`${inputClass} w-auto`}
                    value={row.status}
                    disabled={!currentPassword || update.isPending}
                    onChange={(e) =>
                      update.mutate({
                        id: row.id,
                        status: e.target.value as MembershipStatus,
                      })
                    }
                  >
                    {STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {t(`roles.statusValue.${status}`)}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </li>
          ))}
        </ul>
        {memberships.isError ? <ErrorText error={memberships.error} /> : null}
      </Card>
      <p className="text-xs text-muted">{t('roles.grantHint')}</p>
    </section>
  );
}
