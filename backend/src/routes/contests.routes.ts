import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticateToken } from '../middlewares/auth';

const router = Router();

// GET /api/contests — List all public contests
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const contests = await prisma.contest.findMany({
      where: { isPublic: true },
      orderBy: { startTime: 'desc' },
      include: {
        organization: {
          select: { name: true, logoUrl: true },
        },
        _count: {
          select: {
            problems: true,
            registrations: true,
          },
        },
      },
    });

    const formatted = contests.map((c) => ({
      ...c,
      _count: {
        problems: c._count.problems,
        participants: c._count.registrations,
      },
    }));

    res.json({ contests: formatted });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch contests' });
  }
});

// GET /api/contests/:id/my-report — Student attempt report
router.get('/:id/my-report', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const contestId = req.params.id;

    const participant = await prisma.contestRegistration.findUnique({
      where: { contestId_userId: { contestId, userId } },
    });

    const submissions = await prisma.submission.findMany({
      where: { contestId, userId },
      orderBy: { submittedAt: 'desc' },
    });

    const warnings = await prisma.proctoringLog.count({
      where: { contestId, userId },
    });

    res.json({
      participant: {
        ...participant,
        warnings,
        isTerminated: participant?.status === 'DISQUALIFIED',
      },
      submissions,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch contest report' });
  }
});

export default router;
