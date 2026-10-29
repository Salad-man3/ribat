import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { NavButton } from '../components/ui/nav-button';
import type {
  CreateMemberInput,
  MemberResponse,
  MembershipResponse,
  OrganizationResponse,
  StaffGuardianLinkRow,
  TagResponse,
} from '@ribat/shared';
import { apiFetch } from '../api/api-fetch';
import { useMembers } from '../api/members';
import { fullName } from '../components/MemberCard';
import { MemberForm } from '../components/MemberForm';
import { TagFilterChips } from '../components/TagsSettingsPanel';
import { Button } from '../components/ui/button';
import {
  Card,
  Empty,
  ErrorText,
  inputClass,
  PageHeader,
  Segmented,
} from '../components/ui/form';
import { useActiveMembership } from '../hooks/use-me';
import { cn } from '../lib/utils';

type Tab = 'members' | 'teachers' | 'admins' | 'guardians';
type MemberFilter = 'all' | 'students' | 'teachers';

function courseLine(
  items: { courseName: string; endedAt?: string | null }[] | undefined,
) {
  if (!items?.length) return null;
  return items.map((c) => c.courseName).join('، ');
}

export function StaffMembersPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('members');
  const tabs: Tab[] = ['members', 'teachers', 'admins', 'guardians'];

  return (
    <section className="grid gap-6">
      <PageHeader
        chrome
        title={t('members.title')}
        subtitle={t('members.subtitle')}
      />
      <Segmented
        value={tab}
        onChange={setTab}
        aria-label={t('members.title')}
        options={tabs.map((value) => ({
          value,
          label: t(`members.tab.${value}`),
        }))}
      />
      {tab === 'members' ? <MembersTab /> : null}
      {tab === 'teachers' ? <TeachersTab /> : null}
      {tab === 'admins' ? <AdminsTab /> : null}
      {tab === 'guardians' ? <GuardiansTab /> : null}
    </section>
  );
}

function MembersTab() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<MemberFilter>('all');
  const [tagFilter, setTagFilter] = useState('all');
  const [status, setStatus] = useState<'ACTIVE' | 'ARCHIVED'>('ACTIVE');
  const members = useMembers(status, search, true);
  const org = useQuery({
    queryKey: ['organization'],
    queryFn: () => apiFetch<OrganizationResponse>('/api/v1/organization'),
  });
  const tags = useQuery({
    queryKey: ['tags'],
    queryFn: () => apiFetch<TagResponse[]>('/api/v1/tags'),
    enabled: org.data?.tagsEnabled === true,
    retry: false,
  });
  const memberships = useQuery({
    queryKey: ['memberships'],
    queryFn: () =>
      apiFetch<MembershipResponse[]>('/api/v1/memberships?limit=200'),
  });

  const guardianOnly = useMemo(() => {
    const byMember = new Map<string, Set<string>>();
    for (const row of memberships.data ?? []) {
      if (!row.memberId) continue;
      const set = byMember.get(row.memberId) ?? new Set();
      set.add(row.role);
      byMember.set(row.memberId, set);
    }
    return new Set(
      [...byMember.entries()]
        .filter(([, roles]) => roles.size === 1 && roles.has('GUARDIAN'))
        .map(([id]) => id),
    );
  }, [memberships.data]);

  const rows = (members.data ?? []).filter((m) => {
    if (guardianOnly.has(m.id)) return false;
    if (tagFilter !== 'all' && !(m.tagIds ?? []).includes(tagFilter)) {
      return false;
    }
    if (filter === 'students') return (m.studying?.length ?? 0) > 0;
    if (filter === 'teachers') return (m.teaching?.length ?? 0) > 0;
    return true;
  });

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
    <>
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
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <input
            type="search"
            className={cn(inputClass, 'max-w-xs flex-1')}
            placeholder={t('members.search')}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <Segmented
            value={filter}
            onChange={setFilter}
            aria-label={t('members.title')}
            options={(['all', 'students', 'teachers'] as const).map((value) => ({
              value,
              label: t(`members.filter.${value}`),
            }))}
          />
          <Segmented
            value={status}
            onChange={setStatus}
            aria-label={t('members.title')}
            options={(['ACTIVE', 'ARCHIVED'] as const).map((value) => ({
              value,
              label: t(`members.statusValue.${value}`),
            }))}
          />
        </div>
        {org.data?.tagsEnabled && tags.isSuccess ? (
          <div className="mb-4">
            <TagFilterChips
              tags={tags.data ?? []}
              value={tagFilter}
              onChange={setTagFilter}
            />
          </div>
        ) : null}
        {members.isError ? <ErrorText error={members.error} /> : null}
        {rows.length === 0 ? <Empty>{t('members.empty')}</Empty> : null}
        <MemberRows rows={rows} />
      </Card>
    </>
  );
}

function TeachersTab() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const members = useMembers('ACTIVE', search, true);
  const rows = (members.data ?? []).filter((m) => (m.teaching?.length ?? 0) > 0);

  return (
    <Card>
      <input
        type="search"
        className={cn(inputClass, 'mb-4 max-w-xs')}
        placeholder={t('members.search')}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {rows.length === 0 ? <Empty>{t('members.teachersEmpty')}</Empty> : null}
      <MemberRows rows={rows} teachingOnly />
    </Card>
  );
}

function MemberRows({
  rows,
  teachingOnly,
}: {
  rows: MemberResponse[];
  teachingOnly?: boolean;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { can } = useActiveMembership();
  const canEditMembers = can('members.manage');
  const org = useQuery({
    queryKey: ['organization'],
    queryFn: () => apiFetch<OrganizationResponse>('/api/v1/organization'),
  });
  const tags = useQuery({
    queryKey: ['tags'],
    queryFn: () => apiFetch<TagResponse[]>('/api/v1/tags'),
    enabled: org.data?.tagsEnabled === true,
  });
  const tagName = new Map((tags.data ?? []).map((tag) => [tag.id, tag.name]));
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const archive = useMutation({
    mutationFn: (id: string) =>
      apiFetch<MemberResponse>(`/api/v1/members/${id}/archive`, {
        method: 'POST',
      }),
    onSuccess: async () => {
      setConfirmId(null);
      await queryClient.invalidateQueries({ queryKey: ['members'] });
    },
  });

  return (
    <>
      {archive.isError ? <ErrorText error={archive.error} /> : null}
      <ul className="divide-y divide-line">
        {rows.map((member) => {
          const activeTeach = member.teaching?.filter((x) => !x.endedAt) ?? [];
          const pastTeach = member.teaching?.filter((x) => x.endedAt) ?? [];
          return (
            <li
              key={member.id}
              className="flex items-center gap-2 py-1"
            >
              <NavButton
                to={`/staff/members/${member.id}`}
                className="min-w-0 flex-1 rounded-lg px-2 py-3 text-start hover:bg-paper"
              >
                <span className="block font-medium">{fullName(member)}</span>
                {!teachingOnly && member.studying?.length ? (
                  <span className="block text-xs text-muted">
                    {t('members.studying')}: {courseLine(member.studying)}
                  </span>
                ) : null}
                {activeTeach.length ? (
                  <span className="block text-xs text-muted">
                    {t('members.teaching')}: {courseLine(activeTeach)}
                  </span>
                ) : null}
                {pastTeach.length ? (
                  <span className="block text-xs text-muted/80">
                    {t('members.taughtBefore')}: {courseLine(pastTeach)}
                  </span>
                ) : null}
                {org.data?.tagsEnabled && (member.tagIds?.length ?? 0) > 0 ? (
                  <span className="mt-1 flex flex-wrap gap-1">
                    {(member.tagIds ?? []).map((id) => (
                      <span
                        key={id}
                        className="rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent"
                      >
                        {tagName.get(id) ?? id.slice(0, 8)}
                      </span>
                    ))}
                  </span>
                ) : null}
              </NavButton>
              {canEditMembers && member.status === 'ACTIVE' ? (
                <div className="flex shrink-0 flex-wrap gap-1 pe-1">
                  {confirmId === member.id ? (
                    <>
                      <Button
                        variant="danger"
                        onClick={() => archive.mutate(member.id)}
                        disabled={archive.isPending}
                      >
                        {t('members.confirmDelete')}
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => setConfirmId(null)}
                      >
                        {t('common.cancel')}
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="danger"
                      onClick={() => setConfirmId(member.id)}
                    >
                      {t('members.delete')}
                    </Button>
                  )}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </>
  );
}

type AdminFilter = 'all' | 'SHEIKH' | 'ORG_ADMIN';

function adminMatches(row: MembershipResponse, filter: AdminFilter): boolean {
  if (row.role !== 'SHEIKH' && row.role !== 'ORG_ADMIN') return false;
  if (filter === 'all') return true;
  return row.role === filter;
}

function AdminsTab() {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<AdminFilter>('all');
  const members = useMembers();
  const memberships = useQuery({
    queryKey: ['memberships'],
    queryFn: () =>
      apiFetch<MembershipResponse[]>('/api/v1/memberships?limit=200'),
  });
  const nameOf = (id: string | null) => {
    const row = id ? members.data?.find((m) => m.id === id) : undefined;
    return row ? fullName(row) : '—';
  };
  const admins = useMemo(
    () =>
      (memberships.data ?? []).filter((row) => adminMatches(row, filter)),
    [memberships.data, filter],
  );

  const filterChips: { id: AdminFilter; label: string }[] = [
    { id: 'all', label: t('roles.filterAll') },
    { id: 'SHEIKH', label: t('roles.SHEIKH') },
    { id: 'ORG_ADMIN', label: t('roles.ORG_ADMIN') },
  ];

  return (
    <Card>
      <p className="mb-3 text-sm text-muted">{t('members.adminsHint')}</p>
      <NavButton to="/staff/roles" className="text-sm font-semibold text-accent">
        {t('members.manageRoles')} →
      </NavButton>
      <div className="mt-4 flex flex-wrap gap-2">
        {filterChips.map((chip) => (
          <button
            key={chip.id}
            type="button"
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium',
              filter === chip.id
                ? 'border-accent bg-accent/10 text-accent'
                : 'border-line text-muted',
            )}
            onClick={() => setFilter(chip.id)}
          >
            {chip.label}
          </button>
        ))}
      </div>
      <ul className="mt-4 divide-y divide-line">
        {admins.map((row) => (
          <li key={row.id} className="py-3">
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
            <p className="text-xs text-muted">{t(`roles.${row.role}`)}</p>
            <p className="mt-1 text-xs text-muted">
              {row.permissions
                .map((p) => t(`permissions.${p}`, { defaultValue: p }))
                .join(' · ')}
            </p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function GuardiansTab() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const links = useQuery({
    queryKey: ['guardian-links', search.trim()],
    queryFn: () => {
      const q = search.trim()
        ? `?search=${encodeURIComponent(search.trim())}`
        : '';
      return apiFetch<StaffGuardianLinkRow[]>(`/api/v1/guardian-links${q}`);
    },
  });

  return (
    <Card>
      <input
        type="search"
        className={cn(inputClass, 'mb-4 max-w-md')}
        placeholder={t('members.guardianSearch')}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {links.isError ? <ErrorText error={links.error} /> : null}
      {links.data?.length === 0 ? (
        <Empty>{t('members.guardiansEmpty')}</Empty>
      ) : null}
      <ul className="divide-y divide-line">
        {(links.data ?? []).map((row) => (
          <li key={row.id} className="py-3 text-sm">
            <NavButton
              to={`/staff/members/${row.wardMemberId}`}
              className="font-medium hover:text-accent"
            >
              {row.wardName}
            </NavButton>
            <span className="text-muted"> · {t('members.guardianOf')} </span>
            <NavButton
              to={`/staff/members/${row.guardianMemberId}`}
              className="font-medium hover:text-accent"
            >
              {row.guardianName}
            </NavButton>
            <span className="ms-2 text-xs text-muted">
              {t(`guardians.relation.${row.relation}`)}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
