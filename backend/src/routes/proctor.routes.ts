import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// GET /api/proctor/live/:contestId - Invigilator live feed
router.get('/live/:contestId', async (req, res) => {
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
      take: 50,
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
      })),
      liveLogs: proctorLogs,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/proctor/nudge - Send candidate warning/nudge
router.post('/nudge', async (req, res) => {
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
    res.json({ success: true, log });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// POST /api/proctor/escalate - Escalate candidate for disqualification to ORG_ADMIN
router.post('/escalate', async (req, res) => {
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

export default router;
