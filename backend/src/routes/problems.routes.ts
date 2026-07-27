import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticateToken } from '../middlewares/auth';

const router = Router();

// GET /api/problems — List all problems in Question Bank
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { category, difficulty, search } = req.query;

    const problems = await prisma.problem.findMany({
      where: {
        ...(category && category !== 'all' && { category: String(category) }),
        ...(difficulty && difficulty !== 'all' && { difficulty: String(difficulty) }),
        ...(search && {
          title: { contains: String(search) },
        }),
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        slug: true,
        difficulty: true,
        category: true,
        problemType: true,
        evaluationStrategy: true,
        createdAt: true,
      },
    });

    res.json({ problems });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch problems' });
  }
});

// GET /api/problems/:id — Fetch problem details with starter code & public testcases
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const problem = await prisma.problem.findFirst({
      where: {
        OR: [{ id: req.params.id }, { slug: req.params.id }],
      },
      include: {
        testCases: {
          where: { isHidden: false }, // Only return non-hidden example testcases to students
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!problem) {
      res.status(404).json({ error: 'Problem not found' });
      return;
    }

    res.json({ problem });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch problem' });
  }
});

// POST /api/problems — Create new problem with testcases
router.post('/', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, slug, description, difficulty, category, problemType, evaluationStrategy, referenceSolution, starterCode, testCases } = req.body;

    if (!title || !description) {
      res.status(400).json({ error: 'title and description are required' });
      return;
    }

    const generatedSlug = slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

    const problem = await prisma.problem.create({
      data: {
        title,
        slug: generatedSlug,
        description,
        difficulty: difficulty || 'Medium',
        category: category || 'General',
        problemType: problemType || 'code',
        evaluationStrategy: evaluationStrategy || 'EXACT_MATCH',
        referenceSolution: referenceSolution || null,
        starterCode: starterCode || {},
        testCases: {
          create: (testCases || []).map((tc: any, idx: number) => ({
            input: tc.input || '',
            expectedOutput: tc.expectedOutput || '',
            isHidden: tc.isHidden ?? false,
            order: idx + 1,
          })),
        },
      },
      include: {
        testCases: true,
      },
    });

    res.json({ success: true, problem });
  } catch (error: any) {
    console.error('Error creating problem:', error);
    res.status(500).json({ error: 'Failed to create problem' });
  }
});

export default router;