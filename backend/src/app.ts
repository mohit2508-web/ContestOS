import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Fail loud — crash if critical env vars missing
dotenv.config();
if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is not set. Refusing to start.');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('FATAL: DATABASE_URL environment variable is not set. Refusing to start.');
  process.exit(1);
}

// Import Routes
import authRoutes from './routes/auth.routes';
import contestManagerRoutes from './routes/contest-manager.routes';
import contestsRoutes from './routes/contests.routes';
import submissionsRoutes from './routes/submissions.routes';
import leaderboardRoutes from './routes/leaderboard.routes';
import problemsRoutes from './routes/problems.routes';
import guardRoutes from './routes/guard.routes';
import codeRoutes from './routes/code.routes';
import plagiarismRoutes from './routes/plagiarism.routes';
import orgRoutes from './routes/org.routes';
import adminRoutes from './routes/admin.routes';
import billingRoutes from './routes/billing.routes';
import evaluatorRoutes from './routes/evaluator.routes';
import assignmentRoutes from './routes/assignment.routes';
import orgRequestRoutes from './routes/org-request.routes';

const app = express();
const PORT = process.env.PORT || 5000;

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:5175',
];

if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
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

import { authenticateToken } from './middlewares/auth';
import prisma from './lib/prisma';

// User Streak Dynamic Routes
app.get('/api/user/streak', authenticateToken, async (req: express.Request, res: express.Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.json({ currentStreak: 0, maxStreak: 0 });
      return;
    }

    const submissions = await prisma.submission.findMany({
      where: { userId },
      select: { submittedAt: true },
      orderBy: { submittedAt: 'desc' },
    });

    if (submissions.length === 0) {
      res.json({ currentStreak: 0, maxStreak: 0 });
      return;
    }

    const dateSet = new Set(
      submissions.map((s) => new Date(s.submittedAt).toISOString().split('T')[0])
    );

    const todayStr = new Date().toISOString().split('T')[0];
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayStr = yesterdayDate.toISOString().split('T')[0];

    let currentStreak = 0;
    const checkDate = new Date();

    if (!dateSet.has(todayStr) && !dateSet.has(yesterdayStr)) {
      currentStreak = 0;
    } else {
      if (!dateSet.has(todayStr)) {
        checkDate.setDate(checkDate.getDate() - 1);
      }

      while (true) {
        const dStr = checkDate.toISOString().split('T')[0];
        if (dateSet.has(dStr)) {
          currentStreak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }
    }

    res.json({ currentStreak, maxStreak: currentStreak });
  } catch (error) {
    res.json({ currentStreak: 0, maxStreak: 0 });
  }
});

app.post('/api/user/streak/update', authenticateToken, async (req: express.Request, res: express.Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.json({ success: true, currentStreak: 1 });
      return;
    }

    const submissions = await prisma.submission.findMany({
      where: { userId },
      select: { submittedAt: true },
      orderBy: { submittedAt: 'desc' },
    });

    const dateSet = new Set(
      submissions.map((s) => new Date(s.submittedAt).toISOString().split('T')[0])
    );
    dateSet.add(new Date().toISOString().split('T')[0]);

    let currentStreak = 0;
    const checkDate = new Date();

    while (true) {
      const dStr = checkDate.toISOString().split('T')[0];
      if (dateSet.has(dStr)) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    res.json({ success: true, currentStreak });
  } catch (error) {
    res.json({ success: true, currentStreak: 1 });
  }
});

// Classes Batch Management Fallback Routes
app.get('/api/classes', (_req, res) => {
  res.json({
    classes: [
      { id: 'class-btech-cse-2026', name: 'B.Tech CSE Batch 2026 (Section A)', studentCount: 65 },
      { id: 'class-mtech-ai-2026', name: 'M.Tech AI & Data Science Batch 2026', studentCount: 30 },
      { id: 'class-btech-it-2026', name: 'B.Tech IT Batch 2026 (Section B)', studentCount: 58 },
    ],
  });
});
app.get('/api/classes/:id/students', (_req, res) => {
  res.json({
    students: [
      { student: { userId: 'demo-student-id', name: 'Demo Student', email: 'student@iitd.ac.in' } },
      { student: { userId: 'student-2', name: 'Rohan Sharma', email: 'rohan.sharma@iitd.ac.in' } },
      { student: { userId: 'student-3', name: 'Priya Patel', email: 'priya.patel@iitd.ac.in' } },
    ],
  });
});

// Auth Routes
app.use('/api/auth', authRoutes);

// Organization Management
app.use('/api/org', orgRoutes);

// Contest Assignments
app.use('/api/assignments', assignmentRoutes);

// Super Admin Dashboard
app.use('/api/admin', adminRoutes);

// Billing & Subscription
app.use('/api/billing', billingRoutes);

// Evaluator Routes
app.use('/api/evaluator', evaluatorRoutes);

// Organization Request Routes
app.use('/api/org-requests', orgRequestRoutes);

// Core API Routes
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
  console.log(`ContestOS Server running on port ${PORT}`);
  console.log(`Health Check: http://localhost:${PORT}/api/health`);
});

export default app;
