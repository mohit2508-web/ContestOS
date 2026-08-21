import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { setupQuizTimerSocket } from './sockets/quizTimerSocket';

// Reload env parameters for CockroachDB & Compliance DSAR & Retention endpoints

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
import webDevRoutes from './routes/webdev.routes';
import playgroundRoutes from './routes/playground.routes';
import quizRoutes from './routes/quiz.routes';
import questionGovernanceRoutes from './routes/question-governance.routes';
import proctorRoutes from './routes/proctor.routes';
import analyticsViewerRoutes from './routes/analytics-viewer.routes';
import guestRoutes from './routes/guest.routes';
import complianceRoutes from './routes/compliance.routes';
import notificationRoutes from './routes/notification.routes';
import ssoRoutes from './routes/sso.routes';
import assistantRoutes from './routes/assistant.routes';
import companyVaultRoutes from './routes/company-vault.routes';
import { closeBrowser } from './services/webDevEvaluatorV2';

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 5000;

// Socket.IO — Proctor ↔ Student real-time channel
const io = new SocketServer(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return callback(null, true);
      if (/\.vercel\.app$/.test(origin) || /\.render\.com$/.test(origin)) return callback(null, true);
      return callback(null, true); // Allow all — same CORS policy as HTTP
    },
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});
import interviewRoutes from './routes/interview.routes';
import { setupInterviewSocket } from './sockets/interviewSocket';

setupQuizTimerSocket(io);
setupInterviewSocket(io);

// Export io for use in routes (proctor block via REST)
export { io };

// Graceful shutdown — close Playwright browser on process exit
process.on('SIGTERM', async () => {
  console.log('SIGTERM received — shutting down Playwright browser...');
  await closeBrowser();
  process.exit(0);
});
process.on('SIGINT', async () => {
  await closeBrowser();
  process.exit(0);
});


const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:5175',
];

// Support comma-separated list for FRONTEND_URL (e.g. Vercel preview URLs)
if (process.env.FRONTEND_URL) {
  const urls = process.env.FRONTEND_URL.split(',').map((u) => u.trim());
  allowedOrigins.push(...urls);
}

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    // Allow localhost in any form
    if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }
    // Allow vercel.app and your custom domains
    if (/\.vercel\.app$/.test(origin) || /\.render\.com$/.test(origin)) {
      return callback(null, true);
    }
    if (allowedOrigins.includes(origin)) {
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
    service: 'Kryptavia OS API Engine',
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

    // Calculate maxStreak: scan all dates in ascending order
    const allDates = Array.from(dateSet).sort();
    let maxStreak = 0;
    let runningStreak = 0;
    for (let i = 0; i < allDates.length; i++) {
      if (i === 0) {
        runningStreak = 1;
      } else {
        const prev = new Date(allDates[i - 1]);
        const curr = new Date(allDates[i]);
        const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
        runningStreak = diffDays === 1 ? runningStreak + 1 : 1;
      }
      maxStreak = Math.max(maxStreak, runningStreak);
    }

    res.json({ currentStreak, maxStreak });
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

// Auth & SSO Routes
app.use('/api/auth/sso', ssoRoutes);
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
app.use('/api/webdev', webDevRoutes);
app.use('/api/playground', playgroundRoutes);
app.use('/api/quiz', quizRoutes);
app.use('/api/governance', questionGovernanceRoutes);
app.use('/api/proctor', proctorRoutes);

// Analytics Viewer — read-only org results & scorecards
app.use('/api/analytics', analyticsViewerRoutes);

// Guest Candidate — invite-only external contest participation
app.use('/api/guest', guestRoutes);

// Compliance Officer — GDPR erasure + audit log access
app.use('/api/compliance', complianceRoutes);

// In-App Notifications & SSE Real-time Stream
app.use('/api/notifications', notificationRoutes);

// Live 1-on-1 Mock Interview & Collaborative IDE System
app.use('/api/interviews', interviewRoutes);

// Capgemini Stage 4: Guided Socratic AI Coding Assistant
app.use('/api/assistant', assistantRoutes);

// Company Placement Prep & Secret Vault Module
app.use('/api/company-vaults', companyVaultRoutes);

// Start Server
httpServer.listen(PORT, () => {
  console.log(`Kryptavia OS Server running on port ${PORT}`);
  console.log(`Health Check: http://localhost:${PORT}/api/health`);

  // Anti-Sleep Self-Waker for Free Hosting Tiers (Render/Railway/Koyeb)
  const KEEP_ALIVE_URL = process.env.KEEP_ALIVE_URL || process.env.BACKEND_URL;
  if (KEEP_ALIVE_URL) {
    const pingUrl = `${KEEP_ALIVE_URL.replace(/\/$/, '')}/api/health`;
    const PING_INTERVAL_MS = 10 * 60 * 1000; // Ping every 10 minutes
    console.log(`[Anti-Sleep Waker] Self-ping active for ${pingUrl}`);
    setInterval(async () => {
      try {
        const httpModule = pingUrl.startsWith('https') ? await import('https') : await import('http');
        httpModule.get(pingUrl, (res) => {
          console.log(`[Anti-Sleep Ping] Self-ping dispatched to ${pingUrl} (Status: ${res.statusCode})`);
        }).on('error', (err) => {
          console.warn(`[Anti-Sleep Ping] Self-ping error: ${err.message}`);
        });
      } catch (_e) {}
    }, PING_INTERVAL_MS);
  }
});

export default app;
