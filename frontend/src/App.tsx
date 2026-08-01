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
import { PlatformDashboard } from './pages/superadmin/PlatformDashboard';
import { OrgDashboard } from './pages/orgadmin/OrgDashboard';
import { MemberDashboard } from './pages/orgmember/MemberDashboard';
import { ParticipantDashboard } from './pages/participant/ParticipantDashboard';
import { ContestReport } from './pages/participant/ContestReport';
import { EvaluatorDashboard } from './pages/evaluator/EvaluatorDashboard';

import LandingPageApp from './landing/LandingPageApp';

const queryClient = new QueryClient();

function PortalRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;

  switch (user.role) {
    case 'SUPER_ADMIN': return <Navigate to="/admin/platform" replace />;
    case 'ORG_ADMIN': return <Navigate to="/admin/org" replace />;
    case 'ORG_MEMBER': return <Navigate to="/member/contests" replace />;
    case 'EVALUATOR': return <Navigate to="/evaluator/assigned" replace />;
    default: return <Navigate to="/browse" replace />;
  }
}

import { NotificationProvider } from './components/notifications';

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <NotificationProvider>
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
                <RoleRoute allowedRoles={['EVALUATOR']}>
                  <EvaluatorDashboard />
                </RoleRoute>
              } />

              {/* ========== PARTICIPANT: Browse & Participate ========== */}
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
              <Route path="/leaderboard" element={<Leaderboard />} />

              {/* ========== TalentOS Style Contest Scorecard / Report ========== */}
              <Route path="/contests/:id/report" element={<ContestReport />} />

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

              {/* ========== Interactive Problem Playgrounds ========== */}
              <Route path="/playground/logic" element={<CodePlaygroundPage />} />
              <Route path="/playground/web-dev" element={<WebPlaygroundPage />} />
              <Route path="/playground/sql" element={<SqlPlaygroundPage />} />
              <Route path="/playground" element={<CodePlaygroundPage />} />

              <Route path="*" element={<Navigate to="/contests" replace />} />
            </Routes>
          </Sidebar>
        </Router>
        </NotificationProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
