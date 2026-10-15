import { Navigate, Outlet, useLocation } from 'react-router';
import { ApiError } from '../api/api-fetch';
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
  // No network at all is not a signed-out session: open class mode from the cached kit.
  if (me.isError && !(me.error instanceof ApiError)) {
    return <Navigate to="/teach" replace />;
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
