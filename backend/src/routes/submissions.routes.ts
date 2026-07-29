import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticateToken } from '../middlewares/auth';
import { evaluateCodeSubmission } from '../services/languageAdapter';



const router = Router();

// GET /api/submissions — Fetch submissions list
router.get('/', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { contestId, problemId } = req.query;

    const submissions = await prisma.submission.findMany({
      where: {
        userId,
        ...(contestId && { contestId: String(contestId) }),
        ...(problemId && { problemId: String(problemId) }),
      },
      orderBy: { submittedAt: 'desc' },
      take: 50,
      include: {
        problem: {
          select: { title: true, slug: true, difficulty: true },
        },
      },
    });

    res.json({ submissions });
  } catch (error: any) {
    res.json({ submissions: [] });
  }
});

// POST /api/submissions — Submit solution code
router.post('/', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { problemId, contestId, code, language } = req.body;

    if (!problemId || !code || !language) {
      res.status(400).json({ error: 'problemId, code, and language are required' });
      return;
    }

    const problem = await prisma.problem.findUnique({
      where: { id: problemId },
      include: { testCases: true },
    });

    if (!problem) {
      res.status(404).json({ error: 'Problem not found' });
      return;
    }

    // Create initial PENDING submission record
    const submission = await prisma.submission.create({
      data: {
        userId,
        problemId,
        contestId: contestId || null,
        code,
        language,
        status: 'PENDING',
      },
    });

    const isStream = req.query.stream === 'true';

    if (isStream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      if (typeof (res as any).flushHeaders === 'function') {
        (res as any).flushHeaders();
      }
    }

    // Evaluate code test cases via Codeforces-style languageAdapter
    const evalResult = await evaluateCodeSubmission({
      problemId: problem.id,
      code,
      language,
      testCases: problem.testCases.map((tc) => ({
        id: tc.id,
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        isHidden: tc.isHidden,
      })),
      referenceSolution: problem.referenceSolution,
      onProgress: (tcResult) => {
        if (isStream) {
          res.write(`data: ${JSON.stringify({ type: 'progress', result: tcResult })}\n\n`);
        }
      },
    });

    // Update submission record
    const finalSubmission = await prisma.submission.update({
      where: { id: submission.id },
      data: {
        status: evalResult.status as any,
        executionTime: evalResult.executionTime,
        memoryUsed: evalResult.memoryUsed,
        score: evalResult.score,
        testResults: evalResult.testResults as any,
      },
    });

    // If part of a contest, update/upsert candidate's score in ContestRegistration
    if (contestId) {
      const contestProblem = await prisma.contestProblem.findUnique({
        where: { contestId_problemId: { contestId, problemId } },
      });
      const maxPoints = contestProblem?.points || 100;

      // Calculate points earned: full for ACCEPTED, partial for partial/wrong
      let earnedPoints = 0;
      if (evalResult.status === 'ACCEPTED') {
        earnedPoints = maxPoints;
      } else if (evalResult.passedCount > 0 && evalResult.totalCount > 0) {
        // Partial credit proportional to passed testcases
        earnedPoints = Math.round((evalResult.passedCount / evalResult.totalCount) * maxPoints);
      }

      if (earnedPoints > 0) {
        // Get current best score for this problem from this user in this contest
        const existingBest = await prisma.submission.findFirst({
          where: { contestId, problemId, userId, status: { in: ['ACCEPTED', 'WRONG_ANSWER', 'RUNTIME_ERROR', 'TIME_LIMIT_EXCEEDED'] } },
          orderBy: { score: 'desc' },
        });
        const prevBestPoints = existingBest?.score || 0;
        const pointsDelta = Math.max(0, earnedPoints - prevBestPoints);

        if (pointsDelta > 0) {
          // Upsert ContestRegistration to ensure record exists and add only new score delta
          await prisma.contestRegistration.upsert({
            where: { contestId_userId: { contestId, userId } },
            create: {
              contestId,
              userId,
              score: earnedPoints,
              status: 'IN_PROGRESS',
              penalty: 0,
            },
            update: {
              score: { increment: pointsDelta },
              status: 'IN_PROGRESS',
            },
          });
        }
      }
    }

    if (isStream) {
      res.write(`data: ${JSON.stringify({
        type: 'done',
        status: evalResult.status === 'ACCEPTED' ? 'passed' : 'failed',
        summary: {
          passed: evalResult.passedCount,
          failed: evalResult.totalCount - evalResult.passedCount,
          total: evalResult.totalCount,
        },
        submission: finalSubmission,
        evalResult,
      })}\n\n`);
      res.end();
      return;
    }

    res.json({
      success: true,
      submission: finalSubmission,
      evalResult,
    });
  } catch (error: any) {
    console.error('Submission error:', error);
    res.status(500).json({ error: 'Failed to process submission' });
  }
});

// GET /api/submissions/my — Fetch user's submissions
router.get('/my', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { contestId, problemId } = req.query;

    const submissions = await prisma.submission.findMany({
      where: {
        userId,
        ...(contestId && { contestId: String(contestId) }),
        ...(problemId && { problemId: String(problemId) }),
      },
      orderBy: { submittedAt: 'desc' },
      take: 50,
      include: {
        problem: {
          select: { title: true, slug: true, difficulty: true },
        },
      },
    });

    res.json({ submissions });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
});

// GET /api/submissions/:id — Fetch single submission details
router.get('/:id', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const submission = await prisma.submission.findUnique({
      where: { id: req.params.id },
      include: {
        problem: {
          select: { title: true, difficulty: true },
        },
      },
    });

    if (!submission) {
      res.status(404).json({ error: 'Submission not found' });
      return;
    }

    res.json({ submission });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch submission' });
  }
});

export default router;
