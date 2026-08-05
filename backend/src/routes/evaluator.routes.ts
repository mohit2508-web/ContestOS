import { Router } from 'express';
import prisma from '../lib/prisma';
import { authenticateToken } from '../middlewares/auth';
import { requireRole } from '../middlewares/rbac';

const router = Router();

router.use(authenticateToken, requireRole('super_admin', 'org_admin', 'evaluator'));

router.get('/assigned-submissions', async (req, res) => {
  try {
    const { contestId, page = '1', limit = '20' } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const userRole = String(req.user!.role || '').toUpperCase();
    const isEvaluator = userRole === 'EVALUATOR';

    const where: any = {};
    if (contestId) where.contestId = contestId;

    if (isEvaluator) {
      const assignedContests = await prisma.contestAssignment.findMany({
        where: { userId: req.user!.userId, role: 'EVALUATOR' },
        select: { contestId: true },
      });
      where.contestId = { in: assignedContests.map((a: { contestId: string }) => a.contestId) };
    } else if (userRole === 'ORG_ADMIN' || userRole === 'SUPER_ADMIN') {
      if ((req.user!.hierarchyLevel || 5) > 1 && req.user!.organizationId) {
        where.contest = { organizationId: req.user!.organizationId };
      }
    }

    const [submissions, total] = await Promise.all([
      prisma.submission.findMany({
        where,
        skip,
        take: Number(limit),
        select: {
          id: true, code: true, language: true, status: true, score: true,
          evaluationComments: true, evaluatedAt: true, submittedAt: true,
          contest: { select: { id: true, title: true } },
          problem: { select: { id: true, title: true, difficulty: true } },
          ...(isEvaluator
            ? {}
            : { user: { select: { id: true, name: true, email: true } } }),
        },
        orderBy: { submittedAt: 'desc' },
      }),
      prisma.submission.count({ where }),
    ]);

    const formattedSubmissions = submissions.map((sub: any) => ({
      id: sub.id,
      anonymousId: `SUB-${sub.id.substring(0, 8).toUpperCase()}`,
      problemTitle: sub.problem?.title || 'Untitled Problem',
      difficulty: sub.problem?.difficulty || 'Medium',
      language: sub.language,
      code: sub.code,
      submittedAt: sub.submittedAt,
      status: sub.evaluatedAt ? 'GRADED' : 'PENDING',
      score: sub.score,
      comments: sub.evaluationComments,
      contestTitle: sub.contest?.title || 'Untitled Contest',
      contestId: sub.contest?.id || '',
      ...(isEvaluator ? {} : { user: sub.user }),
    }));

    res.json({
      submissions: formattedSubmissions,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
    });
  } catch (error) {
    console.error('Fetch evaluator submissions error:', error);
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
});

router.post('/:id/score', async (req, res) => {
  try {
    const { score, comments } = req.body;

    if (score === undefined || score < 0) {
      return res.status(400).json({ error: 'Valid score required' });
    }

    const submission = await prisma.submission.update({
      where: { id: req.params.id },
      data: {
        score: Number(score),
        evaluationComments: comments || null,
        evaluatedById: req.user!.userId,
        evaluatedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'SUBMISSION_GRADE',
        resource: 'submission',
        resourceId: submission.id,
        details: { score, comments },
      },
    });

    res.json({ submission });
  } catch (error) {
    res.status(500).json({ error: 'Failed to score submission' });
  }
});

// POST /api/evaluator/:id/signoff - ORG_ADMIN Sign-off and Final Result Approval
router.post('/:id/signoff', async (req, res) => {
  try {
    const userRole = String(req.user!.role || '').toUpperCase();
    if (userRole !== 'ORG_ADMIN' && userRole !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Only ORG_ADMIN or SUPER_ADMIN can sign-off and finalize evaluator scores.' });
    }

    const submission = await prisma.submission.update({
      where: { id: req.params.id },
      data: {
        evaluatedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'ADMIN_RESULT_SIGNOFF',
        resource: 'submission',
        resourceId: submission.id,
        details: { approvedBy: req.user!.userId, approvedAt: new Date() },
      },
    });

    res.json({ success: true, submission, status: 'RESULT_APPROVED_BY_ADMIN' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to signoff submission score' });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const userRole = String(req.user!.role || '').toUpperCase();
    let contestIds: string[] = [];

    if (userRole === 'EVALUATOR') {
      const assignedContests = await prisma.contestAssignment.findMany({
        where: { userId: req.user!.userId, role: 'EVALUATOR' },
        select: { contestId: true },
      });
      contestIds = assignedContests.map((a: { contestId: string }) => a.contestId);
    } else {
      const whereContest: any = {};
      if ((req.user!.hierarchyLevel || 5) > 1 && req.user!.organizationId) {
        whereContest.organizationId = req.user!.organizationId;
      }
      const contests = await prisma.contest.findMany({
        where: whereContest,
        select: { id: true },
      });
      contestIds = contests.map((c: { id: string }) => c.id);
    }

    const whereSub: any = contestIds.length > 0 ? { contestId: { in: contestIds } } : { id: 'none' };

    const [totalSubmissions, gradedSubmissions, pendingSubmissions] = await Promise.all([
      prisma.submission.count({ where: whereSub }),
      prisma.submission.count({ where: { ...whereSub, evaluatedAt: { not: null } } }),
      prisma.submission.count({ where: { ...whereSub, evaluatedAt: null } }),
    ]);

    res.json({
      stats: {
        assignedContests: contestIds.length,
        totalSubmissions,
        gradedSubmissions,
        pendingSubmissions,
      },
    });
  } catch (error) {
    console.error('Fetch evaluator stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;
