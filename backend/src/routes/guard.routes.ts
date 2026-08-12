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

    const maxWarnings = Number(contest?.maxWarnings) || 10;
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
        email: l.user && l.user.email ? l.user.email : 'candidate@kryptavia.org',
      },
    }));

    res.json({ logs: formattedLogs });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch proctoring logs' });
  }
});

import { generateSebConfig, verifySebHeader } from '../services/sebConfigService';

// GET /api/guard/seb-config/:contestId — Download SEB (.seb) configuration file
router.get('/seb-config/:contestId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { contestId } = req.params;
    const contest = await prisma.contest.findUnique({
      where: { id: contestId },
      select: { title: true, requireSeb: true },
    });

    const frontendUrl = process.env.FRONTEND_URL?.split(',')[0] || 'http://localhost:5173';
    const contestStartUrl = `${frontendUrl}/contests/${contestId}`;

    const sebXml = generateSebConfig({
      contestId,
      contestTitle: contest?.title || 'Kryptavia OS Exam',
      startUrl: contestStartUrl,
      allowQuit: true,
      quitPassword: 'exit-exam-pwd',
    });

    res.setHeader('Content-Type', 'application/seb');
    res.setHeader('Content-Disposition', `attachment; filename="Kryptavia_Exam_${contestId}.seb"`);
    res.send(sebXml);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to generate SEB configuration file' });
  }
});

// GET /api/guard/verify-seb — Check if current browser is Safe Exam Browser
router.get('/verify-seb', (req: Request, res: Response): void => {
  const userAgent = req.headers['user-agent'];
  const sebHeader = req.headers['x-safeexambrowser-requesthash'] as string;
  const isSeb = verifySebHeader(userAgent, sebHeader);

  res.json({
    isSeb,
    userAgent,
    message: isSeb
      ? 'Verified Safe Exam Browser connection'
      : 'Standard web browser detected — Safe Exam Browser lockdown required.',
  });
});

export default router;
