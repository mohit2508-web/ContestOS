import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticateToken } from '../middlewares/auth';
import { evaluateCodeSubmission } from '../services/languageAdapter';
import { executeSql, runSqlTestCases, extractDdlString } from '../services/sqlExecutor';

const router = Router();

// GET /api/code/languages — Available compilers & languages
router.get('/languages', async (_req: Request, res: Response): Promise<void> => {
  res.json({
    languages: [
      { id: 'cpp', name: 'C++ 20 (GCC 11.2)', extension: 'cpp' },
      { id: 'python', name: 'Python 3.10', extension: 'py' },
      { id: 'java', name: 'Java 17 (OpenJDK)', extension: 'java' },
      { id: 'javascript', name: 'JavaScript (Node.js v18)', extension: 'js' },
      { id: 'sql', name: 'SQL (SQLite)', extension: 'sql' },
    ],
  });
});

// POST /api/code/run — Execute candidate code against input
router.post('/run', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { language, code, input = '', setup = '', problemId } = req.body;

    if (!language || !code) {
      res.status(400).json({ error: 'Language and code are required' });
      return;
    }

    // ── SQL: route to SQLite engine ──────────────────────────────────────────
    if (language === 'sql') {
      let finalSetup = extractDdlString(setup) || extractDdlString(input);
      if (problemId) {
        const dbProblem = await prisma.problem.findUnique({
          where: { id: problemId },
          include: { testCases: { orderBy: { order: 'asc' }, take: 1 } }
        });
        if (dbProblem) {
          const schemaDdl = extractDdlString(dbProblem.starterCode);
          let sampleSeedDml = '';
          if (dbProblem.testCases && dbProblem.testCases.length > 0) {
            sampleSeedDml = extractDdlString((dbProblem.testCases[0] as any).setup) || extractDdlString(dbProblem.testCases[0].input);
          }
          const hasDdlInSetup = /CREATE\s+TABLE/i.test(finalSetup);
          if (!hasDdlInSetup) {
            finalSetup = schemaDdl + (sampleSeedDml ? '\n' + sampleSeedDml : '') + (finalSetup ? '\n' + finalSetup : '');
          }
        }
      }
      const result = await executeSql(code, finalSetup);

      if (result.error) {
        res.json({
          success: false,
          error: result.error,
          columns: [],
          rows: [],
          rowCount: 0,
          executionTime: result.executionTime,
        });
        return;
      }

      res.json({
        success: true,
        columns: result.columns,
        rows: result.rows,
        rowCount: result.rowCount,
        affected: result.affected,
        executionTime: result.executionTime,
      });
      return;
    }

    // ── All other languages: route to Piston / local adapter ─────────────────
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
    res.status(500).json({ error: 'Execution failed', details: error.message });
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

    // ── SQL: route to SQLite test runner ────────────────────────────────────
    if (language === 'sql') {
      let casesToRun = testCases;
      let schemaDdl = '';
      if (problemId) {
        const dbProblem = await prisma.problem.findUnique({
          where: { id: problemId },
          include: { testCases: { orderBy: { order: 'asc' } } }
        });
        if (dbProblem) {
          if (dbProblem.testCases && dbProblem.testCases.length > 0) {
            casesToRun = dbProblem.testCases;
          }
          schemaDdl = extractDdlString(dbProblem.starterCode);
        }
      }

      const sqlTestCases = casesToRun.map((tc: any) => {
        const rawSetup = extractDdlString(tc.setup) || extractDdlString(tc.input);
        const tcHasDDL = /CREATE\s+TABLE/i.test(rawSetup);
        const finalSetup = tcHasDDL ? rawSetup : (schemaDdl ? schemaDdl + '\n' + rawSetup : rawSetup);
        return {
          setup: finalSetup,
          input: extractDdlString(tc.input),
          expectedOutput: tc.expectedOutput || '',
        };
      });

      const sqlResult = await runSqlTestCases(code, sqlTestCases);

      res.json({
        results: sqlResult.results.map((r, idx) => ({
          testCase: idx + 1,
          passed: r.passed,
          columns: r.columns,
          rows: r.rows,
          rowCount: r.rowCount,
          executionTime: r.executionTime,
          error: r.error,
          expectedOutput: r.expectedOutput,
          actualOutput: r.actualOutput,
        })),
        summary: sqlResult.summary,
      });
      return;
    }

    // ── All other languages: Piston / local adapter ──────────────────────────
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
    res.status(500).json({ error: 'Test execution failed', details: error.message });
  }
});

export default router;