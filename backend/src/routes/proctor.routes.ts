import { Router } from 'express';
import { PrismaClient } from '../generated/client';
import { authenticateToken } from '../middlewares/auth';
import { notifyUser } from '../lib/notifyUser';

const router = Router();
const prisma = new PrismaClient();

// Helper to get io and emit proctor actions via REST (for non-socket clients)
// Emits to BOTH room formats to ensure delivery regardless of how the client joined
async function emitProctorAction(
  targetUserId: string,
  contestId: string,
  action: string,
  extra?: Record<string, unknown>
) {
  try {
    const { io } = await import('../app');
    const roomV1 = `user:${targetUserId}:contest:${contestId}`;
    const roomV2 = `proctor:${contestId}`;
    const roomV3 = `contest:${contestId}:user:${targetUserId}`;
    const payload = { action, contestId, targetUserId, ...extra, _ts: Date.now() };
    io.of('/quiz-timer').to(roomV1).emit('proctor:action', payload);
    io.of('/quiz-timer').to(roomV2).emit('proctor:action', payload);
    io.of('/quiz-timer').to(roomV3).emit('proctor:action', payload);
    // Also emit on main namespace for fallback
    io.to(roomV1).emit('proctor:action', payload);
    console.log(`[proctor] Emitted '${action}' to userId=${targetUserId} contestId=${contestId}`);
  } catch (e) {
    console.warn('[proctorRoutes] Could not emit socket event:', e);
  }
}

// ── FIX #8: Emit proctor status change to all proctor rooms ──
async function emitProctorStatusChange(userId: string, contestId: string, newStatus: string) {
  try {
    const { io } = await import('../app');
    const payload = { userId, contestId, newStatus, _ts: Date.now() };
    io.of('/quiz-timer').to(`proctor:contest:${contestId}`).emit('proctor:candidate_status_change', payload);
    io.of('/quiz-timer').to('proctor:all').emit('proctor:candidate_status_change', payload);
  } catch (e) {
    console.warn('[proctorRoutes] Could not emit status change:', e);
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

// POST /api/proctor/seb-session-start — Log when candidate opens SEB browser
router.post('/seb-session-start', authenticateToken, async (req, res) => {
  try {
    const { contestId } = req.body;
    const userId = req.user!.userId;
    if (!contestId) return res.status(400).json({ success: false, error: 'contestId required' });

    await prisma.proctoringLog.create({
      data: {
        userId,
        contestId,
        eventType: 'SEB_SESSION_START',
        details: 'Candidate opened Safe Exam Browser and entered the secure session.',
      },
    });

    // ── FIX #3: Emit real-time seb_entry to all proctor rooms so count updates instantly ──
    try {
      const { io } = await import('../app');
      const payload = { userId, contestId, _ts: Date.now() };
      io.of('/quiz-timer').to(`proctor:contest:${contestId}`).emit('proctor:seb_entry', payload);
      io.of('/quiz-timer').to('proctor:all').emit('proctor:seb_entry', payload);
    } catch (_e) {}

    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// POST /api/proctor/action — Unified dispatcher used by ProctorConsole
// Routes to the appropriate dedicated endpoint logic + emits socket
router.post('/action', authenticateToken, async (req, res) => {
  try {
    const { action, userId: candidateId, contestId, reason, message } = req.body;
    if (!candidateId || !contestId || !action) {
      return res.status(400).json({ success: false, error: 'action, userId, contestId are required' });
    }

    let eventType = 'PROCTOR_ACTION';
    let details = reason || message || 'Proctor action issued.';
    let dbStatus: string | null = null;

    if (action === 'WARN' || action === 'warn' || action === 'issue_warning') {
      eventType = 'PROCTOR_WARNING';
      // ── FIX #6: Emit socket FIRST (< 100ms delivery), DB write runs in background ──
      emitProctorAction(candidateId, contestId, 'WARNED', { message: details });
      // Fire-and-forget notification — don't await
      notifyUser(candidateId, {
        title: '⚠️ Invigilator Warning',
        message: details,
        type: 'WARNING',
        referenceId: contestId,
      }).catch(console.error);
    } else if (action === 'PAUSE' || action === 'pause' || action === 'block') {
      eventType = 'PROCTOR_BLOCK';
      dbStatus = 'BLOCKED';
      
      const proctorUser = req.user ? await prisma.user.findUnique({ where: { id: req.user.userId }, select: { name: true } }) : null;
      const proctorName = proctorUser?.name || 'Invigilator';
      const warningLogsCount = await prisma.proctoringLog.count({ where: { contestId, userId: candidateId, eventType: 'PROCTOR_WARNING' } });
      const contestObj = await prisma.contest.findUnique({ where: { id: contestId }, select: { maxWarnings: true } });

      await emitProctorAction(candidateId, contestId, 'BLOCKED', { 
        reason: details,
        proctorName,
        warningsCount: warningLogsCount,
        maxWarnings: Number(contestObj?.maxWarnings) || 10,
      });
      await notifyUser(candidateId, {
        title: '⏸️ Exam Paused by Invigilator',
        message: details,
        type: 'PROCTOR_ACTION',
        referenceId: contestId,
      });
    } else if (action === 'RESUME' || action === 'resume' || action === 'unblock') {
      eventType = 'PROCTOR_UNBLOCK';
      dbStatus = 'ACTIVE';
      // ── FIX #8: Emit UNBLOCKED + status_change to proctor rooms instantly ──
      await emitProctorAction(candidateId, contestId, 'UNBLOCKED', {});
      emitProctorStatusChange(candidateId, contestId, 'RESUMED');
      notifyUser(candidateId, {
        title: '▶️ Exam Resumed',
        message: 'Your exam has been resumed by the invigilator.',
        type: 'PROCTOR_ACTION',
        referenceId: contestId,
      }).catch(console.error);
    } else if (action === 'ESCALATE' || action === 'escalate' || action === 'terminate') {
      eventType = 'ESCALATED_FOR_DISQUALIFICATION';
      dbStatus = 'DISQUALIFIED';
      await emitProctorAction(candidateId, contestId, 'TERMINATED', { reason: details });
      emitProctorStatusChange(candidateId, contestId, 'DISQUALIFIED');
      notifyUser(candidateId, {
        title: '🚫 Exam Terminated',
        message: details,
        type: 'PROCTOR_ACTION',
        referenceId: contestId,
      }).catch(console.error);
    } else if (action === 'SNAPSHOT' || action === 'force_snapshot') {
      eventType = 'PROCTOR_SNAPSHOT_REQUEST';
      await emitProctorAction(candidateId, contestId, 'SNAPSHOT_REQUEST', {});
    }

    // Compute SHA-256 audit integrity signature
    const crypto = await import('crypto');
    const auditRaw = `${candidateId}:${contestId}:${eventType}:${details}:${Date.now()}`;
    const auditHash = crypto.createHash('sha256').update(auditRaw).digest('hex');
    const signedDetails = `[SHA256:${auditHash.slice(0, 12)}] ${details}`;

    const log = await prisma.proctoringLog.create({
      data: { userId: candidateId, contestId, eventType, details: signedDetails },
    });

    if (dbStatus === 'BLOCKED' || dbStatus === 'DISQUALIFIED') {
      await prisma.contestRegistration.updateMany({
        where: { contestId, userId: candidateId },
        data: { status: dbStatus as any },
      });
    } else if (dbStatus === 'ACTIVE') {
      await prisma.contestRegistration.updateMany({
        where: { contestId, userId: candidateId, status: 'BLOCKED' as any },
        data: { status: 'ACTIVE' as any },
      });
    }

    res.json({ success: true, log, auditHash });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// POST /api/proctor/broadcast — Live announcement to candidate screens
router.post('/broadcast', authenticateToken, async (req, res) => {
  try {
    const { contestId, message, priority } = req.body;
    if (!message) return res.status(400).json({ success: false, error: 'message is required' });

    try {
      const { io } = await import('../app');
      const payload = { message, priority: priority || 'HIGH', contestId, _ts: Date.now() };
      io.of('/quiz-timer').emit('proctor:broadcast', payload);
    } catch (_e) {}

    res.json({ success: true, message: 'Broadcast announcement dispatched to all candidate screens.' });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

export default router;
