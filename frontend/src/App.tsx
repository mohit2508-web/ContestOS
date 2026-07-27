import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
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

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <Routes>
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

            {/* Teacher / Admin Portal */}
            <Route path="/admin/contests" element={<ContestManagement />} />
            <Route path="/admin/problems/new" element={<TeacherProblemEditorPage />} />
            <Route path="/admin/problems/:id/edit" element={<TeacherProblemEditorPage />} />

            <Route path="*" element={<Navigate to="/contests" replace />} />
          </Routes>
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
}
