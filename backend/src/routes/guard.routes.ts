import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticateToken } from '../middlewares/auth';

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

    // Check warning threshold
    const warningCount = await prisma.proctoringLog.count({
      where: { contestId, userId },
    });

    const contest = await prisma.contest.findUnique({
      where: { id: contestId },
      select: { maxWarnings: true },
    });

    const maxWarnings = contest?.maxWarnings || 3;
    const isDisqualified = warningCount >= maxWarnings;

    if (isDisqualified) {
      await prisma.contestRegistration.updateMany({
        where: { contestId, userId },
        data: { status: 'DISQUALIFIED' },
      });
    }

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
      user: { fullName: l.user.name, email: l.user.email },
    }));

    res.json({ logs: formattedLogs });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch proctoring logs' });
  }
});

export default router;
