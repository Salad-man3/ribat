import { createBrowserRouter } from 'react-router';
import { AppShell } from '../layouts/AppShell';
import { AccountDevicesPage } from '../pages/AccountDevicesPage';
import { AuditPage } from '../pages/AuditPage';
import { CourseDetailPage } from '../pages/CourseDetailPage';
import { CoursesPage } from '../pages/CoursesPage';
import { MaterialsPage } from '../pages/MaterialsPage';
import { GuardianHomePage } from '../pages/GuardianHomePage';
import { LoginPage } from '../pages/LoginPage';
import { MemberDetailPage } from '../pages/MemberDetailPage';
import { MemberHomePage } from '../pages/MemberHomePage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { OrganizationPage } from '../pages/OrganizationPage';
import { PasswordSetupPage } from '../pages/PasswordSetupPage';
import { RolesPage } from '../pages/RolesPage';
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
          { path: 'staff/members/:id', element: <MemberDetailPage /> },
          { path: 'staff/roles', element: <RolesPage /> },
          { path: 'staff/courses', element: <CoursesPage /> },
          { path: 'staff/courses/:id', element: <CourseDetailPage /> },
          { path: 'staff/materials', element: <MaterialsPage /> },
          { path: 'member/courses/:id', element: <CourseDetailPage /> },
          { path: 'staff/organization', element: <OrganizationPage /> },
          { path: 'staff/audit', element: <AuditPage /> },
          { path: 'member', element: <MemberHomePage /> },
          { path: 'guardian', element: <GuardianHomePage /> },
          { path: 'account/devices', element: <AccountDevicesPage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);
