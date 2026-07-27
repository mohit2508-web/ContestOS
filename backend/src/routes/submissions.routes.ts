import { Router, Request, Response } from "express";
import { authenticateToken } from "../middlewares/auth";
import prisma from "../lib/prisma";
import LanguageAdapter from "../services/languageAdapter";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";
import { sanitizeCode } from "./code.routes";

const router = Router();

const TEMP_DIR = path.join(os.tmpdir(), "talentos-code");
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

const languageAdapter = new LanguageAdapter(TEMP_DIR);

interface SubmitCodeBody {
  problemId: string;
  code: string;
  language: string;
}

function determineVerdict(results: Array<{ error?: string; passed: boolean }>): string {
  for (const r of results) {
    if (r.error === "Time Limit Exceeded") return "TLE";
    if (r.error && r.error.includes("Compilation")) return "CE";
    if (r.error && r.error.includes("Exit code")) return "RE";
  }
  if (results.every((r) => r.passed)) return "AC";
  return "WA";
}

router.post("/", authenticateToken, async (req: Request<{}, {}, SubmitCodeBody>, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { problemId, code, language } = req.body;

    if (!problemId || !code || !language) {
      res.status(400).json({ error: "Problem ID, code, and language are required" });
      return;
    }

    if (code.length > 500000) {
      res.status(413).json({ error: "Code exceeds maximum size of 500KB" });
      return;
    }

    console.log(`[Submission Attempt] User ${userId} is submitting code for problem ${problemId} in ${language}. Code size: ${code.length} bytes.`);

    const sanitization = sanitizeCode(code);
    if (!sanitization.valid) {
      res.status(400).json({ error: sanitization.error });
      return;
    }

    const problem = await prisma.problem.findUnique({
      where: { id: problemId },
    });

    if (!problem) {
      res.status(404).json({ error: "Problem not found" });
      return;
    }

    const testCases = problem.testCases as Array<{ input: string; expectedOutput: string }>;
    const timeLimit = problem.timeLimit || 1000;

    const streamMode = req.query.stream === 'true';

    if (streamMode) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      let liveResults: any[] = [];
      try {
        const result = await languageAdapter.runTestCases(
          code, 
          language, 
          testCases, 
          timeLimit, 
          problem.driverCode as Record<string, string> | null,
          (tcResult) => {
            liveResults.push(tcResult);
            const isHidden = (testCases as any[])[tcResult.testCase - 1]?.isHidden ?? ((tcResult.testCase - 1) >= 3);
            const sanitizedResult = {
              ...tcResult,
              input: isHidden ? "[Hidden]" : tcResult.input,
              expectedOutput: isHidden ? "[Hidden]" : tcResult.expectedOutput,
              actualOutput: isHidden ? "[Hidden]" : tcResult.actualOutput,
            };
            res.write(`data: ${JSON.stringify({ type: 'progress', result: sanitizedResult })}\n\n`);
            if ((res as any).flush) (res as any).flush();
          }
        );

        const passedTests = result.summary.passed;
        const totalTests = result.summary.total;
        const status = passedTests === totalTests ? "passed" : "failed";
        const verdict = determineVerdict(result.results);

        const submission = await prisma.submission.create({
          data: {
            userId,
            problemId,
            code,
            language,
            status,
            verdict,
            passedTests,
            totalTests,
            executionTime: result.results.reduce((acc, r) => acc + r.executionTime, 0),
            maxTime: Math.max(...result.results.map((r) => r.executionTime), 0),
            memoryUsed: result.results.reduce((max, r) => Math.max(max, r.memoryUsed || 0), 0),
            error: result.results.some((r) => r.error)
              ? result.results.find((r) => r.error)?.error || null
              : null,
            testResults: {
              create: result.results.map((r) => ({
                testCaseIndex: r.testCase,
                input: r.input,
                expectedOutput: r.expectedOutput,
                actualOutput: r.actualOutput,
                passed: r.passed,
                executionTime: r.executionTime,
                error: r.error || null,
              })),
            },
          },
        });

        res.write(`data: ${JSON.stringify({ 
          type: 'done', 
          summary: result.summary, 
          submissionId: submission.id,
          status,
          verdict
        })}\n\n`);
        res.end();
      } catch (err: any) {
        res.write(`data: ${JSON.stringify({ type: 'error', error: err.message })}\n\n`);
        res.end();
      }
      return;
    }

    const result = await languageAdapter.runTestCases(code, language, testCases, timeLimit, problem.driverCode as Record<string, string> | null);

    const passedTests = result.summary.passed;
    const totalTests = result.summary.total;
    const status = passedTests === totalTests ? "passed" : "failed";
    const verdict = determineVerdict(result.results);

    const submission = await prisma.submission.create({
      data: {
        userId,
        problemId,
        code,
        language,
        status,
        verdict,
        passedTests,
        totalTests,
        executionTime: result.results.reduce((acc, r) => acc + r.executionTime, 0),
        maxTime: Math.max(...result.results.map((r) => r.executionTime), 0),
        memoryUsed: result.results.reduce((max, r) => Math.max(max, r.memoryUsed || 0), 0),
        error: result.results.some((r) => r.error)
          ? result.results.find((r) => r.error)?.error || null
          : null,
        testResults: {
          create: result.results.map((r) => ({
            testCaseIndex: r.testCase,
            input: r.input,
            expectedOutput: r.expectedOutput,
            actualOutput: r.actualOutput,
            passed: r.passed,
            executionTime: r.executionTime,
            error: r.error || null,
          })),
        },
      },
      include: {
        testResults: {
          orderBy: { testCaseIndex: "asc" },
        },
      },
    });

    console.log(`[Submission Success] Submission ID: ${submission.id}, Status: ${submission.status}, Verdict: ${submission.verdict}, Passed: ${passedTests}/${totalTests}`);

    // Sanitize results: Hide input/output details for hidden test cases
    interface TestCase {
      input: string;
      expectedOutput: string;
      isHidden?: boolean;
    }
    const problemTestCases = testCases as TestCase[];
    const sanitizedResults = submission.testResults.map((r, index) => {
      const isHidden = problemTestCases[index]?.isHidden ?? (index >= 3); // Hide if flagged hidden, or default to hiding after the first 3
      return {
        id: r.id,
        submissionId: r.submissionId,
        testCaseIndex: r.testCaseIndex,
        passed: r.passed,
        executionTime: r.executionTime,
        error: r.error,
        createdAt: r.createdAt,
        input: isHidden ? "[Hidden]" : r.input,
        expectedOutput: isHidden ? "[Hidden]" : r.expectedOutput,
        actualOutput: isHidden ? "[Hidden]" : r.actualOutput,
      };
    });

    console.log(`[Submission Success] Submission ID: ${submission.id}, Status: ${submission.status}, Verdict: ${submission.verdict}, Passed: ${passedTests}/${totalTests}`);

    res.json({
      submission: {
        id: submission.id,
        status: submission.status,
        verdict: submission.verdict,
        passedTests: submission.passedTests,
        totalTests: submission.totalTests,
        executionTime: submission.executionTime,
        maxTime: submission.maxTime,
        results: sanitizedResults,
      },
    });
  } catch (error: unknown) {
    console.error("Error submitting code:", error);
    const message = error instanceof Error ? error.message : 'Failed to submit code';
    res.status(500).json({ error: message });
  }
});

router.get("/", authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { problemId, status } = req.query;

    const where: any = { userId };
    if (problemId) where.problemId = problemId as string;
    if (status) where.status = status as string;

    const submissions = await prisma.submission.findMany({
      where,
      include: {
        testResults: {
          orderBy: { testCaseIndex: "asc" },
          take: 5,
        },
        user: {
          select: { id: true, fullName: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    res.json({ submissions });
  } catch (error: unknown) {
    console.error("Error fetching submissions:", error);
    const message = error instanceof Error ? error.message : 'Failed to fetch submissions';
    res.status(500).json({ error: message });
  }
});

router.get("/:id", authenticateToken, async (req: Request, res: Response) => {
  try {
    const idParam = req.params.id;
    const id = Array.isArray(idParam) ? idParam[0] : idParam;
    const userId = req.user!.userId;

    const submission = await prisma.submission.findFirst({
      where: { id, userId },
      include: {
        problem: true,
        testResults: {
          orderBy: { testCaseIndex: "asc" },
        },
        user: {
          select: { id: true, fullName: true, avatarUrl: true },
        },
      },
    });

    if (!submission) {
      res.status(404).json({ error: "Submission not found" });
      return;
    }

    // Sanitize past submission details
    const problemTestCases = (submission.problem.testCases as any[]) || [];
    const sanitizedResults = submission.testResults.map((r, index) => {
      const isHidden = problemTestCases[index]?.isHidden ?? (index >= 3);
      return {
        ...r,
        input: isHidden ? "[Hidden]" : r.input,
        expectedOutput: isHidden ? "[Hidden]" : r.expectedOutput,
        actualOutput: isHidden ? "[Hidden]" : r.actualOutput,
      };
    });

    res.json({
      submission: {
        ...submission,
        testResults: sanitizedResults,
      },
    });
  } catch (error: unknown) {
    console.error("Error fetching submission:", error);
    const message = error instanceof Error ? error.message : 'Failed to fetch submission';
    res.status(500).json({ error: message });
  }
});

router.patch("/:id", authenticateToken, async (req: Request, res: Response) => {
  try {
    const idParam = req.params.id;
    const id = Array.isArray(idParam) ? idParam[0] : idParam;
    const userId = req.user!.userId;
    const { notes, tags } = req.body;

    const existing = await prisma.submission.findFirst({ where: { id, userId } });
    if (!existing) {
      res.status(404).json({ error: "Submission not found" });
      return;
    }

    const submission = await prisma.submission.update({
      where: { id },
      data: {
        notes: notes !== undefined ? notes : existing.notes,
        tags: tags !== undefined ? tags : existing.tags,
      },
    });

    res.json({ submission });
  } catch (error: unknown) {
    console.error("Error updating submission:", error);
    const message = error instanceof Error ? error.message : 'Failed to update submission';
    res.status(500).json({ error: message });
  }
});

export default router;
