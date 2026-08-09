import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticateToken } from '../middlewares/auth';
import { evaluateCodeSubmission } from '../services/languageAdapter';
import { evaluateWebDev } from '../services/webDevEvaluator';



const router = Router();

async function evaluateWebDevSubmission(
  problem: any,
  body: any,
  _res: Response
) {
  const evaluation = await evaluateWebDev({
    html: body.htmlCode || body.code || '',
    css: body.cssCode || '',
    js: body.jsCode || '',
    testCases: (problem.testCases || []).map((tc: any) => ({
      id: tc.id,
      input: tc.input,
      expectedOutput: tc.expectedOutput,
      isHidden: tc.isHidden,
    })),
  });

  return {
    status: evaluation.summary.failed === 0 ? 'ACCEPTED' : 'WRONG_ANSWER',
    score: evaluation.rubric.total,
    executionTime: evaluation.executionTime,
    memoryUsed: 128,
    testResults: evaluation.results,
    passedCount: evaluation.summary.passed,
    totalCount: evaluation.summary.total,
  };
}

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
    const isWebDev = language === 'web-dev' || language === 'web';
    const evalResult = isWebDev
      ? await evaluateWebDevSubmission(problem, req.body, res)
      : await evaluateCodeSubmission({
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

    // Fetch contest problem max points if part of a contest
    let maxPoints = 100;
    if (contestId) {
      const contestProblem = await prisma.contestProblem.findUnique({
        where: { contestId_problemId: { contestId, problemId } },
      });
      if (contestProblem?.points) {
        maxPoints = contestProblem.points;
      }
    }

    // Calculate points earned: full for ACCEPTED, partial for partial/wrong testcases
    let earnedPoints = 0;
    if (evalResult.status === 'ACCEPTED') {
      earnedPoints = maxPoints;
    } else if (evalResult.passedCount > 0 && evalResult.totalCount > 0) {
      earnedPoints = Math.round((evalResult.passedCount / evalResult.totalCount) * maxPoints);
    } else if (evalResult.score > 0) {
      earnedPoints = Math.round((evalResult.score / 100) * maxPoints);
    }

    // Update submission record with scaled earned points
    const finalSubmission = await prisma.submission.update({
      where: { id: submission.id },
      data: {
        status: evalResult.status as any,
        executionTime: evalResult.executionTime,
        memoryUsed: evalResult.memoryUsed,
        score: earnedPoints,
        testResults: evalResult.testResults as any,
      },
    });

    // If part of a contest, update/upsert candidate's score in ContestRegistration
    if (contestId && earnedPoints >= 0) {
      // Get current best score for this problem from this user in this contest
      const previousSubmissions = await prisma.submission.findMany({
        where: { contestId, problemId, userId, id: { not: submission.id } },
        select: { score: true },
      });
      const prevBestPoints = previousSubmissions.reduce((max, s) => Math.max(max, s.score || 0), 0);
      const pointsDelta = Math.max(0, earnedPoints - prevBestPoints);

      if (pointsDelta > 0 || earnedPoints > 0) {
        // Fetch all current best scores across all problems in this contest for total calculation
        const allUserSubmissions = await prisma.submission.findMany({
          where: { contestId, userId },
          select: { problemId: true, score: true, status: true },
        });

        const probBestMap = new Map<string, number>();
        allUserSubmissions.forEach((s) => {
          const cur = probBestMap.get(s.problemId) || 0;
          if (s.score > cur) probBestMap.set(s.problemId, s.score);
        });

        let totalContestScore = 0;
        probBestMap.forEach((pts) => { totalContestScore += pts; });

        await prisma.contestRegistration.upsert({
          where: { contestId_userId: { contestId, userId } },
          create: {
            contestId,
            userId,
            score: totalContestScore,
            status: 'IN_PROGRESS',
            penalty: 0,
          },
          update: {
            score: totalContestScore,
            status: 'IN_PROGRESS',
          },
        });
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
