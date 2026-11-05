import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavButton } from '../components/ui/nav-button';
import {
  type AssignableRole,
  type MembershipResponse,
  type MembershipStatus,
  type OrganizationResponse,
  type S1Permission,
  type TagResponse,
  type UpdateMembershipInput,
} from '@ribat/shared';
import { apiFetch } from '../api/api-fetch';
import { useMembers } from '../api/members';
import { useMe } from '../hooks/use-me';
import { fullName } from '../components/MemberCard';
import { TagFilterChips } from '../components/TagsSettingsPanel';
import { Button } from '../components/ui/button';
import {
  Badge,
  Card,
  ErrorText,
  inputClass,
  FilterChips,
  PageHeader,
} from '../components/ui/form';
import { STAFF_PERMISSION_OPTIONS } from '../lib/staff-template-permissions';

const ASSIGNABLE: AssignableRole[] = ['ORG_ADMIN', 'MEMBER', 'GUARDIAN'];
const STATUSES: MembershipStatus[] = ['ACTIVE', 'SUSPENDED'];

type RoleFilter = 'all' | 'SHEIKH' | 'ORG_ADMIN' | 'MEMBER' | 'GUARDIAN';

function matchesFilter(row: MembershipResponse, filter: RoleFilter): boolean {
  if (filter === 'all') return true;
  return row.role === filter;
}

function matchesTagFilter(row: MembershipResponse, tagFilter: string): boolean {
  if (tagFilter === 'all') return true;
  if (!row.memberId) return false;
  return (row.memberTagIds ?? []).includes(tagFilter);
}

function PermissionPicker({
  value,
  onChange,
  disabled,
}: {
  value: S1Permission[];
  onChange: (next: S1Permission[]) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <ul className="grid gap-1 sm:grid-cols-2">
      {STAFF_PERMISSION_OPTIONS.map((key) => {
        const checked = value.includes(key);
        return (
          <li key={key}>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-accent"
                checked={checked}
                disabled={disabled}
                onChange={() =>
                  onChange(
                    checked ? value.filter((k) => k !== key) : [...value, key],
                  )
                }
              />
              {t(`permissions.${key}`, { defaultValue: key })}
            </label>
          </li>
        );
      })}
    </ul>
  );
}

export function RolesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const me = useMe();
  const canManagePrivileges = me.data?.permissions.includes(
    'memberships.manage_org_admin',
  );

  const [filter, setFilter] = useState<RoleFilter>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');
  const canListTags = me.data?.permissions.includes('members.manage') ?? false;
  const [orgAdminPerms, setOrgAdminPerms] = useState<S1Permission[]>([]);
  const [draft, setDraft] = useState<
    Record<string, { role?: AssignableRole; status?: MembershipStatus }>
  >({});

  const organization = useQuery({
    queryKey: ['organization'],
    queryFn: () => apiFetch<OrganizationResponse>('/api/v1/organization'),
    enabled: Boolean(canManagePrivileges || canListTags),
  });
  const tagsFeatureOn = organization.data?.tagsEnabled === true;

  useEffect(() => {
    if (organization.data?.orgAdminPermissions) {
      setOrgAdminPerms(organization.data.orgAdminPermissions);
    }
  }, [organization.data?.orgAdminPermissions]);

  const tags = useQuery({
    queryKey: ['tags'],
    queryFn: () => apiFetch<TagResponse[]>('/api/v1/tags'),
    enabled: canListTags && tagsFeatureOn,
    retry: false,
  });

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

  const withAccess = new Set(memberships.data?.map((row) => row.memberId));
  const withoutAccess = memberships.data
    ? (members.data ?? []).filter((m) => {
        if (withAccess.has(m.id)) return false;
        if (tagFilter === 'all') return true;
        return (m.tagIds ?? []).includes(tagFilter);
      })
    : [];

  const filteredRows = useMemo(
    () =>
      (memberships.data ?? []).filter(
        (row) => matchesFilter(row, filter) && matchesTagFilter(row, tagFilter),
      ),
    [memberships.data, filter, tagFilter],
  );

  const update = useMutation({
    mutationFn: ({ id, ...patch }: { id: string } & UpdateMembershipInput) =>
      apiFetch<MembershipResponse>(`/api/v1/memberships/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['memberships'] }),
  });

  const saveOrgAdminPerms = useMutation({
    mutationFn: (permissions: S1Permission[]) =>
      apiFetch<OrganizationResponse>('/api/v1/organization', {
        method: 'PATCH',
        body: JSON.stringify({
          orgAdminPermissions: permissions,
        }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['organization'] });
      await queryClient.invalidateQueries({ queryKey: ['memberships'] });
    },
  });

  const filterChips: { id: RoleFilter; label: string }[] = [
    { id: 'all', label: t('roles.filterAll') },
    { id: 'SHEIKH', label: t('roles.SHEIKH') },
    { id: 'ORG_ADMIN', label: t('roles.ORG_ADMIN') },
    { id: 'MEMBER', label: t('roles.MEMBER') },
    { id: 'GUARDIAN', label: t('roles.GUARDIAN') },
  ];

  return (
    <section className="grid gap-6">
      <PageHeader
        chrome
        title={t('roles.title')}
        subtitle={t('roles.subtitle')}
      />

      {canManagePrivileges ? (
        <Card title={t('roles.orgAdminPrivileges')}>
          <p className="mb-3 text-sm text-muted">
            {t('roles.orgAdminPrivilegesHint')}
          </p>
          {saveOrgAdminPerms.isError ? (
            <ErrorText error={saveOrgAdminPerms.error} />
          ) : null}
          <PermissionPicker value={orgAdminPerms} onChange={setOrgAdminPerms} />
          <Button
            type="button"
            className="mt-4"
            disabled={saveOrgAdminPerms.isPending}
            onClick={() => saveOrgAdminPerms.mutate(orgAdminPerms)}
          >
            {t('common.save')}
          </Button>
        </Card>
      ) : null}

      <div className="grid gap-3">
        <FilterChips
          value={filter}
          onChange={setFilter}
          aria-label={t('roles.title')}
          options={filterChips.map((chip) => ({
            value: chip.id,
            label: chip.label,
          }))}
        />
        {tagsFeatureOn && tags.isSuccess ? (
          <TagFilterChips
            tags={tags.data ?? []}
            value={tagFilter}
            onChange={setTagFilter}
          />
        ) : null}
      </div>

      {update.isError ? <ErrorText error={update.error} /> : null}
      {filteredRows.length > 0 || tagFilter === 'all' ? (
        <Card>
          <ul className="divide-y divide-line">
            {filteredRows.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div>
                  {row.memberId ? (
                    <NavButton
                      to={`/staff/members/${row.memberId}`}
                      className="font-medium hover:text-accent"
                    >
                      {nameOf(row.memberId)}
                    </NavButton>
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
                  {row.role === 'ORG_ADMIN' || row.role === 'SHEIKH' ? (
                    <p className="mt-1 text-xs text-muted">
                      {t(`roles.${row.role}`)}
                    </p>
                  ) : null}
                </div>
                {row.role === 'SHEIKH' ? (
                  <Badge tone="accent">{t('roles.SHEIKH')}</Badge>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      aria-label={t('roles.label')}
                      className={`${inputClass} w-auto`}
                      value={draft[row.id]?.role ?? row.role}
                      disabled={update.isPending}
                      onChange={(e) =>
                        setDraft((current) => ({
                          ...current,
                          [row.id]: {
                            ...current[row.id],
                            role: e.target.value as AssignableRole,
                          },
                        }))
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
                      value={draft[row.id]?.status ?? row.status}
                      disabled={update.isPending}
                      onChange={(e) =>
                        setDraft((current) => ({
                          ...current,
                          [row.id]: {
                            ...current[row.id],
                            status: e.target.value as MembershipStatus,
                          },
                        }))
                      }
                    >
                      {STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {t(`roles.statusValue.${status}`)}
                        </option>
                      ))}
                    </select>
                    {draft[row.id] &&
                    ((draft[row.id]?.role ?? row.role) !== row.role ||
                      (draft[row.id]?.status ?? row.status) !== row.status) ? (
                      <>
                        <Button
                          type="button"
                          disabled={update.isPending}
                          onClick={() => {
                            const patch = draft[row.id]!;
                            update.mutate(
                              { id: row.id, ...patch },
                              {
                                onSuccess: () =>
                                  setDraft((current) => {
                                    const next = { ...current };
                                    delete next[row.id];
                                    return next;
                                  }),
                              },
                            );
                          }}
                        >
                          {t('roles.applyAccessChange')}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() =>
                            setDraft((current) => {
                              const next = { ...current };
                              delete next[row.id];
                              return next;
                            })
                          }
                        >
                          {t('common.cancel')}
                        </Button>
                      </>
                    ) : null}
                  </div>
                )}
              </li>
            ))}
          </ul>
          {memberships.isError ? <ErrorText error={memberships.error} /> : null}
        </Card>
      ) : null}
      {withoutAccess.length ? (
        <Card title={t('roles.noAccess')}>
          <p className="text-xs text-muted">{t('roles.grantHint')}</p>
          <ul className="mt-2 divide-y divide-line">
            {withoutAccess.map((member) => (
              <li
                key={member.id}
                className="flex items-center justify-between gap-3 py-3"
              >
                <span className="font-medium">{fullName(member)}</span>
                <NavButton
                  to={`/staff/members/${member.id}`}
                  className="text-sm text-accent hover:text-accent-strong"
                >
                  {t('roles.grant')}
                </NavButton>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </section>
  );
}
