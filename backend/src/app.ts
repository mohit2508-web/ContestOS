import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Import Routes
import contestManagerRoutes from './routes/contest-manager.routes';
import contestsRoutes from './routes/contests.routes';
import submissionsRoutes from './routes/submissions.routes';
import leaderboardRoutes from './routes/leaderboard.routes';
import problemsRoutes from './routes/problems.routes';
import guardRoutes from './routes/guard.routes';
import codeRoutes from './routes/code.routes';
import plagiarismRoutes from './routes/plagiarism.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health Check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'ContestOS API Engine',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/contests/manager', contestManagerRoutes);
app.use('/api/contests', contestsRoutes);
app.use('/api/submissions', submissionsRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/problems', problemsRoutes);
app.use('/api/guard', guardRoutes);
app.use('/api/code', codeRoutes);
app.use('/api/plagiarism', plagiarismRoutes);

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 ContestOS Server running on port ${PORT}`);
  console.log(`📡 Health Check: http://localhost:${PORT}/api/health`);
});

export default app;
