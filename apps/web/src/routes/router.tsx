import { createBrowserRouter } from 'react-router';
import { AppShell } from '../layouts/AppShell';
import { ClassSessionPage } from '../pages/ClassSessionPage';
import { HifzLogPage } from '../pages/HifzLogPage';
import { TodayPage } from '../pages/TodayPage';
import { AccountDevicesPage } from '../pages/AccountDevicesPage';
import { AuditPage } from '../pages/AuditPage';
import { CourseDetailPage } from '../pages/CourseDetailPage';
import { CoursesPage } from '../pages/CoursesPage';
import { ProgramDetailPage } from '../pages/ProgramDetailPage';
import { ExcusesPage } from '../pages/ExcusesPage';
import { FailedEventsPage } from '../pages/FailedEventsPage';
import { NotificationsPage } from '../pages/NotificationsPage';
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
import { JoinApplicationPage } from '../pages/JoinApplicationPage';
import { StaffAccountManagementPage } from '../pages/StaffAccountManagementPage';
import { StaffMembersPage } from '../pages/StaffMembersPage';
import { RouteErrorPage } from '../pages/RouteErrorPage';
import { ReportsPage } from '../pages/ReportsPage';
import { ReportCardDetailPage } from '../pages/ReportCardDetailPage';
import { ProtectedRoute, RoleHomeRedirect } from './ProtectedRoute';

export const router = createBrowserRouter([
  {
    errorElement: <RouteErrorPage />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/setup/password', element: <PasswordSetupPage /> },
      { path: '/setup/organization', element: <SetupOrganizationPage /> },
      { path: '/join/:slug', element: <JoinApplicationPage /> },
      {
        element: <AppShell />,
        children: [
          {
            errorElement: <RouteErrorPage />,
            children: [
              {
                // Outside ProtectedRoute: class mode opens from the cached kit with no network (SYNC-14).
                path: 'teach',
                children: [
                  { index: true, element: <TodayPage /> },
                  { path: ':id', element: <ClassSessionPage /> },
                  { path: ':id/hifz', element: <HifzLogPage /> },
                ],
              },
              {
                element: <ProtectedRoute />,
                children: [
                  { index: true, element: <RoleHomeRedirect /> },
                  { path: 'staff', element: <StaffHomePage /> },
                  { path: 'staff/members', element: <StaffMembersPage /> },
                  { path: 'staff/members/accounts', element: <StaffAccountManagementPage /> },
                  { path: 'staff/members/:id', element: <MemberDetailPage /> },
                  { path: 'staff/roles', element: <RolesPage /> },
                  { path: 'staff/courses', element: <CoursesPage /> },
                  { path: 'staff/programs/:id', element: <ProgramDetailPage /> },
                  { path: 'staff/courses/:id', element: <CourseDetailPage /> },
                  { path: 'staff/materials', element: <MaterialsPage /> },
                  { path: 'member/courses/:id', element: <CourseDetailPage /> },
                  { path: 'staff/organization', element: <OrganizationPage /> },
                  { path: 'staff/audit', element: <AuditPage /> },
                  { path: 'staff/excuses', element: <ExcusesPage /> },
                  { path: 'staff/events', element: <FailedEventsPage /> },
                  { path: 'staff/reports', element: <ReportsPage /> },
                  {
                    path: 'staff/reports/cards/:id',
                    element: <ReportCardDetailPage listPath="/staff/reports" />,
                  },
                  { path: 'teach/reports', element: <ReportsPage /> },
                  {
                    path: 'teach/reports/cards/:id',
                    element: <ReportCardDetailPage listPath="/teach/reports" />,
                  },
                  { path: 'member/reports/cards/:id', element: <ReportCardDetailPage listPath="/member" /> },
                  { path: 'guardian/reports/cards/:id', element: <ReportCardDetailPage listPath="/guardian" /> },
                  { path: 'notifications', element: <NotificationsPage /> },
                  { path: 'member', element: <MemberHomePage /> },
                  { path: 'guardian', element: <GuardianHomePage /> },
                  { path: 'account/devices', element: <AccountDevicesPage /> },
                  { path: '*', element: <NotFoundPage /> },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
]);
