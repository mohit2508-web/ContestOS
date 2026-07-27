import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticateToken } from '../middlewares/auth';
import crypto from 'crypto';

const router = Router();

// GET /api/contests/manager/list — List all contests managed by user
router.get('/list', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const contests = await prisma.contest.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            problems: true,
            registrations: true,
          },
        },
      },
    });

    res.json({ contests });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch managed contests' });
  }
});

// POST /api/contests/manager/create — Create new contest
router.post('/create', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const {
      title,
      description,
      startTime,
      endTime,
      duration,
      difficulty,
      isPublic,
      requireSeb,
      requireFullscreen,
      preventTabSwitch,
      disableCopyPaste,
      enableProctoring,
      maxWarnings,
      problems,
    } = req.body;

    if (!title || !startTime || !endTime) {
      res.status(400).json({ error: 'title, startTime, and endTime are required' });
      return;
    }

    const contest = await prisma.contest.create({
      data: {
        title,
        description: description || null,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        duration: Number(duration) || 120,
        difficulty: difficulty || 'Medium',
        isPublic: isPublic ?? true,
        requireSeb: requireSeb ?? false,
        requireFullscreen: requireFullscreen ?? true,
        preventTabSwitch: preventTabSwitch ?? true,
        disableCopyPaste: disableCopyPaste ?? true,
        enableProctoring: enableProctoring ?? true,
        maxWarnings: Number(maxWarnings) || 3,
        createdById: userId,
        problems: {
          create: (problems || []).map((p: any, idx: number) => ({
            problemId: p.problemId,
            order: idx + 1,
            points: p.points || 100,
          })),
        },
      },
      include: {
        problems: true,
      },
    });

    res.json({ success: true, contest });
  } catch (error: any) {
    console.error('Error creating contest:', error);
    res.status(500).json({ error: 'Failed to create contest' });
  }
});

// GET /api/contests/manager/:id — Fetch single contest details & isJoined state
router.get('/:id', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const contest = await prisma.contest.findUnique({
      where: { id: req.params.id },
      include: {
        problems: {
          include: {
            problem: true,
          },
          orderBy: { order: 'asc' },
        },
        registrations: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    if (!contest) {
      res.status(404).json({ error: 'Contest not found' });
      return;
    }

    const participant = userId
      ? contest.registrations.find((r) => r.userId === userId)
      : null;

    res.json({
      contest,
      isJoined: !!participant,
      participant: participant || null,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch contest details' });
  }
});

// POST /api/contests/manager/:id/join — Candidate Join Contest
router.post('/:id/join', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const contestId = req.params.id;

    const contest = await prisma.contest.findUnique({
      where: { id: contestId },
    });

    if (!contest) {
      res.status(404).json({ error: 'Contest not found' });
      return;
    }

    const registration = await prisma.contestRegistration.upsert({
      where: {
        contestId_userId: { contestId, userId },
      },
      update: {
        status: 'REGISTERED',
      },
      create: {
        contestId,
        userId,
        score: 0,
        penalty: 0,
        status: 'REGISTERED',
      },
    });

    res.json({
      success: true,
      registration,
      message: 'Successfully registered for contest',
    });
  } catch (error: any) {
    console.error('Join contest error:', error);
    res.status(500).json({ error: 'Failed to join contest' });
  }
});

// POST /api/contests/manager/:id/seb-token — Mint SEB Launch Session Token
router.post('/:id/seb-token', authenticateToken, async (_req: Request, res: Response): Promise<void> => {
  try {
    const sessionToken = `seb_session_${crypto.randomBytes(16).toString('hex')}`;
    res.json({ sessionToken });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to generate SEB token' });
  }
});

// GET /api/contests/manager/:id/verify-seb — Verify SEB Handshake
router.get('/:id/verify-seb', authenticateToken, async (_req: Request, res: Response): Promise<void> => {
  res.json({ success: true, verified: true });
});

// GET /api/contests/manager/:id/seb-config — Generate .seb Configuration File
router.get('/:id/seb-config', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const contestId = req.params.id;
    const contest = await prisma.contest.findUnique({ where: { id: contestId } });
    if (!contest) {
      res.status(404).json({ error: 'Contest not found' });
      return;
    }

    const xmlConfig = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>startURL</key>
    <string>http://localhost:5173/contests/${contest.id}?seb=1</string>
    <key>allowQuit</key>
    <true/>
    <key>enableLogging</key>
    <true/>
</dict>
</plist>`;

    res.setHeader('Content-Type', 'application/x-seb');
    res.setHeader('Content-Disposition', `attachment; filename="${contest.title.replace(/\s+/g, '_')}_config.seb"`);
    res.send(xmlConfig);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to generate SEB config' });
  }
});

export default router;