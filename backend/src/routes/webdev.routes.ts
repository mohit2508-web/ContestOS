import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticateToken } from '../middlewares/auth';
import { evaluateWebDev } from '../services/webDevEvaluator';

const router = Router();

function toSubmissionStatus(evaluation: { summary: { failed: number } }): string {
  return evaluation.summary.failed === 0 ? 'ACCEPTED' : 'WRONG_ANSWER';
}

// POST /api/webdev/evaluate — Run candidate HTML/CSS/JS against visible test cases
router.post('/evaluate', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { htmlCode, cssCode, jsCode, problemId } = req.body;

    if (htmlCode === undefined && cssCode === undefined && jsCode === undefined) {
      res.status(400).json({ error: 'htmlCode, cssCode, or jsCode is required' });
      return;
    }

    if (!problemId) {
      res.status(400).json({ error: 'problemId is required' });
      return;
    }

    const problem = await prisma.problem.findUnique({
      where: { id: problemId },
      include: { testCases: { orderBy: { order: 'asc' } } },
    });

    if (!problem) {
      res.status(404).json({ error: 'Problem not found' });
      return;
    }

    const visibleTestCases = (problem.testCases || []).filter((tc) => !tc.isHidden);

    const evaluation = await evaluateWebDev({
      html: htmlCode || '',
      css: cssCode || '',
      js: jsCode || '',
      testCases: visibleTestCases.map((tc) => ({
        id: tc.id,
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        isHidden: false,
      })),
    });

    res.json({
      success: evaluation.success,
      results: evaluation.results,
      summary: evaluation.summary,
      rubric: evaluation.rubric,
      consoleLogs: evaluation.consoleLogs,
      errors: evaluation.errors,
      executionTime: evaluation.executionTime,
    });
  } catch (error: any) {
    console.error('Web evaluation error:', error);
    res.status(500).json({ error: 'Failed to evaluate web submission', details: error.message });
  }
});

// POST /api/webdev/submit — Evaluate against all test cases & persist Submission
router.post('/submit', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { htmlCode, cssCode, jsCode, problemId, contestId } = req.body;

    if (!problemId) {
      res.status(400).json({ error: 'problemId is required' });
      return;
    }
    if (htmlCode === undefined && cssCode === undefined && jsCode === undefined) {
      res.status(400).json({ error: 'htmlCode, cssCode, or jsCode is required' });
      return;
    }

    const problem = await prisma.problem.findUnique({
      where: { id: problemId },
      include: { testCases: { orderBy: { order: 'asc' } } },
    });

    if (!problem) {
      res.status(404).json({ error: 'Problem not found' });
      return;
    }

    const evaluation = await evaluateWebDev({
      html: htmlCode || '',
      css: cssCode || '',
      js: jsCode || '',
      testCases: (problem.testCases || []).map((tc) => ({
        id: tc.id,
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        isHidden: tc.isHidden,
      })),
    });

    const submission = await prisma.submission.create({
      data: {
        userId,
        problemId,
        contestId: contestId || null,
        code: JSON.stringify({ html: htmlCode || '', css: cssCode || '', js: jsCode || '' }),
        language: 'web-dev',
        status: toSubmissionStatus(evaluation) as any,
        executionTime: evaluation.executionTime,
        memoryUsed: 128,
        score: evaluation.rubric.total,
        testResults: evaluation.results as any,
      },
    });

    // If part of a contest, upsert candidate's score in ContestRegistration
    if (contestId) {
      const contestProblem = await prisma.contestProblem.findUnique({
        where: { contestId_problemId: { contestId, problemId } },
      });
      const maxPoints = contestProblem?.points || 100;
      const earnedPoints =
        evaluation.summary.failed === 0
          ? maxPoints
          : evaluation.summary.total > 0
            ? Math.round((evaluation.summary.passed / evaluation.summary.total) * maxPoints)
            : 0;

      if (earnedPoints > 0) {
        const existingBest = await prisma.submission.findFirst({
          where: {
            contestId,
            problemId,
            userId,
            status: { in: ['ACCEPTED', 'WRONG_ANSWER', 'RUNTIME_ERROR', 'TIME_LIMIT_EXCEEDED'] },
          },
          orderBy: { score: 'desc' },
        });
        const prevBestPoints = existingBest?.score || 0;
        const pointsDelta = Math.max(0, earnedPoints - prevBestPoints);

        if (pointsDelta > 0) {
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

    res.json({
      success: evaluation.success,
      evaluation: {
        results: evaluation.results,
        summary: evaluation.summary,
        rubric: evaluation.rubric,
        consoleLogs: evaluation.consoleLogs,
        errors: evaluation.errors,
      },
      submission,
    });
  } catch (error: any) {
    console.error('Web submission error:', error);
    res.status(500).json({ error: 'Failed to submit web solution', details: error.message });
  }
});

export default router;
