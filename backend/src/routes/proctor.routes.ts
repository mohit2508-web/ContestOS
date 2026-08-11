import { Router } from 'express';
import { PrismaClient } from '../generated/client';
import { authenticateToken } from '../middlewares/auth';
import { notifyUser } from '../lib/notifyUser';

const router = Router();
const prisma = new PrismaClient();

// Helper to get io and emit proctor actions via REST (for non-socket clients)
async function emitProctorAction(
  targetUserId: string,
  contestId: string,
  action: string,
  extra?: Record<string, unknown>
) {
  try {
    const { io } = await import('../app');
    const room = `user:${targetUserId}:contest:${contestId}`;
    io.of('/quiz-timer').to(room).emit('proctor:action', { action, contestId, ...extra });
  } catch (e) {
    // io may not be available in all contexts — non-fatal
    console.warn('[proctorRoutes] Could not emit socket event:', e);
  }
}

// GET /api/proctor/live/:contestId — Invigilator live feed
router.get('/live/:contestId', authenticateToken, async (req, res) => {
  try {
    const { contestId } = req.params;
    const contest = await prisma.contest.findUnique({
      where: { id: contestId },
      include: {
        registrations: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    if (!contest) {
      return res.status(404).json({ success: false, error: 'Contest not found' });
    }

    const proctorLogs = await prisma.proctoringLog.findMany({
      where: { contestId },
      orderBy: { timestamp: 'desc' },
      take: 100,
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    res.json({
      success: true,
      contest: {
        id: contest.id,
        title: contest.title,
        duration: contest.duration,
        maxWarnings: contest.maxWarnings,
      },
      participants: contest.registrations.map((r) => ({
        id: r.id,
        userId: r.userId,
        user: r.user,
        score: r.score,
        status: r.status,
        penalty: r.penalty,
      })),
      liveLogs: proctorLogs,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/proctor/block — Block a candidate (pauses their exam screen)
router.post('/block', authenticateToken, async (req, res) => {
  try {
    const { candidateId, contestId, reason } = req.body;
    if (!candidateId || !contestId) {
      return res.status(400).json({ success: false, error: 'candidateId and contestId are required' });
    }

    // Update DB status
    await prisma.contestRegistration.updateMany({
      where: { contestId, userId: candidateId },
      data: { status: 'BLOCKED' },
    });

    const log = await prisma.proctoringLog.create({
      data: {
        userId: candidateId,
        contestId,
        eventType: 'PROCTOR_BLOCK',
        details: reason || 'Proctor blocked the student.',
      },
    });

    // Push via Socket.IO
    await emitProctorAction(candidateId, contestId, 'BLOCKED', {
      reason: reason || 'Your exam has been paused by the invigilator. Please wait.',
    });

    // Push via SSE notification
    await notifyUser(candidateId, {
      title: '⛔ Exam Paused by Invigilator',
      message: reason || 'Your exam has been paused. Please wait for instructions.',
      type: 'PROCTOR_ACTION',
      referenceId: contestId,
    });

    res.json({ success: true, log });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// POST /api/proctor/unblock — Unblock a candidate (resumes their exam)
router.post('/unblock', authenticateToken, async (req, res) => {
  try {
    const { candidateId, contestId } = req.body;
    if (!candidateId || !contestId) {
      return res.status(400).json({ success: false, error: 'candidateId and contestId are required' });
    }

    // Restore to ACTIVE
    await prisma.contestRegistration.updateMany({
      where: { contestId, userId: candidateId, status: 'BLOCKED' },
      data: { status: 'ACTIVE' },
    });

    const log = await prisma.proctoringLog.create({
      data: {
        userId: candidateId,
        contestId,
        eventType: 'PROCTOR_UNBLOCK',
        details: 'Proctor unblocked the student — exam resumed.',
      },
    });

    await emitProctorAction(candidateId, contestId, 'UNBLOCKED');

    await notifyUser(candidateId, {
      title: '✅ Exam Resumed',
      message: 'Your exam has been resumed by the invigilator. You may continue.',
      type: 'PROCTOR_ACTION',
      referenceId: contestId,
    });

    res.json({ success: true, log });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// POST /api/proctor/warn — Send a live warning toast to student (no block)
router.post('/warn', authenticateToken, async (req, res) => {
  try {
    const { candidateId, contestId, message } = req.body;
    if (!candidateId || !contestId) {
      return res.status(400).json({ success: false, error: 'candidateId and contestId are required' });
    }

    const log = await prisma.proctoringLog.create({
      data: {
        userId: candidateId,
        contestId,
        eventType: 'PROCTOR_WARNING',
        details: message || 'Proctor issued a live warning.',
      },
    });

    await emitProctorAction(candidateId, contestId, 'WARNED', {
      message: message || 'You have received a warning from the invigilator. Please follow exam rules.',
    });

    await notifyUser(candidateId, {
      title: '⚠️ Invigilator Warning',
      message: message || 'You have received a warning from the invigilator.',
      type: 'WARNING',
      referenceId: contestId,
    });

    res.json({ success: true, log });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// POST /api/proctor/terminate — Disqualify a candidate permanently
router.post('/terminate', authenticateToken, async (req, res) => {
  try {
    const { candidateId, contestId, reason } = req.body;
    if (!candidateId || !contestId) {
      return res.status(400).json({ success: false, error: 'candidateId and contestId are required' });
    }

    await prisma.contestRegistration.updateMany({
      where: { contestId, userId: candidateId },
      data: { status: 'DISQUALIFIED' },
    });

    const log = await prisma.proctoringLog.create({
      data: {
        userId: candidateId,
        contestId,
        eventType: 'ESCALATED_FOR_DISQUALIFICATION',
        details: `Proctor terminated: ${reason || 'No reason provided'}`,
      },
    });

    await emitProctorAction(candidateId, contestId, 'TERMINATED', {
      reason: reason || 'You have been disqualified from this exam.',
    });

    await notifyUser(candidateId, {
      title: '🚫 Exam Terminated',
      message: reason || 'You have been disqualified from this exam by the invigilator.',
      type: 'PROCTOR_ACTION',
      referenceId: contestId,
    });

    res.json({ success: true, log });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// POST /api/proctor/nudge — Legacy: Send candidate warning/nudge
router.post('/nudge', authenticateToken, async (req, res) => {
  try {
    const { candidateId, contestId, message } = req.body;
    const log = await prisma.proctoringLog.create({
      data: {
        userId: candidateId,
        contestId,
        eventType: 'PROCTOR_NUDGE',
        details: message || 'Proctor issued a live warning nudge to candidate.',
      },
    });
    await emitProctorAction(candidateId, contestId, 'WARNED', {
      message: message || 'The invigilator has sent you a message.',
    });
    res.json({ success: true, log });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// POST /api/proctor/escalate — Escalate candidate for disqualification to ORG_ADMIN
router.post('/escalate', authenticateToken, async (req, res) => {
  try {
    const { candidateId, contestId, reason } = req.body;
    const log = await prisma.proctoringLog.create({
      data: {
        userId: candidateId,
        contestId,
        eventType: 'ESCALATED_FOR_DISQUALIFICATION',
        details: `Proctor escalated candidate for disqualification: ${reason}`,
      },
    });
    res.json({ success: true, log, status: 'ESCALATED_TO_ADMIN' });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// GET /api/proctor/plagiarism/:contestId — Plagiarism reports for contest
router.get('/plagiarism/:contestId', authenticateToken, async (req, res) => {
  try {
    const { contestId } = req.params;
    const reports = await prisma.plagiarismReport.findMany({
      where: { contestId },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, reports });
  } catch (error: any) {
    // If plagiarism table not found, return empty
    res.json({ success: true, reports: [] });
  }
});

export default router;
