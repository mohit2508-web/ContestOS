import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middlewares/auth';
import { evaluateCodeSubmission } from '../services/languageAdapter';


const router = Router();

// GET /api/code/languages — Available compilers & languages
router.get('/languages', async (_req: Request, res: Response): Promise<void> => {
  res.json({
    languages: [
      { id: 'cpp', name: 'C++ 20 (GCC 11.2)', extension: 'cpp' },
      { id: 'python', name: 'Python 3.10', extension: 'py' },
      { id: 'java', name: 'Java 17 (OpenJDK)', extension: 'java' },
      { id: 'javascript', name: 'JavaScript (Node.js v18)', extension: 'js' },
    ],
  });
});

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
      success: !evalResult.testResults[0]?.error,
      output: evalResult.testResults[0]?.actualOutput || evalResult.testResults[0]?.error || 'No output',
      stderr: evalResult.testResults[0]?.error || '',
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

    const isStream = req.query.stream === 'true';

    if (isStream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      if (typeof (res as any).flushHeaders === 'function') {
        (res as any).flushHeaders();
      }
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
      onProgress: (tcResult) => {
        if (isStream) {
          res.write(`data: ${JSON.stringify({ type: 'progress', result: tcResult })}\n\n`);
        }
      },
    });

    if (isStream) {
      res.write(`data: ${JSON.stringify({
        type: 'done',
        status: evalResult.status === 'ACCEPTED' ? 'passed' : 'failed',
        summary: {
          passed: evalResult.passedCount,
          failed: evalResult.totalCount - evalResult.passedCount,
          total: evalResult.totalCount,
        },
        results: evalResult.testResults,
      })}\n\n`);
      res.end();
      return;
    }

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