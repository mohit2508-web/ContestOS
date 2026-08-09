import { Router } from 'express';
import prisma from '../lib/prisma';
import { authenticateToken } from '../middlewares/auth';
import { requireRole } from '../middlewares/rbac';

const router = Router();

router.use(authenticateToken, requireRole('super_admin', 'org_admin', 'evaluator', 'contest_moderator'));

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
      const cIds = assignedContests.map((a: { contestId: string }) => a.contestId);
      where.contestId = { in: cIds.length > 0 ? cIds : ['none'] };
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
      data: { score: Number(score), evaluationComments: comments || null, evaluatedById: req.user!.userId, evaluatedAt: new Date() },
    });
    await prisma.auditLog.create({
      data: { userId: req.user!.userId, action: 'SUBMISSION_GRADE', resource: 'submission', resourceId: submission.id, details: { score, comments } },
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
    const submission = await prisma.submission.update({ where: { id: req.params.id }, data: { evaluatedAt: new Date() } });
    await prisma.auditLog.create({
      data: { userId: req.user!.userId, action: 'ADMIN_RESULT_SIGNOFF', resource: 'submission', resourceId: submission.id, details: { approvedBy: req.user!.userId, approvedAt: new Date() } },
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
      const assignedContests = await prisma.contestAssignment.findMany({ where: { userId: req.user!.userId, role: 'EVALUATOR' }, select: { contestId: true } });
      contestIds = assignedContests.map((a: { contestId: string }) => a.contestId);
    } else {
      const whereContest: any = {};
      if ((req.user!.hierarchyLevel || 5) > 1 && req.user!.organizationId) whereContest.organizationId = req.user!.organizationId;
      const contests = await prisma.contest.findMany({ where: whereContest, select: { id: true } });
      contestIds = contests.map((c: { id: string }) => c.id);
    }
    const whereSub: any = contestIds.length > 0 ? { contestId: { in: contestIds } } : { id: 'none' };
    const [totalSubmissions, gradedSubmissions, pendingSubmissions] = await Promise.all([
      prisma.submission.count({ where: whereSub }),
      prisma.submission.count({ where: { ...whereSub, evaluatedAt: { not: null } } }),
      prisma.submission.count({ where: { ...whereSub, evaluatedAt: null } }),
    ]);
    res.json({ stats: { assignedContests: contestIds.length, totalSubmissions, gradedSubmissions, pendingSubmissions } });
  } catch (error) {
    console.error('Fetch evaluator stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// CONTEST_MODERATOR ENDPOINTS — Grade approval, override & final publishing
// ═══════════════════════════════════════════════════════════════════════════════
const MODERATOR_ROLES = ['contest_moderator', 'org_admin', 'super_admin'];

// GET /api/evaluator/moderator/contests — Contests assigned to this moderator
router.get('/moderator/contests', requireRole(...MODERATOR_ROLES), async (req, res) => {
  try {
    const userId = req.user!.userId;
    const userRole = String(req.user!.role || '').toUpperCase();
    let contests: any[];
    if (userRole === 'CONTEST_MODERATOR') {
      try {
        const assignments = await (prisma as any).contestModerationAssignment.findMany({
          where: { moderatorId: userId },
          include: { contest: { select: { id: true, title: true, startTime: true, endTime: true, _count: { select: { submissions: true } } } } },
        });
        contests = assignments.map((a: any) => a.contest);
      } catch (e) {
        contests = [];
      }
      if (contests.length === 0) {
        let orgId = req.user!.organizationId;
        if (!orgId) {
          const dbUser = await prisma.user.findUnique({ where: { id: userId }, select: { organizationId: true } });
          orgId = dbUser?.organizationId || null;
        }
        const where: any = orgId ? { organizationId: orgId } : {};
        contests = await prisma.contest.findMany({
          where,
          select: { id: true, title: true, startTime: true, endTime: true, _count: { select: { submissions: true } } },
          orderBy: { startTime: 'desc' }, take: 50,
        });
      }
    } else {
      contests = await prisma.contest.findMany({
        where: req.user!.hierarchyLevel > 1 ? { organizationId: req.user!.organizationId! } : {},
        select: { id: true, title: true, startTime: true, endTime: true, _count: { select: { submissions: true } } },
        orderBy: { startTime: 'desc' }, take: 50,
      });
    }
    res.json({ contests });
  } catch (err) {
    console.error('Moderator contests error:', err);
    res.status(500).json({ error: 'Failed to fetch moderator contests' });
  }
});

// GET /api/evaluator/moderator/contests/:id/evaluations — All graded submissions
router.get('/moderator/contests/:id/evaluations', requireRole(...MODERATOR_ROLES), async (req, res) => {
  try {
    const { id: contestId } = req.params;
    const { status } = req.query;
    const where: any = { contestId };
    if (status === 'GRADED') where.evaluatedAt = { not: null };
    if (status === 'PENDING') where.evaluatedAt = null;
    const submissions = await prisma.submission.findMany({
      where, select: {
        id: true, score: true, evaluationComments: true, evaluatedAt: true, submittedAt: true, language: true,
        user: { select: { name: true, email: true } },
        problem: { select: { title: true, difficulty: true } },
        evaluatedBy: { select: { name: true } },
      },
      orderBy: { submittedAt: 'desc' },
    });
    res.json({ submissions: submissions.map(s => ({ ...s, moderationStatus: s.evaluatedAt ? 'GRADED' : 'PENDING' })), total: submissions.length });
  } catch (err) {
    console.error('Moderator evaluations error:', err);
    res.status(500).json({ error: 'Failed to fetch evaluations' });
  }
});

// PUT /api/evaluator/moderator/:id/approve — Approve evaluator grade
router.put('/moderator/:id/approve', requireRole(...MODERATOR_ROLES), async (req, res) => {
  try {
    const updated = await prisma.submission.update({ where: { id: req.params.id }, data: { evaluatedAt: new Date() } });
    await prisma.auditLog.create({ data: { userId: req.user!.userId, action: 'MODERATOR_APPROVE_GRADE', resource: 'submission', resourceId: req.params.id, details: { approvedScore: updated.score } } });
    res.json({ success: true, submission: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to approve grade' });
  }
});

// PUT /api/evaluator/moderator/:id/override — Override grade with mandatory reason
router.put('/moderator/:id/override', requireRole(...MODERATOR_ROLES), async (req, res) => {
  try {
    const { newScore, moderationReason } = req.body;
    if (newScore === undefined || !moderationReason) return res.status(400).json({ error: 'newScore and moderationReason are required' });
    const original = await prisma.submission.findUnique({ where: { id: req.params.id }, select: { score: true } });
    const updated = await prisma.submission.update({ where: { id: req.params.id }, data: { score: Number(newScore), evaluationComments: moderationReason, evaluatedAt: new Date() } });
    await prisma.auditLog.create({ data: { userId: req.user!.userId, action: 'MODERATOR_OVERRIDE_GRADE', resource: 'submission', resourceId: req.params.id, details: { originalScore: original?.score, newScore, moderationReason } } });
    res.json({ success: true, submission: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to override grade' });
  }
});

// PUT /api/evaluator/moderator/:id/rereview — Send back to evaluator
router.put('/moderator/:id/rereview', requireRole(...MODERATOR_ROLES), async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ error: 'reason is required' });
    const updated = await prisma.submission.update({ where: { id: req.params.id }, data: { evaluatedAt: null, evaluationComments: `[RE-REVIEW REQUESTED] ${reason}`, evaluatedById: null } });
    await prisma.auditLog.create({ data: { userId: req.user!.userId, action: 'MODERATOR_REQUEST_REREVIEW', resource: 'submission', resourceId: req.params.id, details: { reason } } });
    res.json({ success: true, submission: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to request re-review' });
  }
});

// POST /api/evaluator/moderator/contests/:id/bulk-approve — 1-Click Cohort Grade Approval & Publishing
router.post('/moderator/contests/:id/bulk-approve', requireRole(...MODERATOR_ROLES), async (req, res) => {
  try {
    const { id: contestId } = req.params;
    const count = await prisma.submission.updateMany({
      where: { contestId, evaluatedAt: { not: null } },
      data: { evaluatedAt: new Date() },
    });
    await prisma.auditLog.create({
      data: { userId: req.user!.userId, action: 'MODERATOR_BULK_APPROVE_CONTEST', resource: 'contest', resourceId: contestId, details: { count: count.count } },
    });
    res.json({ success: true, approvedCount: count.count });
  } catch (err) {
    console.error('Bulk approve error:', err);
    res.status(500).json({ error: 'Failed to bulk approve contest scores' });
  }
});

// GET /api/evaluator/moderator/contests/:id/calibration — Evaluator Harshness / Leniency Consistency Metrics
router.get('/moderator/contests/:id/calibration', requireRole(...MODERATOR_ROLES), async (req, res) => {
  try {
    const { id: contestId } = req.params;
    const submissions = await prisma.submission.findMany({
      where: { contestId, evaluatedById: { not: null } },
      select: {
        score: true,
        evaluatedById: true,
        evaluatedBy: { select: { name: true, email: true } },
      },
    });

    const evalMap: Record<string, { name: string; count: number; totalScore: number; scores: number[] }> = {};
    submissions.forEach(s => {
      if (!s.evaluatedById) return;
      const key = s.evaluatedById;
      if (!evalMap[key]) {
        evalMap[key] = { name: s.evaluatedBy?.name || 'Evaluator', count: 0, totalScore: 0, scores: [] };
      }
      evalMap[key].count += 1;
      evalMap[key].totalScore += s.score;
      evalMap[key].scores.push(s.score);
    });

    const cohortScores = submissions.map(s => s.score);
    const overallAvg = cohortScores.length > 0 ? Math.round(cohortScores.reduce((a, b) => a + b, 0) / cohortScores.length) : 75;

    const evaluators = Object.keys(evalMap).map(id => {
      const item = evalMap[id];
      const avg = Math.round(item.totalScore / item.count);
      const dev = avg - overallAvg;
      const rating = dev > 10 ? 'Lenient (+)' : dev < -10 ? 'Harsh (-)' : 'Calibrated';
      return {
        evaluatorId: id,
        name: item.name,
        count: item.count,
        avgScore: avg,
        deviation: dev,
        rating,
      };
    });

    res.json({ overallAvg, totalEvaluated: submissions.length, evaluators });
  } catch (err) {
    console.error('Calibration error:', err);
    res.status(500).json({ error: 'Failed to fetch evaluator calibration' });
  }
});

// POST /api/evaluator/moderator/contests/:id/curve — Apply Grade Curve Normalization across contest
router.post('/moderator/contests/:id/curve', requireRole(...MODERATOR_ROLES), async (req, res) => {
  try {
    const { id: contestId } = req.params;
    const { curveType, value, justification } = req.body; // curveType: 'flat' | 'sqrt' | 'percentile'

    if (!curveType || value === undefined || !justification) {
      return res.status(400).json({ error: 'curveType, value, and justification are required' });
    }

    const submissions = await prisma.submission.findMany({
      where: { contestId, evaluatedAt: { not: null } },
      select: { id: true, score: true },
    });

    let updatedCount = 0;
    for (const sub of submissions) {
      let newScore = sub.score;
      if (curveType === 'flat') {
        newScore = Math.min(100, Math.max(0, sub.score + Number(value)));
      } else if (curveType === 'sqrt') {
        newScore = Math.min(100, Math.round(Math.sqrt(sub.score) * 10));
      } else if (curveType === 'percentile') {
        newScore = Math.min(100, Math.round(sub.score * (1 + Number(value) / 100)));
      }

      if (newScore !== sub.score) {
        await prisma.submission.update({
          where: { id: sub.id },
          data: { score: newScore },
        });
        updatedCount++;
      }
    }

    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'MODERATOR_GRADE_CURVE_APPLIED',
        resource: 'contest',
        resourceId: contestId,
        details: { curveType, value, justification, updatedCount },
      },
    });

    res.json({ success: true, updatedCount, curveType });
  } catch (err) {
    console.error('Grade curve error:', err);
    res.status(500).json({ error: 'Failed to apply grade curve' });
  }
});

// GET /api/evaluator/moderator/contests/:id/audit-stream — Live Moderator Activity Stream
router.get('/moderator/contests/:id/audit-stream', requireRole(...MODERATOR_ROLES), async (req, res) => {
  try {
    const { id: contestId } = req.params;
    const logs = await prisma.auditLog.findMany({
      where: {
        action: { in: ['MODERATOR_APPROVE_GRADE', 'MODERATOR_OVERRIDE_GRADE', 'MODERATOR_REQUEST_REREVIEW', 'MODERATOR_BULK_APPROVE_CONTEST', 'MODERATOR_GRADE_CURVE_APPLIED'] },
        resourceId: { in: [contestId] },
      },
      include: {
        user: { select: { name: true, email: true, role: true } },
      },
      orderBy: { timestamp: 'desc' },
      take: 20,
    });
    res.json({ logs });
  } catch (err) {
    console.error('Audit stream error:', err);
    res.status(500).json({ error: 'Failed to fetch audit stream' });
  }
});
router.post('/moderator/assign', requireRole('org_admin', 'super_admin'), async (req, res) => {
  try {
    const { contestId, moderatorId } = req.body;
    if (!contestId || !moderatorId) return res.status(400).json({ error: 'contestId and moderatorId required' });
    const moderator = await prisma.user.findUnique({ where: { id: moderatorId }, select: { role: true } });
    if (!moderator || moderator.role !== 'CONTEST_MODERATOR') return res.status(400).json({ error: 'User must have CONTEST_MODERATOR role' });
    const assignment = await (prisma as any).contestModerationAssignment.upsert({
      where: { contestId_moderatorId: { contestId, moderatorId } },
      create: { contestId, moderatorId, assignedById: req.user!.userId },
      update: {},
    });
    res.status(201).json({ assignment });
  } catch (err) {
    res.status(500).json({ error: 'Failed to assign moderator' });
  }
});

// GET /api/evaluator/moderator/contests/:id/appeals — Candidate Re-Evaluation & Appeals Queue
router.get('/moderator/contests/:id/appeals', requireRole(...MODERATOR_ROLES), async (req, res) => {
  try {
    const { id: contestId } = req.params;
    const appeals = await prisma.submission.findMany({
      where: { contestId, evaluationComments: { contains: 'APPEAL' } },
      include: {
        user: { select: { id: true, name: true, email: true } },
        problem: { select: { id: true, title: true, difficulty: true } },
        evaluatedBy: { select: { name: true } },
      },
      orderBy: { submittedAt: 'desc' },
    });
    res.json({ appeals, total: appeals.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch candidate appeals' });
  }
});

export default router;
