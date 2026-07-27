import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticateToken } from '../middlewares/auth';
import { evaluateCodeSubmission } from '../services/languageAdapter';



const router = Router();

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

    // If part of a contest, update candidate's total score in ContestRegistration
    if (contestId && evalResult.status === 'ACCEPTED') {
      const contestProblem = await prisma.contestProblem.findUnique({
        where: { contestId_problemId: { contestId, problemId } },
      });
      const points = contestProblem?.points || 100;

      await prisma.contestRegistration.updateMany({
        where: { contestId, userId },
        data: {
          score: { increment: points },
          status: 'IN_PROGRESS',
        },
      });
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
