import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import type {
  ApproveJoinApplicationResponse,
  JoinApplicationResponse,
  MemberAccessGap,
  OrganizationResponse,
  PublicOrganizationJoinInfo,
  SetupCodeResponse,
} from '@ribat/shared';
import { apiFetch } from '../api/api-fetch';
import { fullName } from '../components/MemberCard';
import { Button } from '../components/ui/button';
import { Badge, Empty, ErrorText, PageHeader } from '../components/ui/form';
import { useActiveMembership } from '../hooks/use-me';
import { setupWhatsappChatUrl } from '../lib/whatsapp-setup';
import { formatDateTime } from '../lib/domain';

export function StaffAccountManagementPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { membership, can } = useActiveMembership();

  const joinInfo = useQuery({
    queryKey: ['join-info'],
    queryFn: () =>
      apiFetch<PublicOrganizationJoinInfo>('/api/v1/join-applications/join-info'),
  });
  const pending = useQuery({
    queryKey: ['join-applications', 'PENDING'],
    queryFn: () =>
      apiFetch<JoinApplicationResponse[]>(
        '/api/v1/join-applications?status=PENDING',
      ),
  });
  const gaps = useQuery({
    queryKey: ['access-gaps'],
    queryFn: () =>
      apiFetch<MemberAccessGap[]>('/api/v1/join-applications/access-gaps'),
  });
  const orgSettings = useQuery({
    queryKey: ['organization'],
    queryFn: () => apiFetch<OrganizationResponse>('/api/v1/organization'),
    enabled: can('organization.manage'),
  });

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['join-applications'] }),
      queryClient.invalidateQueries({ queryKey: ['access-gaps'] }),
      queryClient.invalidateQueries({ queryKey: ['memberships'] }),
    ]);

  const reject = useMutation({
    mutationFn: (id: string) =>
      apiFetch<JoinApplicationResponse>(`/api/v1/join-applications/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    onSuccess: refresh,
  });
  const [justApproved, setJustApproved] = useState<{
    app: JoinApplicationResponse;
    access: SetupCodeResponse;
    href: string | null;
    whatsappOpened: boolean;
  } | null>(null);

  const approve = useMutation({
    mutationFn: ({
      id,
      draft,
    }: {
      id: string;
      draft: Window | null;
    }) =>
      apiFetch<ApproveJoinApplicationResponse>(
        `/api/v1/join-applications/${id}/approve`,
        { method: 'POST', body: JSON.stringify({}) },
      ).then((data) => ({ data, draft })),
    onSuccess: async ({ data, draft }) => {
      const href =
        membership
          ? setupWhatsappChatUrl({
              locale: membership.organizationLocale,
              override: orgSettings.data?.whatsappSetupTemplate,
              phone: data.application.phone,
              mosqueName: membership.organizationName,
              setupUrl: `${window.location.origin}/setup/password`,
              code: data.access.setupCode,
              expires: formatDateTime(
                data.access.expiresAt,
                membership.organizationLocale,
              ),
            })
          : null;
      let whatsappOpened = false;
      if (href && draft && !draft.closed) {
        draft.location.href = href;
        whatsappOpened = true;
      } else {
        draft?.close();
        if (href) {
          const opened = window.open(href, '_blank', 'noopener,noreferrer');
          whatsappOpened = Boolean(opened);
        }
      }
      setJustApproved({
        app: data.application,
        access: data.access,
        href,
        whatsappOpened,
      });
      await refresh();
    },
    onError: (_err, { draft }) => {
      draft?.close();
    },
  });

  const joinUrl =
    joinInfo.data && typeof window !== 'undefined'
      ? `${window.location.origin}/join/${joinInfo.data.slug}`
      : null;

  return (
    <section className="grid gap-8">
      <PageHeader
        title={t('accountMgmt.title')}
        subtitle={t('accountMgmt.subtitle')}
      />

      {joinInfo.data ? (
        <div className="rounded-2xl border border-line bg-surface p-4">
          <p className="text-sm font-medium">{t('accountMgmt.joinLinkTitle')}</p>
          <p className="mt-1 text-sm text-muted">{t('accountMgmt.joinLinkHint')}</p>
          {joinUrl ? (
            <p dir="ltr" className="mt-2 break-all font-mono text-sm">
              {joinUrl}
            </p>
          ) : null}
        </div>
      ) : null}

      {justApproved ? (
        <div className="grid gap-3 rounded-2xl border border-line bg-surface p-4">
          <h2 className="text-lg font-semibold">{t('accountMgmt.justApproved')}</h2>
          <p className="font-semibold">{fullName(justApproved.app)}</p>
          {!justApproved.whatsappOpened ? (
            <p className="text-sm text-muted">{t('accountMgmt.whatsappBlocked')}</p>
          ) : null}
          <p className="text-xs text-muted">{t('access.codeHint')}</p>
          <p dir="ltr" className="font-mono text-lg tracking-widest">
            {justApproved.access.setupCode}
          </p>
          {justApproved.href ? (
            <a
              href={justApproved.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink"
            >
              {t('access.sendWhatsApp')}
            </a>
          ) : null}
          <p className="text-xs text-muted">{t('access.whatsappHint')}</p>
        </div>
      ) : null}

      <div className="grid gap-3">
        <h2 className="text-lg font-semibold">{t('accountMgmt.pendingTitle')}</h2>
        {pending.isError ? <ErrorText error={pending.error} /> : null}
        {approve.isError ? <ErrorText error={approve.error} /> : null}
        {reject.isError ? <ErrorText error={reject.error} /> : null}
        {pending.data?.length === 0 ? (
          <Empty>{t('accountMgmt.pendingEmpty')}</Empty>
        ) : null}
        <ul className="grid gap-2">
          {(pending.data ?? []).map((app) => (
            <PendingApplicationRow
              key={app.id}
              app={app}
              canApprove={can('memberships.manage')}
              onReject={() => reject.mutate(app.id)}
              onApprove={() => {
                const draft = window.open('about:blank', '_blank');
                approve.mutate({ id: app.id, draft });
              }}
              busy={reject.isPending || approve.isPending}
            />
          ))}
        </ul>
      </div>

      <div className="grid gap-3">
        <h2 className="text-lg font-semibold">{t('accountMgmt.gapsTitle')}</h2>
        <p className="text-sm text-muted">{t('accountMgmt.gapsHint')}</p>
        {gaps.isError ? <ErrorText error={gaps.error} /> : null}
        {gaps.data?.length === 0 ? (
          <Empty>{t('accountMgmt.gapsEmpty')}</Empty>
        ) : null}
        <ul className="grid gap-2">
          {(gaps.data ?? []).map((gap) => (
            <li
              key={gap.memberId}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4"
            >
              <div className="grid gap-1">
                <Link
                  to={`/staff/members/${gap.memberId}`}
                  className="font-semibold text-accent"
                >
                  {fullName(gap)}
                </Link>
                <span dir="ltr" className="text-sm text-muted">
                  {gap.phone}
                </span>
              </div>
              <Badge tone={gap.reason === 'NO_MEMBERSHIP' ? 'danger' : 'neutral'}>
                {t(`accountMgmt.gapReason.${gap.reason}`)}
              </Badge>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function PendingApplicationRow({
  app,
  canApprove,
  onReject,
  onApprove,
  busy,
}: {
  app: JoinApplicationResponse;
  canApprove: boolean;
  onReject: () => void;
  onApprove: () => void;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const name = fullName(app);
  const wards =
    app.kind === 'GUARDIAN' && app.wards?.length
      ? app.wards.map((w) => fullName(w)).join(', ')
      : null;

  return (
    <li className="grid gap-3 rounded-2xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <span className="font-semibold">{name}</span>
          <span dir="ltr" className="text-sm text-muted">
            {app.phone}
          </span>
          <span className="text-sm">
            <Badge tone="neutral">{t(`accountMgmt.kind.${app.kind}`)}</Badge>
            {app.birthDate ? (
              <span className="ms-2 text-muted">{app.birthDate}</span>
            ) : null}
          </span>
          {wards ? (
            <span className="text-sm text-muted">
              {t('accountMgmt.wards')}: {wards}
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={onReject} disabled={busy}>
            {t('accountMgmt.reject')}
          </Button>
          {canApprove ? (
            <Button onClick={onApprove} disabled={busy}>
              {t('accountMgmt.approve')}
            </Button>
          ) : (
            <span className="text-xs text-muted">{t('accountMgmt.needGrantPerm')}</span>
          )}
        </div>
      </div>
    </li>
  );
}
