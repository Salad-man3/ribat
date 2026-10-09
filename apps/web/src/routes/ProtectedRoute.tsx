import { Navigate, Outlet, useLocation } from 'react-router';
import { useActiveMembership, useMe } from '../hooks/use-me';

export function ProtectedRoute() {
  const location = useLocation();
  const me = useMe();

  if (me.isLoading) {
    return (
      <div className="grid min-h-dvh place-items-center text-sm text-muted">
        …
      </div>
    );
  }
  if (me.isError || !me.data) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}

export function RoleHomeRedirect() {
  const { membership, activeView } = useActiveMembership();
  if (!membership) return <Navigate to="/login" replace />;
  if (membership.role === 'GUARDIAN')
    return <Navigate to="/guardian" replace />;
  if (membership.role === 'MEMBER' || activeView === 'MEMBER')
    return <Navigate to="/member" replace />;
  return <Navigate to="/staff" replace />;
}
