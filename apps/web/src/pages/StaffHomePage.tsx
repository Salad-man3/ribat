import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useMembers } from '../api/members';
import { PageHeader } from '../components/ui/form';
import { useActiveMembership } from '../hooks/use-me';

export function StaffHomePage() {
  const { t } = useTranslation();
  const { membership, can } = useActiveMembership();
  const members = useMembers();
  const count = members.data?.length;

  const links = [
    {
      to: '/staff/members',
      label: 'nav.members',
      hint: 'staff.membersHint',
      perm: 'members.manage',
    },
    {
      to: '/staff/courses',
      label: 'nav.courses',
      hint: 'staff.coursesHint',
      perm: 'courses.manage',
    },
    {
      to: '/staff/materials',
      label: 'nav.materials',
      hint: 'staff.materialsHint',
      perm: 'materials.manage',
    },
    {
      to: '/staff/roles',
      label: 'nav.roles',
      hint: 'staff.rolesHint',
      perm: 'memberships.manage',
    },
    {
      to: '/staff/audit',
      label: 'nav.audit',
      hint: 'staff.auditHint',
      perm: 'audit.read',
    },
    {
      to: '/staff/organization',
      label: 'nav.organization',
      hint: 'staff.organizationHint',
      perm: 'organization.manage',
    },
  ] as const;

  return (
    <section className="grid gap-6">
      <PageHeader
        title={membership?.organizationName ?? t('staff.homeTitle')}
        subtitle={membership ? t(`roles.${membership.role}`) : undefined}
      />
      <div className="rounded-2xl bg-accent p-6 text-white">
        <p className="text-sm opacity-80">{t('staff.activeMembers')}</p>
        <p className="mt-1 text-4xl font-semibold">
          {count === undefined ? '…' : count >= 200 ? '200+' : count}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {links
          .filter((link) => can(link.perm))
          .map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="rounded-2xl border border-line bg-surface p-5 transition hover:border-accent"
            >
              <p className="font-semibold">{t(link.label)}</p>
              <p className="mt-1 text-sm text-muted">{t(link.hint)}</p>
            </Link>
          ))}
      </div>
    </section>
  );
}
