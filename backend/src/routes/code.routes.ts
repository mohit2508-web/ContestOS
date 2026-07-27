import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middlewares/auth';
import { evaluateCodeSubmission } from '../services/languageAdapter';


const router = Router();

// POST /api/code/run — Execute candidate code against input
router.post('/run', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { language, code, input = '' } = req.body;

    if (!language || !code) {
      res.status(400).json({ error: 'Language and code are required' });
      return;
    }

    const evalResult = await evaluateCodeSubmission({
      problemId: 'test',
      code,
      language,
      testCases: [{ id: '1', input, expectedOutput: '' }],
    });

    res.json({
      success: evalResult.status === 'ACCEPTED',
      output: evalResult.testResults[0]?.actualOutput || 'Code executed successfully',
      stderr: '',
      executionTime: `${evalResult.executionTime}ms`,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Execution failed' });
  }
});

// POST /api/code/run-tests — Run test suite for candidate code
router.post('/run-tests', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { language, code, testCases = [], problemId } = req.body;

    if (!language || !code) {
      res.status(400).json({ error: 'Language and code are required' });
      return;
    }

    const evalResult = await evaluateCodeSubmission({
      problemId: problemId || 'test',
      code,
      language,
      testCases: testCases.map((tc: any, idx: number) => ({
        id: String(idx + 1),
        input: tc.input || '',
        expectedOutput: tc.expectedOutput || '',
        isHidden: tc.isHidden || false,
      })),
    });

    res.json({
      results: evalResult.testResults,
      summary: {
        passed: evalResult.passedCount,
        failed: evalResult.totalCount - evalResult.passedCount,
        total: evalResult.totalCount,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Test execution failed' });
  }
});

export default router;