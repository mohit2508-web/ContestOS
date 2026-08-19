import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Sidebar } from './components/Sidebar';
import { RoleRoute } from './components/RoleRoute';
import LoginPageComponent from './pages/Login';
import RegisterPage from './pages/Register';
import {
  ContestZoneLayout,
  ContestProtectedRoute,
  OverviewTab,
  ProblemsTab,
} from './pages/ContestZonePage';
import { TeacherProblemEditorPage } from './pages/teacher/ProblemEditor';
import { TeacherProblemListPage as ProblemList } from './pages/teacher/ProblemList';
import { ContestManagementPage as ContestManagement } from './pages/teacher/ContestManagement';
import { ContestBoardPage as ContestBoard } from './pages/ContestBoard';
import { LeaderboardPage as Leaderboard } from './pages/Leaderboard';
import { CodePlaygroundPage } from './pages/CodePlaygroundPage';
import { WebPlaygroundPage } from './pages/WebPlaygroundPage';
import { SqlPlaygroundPage } from './pages/SqlPlaygroundPage';
import { QuizPlaygroundPage } from './pages/QuizPlaygroundPage';
import { QuizAnalyticsPage } from './pages/teacher/QuizAnalyticsPage';
import { PlatformDashboard } from './pages/superadmin/PlatformDashboard';
import { OrgDashboard } from './pages/orgadmin/OrgDashboard';
import { MemberDashboard } from './pages/orgmember/MemberDashboard';
import { ParticipantDashboard } from './pages/participant/ParticipantDashboard';
import { ContestReport } from './pages/participant/ContestReport';
import { EvaluatorDashboard } from './pages/evaluator/EvaluatorDashboard';
import { QuestionBankPage } from './pages/teacher/QuestionBankPage';
import { QuestionReviewDashboard } from './pages/teacher/QuestionReviewDashboard';
import { QuestionAuthoringForm } from './components/teacher/QuestionAuthoringForm';
import { ContestAssemblyBuilder } from './components/teacher/ContestAssemblyBuilder';
import { ProctorConsolePage } from './pages/proctor/ProctorConsole';
import { SmeGlobalRepositoryPage } from './pages/governance/SmeGlobalRepositoryPage';
import { AnalyticsDashboard } from './pages/analytics/AnalyticsDashboard';
import { GuestContestEntry } from './pages/guest/GuestContestEntry';
import { GuestResultView } from './pages/guest/GuestResultView';
import { ComplianceDashboard } from './pages/compliance/ComplianceDashboard';
import { ModeratorDashboard } from './pages/moderator/ModeratorDashboard';

import { AcceptInvitePage } from './pages/AcceptInvitePage';
import { NotificationsPage } from './pages/NotificationsPage';
import { SsoCallbackPage } from './pages/SsoCallbackPage';
import { InterviewDashboardPage } from './pages/InterviewDashboardPage';
import { LiveInterviewRoomPage } from './pages/LiveInterviewRoomPage';

import LandingPageApp from './landing/LandingPageApp';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { ErrorState } from './components/common/ErrorState';
import { NotFoundPage } from './pages/NotFoundPage';

const queryClient = new QueryClient();

function NetworkOfflineDetector() {
  const [isOffline, setIsOffline] = React.useState(!navigator.onLine);

  React.useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
      <div className="w-full max-w-lg">
        <ErrorState
          variant="network"
          title="Internet Connection Lost"
          body="Your connection dropped. Check your Wi-Fi/LAN cable. We'll pick up right where you left off when connected."
          onAction={() => window.location.reload()}
          ctaLabel="Retry Connection"
        />
      </div>
    </div>
  );
}

function PortalRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;

  if (user.role !== 'SUPER_ADMIN' && user.role !== 'PLATFORM_CONTENT_AUTHOR' && !user.organizationId) {
    return <Navigate to="/dashboard" replace />;
  }

  switch (user.role) {
    case 'SUPER_ADMIN': return <Navigate to="/admin/platform" replace />;
    case 'PLATFORM_CONTENT_AUTHOR': return <Navigate to="/governance/sme-bank" replace />;
    case 'ORG_ADMIN': return <Navigate to="/admin/org" replace />;
    case 'PROCTOR': return <Navigate to="/proctor/live" replace />;
    case 'ORG_MEMBER': return <Navigate to="/member/contests" replace />;
    case 'EVALUATOR': return <Navigate to="/evaluator/assigned" replace />;
    case 'ANALYTICS_VIEWER': return <Navigate to="/analytics/dashboard" replace />;
    case 'COMPLIANCE_OFFICER': return <Navigate to="/compliance/audit-logs" replace />;
    case 'CONTEST_MODERATOR': return <Navigate to="/moderator/dashboard" replace />;
    default: return <Navigate to="/dashboard" replace />;
  }
}

import { NotificationProvider } from './components/notifications';

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <NotificationProvider>
            <NetworkOfflineDetector />
            <Router>
              <Sidebar>
                <Routes>
              {/* Landing Page as Root Entrance */}
              <Route path="/" element={<LandingPageApp />} />
              <Route path="/landing" element={<LandingPageApp />} />
              <Route path="/portal" element={<PortalRedirect />} />

              {/* Auth Pages */}
              <Route path="/login" element={<LoginPageComponent />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/auth/sso/callback" element={<SsoCallbackPage />} />

              {/* Guest & Public Invite Routes */}
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/accept-invite" element={<AcceptInvitePage />} />
              <Route path="/guest/join/:token" element={<GuestContestEntry />} />
              <Route path="/guest/result/:token" element={<GuestResultView />} />

              {/* ========== ANALYTICS_VIEWER: Performance & Leaderboard ========== */}
              <Route path="/analytics/dashboard" element={
                <RoleRoute allowedRoles={['ANALYTICS_VIEWER', 'ORG_ADMIN', 'SUPER_ADMIN']}>
                  <AnalyticsDashboard />
                </RoleRoute>
              } />
              <Route path="/analytics/contests" element={
                <RoleRoute allowedRoles={['ANALYTICS_VIEWER', 'ORG_ADMIN', 'SUPER_ADMIN']}>
                  <AnalyticsDashboard />
                </RoleRoute>
              } />

              {/* ========== COMPLIANCE_OFFICER: Audit & GDPR Cockpit ========== */}
              <Route path="/compliance/audit-logs" element={
                <RoleRoute allowedRoles={['COMPLIANCE_OFFICER', 'SUPER_ADMIN']}>
                  <ComplianceDashboard />
                </RoleRoute>
              } />
              <Route path="/compliance/gdpr" element={
                <RoleRoute allowedRoles={['COMPLIANCE_OFFICER', 'SUPER_ADMIN']}>
                  <ComplianceDashboard />
                </RoleRoute>
              } />

              {/* ========== CONTEST_MODERATOR: Chief Examiner Console ========== */}
              <Route path="/moderator/dashboard" element={
                <RoleRoute allowedRoles={['CONTEST_MODERATOR', 'ORG_ADMIN', 'SUPER_ADMIN']}>
                  <ModeratorDashboard />
                </RoleRoute>
              } />
              <Route path="/moderator/queue" element={
                <RoleRoute allowedRoles={['CONTEST_MODERATOR', 'ORG_ADMIN', 'SUPER_ADMIN']}>
                  <ModeratorDashboard />
                </RoleRoute>
              } />

              {/* ========== SUPER_ADMIN: Platform Dashboard ========== */}
              <Route path="/admin/platform" element={
                <RoleRoute allowedRoles={['SUPER_ADMIN']}>
                  <PlatformDashboard />
                </RoleRoute>
              } />

              {/* ========== ORG_ADMIN: Organization Dashboard ========== */}
              <Route path="/admin/org" element={
                <RoleRoute allowedRoles={['ORG_ADMIN']}>
                  <OrgDashboard />
                </RoleRoute>
              } />
              <Route path="/admin/org/problems/new" element={
                <RoleRoute allowedRoles={['ORG_ADMIN', 'SUPER_ADMIN', 'ORG_MEMBER']}>
                  <TeacherProblemEditorPage />
                </RoleRoute>
              } />
              <Route path="/admin/org/problems/:id/edit" element={
                <RoleRoute allowedRoles={['ORG_ADMIN', 'SUPER_ADMIN', 'ORG_MEMBER']}>
                  <TeacherProblemEditorPage />
                </RoleRoute>
              } />
              <Route path="/problems" element={
                <RoleRoute allowedRoles={['SUPER_ADMIN', 'ORG_ADMIN', 'ORG_MEMBER']}>
                  <ProblemList />
                </RoleRoute>
              } />
              <Route path="/problems/new" element={
                <RoleRoute allowedRoles={['SUPER_ADMIN', 'ORG_ADMIN', 'ORG_MEMBER']}>
                  <TeacherProblemEditorPage />
                </RoleRoute>
              } />
              <Route path="/problems/:id/edit" element={
                <RoleRoute allowedRoles={['SUPER_ADMIN', 'ORG_ADMIN', 'ORG_MEMBER']}>
                  <TeacherProblemEditorPage />
                </RoleRoute>
              } />

              {/* ORG_ADMIN & ORG_MEMBER have access to full contest management */}
              <Route path="/admin/contests" element={
                <RoleRoute allowedRoles={['SUPER_ADMIN', 'ORG_ADMIN', 'ORG_MEMBER']}>
                  <ContestManagement />
                </RoleRoute>
              } />
              <Route path="/admin/quiz-analytics" element={
                <RoleRoute allowedRoles={['SUPER_ADMIN', 'ORG_ADMIN', 'ORG_MEMBER']}>
                  <QuizAnalyticsPage />
                </RoleRoute>
              } />

              {/* ========== ORG_MEMBER: Assigned Contests ========== */}
              <Route path="/member/contests" element={
                <RoleRoute allowedRoles={['ORG_MEMBER']}>
                  <MemberDashboard />
                </RoleRoute>
              } />
              <Route path="/member/contests/:contestId/problems/new" element={
                <RoleRoute allowedRoles={['ORG_MEMBER']}>
                  <TeacherProblemEditorPage />
                </RoleRoute>
              } />

              {/* ========== EVALUATOR: Grading Queue ========== */}
              <Route path="/evaluator/assigned" element={
                <RoleRoute allowedRoles={['EVALUATOR', 'SUPER_ADMIN', 'ORG_ADMIN']}>
                  <EvaluatorDashboard />
                </RoleRoute>
              } />

              {/* ========== PARTICIPANT: Browse & Participate ========== */}
              <Route path="/dashboard" element={
                <RoleRoute allowedRoles={['STUDENT', 'SUPER_ADMIN', 'ORG_ADMIN', 'ORG_MEMBER']}>
                  <ParticipantDashboard />
                </RoleRoute>
              } />
              <Route path="/browse" element={
                <RoleRoute allowedRoles={['STUDENT', 'SUPER_ADMIN', 'ORG_ADMIN', 'ORG_MEMBER']}>
                  <ParticipantDashboard />
                </RoleRoute>
              } />
              <Route path="/contests" element={
                <RoleRoute allowedRoles={['STUDENT', 'SUPER_ADMIN', 'ORG_ADMIN', 'ORG_MEMBER']}>
                  <ParticipantDashboard />
                </RoleRoute>
              } />
              <Route path="/leaderboard" element={
                <RoleRoute allowedRoles={['SUPER_ADMIN', 'PLATFORM_CONTENT_AUTHOR', 'ORG_ADMIN', 'PROCTOR', 'ORG_MEMBER', 'EVALUATOR', 'STUDENT', 'CANDIDATE', 'ANALYTICS_VIEWER', 'GUEST_CANDIDATE', 'COMPLIANCE_OFFICER', 'CONTEST_MODERATOR']}>
                  <Leaderboard />
                </RoleRoute>
              } />

              {/* ========== TalentOS Style Contest Scorecard / Report ========== */}
              <Route path="/contests/:id/report" element={
                <RoleRoute allowedRoles={['SUPER_ADMIN', 'PLATFORM_CONTENT_AUTHOR', 'ORG_ADMIN', 'PROCTOR', 'ORG_MEMBER', 'EVALUATOR', 'STUDENT', 'CANDIDATE', 'ANALYTICS_VIEWER', 'GUEST_CANDIDATE', 'COMPLIANCE_OFFICER', 'CONTEST_MODERATOR']}>
                  <ContestReport />
                </RoleRoute>
              } />

              {/* ========== Immersive Contest Zone / IDE ========== */}
              <Route
                path="/contests/:contestId"
                element={
                  <ContestProtectedRoute>
                    <ContestZoneLayout />
                  </ContestProtectedRoute>
                }
              >
                <Route index element={<Navigate to="overview" replace />} />
                <Route path="overview" element={<OverviewTab />} />
                <Route path="problems" element={<ProblemsTab />} />
                <Route path="leaderboard" element={<Leaderboard />} />
                <Route path="rules" element={<OverviewTab />} />
              </Route>

              {/* ========== Content Governance & Question Banks ========== */}
              {/* SME Dedicated Global Repository Portal */}
              <Route path="/governance/sme-bank" element={
                <RoleRoute allowedRoles={['SUPER_ADMIN', 'PLATFORM_CONTENT_AUTHOR']}>
                  <SmeGlobalRepositoryPage />
                </RoleRoute>
              } />
              <Route path="/governance/banks" element={
                <RoleRoute allowedRoles={['SUPER_ADMIN', 'PLATFORM_CONTENT_AUTHOR', 'ORG_ADMIN', 'ORG_MEMBER']}>
                  <QuestionBankPage />
                </RoleRoute>
              } />
              <Route path="/governance/reviews" element={
                <RoleRoute allowedRoles={['SUPER_ADMIN', 'PLATFORM_CONTENT_AUTHOR', 'ORG_ADMIN', 'ORG_MEMBER']}>
                  <QuestionReviewDashboard />
                </RoleRoute>
              } />
              <Route path="/governance/authoring" element={
                <RoleRoute allowedRoles={['SUPER_ADMIN', 'PLATFORM_CONTENT_AUTHOR', 'ORG_ADMIN', 'ORG_MEMBER']}>
                  <QuestionAuthoringForm />
                </RoleRoute>
              } />
              <Route path="/governance/assembly" element={
                <RoleRoute allowedRoles={['SUPER_ADMIN', 'PLATFORM_CONTENT_AUTHOR', 'ORG_ADMIN', 'ORG_MEMBER']}>
                  <ContestAssemblyBuilder />
                </RoleRoute>
              } />
              <Route path="/proctor/live" element={
                <RoleRoute allowedRoles={['PROCTOR', 'SUPER_ADMIN', 'ORG_ADMIN', 'ORG_MEMBER']}>
                  <ProctorConsolePage />
                </RoleRoute>
              } />

              {/* ========== Interactive Problem Playgrounds ========== */}
              <Route path="/playground/logic" element={
                <RoleRoute allowedRoles={['SUPER_ADMIN', 'PLATFORM_CONTENT_AUTHOR', 'ORG_ADMIN', 'PROCTOR', 'ORG_MEMBER', 'EVALUATOR', 'STUDENT', 'CANDIDATE', 'ANALYTICS_VIEWER', 'GUEST_CANDIDATE', 'COMPLIANCE_OFFICER', 'CONTEST_MODERATOR']}>
                  <CodePlaygroundPage />
                </RoleRoute>
              } />
              <Route path="/playground/web-dev" element={
                <RoleRoute allowedRoles={['SUPER_ADMIN', 'PLATFORM_CONTENT_AUTHOR', 'ORG_ADMIN', 'PROCTOR', 'ORG_MEMBER', 'EVALUATOR', 'STUDENT', 'CANDIDATE', 'ANALYTICS_VIEWER', 'GUEST_CANDIDATE', 'COMPLIANCE_OFFICER', 'CONTEST_MODERATOR']}>
                  <WebPlaygroundPage />
                </RoleRoute>
              } />
              <Route path="/playground/sql" element={
                <RoleRoute allowedRoles={['SUPER_ADMIN', 'PLATFORM_CONTENT_AUTHOR', 'ORG_ADMIN', 'PROCTOR', 'ORG_MEMBER', 'EVALUATOR', 'STUDENT', 'CANDIDATE', 'ANALYTICS_VIEWER', 'GUEST_CANDIDATE', 'COMPLIANCE_OFFICER', 'CONTEST_MODERATOR']}>
                  <SqlPlaygroundPage />
                </RoleRoute>
              } />
              <Route path="/playground/quiz" element={
                <RoleRoute allowedRoles={['SUPER_ADMIN', 'PLATFORM_CONTENT_AUTHOR', 'ORG_ADMIN', 'PROCTOR', 'ORG_MEMBER', 'EVALUATOR', 'STUDENT', 'CANDIDATE', 'ANALYTICS_VIEWER', 'GUEST_CANDIDATE', 'COMPLIANCE_OFFICER', 'CONTEST_MODERATOR']}>
                  <QuizPlaygroundPage />
                </RoleRoute>
              } />
              <Route path="/playground" element={
                <RoleRoute allowedRoles={['SUPER_ADMIN', 'PLATFORM_CONTENT_AUTHOR', 'ORG_ADMIN', 'PROCTOR', 'ORG_MEMBER', 'EVALUATOR', 'STUDENT', 'CANDIDATE', 'ANALYTICS_VIEWER', 'GUEST_CANDIDATE', 'COMPLIANCE_OFFICER', 'CONTEST_MODERATOR']}>
                  <CodePlaygroundPage />
                </RoleRoute>
              } />

              {/* ========== Live 1-on-1 Mock Interview & Pair Programming ========== */}
              <Route path="/interview/dashboard" element={
                <RoleRoute allowedRoles={['SUPER_ADMIN', 'PLATFORM_CONTENT_AUTHOR', 'ORG_ADMIN', 'PROCTOR', 'ORG_MEMBER', 'EVALUATOR', 'STUDENT', 'CANDIDATE']}>
                  <InterviewDashboardPage />
                </RoleRoute>
              } />
              <Route path="/interview/join/:sessionId" element={<LiveInterviewRoomPage />} />
              <Route path="/interview/room/:sessionId" element={<LiveInterviewRoomPage />} />

              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Sidebar>
        </Router>
        </NotificationProvider>
      </AuthProvider>
    </QueryClientProvider>
    </ErrorBoundary>
  );
}
