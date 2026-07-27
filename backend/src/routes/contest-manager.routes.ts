import { Router, Request, Response } from "express";
import { authenticateToken } from "../middlewares/auth";
import { requireMinLevel } from "../middlewares/rbac";
import prisma from "../lib/prisma";
import executeSql from "../services/sqlExecutor";
import webDevEvaluator from "../services/webDevEvaluator";
import fs from "fs";
import fsp from 'fs/promises';
import path from "path";
import { cacheWithFallback, delCache, delCacheByPattern, getCached, setCache } from "../lib/cacheUtils";
import crypto from "crypto";
import { validateBody } from "../middlewares/validateBody";
import { sendEmail } from "../lib/email";
import { escapeHtml } from "../lib/sanitize";
import redis from "../lib/redis";
import { generateSebConfig } from "../services/sebConfigGenerator";
import { verifySafeBrowser } from "../middlewares/verifySafeBrowser";

const router = Router();


export async function autoSubmitContestDrafts(contestId: string, userId: string, participantId: string, submissionType: string = "auto_timeout") {
  try {
    const drafts = await prisma.contestDraft.findMany({
      where: { participantId }
    });

    for (const draft of drafts) {
      await prisma.contestSubmission.create({
        data: {
          contestId,
          userId,
          problemId: draft.problemId,
          language: draft.language,
          code: draft.code,
          status: "auto_submitted",
          points: 0,
          submissionType
        }
      });
    }
  } catch (err) {
    console.error("Failed to auto-submit drafts:", err);
  }
}

async function notifyViolationReport(contestId: string, participantId: string, violationType: string, description: string) {
  try {
    const participant = await prisma.contestParticipant.findUnique({
      where: { id: participantId },
      include: {
        user: true,
        contest: true
      }
    });

    if (!participant || !participant.user) return;

    const studentEmail = participant.user.email;
    const studentName = participant.user.fullName || "Candidate";
    const contestTitle = participant.contest.title;

    let creatorEmail = "";
    let creatorName = "Coordinator";

    if (participant.contest.createdById) {
      const creator = await prisma.user.findUnique({
        where: { id: participant.contest.createdById }
      });
      if (creator) {
        creatorEmail = creator.email;
        creatorName = creator.fullName || "Coordinator";
      }
    }

    const subject = `⚠️ Security Violation Block: ${escapeHtml(contestTitle)}`;
    
    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; background: #fafafa; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; border: 1px solid #ffccd5; }
          .header { text-align: center; margin-bottom: 25px; border-bottom: 2px solid #ff4d4f; padding-bottom: 15px; }
          .logo { font-size: 24px; font-weight: bold; color: #ff4d4f; }
          .content { color: #333; line-height: 1.6; }
          .violation-details { background: #fff1f0; border: 1px solid #ffa39e; padding: 15px; border-radius: 5px; margin: 20px 0; color: #cf1322; font-family: monospace; }
          .footer { margin-top: 30px; color: #888; font-size: 11px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">TalentOS Proctoring Alert</div>
          </div>
          <div class="content">
            <h2>Exam Access Blocked</h2>
            <p>Hello <strong>${escapeHtml(studentName)}</strong>,</p>
            <p>Your access to the contest <strong>${escapeHtml(contestTitle)}</strong> has been suspended due to proctoring warning limits check triggers.</p>
            <div class="violation-details">
              <strong>Violation Type:</strong> ${escapeHtml(violationType)}<br/>
              <strong>Log Details:</strong> ${escapeHtml(description)}<br/>
              <strong>Status:</strong> Exam Blocked / Terminated
            </div>
            <p>If you believe this is a false detection, please contact your instructor/coordinator.</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} TalentOS Proctoring System. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await sendEmail(studentEmail, subject, htmlBody);

    if (creatorEmail) {
      const coordSubject = `Proctoring Alert: ${escapeHtml(studentName)} Terminated in ${escapeHtml(contestTitle)}`;
      const coordHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; background: #fafafa; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; border: 1px solid #ffa39e; }
            .header { text-align: center; margin-bottom: 25px; border-bottom: 2px solid #cf1322; padding-bottom: 15px; }
            .logo { font-size: 24px; font-weight: bold; color: #cf1322; }
            .content { color: #333; line-height: 1.6; }
            .violation-details { background: #fff1f0; border: 1px solid #ffa39e; padding: 15px; border-radius: 5px; margin: 20px 0; color: #cf1322; font-family: monospace; }
            .footer { margin-top: 30px; color: #888; font-size: 11px; text-align: center; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">TalentOS Proctoring Notification</div>
            </div>
            <div class="content">
              <h2>Candidate Terminated</h2>
              <p>Hello <strong>${escapeHtml(creatorName)}</strong>,</p>
              <p>Candidate <strong>${escapeHtml(studentName)}</strong> (${escapeHtml(studentEmail)}) has been automatically terminated from <strong>${escapeHtml(contestTitle)}</strong> after exceeding proctoring warning limits.</p>
              <div class="violation-details">
                <strong>Student:</strong> ${escapeHtml(studentName)}<br/>
                <strong>Email:</strong> ${escapeHtml(studentEmail)}<br/>
                <strong>Reason:</strong> ${escapeHtml(violationType)} - ${escapeHtml(description)}
              </div>
              <p>You can review their snapshots and logs directly on the TalentOS Coordinator Dashboard.</p>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} TalentOS Proctoring System.</p>
            </div>
          </div>
        </body>
        </html>
      `;
      await sendEmail(creatorEmail, coordSubject, coordHtml);
    }
  } catch (err) {
    console.error("Failed to notify violation report:", err);
  }
}

// NOTE: delCacheByPattern uses Redis KEYS under the hood which is O(N) and blocks Redis.
// For production, replace with SCAN-based iteration.

const ownershipCache = new Map<string, { result: boolean; expiresAt: number }>();
const OWNERSHIP_CACHE_TTL = 30_000;


async function checkContestOwnership(contestId: string, userId: string): Promise<boolean> {
  const cacheKey = `ownership:${contestId}:${userId}`;
  return cacheWithFallback<boolean>(cacheKey, async () => {
    const contest = await prisma.contest.findUnique({ where: { id: contestId } });
    return contest?.createdById === userId;
  }, OWNERSHIP_CACHE_TTL);
}

interface CreateContestBody {
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  duration?: number;
  difficulty?: string;
  isPublic?: boolean;
  problemIds?: string[];
  requireFullscreen?: boolean;
  preventTabSwitch?: boolean;
  disableCopyPaste?: boolean;
  enableProctoring?: boolean;
  requireSeb?: boolean;
  maxWarnings?: number;
  allowMultipleMonitors?: boolean;
  pasteMode?: 'ALLOWED' | 'LOG_ONLY' | 'BLOCKED';
  faceCheckEnabled?: boolean;
  voiceCheckEnabled?: boolean;
  randomizeQuestionOrder?: boolean;
  snapshotIntervalSeconds?: number;
}

interface JoinContestBody {
  contestId: string;
}

interface SubmitContestCodeBody {
  contestId: string;
  problemId: string;
  code: string;
  language: string;
  htmlCode?: string;
  cssCode?: string;
  jsCode?: string;
}

router.get("/", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { status } = req.query;

    const result = await cacheWithFallback(`contests:list:${status || 'all'}`, async () => {
      const now = new Date();
      let where: any = { isPublic: true };

      if (status === "upcoming") { where.startTime = { gt: now }; }
      else if (status === "active") { where.startTime = { lte: now }; where.endTime = { gte: now }; }
      else if (status === "ended") { where.endTime = { lt: now }; }

      const contests = await prisma.contest.findMany({
        where,
        select: {
          id: true, title: true, description: true, startTime: true, endTime: true, duration: true, difficulty: true,
          _count: { select: { participants: true, problems: true } }
        },
        orderBy: { startTime: "asc" },
        take: 50,
      });

      return { contests };
    }, 60);

    res.json(result);
  } catch (error: any) {
    console.error("Error fetching contests:", error);
    res.status(500).json({ error: "Failed to fetch contests" });
  }
});

router.get("/my-managed", authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const result = await cacheWithFallback(`contests:managed:${userId}`, () =>
      prisma.contest.findMany({
        where: { createdById: userId },
        select: {
          id: true, title: true, description: true, startTime: true, endTime: true, duration: true, difficulty: true,
          isPublic: true, requireFullscreen: true, preventTabSwitch: true, disableCopyPaste: true, enableProctoring: true,
          _count: { select: { participants: true, problems: true } }
        },
        orderBy: { createdAt: "desc" }
      }).then(contests => ({ contests }))
    , 60);
    res.json(result);
  } catch (error: any) {
    console.error("Error fetching managed contests:", error);
    res.status(500).json({ error: "Failed to fetch managed contests" });
  }
});

router.get("/active", authenticateToken, async (req: Request, res: Response) => {
  try {
    const result = await cacheWithFallback('contests:active', async () => {
      const now = new Date();
      const contests = await prisma.contest.findMany({
        where: {
          isPublic: true,
          startTime: { lte: now },
          endTime: { gte: now }
        },
        select: {
          id: true, title: true, description: true, startTime: true, endTime: true, duration: true, difficulty: true,
          _count: { select: { participants: true, problems: true } }
        },
        orderBy: { startTime: "asc" }
      });
      return { contests };
    }, 60);

    res.json(result);
  } catch (error: any) {
    console.error("Error fetching active contests:", error);
    res.status(500).json({ error: "Failed to fetch active contests" });
  }
});

router.get("/:id", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const userId = req.user!.userId;

    const contest = await prisma.contest.findUnique({
      where: { id },
      include: {
        problems: {
          include: { problem: true },
          orderBy: { order: "asc" }
        },
        _count: { select: { participants: true } }
      }
    });

    if (!contest) {
      res.status(404).json({ error: "Contest not found" });
      return;
    }

    let participant = await prisma.contestParticipant.findUnique({
      where: { contestId_userId: { contestId: id, userId } }
    });

    if (participant && !participant.activeSessionToken) {
      const token = crypto.randomUUID();
      participant = await prisma.contestParticipant.update({
        where: { id: participant.id },
        data: { activeSessionToken: token }
      });
    }

    let solvedProblems: string[] = [];
    if (participant) {
      const passedProblems = await prisma.contestPassedProblem.findMany({
        where: { contestId: id, userId },
        select: { problemId: true }
      });
      solvedProblems = passedProblems.map(p => p.problemId);
    }

    res.json({
      contest,
      isJoined: !!participant,
      isActive: new Date() >= contest.startTime && new Date() <= contest.endTime,
      participant: participant ? {
        id: participant.id,
        warnings: participant.warnings,
        isTerminated: participant.isTerminated,
        score: participant.score,
        solvedCount: participant.solvedCount,
        status: participant.status,
        submittedAt: (participant as any).submittedAt || null,
        activeSessionToken: participant.activeSessionToken,
        registrationPhoto: participant.registrationPhoto,
        solvedProblems
      } : null
    });
  } catch (error: any) {
    console.error("Error getting contest detail:", error);
    res.status(500).json({ error: "Failed to load contest detail" });
  }
});

// --- SEB Config Download Route ---
// Serves a candidate-specific .seb configuration file for a locked contest
router.get("/:id/seb-config", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const userId = req.user!.userId;

    const contest = await prisma.contest.findUnique({
      where: { id },
      select: { id: true, title: true, requireSeb: true, sebConfig: true, sebQuitPassword: true }
    });

    if (!contest) {
      res.status(404).json({ error: "Contest not found" });
      return;
    }

    if (!contest.requireSeb) {
      res.status(400).json({ error: "This contest does not require SEB" });
      return;
    }

    // Verify participant is registered
    const participant = await prisma.contestParticipant.findUnique({
      where: { contestId_userId: { contestId: id, userId } }
    });

    if (!participant) {
      res.status(403).json({ error: "You must join the contest before downloading the SEB config" });
      return;
    }

    // Generate start URL pointing to the contest zone in SEB
    const frontendBase = process.env.FRONTEND_URL || 'http://localhost:5173';
    const startUrl = `${frontendBase}/contests/${id}/overview?seb=1&token=${participant.activeSessionToken || ''}`;

    const sebXml = generateSebConfig(
      startUrl,
      (contest as any).sebConfig || null,
      (contest as any).sebQuitPassword || null
    );

    res.set({
      'Content-Type': 'application/seb',
      'Content-Disposition': `attachment; filename="contest_${id}.seb"`,
      'Cache-Control': 'no-store'
    });
    res.send(sebXml);
  } catch (error: any) {
    console.error("Error generating SEB config:", error);
    res.status(500).json({ error: "Failed to generate SEB configuration" });
  }
});


router.post("/", validateBody("title", "startTime", "endTime"), authenticateToken, requireMinLevel(4), async (req: Request<{}, {}, CreateContestBody>, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { 
      title, description, startTime, endTime, duration, difficulty, isPublic, problemIds, 
      requireFullscreen, preventTabSwitch, disableCopyPaste, enableProctoring, requireSeb,
      maxWarnings, allowMultipleMonitors, pasteMode, faceCheckEnabled, voiceCheckEnabled, 
      randomizeQuestionOrder, snapshotIntervalSeconds 
    } = req.body;

    if (!title || !startTime || !endTime) {
      res.status(400).json({ error: "Title, start time, and end time are required" });
      return;
    }

    const contest = await prisma.contest.create({
      data: {
        title,
        description,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        duration: duration || 120,
        difficulty: difficulty || "Medium",
        isPublic: isPublic ?? true,
        requireFullscreen: requireFullscreen ?? true,
        preventTabSwitch: preventTabSwitch ?? true,
        disableCopyPaste: disableCopyPaste ?? true,
        enableProctoring: enableProctoring ?? false,
        requireSeb: requireSeb ?? false,
        maxWarnings: maxWarnings ?? 3,
        allowMultipleMonitors: allowMultipleMonitors ?? false,
        pasteMode: pasteMode ?? "LOG_ONLY",
        faceCheckEnabled: faceCheckEnabled ?? false,
        voiceCheckEnabled: voiceCheckEnabled ?? false,
        randomizeQuestionOrder: randomizeQuestionOrder ?? true,
        snapshotIntervalSeconds: snapshotIntervalSeconds ?? 45,
        createdById: userId,
      }
    });

    if (problemIds && problemIds.length > 0) {
      await prisma.contestProblem.createMany({
        data: problemIds.map((problemId, index) => ({
          contestId: contest.id,
          problemId,
          order: index,
          points: 100 * (index + 1)
        }))
      });
    }

    await delCache('contests:list:all');
    await delCache('contests:active');
    await delCache(`contests:managed:${userId}`);

    res.status(201).json({ contest });
  } catch (error: any) {
    console.error("Error creating contest:", error);
    res.status(500).json({ error: "Failed to create contest" });
  }
});

router.put("/:id", validateBody("title"), authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const userId = req.user!.userId;

    const contest = await prisma.contest.findUnique({
      where: { id },
      select: { createdById: true }
    });

    if (!contest) {
      res.status(404).json({ error: "Contest not found" });
      return;
    }

    const isOwner = await checkContestOwnership(id, userId);
    if (!isOwner && req.user!.hierarchyLevel > 2) {
      res.status(403).json({ error: "You are not authorized to modify this contest" });
      return;
    }

    const { title, description, startTime, endTime, duration, difficulty, isPublic, allowJoin, requireFullscreen, preventTabSwitch, disableCopyPaste, enableProctoring, requireSeb, maxWarnings, allowMultipleMonitors, pasteMode, faceCheckEnabled, voiceCheckEnabled, randomizeQuestionOrder, snapshotIntervalSeconds } = req.body;

    const updatedContest = await prisma.contest.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(startTime && { startTime: new Date(startTime) }),
        ...(endTime && { endTime: new Date(endTime) }),
        ...(duration && { duration }),
        ...(difficulty && { difficulty }),
        ...(isPublic !== undefined && { isPublic }),
        ...(allowJoin !== undefined && { allowJoin }),
        ...(requireFullscreen !== undefined && { requireFullscreen }),
        ...(preventTabSwitch !== undefined && { preventTabSwitch }),
        ...(disableCopyPaste !== undefined && { disableCopyPaste }),
        ...(enableProctoring !== undefined && { enableProctoring }),
        ...(requireSeb !== undefined && { requireSeb }),
        ...(maxWarnings !== undefined && { maxWarnings }),
        ...(allowMultipleMonitors !== undefined && { allowMultipleMonitors }),
        ...(pasteMode !== undefined && { pasteMode }),
        ...(faceCheckEnabled !== undefined && { faceCheckEnabled }),
        ...(voiceCheckEnabled !== undefined && { voiceCheckEnabled }),
        ...(randomizeQuestionOrder !== undefined && { randomizeQuestionOrder }),
        ...(snapshotIntervalSeconds !== undefined && { snapshotIntervalSeconds }),
      }
    });

    await delCacheByPattern(`contest:detail:${id}:*`);
    await delCache('contests:list:all');
    await delCache('contests:active');

    res.json({ contest: updatedContest });
  } catch (error: any) {
    console.error("Error updating contest:", error);
    res.status(500).json({ error: "Failed to update contest" });
  }
});

router.delete("/:id", authenticateToken, requireMinLevel(4), async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const userId = req.user!.userId;

    const contest = await prisma.contest.findUnique({
      where: { id },
      select: { createdById: true }
    });

    if (!contest) {
      res.status(404).json({ error: "Contest not found" });
      return;
    }

    const isOwner = await checkContestOwnership(id, userId);
    if (!isOwner && req.user!.hierarchyLevel > 2) {
      res.status(403).json({ error: "You are not authorized to delete this contest" });
      return;
    }

    await prisma.contest.delete({ where: { id } });

    await delCacheByPattern(`contest:detail:${id}:*`);
    await delCache('contests:list:all');
    await delCache('contests:active');

    res.json({ message: "Contest deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting contest:", error);
    res.status(500).json({ error: "Failed to delete contest" });
  }
});

router.post("/:id/join", authenticateToken, async (req: Request<{ id: string }, {}, JoinContestBody>, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    const contest = await prisma.contest.findUnique({
      where: { id },
      select: { allowJoin: true, startTime: true, endTime: true }
    });

    if (!contest) {
      res.status(404).json({ error: "Contest not found" });
      return;
    }

    const now = new Date();
    if (now < contest.startTime || now > contest.endTime) {
      res.status(400).json({ error: "Contest is not active" });
      return;
    }

    let existingPart = await prisma.contestParticipant.findUnique({
      where: { contestId_userId: { contestId: id, userId } }
    });

    const token = existingPart?.activeSessionToken || crypto.randomUUID();

    const participant = await prisma.contestParticipant.upsert({
      where: {
        contestId_userId: { contestId: id, userId }
      },
      update: {
        activeSessionToken: token
      },
      create: {
        contestId: id,
        userId,
        activeSessionToken: token
      }
    });

    await delCache(`contest:detail:${id}:${userId}`);
    await delCache('contests:list:all');

    res.json({ message: "Joined contest successfully", participant: { ...participant, activeSessionToken: token } });
  } catch (error: any) {
    console.error("Error joining contest:", error);
    res.status(500).json({ error: "Failed to join contest" });
  }
});

router.post("/:id/submit", validateBody("problemId", "code", "language"), authenticateToken, verifySafeBrowser, async (req: Request<{ id: string }, {}, SubmitContestCodeBody>, res: Response) => {
  try {
    const submitStartTime = Date.now();
    const { id: contestId } = req.params;
    const userId = req.user!.userId;
    const { problemId, code, language, htmlCode, cssCode, jsCode } = req.body;

    if (!problemId || !code || !language) {
      res.status(400).json({ error: "Problem ID, code, and language are required" });
      return;
    }

    const contest = await prisma.contest.findUnique({
      where: { id: contestId },
      select: { startTime: true, endTime: true }
    });

    if (!contest) {
      res.status(404).json({ error: "Contest not found" });
      return;
    }

    const now = new Date();
    if (now < contest.startTime || now > contest.endTime) {
      res.status(400).json({ error: "Contest is not active" });
      return;
    }

    const participant = await prisma.contestParticipant.findUnique({
      where: { contestId_userId: { contestId, userId } }
    });

    if (!participant) {
      res.status(400).json({ error: "You must join the contest first" });
      return;
    }

    const clientToken = req.headers['x-active-session-token'];
    if (participant.activeSessionToken && clientToken && participant.activeSessionToken !== clientToken) {
      console.warn("SESSION_CONFLICT [submit]: tokens do not match!");
      res.status(409).json({ error: "SESSION_CONFLICT" });
      return;
    }

    if (participant.isTerminated) {
      res.status(403).json({ error: "Your participation in this contest has been terminated due to security violations." });
      return;
    }

    const contestProblem = await prisma.contestProblem.findFirst({
      where: { contestId, problemId },
      include: { problem: true }
    });

    if (!contestProblem) {
      res.status(404).json({ error: "Problem not found in contest" });
      return;
    }

    let passedCount = 0;
    let totalTests = 0;
    let allPassed = false;
    let pointsEarned = 0;
    let submissionCode = code;

    if (contestProblem.problem.problemType === "sql") {
      const setupSchema = (contestProblem.problem.schema as any)?.setup || "";
      const testCases = contestProblem.problem.testCases as Array<{ input: string; expectedOutput: string; setup?: string }>;
      totalTests = testCases.length;

      const serializeSqlResult = (result: any) => {
        if (!result) return '';
        const columns = result.columns || [];
        const rows = result.rows || [];
        const header = columns.join(' | ');
        const rowStrings = rows.map((row: any) =>
          columns.map((col: string) => row[col] ?? 'NULL').join(' | ')
        );
        return [header, ...rowStrings].join('\n');
      };

      for (const testCase of testCases) {
        const fullSetup = (setupSchema + "\n" + (testCase.setup || "")).trim();
        const sqlResult = await executeSql(fullSetup, code);
        const actualSerialized = serializeSqlResult(sqlResult);
        if (sqlResult.success && actualSerialized.trim() === testCase.expectedOutput.trim()) {
          passedCount++;
        }
      }

      allPassed = passedCount === totalTests;
      pointsEarned = totalTests > 0 ? Math.round((passedCount / totalTests) * contestProblem.points) : 0;
    } else if (contestProblem.problem.problemType === "web-dev") {
      const html = htmlCode || "";
      const css = cssCode || "";
      const js = jsCode || "";
      
      submissionCode = JSON.stringify({ htmlCode: html, cssCode: css, jsCode: js });

      const webTestCasesJson = contestProblem.problem.webTestCases as any;
      const webTestCases = webTestCasesJson?.tests || webTestCasesJson || [];
      totalTests = webTestCases.length;

      if (totalTests > 0) {
        const evaluationResult = await webDevEvaluator.evaluate(html, css, js, webTestCases);
        passedCount = evaluationResult.summary.passed;
        allPassed = passedCount === totalTests;
      } else {
        allPassed = true;
        passedCount = 0;
      }

      pointsEarned = totalTests > 0 ? Math.round((passedCount / totalTests) * contestProblem.points) : 0;
    } else {
      const testCases = contestProblem.problem.testCases as Array<{ input: string; expectedOutput: string }>;
      totalTests = testCases.length;

      if (totalTests > 0) {
        try {
          const execResponse = await fetch(`${process.env.API_URL || "http://localhost:5000/api"}/code/run-tests`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": req.headers.authorization || ""
            },
            body: JSON.stringify({ language, code, testCases })
          });
          
          const result = await execResponse.json();
          if (result && result.summary) {
            passedCount = result.summary.passed;
          }
        } catch (err) {
          console.error("Error executing run-tests in contest submit:", err);
          passedCount = 0;
        }
      }

      allPassed = passedCount === totalTests;
      pointsEarned = totalTests > 0 ? Math.round((passedCount / totalTests) * contestProblem.points) : 0;
    }

    await prisma.contestSubmission.create({
      data: {
        contestId,
        userId,
        problemId,
        language,
        code: submissionCode,
        status: allPassed ? "passed" : "failed",
        points: pointsEarned,
        executionTime: Date.now() - submitStartTime
      }
    });

    await prisma.$transaction(async (tx) => {
      // 1. Get all problems in the contest
      const contestProblems = await tx.contestProblem.findMany({
        where: { contestId },
        select: { problemId: true, points: true }
      });

      // 2. Fetch the max points earned for each problem by this user
      let totalScore = 0;
      let solvedCount = 0;

      for (const cp of contestProblems) {
        const maxSub = await tx.contestSubmission.aggregate({
          where: {
            contestId,
            userId,
            problemId: cp.problemId
          },
          _max: {
            points: true
          }
        });
        const maxPoints = maxSub._max.points ?? 0;
        totalScore += maxPoints;

        if (maxPoints === cp.points && cp.points > 0) {
          solvedCount++;
        }
      }

      // 3. Update the ContestParticipant record
      await tx.contestParticipant.update({
        where: { contestId_userId: { contestId, userId } },
        data: {
          score: totalScore,
          solvedCount: solvedCount
        }
      });

      // 4. Create/update ContestPassedProblem if 100% solved
      const isFullySolved = (pointsEarned === contestProblem.points);
      if (isFullySolved) {
        const existing = await tx.contestPassedProblem.findFirst({
          where: { contestId, userId, problemId }
        });
        if (!existing) {
          await tx.contestPassedProblem.create({
            data: { contestId, userId, problemId }
          });
        }
      }
    });

    // Fetch updated participant for current score/solvedCount
    const updatedParticipant = await prisma.contestParticipant.findUnique({
      where: { contestId_userId: { contestId, userId } }
    });

    await delCache(`contest:leaderboard:${contestId}`);
    await delCache(`contest:detail:${contestId}:${userId}`);

    res.json({
      passed: allPassed,
      passedTests: passedCount,
      totalTests: totalTests,
      points: pointsEarned,
      totalPoints: contestProblem.points,
      currentScore: updatedParticipant?.score ?? 0,
      currentSolvedCount: updatedParticipant?.solvedCount ?? 0
    });
  } catch (error: any) {
    console.error("Error submitting contest code:", error);
    res.status(500).json({ error: "Failed to submit code" });
  }
});

router.get("/:id/leaderboard", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };

    const result = await cacheWithFallback(`contest:leaderboard:${id}`, async () => {
      const leaderboard = await prisma.contestParticipant.findMany({
        where: { contestId: id },
        select: { userId: true, score: true, solvedCount: true, joinedAt: true },
        orderBy: [{ score: "desc" }, { solvedCount: "desc" }, { joinedAt: "asc" }],
        take: 100
      });

      const userIds = leaderboard.map(p => p.userId);
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, fullName: true }
      });

      const userMap = new Map(users.map(u => [u.id, u]));

      const formattedLeaderboard = leaderboard.map((p, index) => ({
        rank: index + 1,
        user: userMap.get(p.userId),
        score: p.score,
        solvedCount: p.solvedCount
      }));

      return { leaderboard: formattedLeaderboard };
    }, 120);

    res.json(result);
  } catch (error: any) {
    console.error("Error fetching leaderboard:", error);
    res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
});

// GET /api/contests/manager/:id/leaderboard/stream — SSE standings connection
router.get("/:id/leaderboard/stream", authenticateToken, async (req: Request, res: Response) => {
  try {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

    // Emit live mock rank delta updates every 10 seconds for layout animation demonstration
    const interval = setInterval(() => {
      const deltaEvent = {
        type: "rank_delta",
        userId: "mock-uid",
        oldRank: 5,
        newRank: 3,
        scoreChange: 50
      };
      res.write(`data: ${JSON.stringify(deltaEvent)}\n\n`);
    }, 10000);

    req.on('close', () => {
      clearInterval(interval);
      res.end();
    });
  } catch (error: any) {
    console.error("SSE Leaderboard stream error:", error);
    res.status(500).end();
  }
});

router.get("/my/participation", authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const result = await cacheWithFallback(`contests:participation:${userId}`, () =>
      prisma.contestParticipant.findMany({
        where: { userId },
        include: { contest: true },
        orderBy: { joinedAt: "desc" },
        take: 20
      }).then(participations => ({ participations }))
    , 60);
    res.json(result);
  } catch (error: any) {
    console.error("Error fetching participations:", error);
    res.status(500).json({ error: "Failed to fetch participations" });
  }
});

router.post("/:id/problems", validateBody("problemId"), authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id: contestId } = req.params as { id: string };
    const userId = req.user!.userId;

    const contest = await prisma.contest.findUnique({
      where: { id: contestId },
      select: { createdById: true }
    });

    if (!contest) {
      res.status(404).json({ error: "Contest not found" });
      return;
    }

    if (contest.createdById !== userId && req.user!.hierarchyLevel > 3) {
      res.status(403).json({ error: "You are not authorized to modify this contest" });
      return;
    }

    const { problemId, order, points } = req.body;

    if (!problemId) {
      res.status(400).json({ error: "Problem ID is required" });
      return;
    }

    const contestProblem = await prisma.contestProblem.create({
      data: {
        contestId,
        problemId,
        order: order || 0,
        points: points || 100
      }
    });

    res.status(201).json({ contestProblem });
  } catch (error: any) {
    console.error("Error adding problem to contest:", error);
    res.status(500).json({ error: "Failed to add problem to contest" });
  }
});

router.post("/:id/participants/bulk", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const userId = req.user!.userId;

    const contest = await prisma.contest.findUnique({
      where: { id },
      select: { createdById: true }
    });

    if (!contest) {
      res.status(404).json({ error: "Contest not found" });
      return;
    }

    if (contest.createdById !== userId && req.user!.hierarchyLevel > 3) {
      res.status(403).json({ error: "You are not authorized to modify this contest" });
      return;
    }

    const { userIds } = req.body as { userIds: string[] };

    if (!userIds || !Array.isArray(userIds)) {
      res.status(400).json({ error: "userIds array is required" });
      return;
    }

    const participants = await Promise.all(userIds.map(userId => 
      prisma.contestParticipant.upsert({
        where: { contestId_userId: { contestId: id, userId } },
        update: {},
        create: { contestId: id, userId }
      })
    ));

    res.json({ message: "Participants added", count: participants.length });
  } catch (error: any) {
    console.error("Error adding participants:", error);
    res.status(500).json({ error: "Failed to add participants" });
  }
});

router.post("/:id/participants/log", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const userId = req.user!.userId;
    const { eventType, description } = req.body;

    const participant = await prisma.contestParticipant.findUnique({
      where: { contestId_userId: { contestId: id, userId } }
    });

    if (!participant) {
      res.status(400).json({ error: "You must join the contest first" });
      return;
    }

    const clientToken = req.headers['x-active-session-token'];
    if (participant.activeSessionToken && clientToken && participant.activeSessionToken !== clientToken) {
      console.warn("SESSION_CONFLICT [log]: tokens do not match!");
      res.status(409).json({ error: "SESSION_CONFLICT" });
      return;
    }

    await prisma.contestActivityLog.create({
      data: { contestId: id, userId, eventType, description }
    });

    const contest = await prisma.contest.findUnique({
      where: { id },
      select: { maxWarnings: true }
    });

    const maxAllowed = contest?.maxWarnings ?? 3;

    const updatedParticipant = await prisma.contestParticipant.update({
      where: { id: participant.id },
      data: { warnings: { increment: 1 } }
    });

    const newWarnings = updatedParticipant.warnings;
    const shouldTerminate = newWarnings >= maxAllowed;

    if (shouldTerminate && !updatedParticipant.isTerminated) {
      await prisma.contestParticipant.update({
        where: { id: participant.id },
        data: {
          isTerminated: true,
          status: "TERMINATED",
          blockReason: "EXCEEDED_WARNINGS",
          blockedAt: new Date()
        }
      });

      // Auto-submit drafts
      await autoSubmitContestDrafts(id, userId, participant.id);

      // Notify student, teacher, coordinator
      await notifyViolationReport(id, participant.id, eventType, description);
    }

    res.json({ 
      warnings: newWarnings, 
      isTerminated: shouldTerminate, 
      maxWarnings: maxAllowed 
    });
  } catch (error: any) {
    console.error("Error logging activity:", error);
    res.status(500).json({ error: "Failed to log activity" });
  }
});

router.post("/:id/telemetry/bulk", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const userId = req.user!.userId;
    const { logs } = req.body as { logs: Array<{ eventType: string; details: string }> };

    if (!Array.isArray(logs) || logs.length === 0) {
      res.status(400).json({ error: "Invalid telemetry array format" });
      return;
    }

    const participant = await prisma.contestParticipant.findUnique({
      where: { contestId_userId: { contestId: id, userId } }
    });

    if (!participant) {
      res.status(400).json({ error: "You must join the contest first" });
      return;
    }

    // Bulk create activity logs
    await prisma.contestActivityLog.createMany({
      data: logs.map(log => ({
        contestId: id,
        userId,
        eventType: log.eventType,
        description: log.details
      }))
    });

    res.json({ message: "Bulk telemetry synced successfully", count: logs.length });
  } catch (error: any) {
    console.error("Bulk telemetry upload error:", error);
    res.status(500).json({ error: "Failed to upload bulk telemetry" });
  }
});

router.put("/:id/participants/:userId/block", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id, userId } = req.params as { id: string, userId: string };
    const currentUserId = req.user!.userId;
    const { note } = req.body as { note?: string };

    const contest = await prisma.contest.findUnique({
      where: { id },
      select: { createdById: true }
    });

    if (!contest) {
      res.status(404).json({ error: "Contest not found" });
      return;
    }

    if (contest.createdById !== currentUserId && req.user!.hierarchyLevel > 3) {
      res.status(403).json({ error: "You are not authorized to block participants for this contest" });
      return;
    }

    const participant = await prisma.contestParticipant.update({
      where: { contestId_userId: { contestId: id, userId } },
      data: {
        isTerminated: true,
        status: "TERMINATED",
        blockReason: "MANUAL",
        blockedBy: currentUserId,
        blockedAt: new Date(),
        unblockedAt: null,
        unblockNote: null
      }
    });

    // Auto-submit drafts
    await autoSubmitContestDrafts(id, userId, participant.id);

    // Notify coordinator and student
    await notifyViolationReport(id, participant.id, "MANUAL_BLOCK", note || "Suspended by contest manager.");

    // Delete details cache
    await delCache(`contest:detail:${id}:${userId}`);

    res.json({ message: "Participant blocked successfully", participant });
  } catch (error: any) {
    console.error("Error blocking participant:", error);
    res.status(500).json({ error: "Failed to block participant" });
  }
});

router.put("/:id/participants/:userId/unblock", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id, userId } = req.params as { id: string, userId: string };
    const currentUserId = req.user!.userId;
    const { note } = req.body as { note?: string };

    const contest = await prisma.contest.findUnique({
      where: { id },
      select: { createdById: true }
    });

    if (!contest) {
      res.status(404).json({ error: "Contest not found" });
      return;
    }

    if (contest.createdById !== currentUserId && req.user!.hierarchyLevel > 3) {
      res.status(403).json({ error: "You are not authorized to unblock participants for this contest" });
      return;
    }

    // Reset warnings and status
    const participant = await prisma.contestParticipant.update({
      where: { contestId_userId: { contestId: id, userId } },
      data: {
        isTerminated: false,
        status: "IN_PROGRESS",
        warnings: 0,
        unblockedAt: new Date(),
        unblockNote: note || "Unblocked by contest manager."
      }
    });

    // Delete details cache to allow participant back in
    await delCache(`contest:detail:${id}:${userId}`);

    res.json({ message: "Participant unblocked successfully", participant });
  } catch (error: any) {
    console.error("Error unblocking participant:", error);
    res.status(500).json({ error: "Failed to unblock participant" });
  }
});

router.post("/:id/participants/:participantId/snapshot", authenticateToken, async (req: Request, res: Response) => {
  try {
    const contestId = req.params.id as string;
    const participantId = req.params.participantId as string;
    const { image } = req.body; // Base64 image string

    if (!image) {
      res.status(400).json({ error: "Image data is required" });
      return;
    }

    const participant = await prisma.contestParticipant.findFirst({
      where: { id: participantId, contestId }
    });

    if (!participant) {
      res.status(404).json({ error: "Participant not found" });
      return;
    }

    if (participant.userId !== req.user!.userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const userId = participant.userId;

    // Verify session token
    const clientToken = req.headers['x-active-session-token'];
    if (participant.activeSessionToken && clientToken && participant.activeSessionToken !== clientToken) {
      console.warn("SESSION_CONFLICT [snapshot]: tokens do not match!");
      res.status(409).json({ error: "SESSION_CONFLICT" });
      return;
    }

    // Create target directory
    const uploadDir = path.resolve(process.cwd(), "uploads", "proctoring", contestId, participantId);
    await fsp.mkdir(uploadDir, { recursive: true }).catch(() => {});

    // Decode and save image
    const filename = `${Date.now()}.jpg`;
    const filepath = path.join(uploadDir, filename);
    
    // Extract base64 content
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");
    await fsp.writeFile(filepath, buffer);

    // Call Python ML service for face check
    let faceCount: number | null = null;
    let flagged = false;

    try {
      const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:8000";
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(`${ML_SERVICE_URL}/proctoring/detect-face`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_base64: image }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const mlResult = await response.json();
        faceCount = mlResult.face_count;
        // Flagged if there's not exactly 1 face
        if (faceCount !== 1) {
          flagged = true;
        }
      } else {
        console.error("ML service returned error status:", response.status);
      }
    } catch (mlErr) {
      console.error("Failed to connect to ML service for face detection:", mlErr);
    }

    const relativeStorageKey = `uploads/proctoring/${contestId}/${participantId}/${filename}`;

    const snapshot = await prisma.proctoringSnapshot.create({
      data: {
        participantId,
        contestId,
        storageKey: relativeStorageKey,
        faceCount,
        flagged
      }
    });

    let warnings = participant.warnings;
    let isTerminated = participant.isTerminated;

    if (flagged) {
      const contest = await prisma.contest.findUnique({
        where: { id: contestId },
        select: { maxWarnings: true }
      });
      const maxAllowed = contest?.maxWarnings ?? 3;

      const updatedParticipant = await prisma.contestParticipant.update({
        where: { id: participant.id },
        data: { warnings: { increment: 1 } }
      });

      warnings = updatedParticipant.warnings;
      const description = faceCount === 0 
        ? "No face detected in proctoring snapshot." 
        : `Multiple faces (${faceCount}) detected in proctoring snapshot.`;

      // Log violation
      await prisma.contestActivityLog.create({
        data: {
          contestId,
          userId,
          eventType: "FACE_CHECK_VIOLATION",
          description
        }
      });

      if (warnings >= maxAllowed && !updatedParticipant.isTerminated) {
        isTerminated = true;
        await prisma.contestParticipant.update({
          where: { id: participant.id },
          data: {
            isTerminated: true,
            status: "TERMINATED",
            blockReason: "EXCEEDED_WARNINGS",
            blockedAt: new Date()
          }
        });

        // Auto-submit drafts
        await autoSubmitContestDrafts(contestId, userId, participant.id);

        // Notify student, teacher, coordinator
        await notifyViolationReport(contestId, participant.id, "FACE_CHECK_VIOLATION", description);
      }
    }

    res.status(201).json({ 
      snapshot,
      warnings,
      isTerminated
    });
  } catch (error: any) {
    console.error("Error uploading proctoring snapshot:", error);
    res.status(500).json({ error: "Failed to upload proctoring snapshot" });
  }
});

router.post("/:id/participants/:participantId/register-photo", authenticateToken, async (req: Request, res: Response) => {
  try {
    const contestId = req.params.id as string;
    const participantId = req.params.participantId as string;
    const { image } = req.body; // Base64 image string

    if (!image) {
      res.status(400).json({ error: "Image data is required" });
      return;
    }

    const participant = await prisma.contestParticipant.findFirst({
      where: { id: participantId, contestId }
    });

    if (!participant) {
      res.status(404).json({ error: "Participant not found" });
      return;
    }

    if (participant.userId !== req.user!.userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    // Verify session token
    const clientToken = req.headers['x-active-session-token'];
    if (participant.activeSessionToken && clientToken && participant.activeSessionToken !== clientToken) {
      res.status(409).json({ error: "SESSION_CONFLICT" });
      return;
    }

    // Create target directory
    const uploadDir = path.resolve(process.cwd(), "uploads", "proctoring", contestId, participantId);
    await fsp.mkdir(uploadDir, { recursive: true }).catch(() => {});

    // Save image
    const filename = `registration_${Date.now()}.jpg`;
    const filepath = path.join(uploadDir, filename);
    
    // Extract base64 content
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");
    await fsp.writeFile(filepath, buffer);

    const relativeStorageKey = `uploads/proctoring/${contestId}/${participantId}/${filename}`;

    // Update participant
    await prisma.contestParticipant.update({
      where: { id: participantId },
      data: { registrationPhoto: relativeStorageKey }
    });

    // Run ML face detection to flag if no single face is captured
    let faceCount: number | null = null;
    try {
      const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:8000";
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const mlResponse = await fetch(`${ML_SERVICE_URL}/proctoring/detect-face`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_base64: image }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (mlResponse.ok) {
        const mlResult = await mlResponse.json();
        faceCount = mlResult.face_count;
      }
    } catch (mlErr) {
      console.error("Failed to connect to ML service for registration face check:", mlErr);
    }

    // Also write to snapshots table
    await prisma.proctoringSnapshot.create({
      data: {
        participantId,
        contestId,
        storageKey: relativeStorageKey,
        faceCount,
        flagged: faceCount !== 1
      }
    });

    res.status(200).json({ success: true, registrationPhoto: relativeStorageKey });
  } catch (error: any) {
    console.error("Error registering photo:", error);
    res.status(500).json({ error: "Failed to register verification photo" });
  }
});

router.get("/:id/flagged-snapshots", authenticateToken, async (req: Request, res: Response) => {
  try {
    const contestId = req.params.id as string;
    const userId = req.user!.userId;

    const result = await cacheWithFallback(`contests:snapshots:${contestId}`, async () => {
      const contest = await prisma.contest.findUnique({
        where: { id: contestId },
        select: { createdById: true }
      });

      if (!contest) return null;
      if (contest.createdById !== userId) return { unauthorized: true };

      const snapshots = await prisma.proctoringSnapshot.findMany({
        where: { contestId },
        orderBy: { capturedAt: "desc" }
      });

      const participantIds = Array.from(new Set(snapshots.map(s => s.participantId)));
      const participants = await prisma.contestParticipant.findMany({
        where: { id: { in: participantIds } },
        include: { user: { select: { fullName: true, email: true } } }
      });

      const participantMap = new Map(participants.map(p => [p.id, p]));

      const formattedSnapshots = snapshots.map(s => {
        const p = participantMap.get(s.participantId);
        return { ...s, studentName: p?.user.fullName || "Unknown", studentEmail: p?.user.email || "Unknown", warnings: p?.warnings ?? 0, isTerminated: p?.isTerminated ?? false };
      });

      return { snapshots: formattedSnapshots };
    }, 60);

    if (!result) { res.status(404).json({ error: "Contest not found" }); return; }
    if ((result as any).unauthorized) { res.status(403).json({ error: "You are not authorized to view this contest's proctoring snapshots" }); return; }

    res.json(result);
  } catch (error: any) {
    console.error("Error fetching flagged snapshots:", error);
    res.status(500).json({ error: "Failed to fetch flagged snapshots" });
  }
});

router.put("/:id/snapshots/:snapshotId/review", authenticateToken, async (req: Request, res: Response) => {
  try {
    const contestId = req.params.id as string;
    const snapshotId = req.params.snapshotId as string;
    const userId = req.user!.userId;

    const contest = await prisma.contest.findUnique({
      where: { id: contestId },
      select: { createdById: true }
    });

    if (!contest) {
      res.status(404).json({ error: "Contest not found" });
      return;
    }

    if (contest.createdById !== userId) {
      res.status(403).json({ error: "You are not authorized to review snapshots for this contest" });
      return;
    }

    const updatedSnapshot = await prisma.proctoringSnapshot.update({
      where: { id: snapshotId },
      data: {
        reviewedBy: userId,
        reviewedAt: new Date(),
        flagged: false
      }
    });

    await delCache(`contests:snapshots:${contestId}`);

    res.json({ snapshot: updatedSnapshot });
  } catch (error: any) {
    console.error("Error reviewing snapshot:", error);
    res.status(500).json({ error: "Failed to review snapshot" });
  }
});

router.post("/:contestId/problems/:problemId/draft", authenticateToken, verifySafeBrowser, async (req: Request, res: Response) => {
  try {
    const { contestId, problemId } = req.params as { contestId: string; problemId: string };
    const { language, code } = req.body as { language: string; code: string };
    const userId = req.user!.userId;

    if (!language || code === undefined) {
      res.status(400).json({ error: "Language and code are required" });
      return;
    }

    const participant = await prisma.contestParticipant.findUnique({
      where: { contestId_userId: { contestId, userId } }
    });

    if (!participant) {
      res.status(404).json({ error: "Participant not found in contest" });
      return;
    }

    const draft = await prisma.contestDraft.upsert({
      where: {
        participantId_problemId_language: {
          participantId: participant.id,
          problemId,
          language
        }
      },
      update: { code, updatedAt: new Date() },
      create: {
        participantId: participant.id,
        problemId,
        language,
        code
      }
    });

    res.json({ success: true, draft });
  } catch (error: any) {
    console.error("Error saving contest draft:", error);
    res.status(500).json({ error: "Failed to save contest draft" });
  }
});

router.get("/:contestId/problems/:problemId/draft/:language", authenticateToken, verifySafeBrowser, async (req: Request, res: Response) => {
  try {
    const { contestId, problemId, language } = req.params as { contestId: string; problemId: string; language: string };
    const userId = req.user!.userId;

    const participant = await prisma.contestParticipant.findUnique({
      where: { contestId_userId: { contestId, userId } }
    });

    if (!participant) {
      res.status(404).json({ error: "Participant not found in contest" });
      return;
    }

    const draft = await prisma.contestDraft.findUnique({
      where: {
        participantId_problemId_language: {
          participantId: participant.id,
          problemId,
          language
        }
      }
    });

    res.json({ draft });
  } catch (error: any) {
    console.error("Error loading contest draft:", error);
    res.status(500).json({ error: "Failed to load contest draft" });
  }
});

router.post("/:id/participants/recording-chunk", authenticateToken, async (req: Request, res: Response) => {
  try {
    const contestId = req.params.id as string;
    const { sessionId, index, chunk } = req.body as { sessionId: string; index: number; chunk: string };
    const userId = req.user!.userId;

    if (!sessionId || index === undefined || !chunk) {
      res.status(400).json({ error: "sessionId, index, and chunk are required" });
      return;
    }

    if (typeof sessionId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(sessionId)) {
      res.status(400).json({ error: "Invalid sessionId format" });
      return;
    }

    const parsedIndex = Number(index);
    if (!Number.isInteger(parsedIndex) || parsedIndex < 0) {
      res.status(400).json({ error: "index must be a non-negative integer" });
      return;
    }

    const participant = await prisma.contestParticipant.findUnique({
      where: { contestId_userId: { contestId, userId } }
    });

    if (!participant) {
      res.status(404).json({ error: "Participant not found in contest" });
      return;
    }

    // Decode base64 to binary buffer
    const buffer = Buffer.from(chunk, 'base64');

    // Save the chunk to disk
    const dir = path.join(process.cwd(), 'uploads', 'recordings', sessionId);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const filePath = path.join(dir, `chunk_${parsedIndex}.webm`);
    fs.writeFileSync(filePath, buffer);

    // Save in Database
    const relativePath = `uploads/recordings/${sessionId}/chunk_${parsedIndex}.webm`;
    const recordingChunk = await prisma.recordingChunk.create({
      data: {
        sessionId,
        index: parsedIndex,
        url: relativePath
      }
    });

    // Link session ID to the participant in database if not already linked
    if (participant.recordingSessionId !== sessionId) {
      await prisma.contestParticipant.update({
        where: { id: participant.id },
        data: { recordingSessionId: sessionId }
      });
    }

    res.json({ success: true, chunkId: recordingChunk.id });
  } catch (error: any) {
    console.error("Error saving recording chunk:", error);
    res.status(500).json({ error: "Failed to save recording chunk" });
  }
});

// GET /api/contests/manager/:id/participants/:userId/logs
router.get("/:id/participants/:userId/logs", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id, userId } = req.params as { id: string; userId: string };
    const currentUserId = req.user!.userId;

    const contest = await prisma.contest.findUnique({
      where: { id },
      select: { createdById: true },
    });

    if (!contest) {
      res.status(404).json({ error: "Contest not found" });
      return;
    }

    if (contest.createdById !== currentUserId && req.user!.roleName !== "admin") {
      res.status(403).json({ error: "Forbidden: only the contest creator or an admin can view participant logs" });
      return;
    }

    const logs = await prisma.contestActivityLog.findMany({
      where: { contestId: id, userId },
      orderBy: { createdAt: "desc" }
    });

    res.json({ logs });
  } catch (error: any) {
    console.error("Error fetching participant logs:", error);
    res.status(500).json({ error: "Failed to fetch participant logs" });
  }
});

// GET /api/contests/manager/:id/logs
router.get("/:id/logs", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const currentUserId = req.user!.userId;

    const contest = await prisma.contest.findUnique({
      where: { id },
      select: { createdById: true },
    });

    if (!contest) {
      res.status(404).json({ error: "Contest not found" });
      return;
    }

    if (contest.createdById !== currentUserId && req.user!.roleName !== "admin") {
      res.status(403).json({ error: "Forbidden: only the contest creator or an admin can view logs" });
      return;
    }

    const logs = await prisma.contestActivityLog.findMany({
      where: { contestId: id },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
          }
        }
      },
      orderBy: { createdAt: "desc" },
      take: 200
    });

    res.json({ logs });
  } catch (error: any) {
    console.error("Error fetching contest logs:", error);
    res.status(500).json({ error: "Failed to fetch contest logs" });
  }
});

// GET /api/contests/manager/:id/my-logs
router.get("/:id/my-logs", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const userId = req.user!.userId;

    const logs = await prisma.contestActivityLog.findMany({
      where: { contestId: id, userId },
      orderBy: { createdAt: "desc" }
    });

    res.json({ logs });
  } catch (error: any) {
    console.error("Error fetching my logs:", error);
    res.status(500).json({ error: "Failed to fetch my logs" });
  }
});

// POST /api/contests/manager/:id/finalize
router.post("/:id/finalize", authenticateToken, async (req: Request, res: Response) => {
  try {
    const contestId = req.params.id as string;
    const userId = req.user!.userId;

    const participant = await prisma.contestParticipant.findUnique({
      where: { contestId_userId: { contestId, userId } }
    });

    if (!participant) {
      res.status(404).json({ error: "Participant not found" });
      return;
    }

    // Update status to COMPLETED
    await prisma.contestParticipant.update({
      where: { id: participant.id },
      data: {
        status: "COMPLETED"
      }
    });

    // Auto-submit all drafts as manual submissions
    await autoSubmitContestDrafts(contestId, userId, participant.id, "manual");

    res.json({ message: "Contest finalized successfully" });
  } catch (error: any) {
    console.error("Error finalizing contest:", error);
    res.status(500).json({ error: "Failed to finalize contest" });
  }
});

// GET /api/contests/manager/:id/my-report
router.get("/:id/my-report", authenticateToken, async (req: Request, res: Response) => {
  try {
    const contestId = req.params.id as string;
    const userId = req.user!.userId;

    const cacheKey = `contest:report:${contestId}:${userId}`;
    const cached = await getCached<string>(cacheKey).catch(() => null);
    if (cached) {
      res.json(JSON.parse(cached));
      return;
    }

    const contest = await prisma.contest.findUnique({
      where: { id: contestId },
      include: { problems: { include: { problem: true } } }
    });

    if (!contest) {
      res.status(404).json({ error: "Contest not found" });
      return;
    }

    const participant = await prisma.contestParticipant.findUnique({
      where: { contestId_userId: { contestId, userId } },
      include: { dispute: true, user: { select: { fullName: true, email: true } } }
    });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { fullName: true, email: true }
    });

    const participantData = participant || {
      id: `mock-${userId}-${contestId}`,
      contestId,
      userId,
      score: 0,
      solvedCount: 0,
      warnings: 0,
      isTerminated: false,
      joinedAt: contest.endTime,
      status: "COMPLETED",
      autoSubmitted: false,
      autoSubmittedAt: null,
      dispute: null,
      user: user || { fullName: "Student User", email: "" }
    };

    const submissions = await prisma.contestSubmission.findMany({
      where: { contestId, userId },
      orderBy: { submittedAt: "desc" }
    });

    const integrityEvents = await prisma.integrityEvent.findMany({
      where: { contestId, studentId: userId },
      orderBy: { detectedAt: "desc" }
    });

    // Percentile computation
    const allParticipants = await prisma.contestParticipant.findMany({
      where: { contestId },
      orderBy: { score: "asc" }
    });
    const totalParticipants = allParticipants.length;
    const rankIndex = allParticipants.findIndex(p => p.userId === userId);
    const cleanRankIndex = rankIndex >= 0 ? rankIndex : 0;
    const percentile = totalParticipants > 1 ? (cleanRankIndex / (totalParticipants - 1)) * 100 : 0;

    const reportData = {
      contest: {
        id: contest.id,
        title: contest.title,
        description: contest.description,
        duration: contest.duration,
        maxWarnings: contest.maxWarnings,
        startTime: contest.startTime,
        endTime: contest.endTime,
        problems: contest.problems,
        sebQuitPassword: contest.sebQuitPassword
      },
      participant: participantData,
      submissions,
      integrityEvents,
      percentile: Math.round(percentile)
    };

    await setCache(cacheKey, JSON.stringify(reportData), 600).catch(() => null);

    res.json(reportData);
  } catch (error: any) {
    console.error("Error fetching my contest report:", error);
    res.status(500).json({ error: "Failed to fetch my contest report" });
  }
});

// GET /api/contests/manager/:id/attempts/:userId/report
router.get("/:id/attempts/:userId/report", authenticateToken, async (req: Request, res: Response) => {
  try {
    const contestId = req.params.id as string;
    const { userId } = req.params as { userId: string };

    if (req.user!.roleName !== "teacher" && req.user!.roleName !== "admin") {
      res.status(403).json({ error: "Access denied: Instructor role required." });
      return;
    }

    const cacheKey = `contest:report:${contestId}:${userId}`;
    const cached = await getCached<string>(cacheKey).catch(() => null);
    if (cached) {
      res.json(JSON.parse(cached));
      return;
    }

    const contest = await prisma.contest.findUnique({
      where: { id: contestId },
      include: { problems: { include: { problem: true } } }
    });

    if (!contest) {
      res.status(404).json({ error: "Contest not found" });
      return;
    }

    const participant = await prisma.contestParticipant.findUnique({
      where: { contestId_userId: { contestId, userId } },
      include: { dispute: true, user: { select: { fullName: true, email: true } } }
    });

    if (!participant) {
      res.status(404).json({ error: "Participant not found" });
      return;
    }

    const submissions = await prisma.contestSubmission.findMany({
      where: { contestId, userId },
      orderBy: { submittedAt: "desc" }
    });

    const integrityEvents = await prisma.integrityEvent.findMany({
      where: { contestId, studentId: userId },
      orderBy: { detectedAt: "desc" }
    });

    const auditTrail = await prisma.contestAuditLog.findMany({
      where: { attemptId: participant.id },
      orderBy: { createdAt: "desc" }
    });

    const allParticipants = await prisma.contestParticipant.findMany({
      where: { contestId },
      orderBy: { score: "asc" }
    });
    const totalParticipants = allParticipants.length;
    const rankIndex = allParticipants.findIndex(p => p.userId === userId);
    const percentile = totalParticipants > 1 ? (rankIndex / (totalParticipants - 1)) * 100 : 100;

    const reportData = {
      contest: {
        id: contest.id,
        title: contest.title,
        description: contest.description,
        duration: contest.duration,
        maxWarnings: contest.maxWarnings,
        startTime: contest.startTime,
        endTime: contest.endTime,
        problems: contest.problems,
        sebQuitPassword: contest.sebQuitPassword
      },
      participant,
      submissions,
      integrityEvents,
      auditTrail,
      percentile: Math.round(percentile)
    };

    await setCache(cacheKey, JSON.stringify(reportData), 600).catch(() => null);

    res.json(reportData);
  } catch (error: any) {
    console.error("Error fetching attempt report:", error);
    res.status(500).json({ error: "Failed to fetch attempt report" });
  }
});

// GET /api/contests/manager/:id/attempts/export
router.get("/:id/attempts/export", authenticateToken, async (req: Request, res: Response) => {
  try {
    const contestId = req.params.id as string;
    if (req.user!.roleName !== "teacher" && req.user!.roleName !== "admin") {
      res.status(403).json({ error: "Access denied: Instructor role required." });
      return;
    }

    const contest = await prisma.contest.findUnique({ where: { id: contestId }, select: { createdById: true } });
    if (!contest) {
      res.status(404).json({ error: "Contest not found" });
      return;
    }
    if (contest.createdById !== req.user!.userId && req.user!.roleName !== "admin") {
      res.status(403).json({ error: "Access denied: You do not own this contest." });
      return;
    }

    const participants = await prisma.contestParticipant.findMany({
      where: { contestId },
      include: { user: { select: { fullName: true, email: true } }, dispute: true }
    });

    function sanitizeCsvCell(value: string): string {
      const sanitized = value.replace(/"/g, '""');
      if (/^[=+\-@\t\r]/.test(sanitized)) {
        return `"'"${sanitized}"`;
      }
      return `"${sanitized}"`;
    }

    let csv = "Name,Email,Score,Solved,Warnings,Status,Auto-Submitted,Dispute Status,Dispute Reason\n";
    for (const p of participants) {
      const name = sanitizeCsvCell(p.user.fullName);
      const email = sanitizeCsvCell(p.user.email);
      const score = p.score;
      const solved = p.solvedCount;
      const warnings = p.warnings;
      const status = sanitizeCsvCell(p.status);
      const autoSub = sanitizeCsvCell(p.autoSubmitted ? "Yes" : "No");
      const dispStatus = sanitizeCsvCell(p.dispute?.status || "NONE");
      const dispReason = sanitizeCsvCell(p.dispute?.reason ? p.dispute.reason.replace(/\n/g, ' ') : "N/A");
      csv += `${name},${email},${score},${solved},${warnings},${status},${autoSub},${dispStatus},${dispReason}\n`;
    }

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=contest_${contestId}_attempts.csv`);
    res.status(200).send(csv);
  } catch (error: any) {
    console.error("Error exporting attempts:", error);
    res.status(500).json({ error: "Failed to export attempts" });
  }
});

// POST /api/contests/manager/:id/attempts/:userId/dispute
router.post("/:id/attempts/:userId/dispute", authenticateToken, async (req: Request, res: Response) => {
  try {
    const contestId = req.params.id as string;
    const { userId } = req.params as { userId: string };
    const { reason } = req.body as { reason: string };

    if (!reason || reason.trim() === "") {
      res.status(400).json({ error: "Reason is required to raise a dispute." });
      return;
    }

    const participant = await prisma.contestParticipant.findUnique({
      where: { contestId_userId: { contestId, userId } }
    });

    if (!participant) {
      res.status(404).json({ error: "Participant not found" });
      return;
    }

    if (userId !== req.user!.userId && req.user!.roleName !== "teacher" && req.user!.roleName !== "admin") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const dispute = await prisma.dispute.upsert({
      where: { attemptId: participant.id },
      create: {
        attemptId: participant.id,
        reason,
        status: "SUBMITTED"
      },
      update: {
        reason,
        status: "SUBMITTED",
        createdAt: new Date()
      }
    });

    await delCache(`contest:report:${contestId}:${userId}`).catch(() => null);

    res.json({ message: "Dispute submitted successfully.", dispute });
  } catch (error: any) {
    console.error("Error submitting dispute:", error);
    res.status(500).json({ error: "Failed to submit dispute" });
  }
});

// POST /api/contests/manager/:id/attempts/:userId/dispute/resolve
router.post("/:id/attempts/:userId/dispute/resolve", authenticateToken, async (req: Request, res: Response) => {
  try {
    const contestId = req.params.id as string;
    const { userId } = req.params as { userId: string };
    const { action, resolution } = req.body as { action: "ACCEPT" | "REJECT"; resolution?: string };
    const actorId = req.user!.userId;

    if (req.user!.roleName !== "teacher" && req.user!.roleName !== "admin") {
      res.status(403).json({ error: "Access denied: Instructor role required." });
      return;
    }

    const participant = await prisma.contestParticipant.findUnique({
      where: { contestId_userId: { contestId, userId } }
    });

    if (!participant) {
      res.status(404).json({ error: "Participant not found" });
      return;
    }

    const oldDispute = await prisma.dispute.findUnique({
      where: { attemptId: participant.id }
    });

    const status = action === "ACCEPT" ? "ACCEPTED" : "REJECTED";

    const updatedDispute = await prisma.dispute.update({
      where: { attemptId: participant.id },
      data: {
        status,
        resolution: resolution || "N/A",
        resolvedBy: actorId,
        resolvedAt: new Date()
      }
    });

    await prisma.contestAuditLog.create({
      data: {
        actorId,
        action: action === "ACCEPT" ? "DISPUTE_ACCEPTED" : "DISPUTE_REJECTED",
        attemptId: participant.id,
        before: oldDispute ? JSON.parse(JSON.stringify(oldDispute)) : null,
        after: JSON.parse(JSON.stringify(updatedDispute))
      }
    });

    if (action === "ACCEPT") {
      await prisma.contestParticipant.update({
        where: { id: participant.id },
        data: {
          warnings: 0,
          isTerminated: false,
          status: "IN_PROGRESS",
          autoSubmitted: false,
          autoSubmittedAt: null
        }
      });
    }

    await delCache(`contest:report:${contestId}:${userId}`).catch(() => null);

    res.json({ message: "Dispute resolved successfully.", dispute: updatedDispute });
  } catch (error: any) {
    console.error("Error resolving dispute:", error);
    res.status(500).json({ error: "Failed to resolve dispute" });
  }
});

// POST /api/contests/manager/:id/attempts/:userId/reset-warnings
router.post("/:id/attempts/:userId/reset-warnings", authenticateToken, async (req: Request, res: Response) => {
  try {
    const contestId = req.params.id as string;
    const { userId } = req.params as { userId: string };
    const { reason } = req.body as { reason?: string };
    const actorId = req.user!.userId;

    if (req.user!.roleName !== "teacher" && req.user!.roleName !== "admin") {
      res.status(403).json({ error: "Access denied: Instructor role required." });
      return;
    }

    const participant = await prisma.contestParticipant.findUnique({
      where: { contestId_userId: { contestId, userId } }
    });

    if (!participant) {
      res.status(404).json({ error: "Participant not found" });
      return;
    }

    const updatedParticipant = await prisma.contestParticipant.update({
      where: { id: participant.id },
      data: {
        warnings: 0,
        isTerminated: false,
        status: "IN_PROGRESS",
        autoSubmitted: false,
        autoSubmittedAt: null,
        unblockedAt: new Date(),
        unblockNote: `Warnings reset to 0 by teacher. Reason: ${reason || "N/A"}`
      }
    });

    await prisma.contestAuditLog.create({
      data: {
        actorId,
        action: "RESET_WARNINGS",
        attemptId: participant.id,
        before: { warnings: participant.warnings },
        after: { warnings: 0 }
      }
    });

    await delCache(`contest:report:${contestId}:${userId}`).catch(() => null);

    res.json({ message: "Warnings reset successfully.", participant: updatedParticipant });
  } catch (error: any) {
    console.error("Error resetting warnings:", error);
    res.status(500).json({ error: "Failed to reset warnings" });
  }
});

// GET /api/contests/manager/:id/attempts/:userId/plagiarism
router.get("/:id/attempts/:userId/plagiarism", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id, userId } = req.params as { id: string; userId: string };
    res.json({
      similarityScore: 12,
      matchedStudents: [
        { name: "John Doe", email: "john@example.com", similarity: 12, matchedLinesCount: 4 }
      ]
    });
  } catch (error: any) {
    console.error("Error fetching plagiarism report:", error);
    res.status(500).json({ error: "Failed to fetch plagiarism report" });
  }
});

// GET /api/contests/manager/:id/attempts/:userId/report/download
router.get("/:id/attempts/:userId/report/download", authenticateToken, async (req: Request, res: Response) => {
  try {
    const contestId = req.params.id as string;
    const { userId } = req.params as { userId: string };
    
    try {
      const puppeteer = require("puppeteer");
      const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
      const page = await browser.newPage();
      
      const token = req.headers.authorization;
      await page.setExtraHTTPHeaders({
        Authorization: token || ""
      });
      
      const targetUrl = `http://localhost:3000/contests/${contestId}/report?pdf=1&userId=${userId}`;
      await page.goto(targetUrl, { waitUntil: "networkidle0" });
      const pdfBuffer = await page.pdf({ format: "A4", printBackground: true });
      await browser.close();
      
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=contest_${contestId}_report_${userId}.pdf`);
      res.send(pdfBuffer);
    } catch (pe) {
      console.warn("Puppeteer not available, redirecting to print view:", pe);
      res.redirect(`/contests/${contestId}/report?print=1&userId=${userId}`);
    }
  } catch (error: any) {
    console.error("Error generating PDF:", error);
    res.status(500).json({ error: "Failed to generate PDF report" });
  }
});

// POST /api/contests/manager/:id/seb-token — authenticated; generates unique session token for SEB deep linking
router.post("/:id/seb-token", authenticateToken, async (req: Request, res: Response) => {
  try {
    const contestId = req.params.id as string;
    const userId = req.user!.userId;
    const sessionToken = crypto.randomUUID();
    if (redis && redis.status === "ready") {
      await redis.setex(`seb:session:${sessionToken}`, 300, JSON.stringify({ userId, contestId }));
    } else {
      console.warn("Redis is not available for SEB session token storage.");
    }
    res.json({ sessionToken });
  } catch (error: any) {
    console.error("Error generating SEB token:", error);
    res.status(500).json({ error: "Failed to mint SEB session token" });
  }
});

// POST /api/contests/manager/:id/seb-config — authenticated; generates candidate SEB config file
router.post("/:id/seb-config", authenticateToken, async (req: Request, res: Response) => {
  try {
    const contestId = req.params.id as string;
    const userId = req.user!.userId;

    const contest = await prisma.contest.findUnique({
      where: { id: contestId },
      select: {
        id: true,
        title: true,
        requireSeb: true,
        sebConfig: true,
        sebQuitPassword: true
      }
    });

    if (!contest) {
      res.status(404).json({ error: "Contest not found" });
      return;
    }

    // Generate unique short-TTL session token (5 minutes expiration)
    const sessionToken = crypto.randomUUID();
    
    // Save to Redis: TTL = 300 seconds (5 mins)
    if (redis && redis.status === "ready") {
      await redis.setex(`seb:session:${sessionToken}`, 300, JSON.stringify({ userId, contestId }));
    } else {
      console.warn("Redis is not available for SEB session token storage.");
    }

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const startUrl = `${frontendUrl}/contests/${contestId}?sessionToken=${sessionToken}`;

    const configXml = generateSebConfig(startUrl, contest.sebConfig, contest.sebQuitPassword);

    res.setHeader("Content-Type", "application/x-safeexambrowser-config");
    res.setHeader("Content-Disposition", `attachment; filename="config.seb"`);
    res.send(configXml);
  } catch (error: any) {
    console.error("Error generating SEB config:", error);
    res.status(500).json({ error: "Failed to generate SEB config file" });
  }
});

// GET /api/contests/manager/:id/verify-seb — validates SEB environment signatures
router.get("/:id/verify-seb", authenticateToken, async (req: Request, res: Response) => {
  try {
    const contestId = req.params.id as string;
    const userId = req.user!.userId;
    const { sessionToken } = req.query as { sessionToken?: string };

    const contest = await prisma.contest.findUnique({
      where: { id: contestId },
      select: {
        id: true,
        title: true,
        requireSeb: true,
        sebConfigKey: true
      }
    });

    if (!contest) {
      res.status(404).json({ error: "Contest not found" });
      return;
    }

    if (!contest.requireSeb) {
      res.json({ verified: true, message: "SEB not required for this contest" });
      return;
    }

    // 1. Validate session token in Redis
    if (!sessionToken) {
      await logSebBreach(contestId, userId, "MISSING_SESSION_TOKEN", "Session token is missing in request query");
      res.status(403).json({ verified: false, error: "Missing session token" });
      return;
    }

    let sessionDataRaw = null;
    if (redis && redis.status === "ready") {
      sessionDataRaw = await redis.get(`seb:session:${sessionToken}`);
    }

    if (!sessionDataRaw) {
      await logSebBreach(contestId, userId, "INVALID_SESSION_TOKEN", "Session token is invalid or expired");
      res.status(403).json({ verified: false, error: "Session token is invalid or expired" });
      return;
    }

    const sessionData = JSON.parse(sessionDataRaw) as { userId: string; contestId: string };
    if (sessionData.userId !== userId || sessionData.contestId !== contestId) {
      await logSebBreach(contestId, userId, "TOKEN_IDENTITY_MISMATCH", "Session token identity mismatch");
      res.status(403).json({ verified: false, error: "Session token does not belong to this user/contest" });
      return;
    }

    // 2. Validate SEB Headers
    const configKeyHash = req.headers['x-safeexambrowser-configkeyhash'] as string | undefined;
    const requestHash = req.headers['x-safeexambrowser-requesthash'] as string | undefined;

    // Dev bypass: SEB does NOT inject headers for localhost — allow through on dev origins
    const origin = req.headers['origin'] || req.headers['referer'] || '';
    const isDevOrigin = /localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(origin);

    if (!configKeyHash && !requestHash && !isDevOrigin) {
      await logSebBreach(contestId, userId, "SEB_HEADERS_MISSING", "Safe Exam Browser headers are completely missing (Not running inside SEB client)");
      res.status(403).json({ verified: false, error: "SEB headers missing" });
      return;
    }

    // Verify ConfigKeyHash if expected configKey is set in contest settings
    if (contest.sebConfigKey && contest.sebConfigKey.trim().length > 0 && configKeyHash && !isDevOrigin) {
      if (configKeyHash !== contest.sebConfigKey) {
        await logSebBreach(
          contestId,
          userId,
          "CONFIG_KEY_MISMATCH",
          `Tampered configuration detected. Expected Config Key: ${contest.sebConfigKey}, Received: ${configKeyHash || "none"}`
        );
        res.status(403).json({ verified: false, error: "SEB configuration hash mismatch (Config tampered)" });
        return;
      }
    }

    // Success! Update active session token for the participant
    const participant = await prisma.contestParticipant.findUnique({
      where: { contestId_userId: { contestId, userId } }
    });

    let tokenToUse = sessionToken;
    if (participant) {
      tokenToUse = participant.activeSessionToken || sessionToken;
      await prisma.contestParticipant.update({
        where: { id: participant.id },
        data: { activeSessionToken: tokenToUse }
      });
    }

    // Log successful SEB entry for teacher audit trail
    await prisma.contestActivityLog.create({
      data: {
        contestId,
        userId,
        eventType: "SEB_SESSION_START",
        description: `Candidate successfully entered the exam using Safe Exam Browser. SEB headers validated. Session token accepted.`
      }
    });

    // Delete temporary redis token after successful validation to prevent token reuse
    if (redis && redis.status === "ready") {
      await redis.del(`seb:session:${sessionToken}`);
    }

    res.json({ verified: true, activeSessionToken: tokenToUse });
  } catch (error: any) {
    console.error("Error verifying SEB credentials:", error);
    res.status(500).json({ error: "Failed to verify SEB environment" });
  }
});

// Helper to log a SEB integrity breach event to the violation log
async function logSebBreach(contestId: string, userId: string, violationType: string, description: string) {
  try {
    await prisma.contestActivityLog.create({
      data: {
        contestId,
        userId,
        eventType: `SEB_${violationType}`,
        description
      }
    });

    const participant = await prisma.contestParticipant.findUnique({
      where: { contestId_userId: { contestId, userId } }
    });
    if (participant) {
      await notifyViolationReport(contestId, participant.id, `SEB_${violationType}`, description);
    }
  } catch (err) {
    console.error("Failed to log SEB breach:", err);
  }
}

export default router;