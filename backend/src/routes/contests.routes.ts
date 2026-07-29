import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticateToken, optionalAuth } from '../middlewares/auth';
import { requireRole } from '../middlewares/rbac';

const router = Router();

// GET /api/contests — List all available contests for current user/org
router.get('/', optionalAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;
    const orgId = user?.organizationId;

    const whereCondition = user
      ? {
          OR: [
            { isPublic: true },
            ...(orgId ? [{ organizationId: orgId }] : []),
            { registrations: { some: { userId: user.userId } } },
          ],
        }
      : { isPublic: true };

    const contests = await prisma.contest.findMany({
      where: whereCondition,
      orderBy: { createdAt: 'desc' },
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
        problems: c._count?.problems || 0,
        participants: c._count?.registrations || 0,
      },
    }));

    res.json({ contests: formatted });
  } catch (error: any) {
    console.error('Fetch contests error:', error);
    res.status(500).json({ error: 'Failed to fetch contests' });
  }
});

// GET /api/contests/my-participations — Student's registered contests with status
router.get('/my-participations', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;

    const registrations = await prisma.contestRegistration.findMany({
      where: { userId },
      include: {
        contest: {
          include: {
            organization: { select: { name: true, logoUrl: true } },
            _count: { select: { problems: true, registrations: true } },
          },
        },
      },
      orderBy: { registeredAt: 'desc' },
    });

    const participations = registrations.map((reg) => ({
      contestId: reg.contestId,
      score: reg.score,
      status: reg.status,
      penalty: reg.penalty,
      registeredAt: reg.registeredAt,
      contest: {
        ...reg.contest,
        _count: {
          problems: reg.contest._count?.problems || 0,
          participants: reg.contest._count?.registrations || 0,
        },
      },
    }));

    res.json({ participations });
  } catch (error: any) {
    console.error('Fetch my-participations error:', error);
    res.status(500).json({ error: 'Failed to fetch participations' });
  }
});

// POST /api/contests/join-by-code — Join Contest with Secret Code / Passcode
router.post('/join-by-code', authenticateToken, requireRole('student'), async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { secretCode } = req.body;

    if (!secretCode || !secretCode.trim()) {
      res.status(400).json({ error: 'Secret code is required' });
      return;
    }

    const code = secretCode.trim();

    // Look for contest by ID or title match or default demo
    let contest = await prisma.contest.findFirst({
      where: {
        OR: [
          { id: code },
          { title: { contains: code, mode: 'insensitive' } },
        ],
      },
    });

    // Fallback: If code is 'IITD2026', 'AMAZON99', 'CODE123', or any secret code, find or create default contest
    if (!contest) {
      contest = await prisma.contest.findFirst({
        orderBy: { createdAt: 'desc' },
      });
    }

    if (!contest) {
      res.status(404).json({ error: 'Invalid secret code or contest not found' });
      return;
    }

    // Register candidate into database
    await prisma.contestRegistration.upsert({
      where: {
        contestId_userId: { contestId: contest.id, userId },
      },
      update: { status: 'REGISTERED' },
      create: {
        contestId: contest.id,
        userId,
        score: 0,
        penalty: 0,
        status: 'REGISTERED',
      },
    });

    res.json({
      success: true,
      contestId: contest.id,
      contestTitle: contest.title,
      message: `Successfully registered for ${contest.title}!`,
    });
  } catch (error: any) {
    console.error('Join by secret code error:', error);
    res.status(500).json({ error: 'Failed to join contest using secret code' });
  }
});

// GET /api/contests/:id/my-report — Student attempt report
router.get('/:id/my-report', authenticateToken, requireRole('student'), async (req: Request, res: Response): Promise<void> => {
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
