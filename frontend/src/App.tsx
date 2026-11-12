import React, { ReactNode } from 'react';
import { Route, Switch, useLocation, Redirect } from 'wouter';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { authApi, User } from '@/services/api';
import { AppShell } from '@/components/layout/AppShell';
import { LoadingState } from '@/components/common/UIComponents';

// Auth Pages
import { LoginPage } from '@/pages/auth/LoginPage';
import { SetupAdminPage } from '@/pages/auth/SetupAdminPage';
import { PublicRegisterPage } from '@/pages/auth/PublicRegisterPage';

// Shared / Role-specific Pages
import { DashboardPage } from '@/pages/DashboardPage';
import { StudentsPage } from '@/pages/admin/StudentsPage';
import { MyStudentsPage } from '@/pages/employee/MyStudentsPage';
import { EmployeesPage } from '@/pages/admin/EmployeesPage';
import { TeamsPage } from '@/pages/admin/TeamsPage';
import { ProgramsPage } from '@/pages/admin/ProgramsPage';
import { ProgramDetailPage } from '@/pages/admin/ProgramDetailPage';
import { EnrollmentsPage } from '@/pages/admin/EnrollmentsPage';
import { ChatPage } from '@/pages/common/ChatPage';
import { AuditLogsPage } from '@/pages/admin/AuditLogsPage';
import { StudentReviewsPage } from '@/pages/admin/StudentReviewsPage';
import { ReferralManagementPage } from '@/pages/admin/ReferralManagementPage';
import { PaymentManagementPage } from '@/pages/admin/PaymentManagementPage';
import { RewardConfigPage } from '@/pages/admin/RewardConfigPage';

// Student Pages
import { MyProgramsPage } from '@/pages/student/MyProgramsPage';
import { StudentProgramView } from '@/pages/student/StudentProgramView';
import { DailyClassPage } from '@/pages/student/DailyClassPage';
import { ReferralPage } from '@/pages/student/ReferralPage';
import { RewardWalletPage } from '@/pages/student/RewardWalletPage';
import { ExploreProgramsPage } from '@/pages/student/ExploreProgramsPage';
import { PaymentHistoryPage } from '@/pages/student/PaymentHistoryPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        const status = error?.status;
        if (status === 400 || status === 401 || status === 403 || status === 404 || status === 422) {
          return false;
        }
        return failureCount < 1;
      },
      refetchOnWindowFocus: false,
      staleTime: 5000
    }
  }
});

function AuthGuard({ children, roles }: { children: (user: User) => ReactNode; roles?: string[] }) {
  const [location, setLocation] = useLocation();

  const { data: user, isLoading, isError } = useQuery<User>({
    queryKey: ['current_user'],
    queryFn: authApi.me,
  });

  if (isLoading) {
    return <LoadingState label="Checking active session" />;
  }

  if (isError || !user) {
    if (location !== '/login' && location !== '/setup') {
      setLocation('/login');
    }
    return null;
  }

  if (roles && !roles.includes(user.role)) {
    return (
      <AppShell user={user}>
        <div className="panel p-8 text-center bg-white border border-[#e1e8e1] rounded-2xl max-w-lg mx-auto my-12">
          <div className="text-xl font-bold text-[#9d3c32]">Access Restricted</div>
          <p className="mt-2 text-xs text-[#6e7e76]">
            Your current account role ({user.role}) does not have permission to access this panel section.
          </p>
        </div>
      </AppShell>
    );
  }

  return <AppShell user={user}>{children(user)}</AppShell>;
}

function NotFound() {
  return (
    <div className="panel p-10 text-center bg-white border border-[#e1e8e1] rounded-2xl max-w-lg mx-auto my-12">
      <div className="text-2xl font-extrabold text-[#23352e]">404 - Page Not Found</div>
      <p className="mt-2 text-xs text-[#718279]">The requested resource does not exist or has been relocated.</p>
    </div>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Switch>
        {/* Public / Auth routes */}
        <Route path="/login" component={LoginPage} />
        <Route path="/setup" component={SetupAdminPage} />
        <Route path="/register" component={PublicRegisterPage} />
        <Route path="/student-registration" component={PublicRegisterPage} />
        <Route path="/join" component={PublicRegisterPage} />

        {/* Dashboard / Overview */}
        <Route path="/">
          <AuthGuard>{(user) => <DashboardPage user={user} />}</AuthGuard>
        </Route>
        <Route path="/dashboard">
          <AuthGuard>{(user) => <DashboardPage user={user} />}</AuthGuard>
        </Route>

        {/* Admin Management routes */}
        <Route path="/students">
          <AuthGuard roles={['admin']}>{() => <StudentsPage />}</AuthGuard>
        </Route>
        <Route path="/employees">
          <AuthGuard roles={['admin']}>{() => <EmployeesPage />}</AuthGuard>
        </Route>
        <Route path="/teams">
          <AuthGuard roles={['admin']}>{() => <TeamsPage />}</AuthGuard>
        </Route>
        <Route path="/programs">
          <AuthGuard roles={['admin']}>{() => <ProgramsPage />}</AuthGuard>
        </Route>
        <Route path="/programs/:id">
          <AuthGuard roles={['admin']}>{() => <ProgramDetailPage />}</AuthGuard>
        </Route>
        <Route path="/enrollments">
          <AuthGuard roles={['admin']}>{() => <EnrollmentsPage />}</AuthGuard>
        </Route>
        <Route path="/payments">
          <AuthGuard roles={['admin']}>{() => <PaymentManagementPage />}</AuthGuard>
        </Route>
        <Route path="/reward-config">
          <AuthGuard roles={['admin']}>{() => <RewardConfigPage />}</AuthGuard>
        </Route>
        <Route path="/audit-logs">
          <AuthGuard roles={['admin']}>{() => <AuditLogsPage />}</AuthGuard>
        </Route>

        {/* Employee-specific routes */}
        <Route path="/my-students">
          <AuthGuard roles={['employee']}>{() => <MyStudentsPage />}</AuthGuard>
        </Route>
        <Route path="/daily-classes">
          <Redirect to="/my-students" />
        </Route>

        {/* Reviews and Performance */}
        <Route path="/student-reviews">
          <AuthGuard roles={['admin', 'employee']}>{() => <StudentReviewsPage />}</AuthGuard>
        </Route>
        <Route path="/referral-management">
          <AuthGuard roles={['admin']}>{() => <ReferralManagementPage />}</AuthGuard>
        </Route>

        {/* Real-time Messages / Chat */}
        <Route path="/chat">
          <AuthGuard>{(user) => <ChatPage user={user} />}</AuthGuard>
        </Route>

        {/* Student Learning, Rewards, and Purchases */}
        <Route path="/my-programs">
          <AuthGuard roles={['student']}>{() => <MyProgramsPage />}</AuthGuard>
        </Route>
        <Route path="/my-programs/:id">
          <AuthGuard roles={['student', 'employee', 'admin']}>{() => <StudentProgramView />}</AuthGuard>
        </Route>
        <Route path="/learning-days/:id">
          <AuthGuard roles={['student', 'employee', 'admin']}>{() => <DailyClassPage />}</AuthGuard>
        </Route>
        <Route path="/wallet">
          <AuthGuard roles={['student', 'admin']}>{() => <RewardWalletPage />}</AuthGuard>
        </Route>
        <Route path="/explore-programs">
          <AuthGuard roles={['student', 'admin']}>{() => <ExploreProgramsPage />}</AuthGuard>
        </Route>
        <Route path="/payment-history">
          <AuthGuard roles={['student', 'admin']}>{() => <PaymentHistoryPage />}</AuthGuard>
        </Route>
        <Route path="/referrals">
          <AuthGuard roles={['student', 'employee']}>{(user) => <ReferralPage user={user} />}</AuthGuard>
        </Route>

        {/* Fallback & Redirects for removed attendance & submission queues */}
        <Route path="/attendance">
          <AuthGuard>{(user) => <DashboardPage user={user} />}</AuthGuard>
        </Route>
        <Route path="/my-attendance">
          <AuthGuard>{(user) => <DashboardPage user={user} />}</AuthGuard>
        </Route>
        <Route path="/submissions">
          <AuthGuard>{() => <StudentReviewsPage />}</AuthGuard>
        </Route>
        <Route path="/my-tasks">
          <AuthGuard>{() => <MyProgramsPage />}</AuthGuard>
        </Route>

        {/* 404 Fallback */}
        <Route>
          <AuthGuard>{() => <NotFound />}</AuthGuard>
        </Route>
      </Switch>
    </QueryClientProvider>
  );
}

export default App;
