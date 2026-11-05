import { useQuery } from '@tanstack/react-query';
import type { MemberResponse } from '@ribat/shared';
import { apiFetch } from '../api/api-fetch';
import { useActiveMembership } from '../hooks/use-me';
import { NavButton } from './ui/nav-button';
import { cn } from '../lib/utils';

function useMemberProfileHref(memberId: string): string | null {
  const { membership, can } = useActiveMembership();
  const wards = useQuery({
    queryKey: ['wards'],
    queryFn: () => apiFetch<MemberResponse[]>('/api/v1/wards'),
    enabled: membership?.role === 'GUARDIAN',
  });

  if (can('members.manage') || can('courses.manage'))
    return `/staff/members/${memberId}`;
  if (membership?.memberId === memberId) return '/member/profile';
  if (wards.data?.some((w) => w.id === memberId))
    return `/guardian/members/${memberId}`;
  return null;
}

export function MemberNameLink({
  memberId,
  children,
  className,
}: {
  memberId: string;
  children: React.ReactNode;
  className?: string;
}) {
  const href = useMemberProfileHref(memberId);
  if (!href) {
    return (
      <span dir="auto" className={cn('text-start', className)}>
        {children}
      </span>
    );
  }
  return (
    <NavButton
      to={href}
      className={cn('font-medium text-accent hover:underline', className)}
    >
      {children}
    </NavButton>
  );
}
