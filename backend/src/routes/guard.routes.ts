import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticateToken } from '../middlewares/auth';
import { requireRole } from '../middlewares/rbac';

const router = Router();

// POST /api/guard/log — Log security proctoring event (Tab switch, Fullscreen exit, Webcam warning)
router.post('/log', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { contestId, eventType, details } = req.body;

    if (!contestId || !eventType) {
      res.status(400).json({ error: 'contestId and eventType are required' });
      return;
    }

    // Record proctoring log
    const log = await prisma.proctoringLog.create({
      data: {
        contestId,
        userId,
        eventType,
        details: typeof details === 'string' ? details : JSON.stringify(details || {}),
      },
    });

    const VIOLATION_EVENTS = [
      'TAB_SWITCH',
      'FULLSCREEN_EXIT',
      'COPY_PASTE_ATTEMPT',
      'SCREENSHOT_ATTEMPT',
      'DEVTOOLS_OPENED',
      'VOICE_TALKING_DETECTED',
      'FACE_MULTIPLE_DETECTED',
      'FACE_MISSING_DETECTED',
      'PROCTOR_WARNING',
    ];

    // Count only actual security violation events towards the warning threshold
    const warningCount = await prisma.proctoringLog.count({
      where: {
        contestId,
        userId,
        eventType: { in: VIOLATION_EVENTS },
      },
    });

    const contest = await prisma.contest.findUnique({
      where: { id: contestId },
      select: { maxWarnings: true },
    });

    const maxWarnings = contest?.maxWarnings || 3;
    const isDisqualified = warningCount >= maxWarnings;

    try {
      await prisma.contestRegistration.updateMany({
        where: { contestId, userId },
        data: {
          penalty: warningCount,
          ...(isDisqualified ? { status: 'DISQUALIFIED' } : {}),
        },
      });
    } catch (_e) {}

    res.json({
      success: true,
      logId: log.id,
      warningCount,
      maxWarnings,
      isDisqualified,
    });
  } catch (error: any) {
    console.error('Guard log error:', error);
    res.status(500).json({ error: 'Failed to record proctoring log' });
  }
});

// GET /api/guard/logs/:contestId — Fetch proctoring logs for a contest (Teacher / Admin)
router.get('/logs/:contestId', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { contestId } = req.params;

    const logs = await prisma.proctoringLog.findMany({
      where: { contestId },
      orderBy: { timestamp: 'desc' },
      take: 100,
      include: {
        user: {
          select: { name: true, email: true },
        },
      },
    });

    const formattedLogs = logs.map((l) => ({
      id: l.id,
      userId: l.userId,
      eventType: l.eventType,
      description: l.details,
      createdAt: l.timestamp,
      user: {
        fullName: l.user && l.user.name ? l.user.name : (l.user && l.user.email ? l.user.email.split('@')[0] : 'System Candidate'),
        email: l.user && l.user.email ? l.user.email : 'candidate@contestos.org',
      },
    }));

    res.json({ logs: formattedLogs });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch proctoring logs' });
  }
});

export default router;
