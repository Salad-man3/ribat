import { Navigate, Outlet, useLocation } from 'react-router';
import { useMe } from '../hooks/use-me';

export function ProtectedRoute() {
  const location = useLocation();
  const me = useMe();

  if (me.isLoading) {
    return <p className="text-sm text-slate-600">…</p>;
  }
  if (me.isError || !me.data) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}

export function RoleHomeRedirect() {
  const me = useMe();
  const membership = me.data?.memberships.find(
    (row) => row.organizationId === me.data?.activeOrganizationId,
  );
  if (!membership) return <Navigate to="/login" replace />;
  if (membership.role === 'GUARDIAN') return <Navigate to="/guardian" replace />;
  if (membership.role === 'MEMBER') return <Navigate to="/member" replace />;
  return <Navigate to="/staff" replace />;
}
