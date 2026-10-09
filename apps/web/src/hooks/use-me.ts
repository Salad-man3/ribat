import { useQuery } from '@tanstack/react-query';
import type { S1Permission } from '@ribat/shared';
import { fetchMe } from '../api/auth';

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: fetchMe,
    retry: false,
  });
}

/** The membership for the active org, plus a permission check. */
export function useActiveMembership() {
  const me = useMe();
  const membership = me.data?.memberships.find(
    (row) => row.organizationId === me.data?.activeOrganizationId,
  );
  const can = (permission: S1Permission) =>
    me.data?.permissions.includes(permission) ?? false;
  return { me, membership, activeView: me.data?.activeView ?? null, can };
}
