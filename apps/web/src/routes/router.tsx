import { createBrowserRouter, Navigate } from 'react-router';
import { AppShell } from '../layouts/AppShell';
import { AccountDevicesPage } from '../pages/AccountDevicesPage';
import { GuardianHomePage } from '../pages/GuardianHomePage';
import { LoginPage } from '../pages/LoginPage';
import { MemberHomePage } from '../pages/MemberHomePage';
import { PasswordSetupPage } from '../pages/PasswordSetupPage';
import { SetupOrganizationPage } from '../pages/SetupOrganizationPage';
import { StaffHomePage } from '../pages/StaffHomePage';
import { StaffMembersPage } from '../pages/StaffMembersPage';
import { ProtectedRoute, RoleHomeRedirect } from './ProtectedRoute';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/setup/password', element: <PasswordSetupPage /> },
  { path: '/setup/organization', element: <SetupOrganizationPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <RoleHomeRedirect /> },
          { path: 'staff', element: <StaffHomePage /> },
          { path: 'staff/members', element: <StaffMembersPage /> },
          { path: 'member', element: <MemberHomePage /> },
          { path: 'guardian', element: <GuardianHomePage /> },
          { path: 'account/devices', element: <AccountDevicesPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
