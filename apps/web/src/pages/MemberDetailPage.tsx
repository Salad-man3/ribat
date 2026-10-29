import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';
import { NavButton } from '../components/ui/nav-button';
import type {
  AssignableRole,
  CreateGuardianLinkInput,
  CreateMemberInput,
  GuardianLinkResponse,
  GuardianRelation,
  MemberNoteResponse,
  MemberNoteVisibility,
  MemberResponse,
  MembershipResponse,
  OrganizationResponse,
  SetupCodeResponse,
} from '@ribat/shared';
import { ApiError, apiFetch } from '../api/api-fetch';
import { useMembers } from '../api/members';
import { fullName, MemberCard } from '../components/MemberCard';
import { MemberForm } from '../components/MemberForm';
import { Button } from '../components/ui/button';
import {
  Badge,
  Card,
  Empty,
  ErrorText,
  Field,
  inputClass,
  SectionNav,
} from '../components/ui/form';
import { useActiveMembership } from '../hooks/use-me';
import { setupWhatsappChatUrl } from '../lib/whatsapp-setup';
import { MemberTagsSection } from '../components/MemberTagsSection';
import { MemberHifzSection } from '../components/MemberHifzSection';
import { NotFoundPage } from './NotFoundPage';
import { formatDateTime } from '../lib/domain';

const RELATIONS: GuardianRelation[] = ['FATHER', 'MOTHER', 'OTHER'];
const ASSIGNABLE: AssignableRole[] = ['MEMBER', 'GUARDIAN', 'ORG_ADMIN'];

export function MemberDetailPage() {
  const { id = '' } = useParams();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { can } = useActiveMembership();
  const [editing, setEditing] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);

  const member = useQuery({
    queryKey: ['member', id],
    queryFn: () => apiFetch<MemberResponse>(`/api/v1/members/${id}`),
    retry: false,
  });
  const everyone = useMembers();
  const nameOf = (memberId: string) => {
    const row = everyone.data?.find((m) => m.id === memberId);
    return row ? fullName(row) : memberId.slice(0, 8);
  };
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ['member', id] });

  const update = useMutation({
    mutationFn: (input: CreateMemberInput) =>
      apiFetch<MemberResponse>(`/api/v1/members/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    onSuccess: async () => {
      setEditing(false);
      await Promise.all([
        refresh(),
        queryClient.invalidateQueries({ queryKey: ['members'] }),
      ]);
    },
  });
  const archive = useMutation({
    mutationFn: () =>
      apiFetch<MemberResponse>(`/api/v1/members/${id}/archive`, {
        method: 'POST',
      }),
    onSuccess: async () => {
      setConfirmArchive(false);
      await Promise.all([
        refresh(),
        queryClient.invalidateQueries({ queryKey: ['members'] }),
      ]);
    },
  });

  // A member id from another mosque comes back as NOT_FOUND, same as one that never existed.
  if (
    member.error instanceof ApiError &&
    member.error.body.error.code === 'NOT_FOUND'
  )
    return <NotFoundPage />;
  if (member.isError) return <ErrorText error={member.error} />;
  if (!member.data) return <p className="text-sm text-muted">…</p>;
  const data = member.data;

  const sectionItems = [
    ...(can('members.manage')
      ? [{ id: 'member-tags', label: t('members.tags.title') }]
      : []),
    ...(can('members.manage')
      ? [{ id: 'member-hifz', label: t('hifz.mapTitle') }]
      : []),
    { id: 'member-guardians', label: t('guardians.title') },
    { id: 'member-household', label: t('household.title') },
    { id: 'member-notes', label: t('notes.title') },
    ...(can('memberships.manage')
      ? [{ id: 'member-access', label: t('access.title') }]
      : []),
  ];

  return (
    <section className="grid gap-6">
      <NavButton to="/staff/members" className="text-sm text-accent">
        <span className="inline-block rtl:rotate-180">←</span>{' '}
        {t('members.title')}
      </NavButton>

      {editing ? (
        <Card
          title={t('members.editTitle')}
          actions={
            <Button variant="ghost" onClick={() => setEditing(false)}>
              {t('common.cancel')}
            </Button>
          }
        >
          <MemberForm
            initial={data}
            submitLabel={t('common.save')}
            pending={update.isPending}
            onSubmit={update.mutate}
          />
          {update.isError ? (
            <div className="mt-3">
              <ErrorText error={update.error} />
            </div>
          ) : null}
        </Card>
      ) : (
        <div className="grid gap-3">
          <MemberCard member={data} />
          {data.status === 'ACTIVE' && can('members.manage') ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" onClick={() => setEditing(true)}>
                {t('common.edit')}
              </Button>
              {confirmArchive ? (
                <>
                  <Button
                    variant="danger"
                    onClick={() => archive.mutate()}
                    disabled={archive.isPending}
                  >
                    {t('members.confirmDelete')}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setConfirmArchive(false)}
                  >
                    {t('common.cancel')}
                  </Button>
                </>
              ) : (
                <Button
                  variant="danger"
                  onClick={() => setConfirmArchive(true)}
                >
                  {t('members.delete')}
                </Button>
              )}
            </div>
          ) : null}
          {archive.isError ? <ErrorText error={archive.error} /> : null}
        </div>
      )}

      <SectionNav items={sectionItems} />

      {can('members.manage') ? (
        <div id="member-tags" className="record-section">
          <MemberTagsSection member={data} />
        </div>
      ) : null}
      {can('members.manage') ? (
        <div id="member-hifz" className="record-section">
          <MemberHifzSection memberId={id} />
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <div id="member-guardians" className="record-section">
          <GuardiansSection
            memberId={id}
            nameOf={nameOf}
            candidates={everyone.data ?? []}
          />
        </div>
        <div id="member-household" className="record-section">
          <HouseholdSection
            member={data}
            nameOf={nameOf}
            candidates={everyone.data ?? []}
            onLinked={refresh}
          />
        </div>
        <div id="member-notes" className="record-section">
          <NotesSection
            memberId={id}
            nameOf={nameOf}
            canWrite={can('notes.write')}
          />
        </div>
        {can('memberships.manage') ? (
          <div id="member-access" className="record-section">
            <AccessSection member={data} />
          </div>
        ) : null}
      </div>
    </section>
  );
}

type SectionProps = {
  nameOf: (id: string) => string;
  candidates: MemberResponse[];
};

function MemberSelect({
  value,
  onChange,
  candidates,
  exclude,
}: {
  value: string;
  onChange: (id: string) => void;
  candidates: MemberResponse[];
  exclude: string[];
}) {
  const { t } = useTranslation();
  return (
    <select
      className={inputClass}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required
    >
      <option value="">{t('common.choose')}</option>
      {candidates
        .filter((m) => !exclude.includes(m.id))
        .map((m) => (
          <option key={m.id} value={m.id}>
            {fullName(m)}
          </option>
        ))}
    </select>
  );
}

function GuardiansSection({
  memberId,
  nameOf,
  candidates,
}: SectionProps & { memberId: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const key = ['member', memberId, 'guardians'];
  const links = useQuery({
    queryKey: key,
    queryFn: () =>
      apiFetch<GuardianLinkResponse[]>(`/api/v1/members/${memberId}/guardians`),
  });
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [guardianMemberId, setGuardianMemberId] = useState('');
  const [guardian, setGuardian] = useState({
    firstName: '',
    fatherName: '',
    familyName: '',
    phone: '',
  });
  const [relation, setRelation] = useState<GuardianRelation>('FATHER');
  const [isPrimary, setIsPrimary] = useState(false);

  const add = useMutation({
    mutationFn: () => {
      const body: CreateGuardianLinkInput =
        mode === 'existing'
          ? { mode, guardianMemberId, relation, isPrimary }
          : {
              mode,
              guardian: {
                ...guardian,
                phone: guardian.phone.trim() || undefined,
              },
              relation,
              isPrimary,
            };
      return apiFetch<GuardianLinkResponse>(
        `/api/v1/members/${memberId}/guardians`,
        { method: 'POST', body: JSON.stringify(body) },
      );
    },
    onSuccess: async () => {
      setGuardianMemberId('');
      setGuardian({ firstName: '', fatherName: '', familyName: '', phone: '' });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: key }),
        queryClient.invalidateQueries({ queryKey: ['members'] }),
      ]);
    },
  });
  const remove = useMutation({
    mutationFn: (linkId: string) =>
      apiFetch<void>(`/api/v1/members/${memberId}/guardians/${linkId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  return (
    <Card title={t('guardians.title')}>
      {links.data?.length === 0 ? <Empty>{t('guardians.empty')}</Empty> : null}
      <ul className="grid gap-2">
        {(links.data ?? []).map((link) => (
          <li
            key={link.id}
            className="flex items-center justify-between gap-2 rounded-lg bg-paper px-3 py-2 text-sm"
          >
            <NavButton
              to={`/staff/members/${link.guardianMemberId}`}
              className="font-medium hover:text-accent"
            >
              {nameOf(link.guardianMemberId)}
            </NavButton>
            <span className="flex items-center gap-2">
              <Badge>{t(`guardians.relation.${link.relation}`)}</Badge>
              {link.isPrimary ? (
                <Badge tone="accent">{t('guardians.primary')}</Badge>
              ) : null}
              <button
                type="button"
                className="text-xs text-danger underline"
                onClick={() => remove.mutate(link.id)}
              >
                {t('common.remove')}
              </button>
            </span>
          </li>
        ))}
      </ul>

      <form
        className="mt-4 grid gap-3 border-t border-line pt-4"
        onSubmit={(e) => {
          e.preventDefault();
          add.mutate();
        }}
      >
        <div className="flex gap-4 text-sm">
          {(['existing', 'new'] as const).map((value) => (
            <label key={value} className="flex items-center gap-1.5">
              <input
                type="radio"
                checked={mode === value}
                onChange={() => setMode(value)}
                className="accent-accent"
              />
              {t(`guardians.mode.${value}`)}
            </label>
          ))}
        </div>
        {mode === 'existing' ? (
          <MemberSelect
            value={guardianMemberId}
            onChange={setGuardianMemberId}
            candidates={candidates}
            exclude={[memberId]}
          />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {(['firstName', 'fatherName', 'familyName'] as const).map(
              (field) => (
                <input
                  key={field}
                  className={inputClass}
                  placeholder={t(`members.${field}`)}
                  value={guardian[field]}
                  onChange={(e) =>
                    setGuardian({ ...guardian, [field]: e.target.value })
                  }
                  required
                />
              ),
            )}
            <input
              className={inputClass}
              dir="ltr"
              placeholder="+963…"
              value={guardian.phone}
              onChange={(e) =>
                setGuardian({ ...guardian, phone: e.target.value })
              }
            />
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <select
            className={`${inputClass} w-auto`}
            value={relation}
            onChange={(e) => setRelation(e.target.value as GuardianRelation)}
          >
            {RELATIONS.map((r) => (
              <option key={r} value={r}>
                {t(`guardians.relation.${r}`)}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-sm">
            <input
              type="checkbox"
              checked={isPrimary}
              onChange={(e) => setIsPrimary(e.target.checked)}
              className="accent-accent"
            />
            {t('guardians.primary')}
          </label>
          <Button type="submit" disabled={add.isPending}>
            {t('guardians.add')}
          </Button>
        </div>
        {add.isError ? <ErrorText error={add.error} /> : null}
      </form>
    </Card>
  );
}

function HouseholdSection({
  member,
  nameOf,
  candidates,
  onLinked,
}: SectionProps & { member: MemberResponse; onLinked: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [siblingMemberId, setSiblingMemberId] = useState('');
  const siblings = member.siblingMemberIds ?? [];
  const link = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/members/${member.id}/household`, {
        method: 'POST',
        body: JSON.stringify({ siblingMemberId }),
      }),
    onSuccess: async () => {
      setSiblingMemberId('');
      onLinked();
      await queryClient.invalidateQueries({ queryKey: ['members'] });
    },
  });

  return (
    <Card title={t('household.title')}>
      {siblings.length === 0 ? <Empty>{t('household.empty')}</Empty> : null}
      <ul className="flex flex-wrap gap-2">
        {siblings.map((sid) => (
          <li key={sid}>
            <NavButton
              to={`/staff/members/${sid}`}
              className="inline-block rounded-full bg-accent-soft px-3 py-1 text-sm text-accent"
            >
              {nameOf(sid)}
            </NavButton>
          </li>
        ))}
      </ul>
      <form
        className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4"
        onSubmit={(e) => {
          e.preventDefault();
          link.mutate();
        }}
      >
        <div className="min-w-48 flex-1">
          <MemberSelect
            value={siblingMemberId}
            onChange={setSiblingMemberId}
            candidates={candidates}
            exclude={[member.id, ...siblings]}
          />
        </div>
        <Button type="submit" disabled={link.isPending}>
          {t('household.link')}
        </Button>
      </form>
      {link.isError ? (
        <div className="mt-3">
          <ErrorText error={link.error} />
        </div>
      ) : null}
    </Card>
  );
}

function NotesSection({
  memberId,
  nameOf,
  canWrite,
}: {
  memberId: string;
  nameOf: (id: string) => string;
  canWrite: boolean;
}) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const key = ['member', memberId, 'notes'];
  const notes = useQuery({
    queryKey: key,
    queryFn: () =>
      apiFetch<MemberNoteResponse[]>(`/api/v1/members/${memberId}/notes`),
  });
  const [body, setBody] = useState('');
  const [visibility, setVisibility] =
    useState<MemberNoteVisibility>('SHEIKH_ONLY');
  const add = useMutation({
    mutationFn: () =>
      apiFetch<MemberNoteResponse>(`/api/v1/members/${memberId}/notes`, {
        method: 'POST',
        body: JSON.stringify({ body, visibility }),
      }),
    onSuccess: async () => {
      setBody('');
      await queryClient.invalidateQueries({ queryKey: key });
    },
  });

  return (
    <Card title={t('notes.title')}>
      {notes.isError ? <ErrorText error={notes.error} /> : null}
      {notes.data?.length === 0 ? <Empty>{t('notes.empty')}</Empty> : null}
      <ul className="grid gap-2">
        {(notes.data ?? []).map((note) => (
          <li key={note.id} className="rounded-lg bg-paper px-3 py-2 text-sm">
            <p dir="auto" className="whitespace-pre-wrap">
              {note.body}
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
              {nameOf(note.authorMemberId)} ·{' '}
              {formatDateTime(note.createdAt, i18n.language)}
              <Badge
                tone={note.visibility === 'SHEIKH_ONLY' ? 'danger' : 'neutral'}
              >
                {t(`notes.visibility.${note.visibility}`)}
              </Badge>
            </p>
          </li>
        ))}
      </ul>
      {canWrite ? (
        <form
          className="mt-4 grid gap-2 border-t border-line pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            add.mutate();
          }}
        >
          <textarea
            className={`${inputClass} min-h-20 py-2`}
            placeholder={t('notes.placeholder')}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
          />
          <div className="flex flex-wrap gap-2">
            <select
              className={`${inputClass} w-auto`}
              value={visibility}
              onChange={(e) =>
                setVisibility(e.target.value as MemberNoteVisibility)
              }
            >
              {(['SHEIKH_ONLY', 'STAFF'] as const).map((v) => (
                <option key={v} value={v}>
                  {t(`notes.visibility.${v}`)}
                </option>
              ))}
            </select>
            <Button type="submit" disabled={add.isPending}>
              {t('notes.add')}
            </Button>
          </div>
          {add.isError ? <ErrorText error={add.error} /> : null}
        </form>
      ) : null}
    </Card>
  );
}

function AccessSection({ member }: { member: MemberResponse }) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const { membership, can } = useActiveMembership();
  const orgSettings = useQuery({
    queryKey: ['organization'],
    queryFn: () => apiFetch<OrganizationResponse>('/api/v1/organization'),
    enabled: can('organization.manage'),
  });
  const memberships = useQuery({
    queryKey: ['memberships'],
    queryFn: () =>
      apiFetch<MembershipResponse[]>('/api/v1/memberships?limit=200'),
  });
  const existing = memberships.data?.find((m) => m.memberId === member.id);
  const [role, setRole] = useState<AssignableRole>('MEMBER');
  const [issued, setIssued] = useState<SetupCodeResponse | null>(null);

  const submit = useMutation({
    mutationFn: () =>
      apiFetch<SetupCodeResponse>(
        existing
          ? `/api/v1/members/${member.id}/access/reset-code`
          : `/api/v1/members/${member.id}/access`,
        {
          method: 'POST',
          body: JSON.stringify(existing ? {} : { role }),
        },
      ),
    onSuccess: async (data) => {
      setIssued(data);
      await queryClient.invalidateQueries({ queryKey: ['memberships'] });
    },
  });

  const whatsappHref =
    issued && member.phone && membership
      ? setupWhatsappChatUrl({
          locale: membership.organizationLocale,
          override: orgSettings.data?.whatsappSetupTemplate,
          phone: member.phone,
          mosqueName: membership.organizationName,
          setupUrl: `${window.location.origin}/setup`,
          code: issued.setupCode,
          expires: formatDateTime(issued.expiresAt, membership.organizationLocale),
        })
      : null;

  return (
    <Card title={t('access.title')}>
      {existing ? (
        <p className="mb-3 flex items-center gap-2 text-sm">
          {t('access.hasAccess')}{' '}
          <Badge tone="accent">{t(`roles.${existing.role}`)}</Badge>
          {existing.status === 'SUSPENDED' ? (
            <Badge tone="danger">{t('roles.statusValue.SUSPENDED')}</Badge>
          ) : null}
        </p>
      ) : (
        <p className="mb-3 text-sm text-muted">
          {member.phone ? t('access.noAccess') : t('access.needsPhone')}
        </p>
      )}

      {issued ? (
        <div className="mb-4 rounded-xl bg-accent p-4 text-accent-ink">
          <p className="text-xs opacity-80">{t('access.codeHint')}</p>
          <p
            dir="ltr"
            className="mt-2 select-all text-center font-mono text-2xl tracking-[0.3em]"
          >
            {issued.setupCode}
          </p>
          <p className="mt-2 text-xs opacity-80">
            {t('access.expires')}:{' '}
            {formatDateTime(issued.expiresAt, i18n.language)}
          </p>
          {whatsappHref ? (
            <div className="mt-4 grid gap-2">
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center justify-center rounded-lg bg-surface px-4 py-2 text-sm font-semibold text-ink ring-1 ring-line hover:bg-paper"
              >
                {t('access.sendWhatsApp')}
              </a>
              <p className="text-xs opacity-80">{t('access.whatsappHint')}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      {member.phone && member.status === 'ACTIVE' ? (
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit.mutate();
          }}
        >
          {!existing ? (
            <Field label={t('roles.label')}>
              <select
                className={inputClass}
                value={role}
                onChange={(e) => setRole(e.target.value as AssignableRole)}
              >
                {ASSIGNABLE.map((r) => (
                  <option key={r} value={r}>
                    {t(`roles.${r}`)}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
          <div>
            <Button type="submit" disabled={submit.isPending}>
              {existing ? t('access.resetCode') : t('access.grant')}
            </Button>
          </div>
          {submit.isError ? <ErrorText error={submit.error} /> : null}
        </form>
      ) : null}
    </Card>
  );
}
