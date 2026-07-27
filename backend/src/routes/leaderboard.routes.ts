import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';

const router = Router();

// GET /api/leaderboard — Global ContestOS Leaderboard
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = Number(req.query.limit) || 50;

    const registrations = await prisma.contestRegistration.findMany({
      take: limit,
      orderBy: [
        { score: 'desc' },
        { penalty: 'asc' },
      ],
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        contest: {
          select: {
            title: true,
          },
        },
      },
    });

    const leaderboard = registrations.map((reg, index) => ({
      rank: index + 1,
      id: reg.id,
      userId: reg.userId,
      name: reg.user.name,
      email: reg.user.email,
      score: reg.score,
      penalty: reg.penalty,
      contestTitle: reg.contest?.title || 'General',
      status: reg.status,
    }));

    res.json({ leaderboard });
  } catch (error: any) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// GET /api/leaderboard/contest/:contestId — Contest-specific Live Leaderboard
router.get('/contest/:contestId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { contestId } = req.params;

    const participants = await prisma.contestRegistration.findMany({
      where: { contestId },
      orderBy: [
        { score: 'desc' },
        { penalty: 'asc' },
      ],
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    const leaderboard = participants.map((p, index) => ({
      rank: index + 1,
      userId: p.userId,
      user: {
        id: p.user.id,
        fullName: p.user.name,
        email: p.user.email,
      },
      score: p.score,
      penalty: p.penalty,
      solvedCount: Math.floor(p.score / 100),
      status: p.status,
    }));

    res.json({ leaderboard });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch contest leaderboard' });
  }
});

export default router;
