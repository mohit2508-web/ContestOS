import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Sidebar } from './components/Sidebar';
import { LoginPage } from './pages/Login';
import { RegisterPage } from './pages/Register';
import {
  ContestZoneLayout,
  ContestProtectedRoute,
  OverviewTab,
  ProblemsTab,
} from './pages/ContestZonePage';
import { TeacherProblemEditorPage } from './pages/teacher/ProblemEditor';
import { ContestManagementPage as ContestManagement } from './pages/teacher/ContestManagement';
import { ContestBoardPage as ContestBoard } from './pages/ContestBoard';
import { LeaderboardPage as Leaderboard } from './pages/Leaderboard';

const queryClient = new QueryClient();

// Protected Route for Host/Teacher/Admin Portals — Students are strictly blocked
function HostProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const role = (user?.role || 'STUDENT').toUpperCase();

  if (role === 'STUDENT') {
    return <Navigate to="/contests" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <Sidebar>
            <Routes>
              {/* Auth Pages */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />

              {/* Student Candidate Portal */}
              <Route path="/" element={<Navigate to="/contests" replace />} />
              <Route path="/contests" element={<ContestBoard />} />
              <Route path="/leaderboard" element={<Leaderboard />} />

              {/* Immersive Contest Zone / IDE */}
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

              {/* Teacher / Admin Host Portal (Strictly Isolated) */}
              <Route
                path="/admin/contests"
                element={
                  <HostProtectedRoute>
                    <ContestManagement />
                  </HostProtectedRoute>
                }
              />
              <Route
                path="/admin/problems/new"
                element={
                  <HostProtectedRoute>
                    <TeacherProblemEditorPage />
                  </HostProtectedRoute>
                }
              />
              <Route
                path="/admin/problems/:id/edit"
                element={
                  <HostProtectedRoute>
                    <TeacherProblemEditorPage />
                  </HostProtectedRoute>
                }
              />

              <Route path="*" element={<Navigate to="/contests" replace />} />
            </Routes>
          </Sidebar>
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
}
