import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticateToken } from '../middlewares/auth';

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

// GET /api/contests/manager/:id — Fetch single contest details
router.get('/:id', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
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

    res.json({ contest });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch contest details' });
  }
});

export default router;