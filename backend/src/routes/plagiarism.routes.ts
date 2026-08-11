import { Router, Request, Response } from "express";
import { authenticateToken } from "../middlewares/auth";
import { requireRole } from "../middlewares/rbac";
import plagiarismDetector from "../services/plagiarismDetector";
import prisma from "../lib/prisma";

const router = Router();

interface CheckPlagiarismBody {
  code: string;
  language: string;
}

interface CompareBody {
  code1: string;
  code2: string;
}

router.post("/check", authenticateToken, requireRole('super_admin', 'org_admin', 'org_member'), async (req: Request<{}, {}, CheckPlagiarismBody>, res: Response) => {
  try {
    const { code, language } = req.body;

    if (!code) {
      res.status(400).json({ error: "Code is required" });
      return;
    }

    const recentSubmissions = await prisma.submission.findMany({
      where: { language },
      orderBy: { submittedAt: "desc" },

      take: 100,
      select: { code: true },
    });

    const compareCodes = recentSubmissions.map((s) => s.code);
    const result = plagiarismDetector.checkPlagiarism(code, compareCodes, 0.6);

    res.json({
      isPlagiarized: result.isPlagiarized,
      similarity: result.similarity,
      matches: result.matches,
      analysis: result.analysis,
      fingerprint: plagiarismDetector.generateFingerprint(code),
    });
  } catch (error: unknown) {
    console.error("Plagiarism check error:", error);
    const message = error instanceof Error ? error.message : 'Plagiarism check failed';
    res.status(500).json({ error: message });
  }
});

router.post("/compare", authenticateToken, requireRole('super_admin', 'org_admin', 'org_member'), async (req: Request<{}, {}, CompareBody>, res: Response) => {
  try {
    const { code1, code2 } = req.body;

    if (!code1 || !code2) {
      res.status(400).json({ error: "Both codes are required" });
      return;
    }

    const result = plagiarismDetector.compareCodes(code1, code2);

    res.json({
      similarity: result.similarity,
      method: result.method,
    });
  } catch (error: unknown) {
    console.error("Comparison error:", error);
    const message = error instanceof Error ? error.message : 'Code comparison failed';
    res.status(500).json({ error: message });
  }
});

router.post("/fingerprint", authenticateToken, requireRole('super_admin', 'org_admin', 'org_member'), async (req: Request, res: Response) => {
  try {
    const { code } = req.body;
    if (!code) {
      res.status(400).json({ error: 'Code is required' });
      return;
    }
    const fingerprint = plagiarismDetector.generateFingerprint(code);
    res.json({ fingerprint });
  } catch (error: unknown) {
    console.error("Fingerprint generation error:", error);
    const message = error instanceof Error ? error.message : 'Fingerprint generation failed';
    res.status(500).json({ error: message });
  }
});

// POST /api/plagiarism/run/:contestId — Run batch plagiarism detector across all submissions in contest
router.post("/run/:contestId", authenticateToken, requireRole('super_admin', 'org_admin', 'org_member'), async (req: Request, res: Response) => {
  try {
    const { contestId } = req.params;
    const submissions = await prisma.submission.findMany({
      where: { contestId, status: 'ACCEPTED' },
      include: {
        user: { select: { id: true, name: true, email: true } },
        problem: { select: { id: true, title: true } },
      },
    });

    const reports: Array<{
      user1: any;
      user2: any;
      problem: any;
      similarity: number;
      method: string;
      code1?: string;
      code2?: string;
    }> = [];

    // Group by problemId
    const problemMap = new Map<string, typeof submissions>();
    for (const sub of submissions) {
      if (!sub.code || sub.code.length < 20) continue;
      const existing = problemMap.get(sub.problemId) || [];
      existing.push(sub);
      problemMap.set(sub.problemId, existing);
    }

    for (const [_, subs] of problemMap.entries()) {
      for (let i = 0; i < subs.length; i++) {
        for (let j = i + 1; j < subs.length; j++) {
          if (subs[i].userId === subs[j].userId) continue;

          const res = plagiarismDetector.compareCodes(subs[i].code, subs[j].code);
          if (res.similarity >= 0.5) {
            reports.push({
              user1: subs[i].user,
              user2: subs[j].user,
              problem: subs[i].problem,
              similarity: Math.round(res.similarity * 100),
              method: res.method,
              code1: subs[i].code,
              code2: subs[j].code,
            });
          }
        }
      }
    }

    reports.sort((a, b) => b.similarity - a.similarity);
    res.json({ success: true, count: reports.length, reports });
  } catch (error: unknown) {
    console.error("Batch plagiarism run error:", error);
    res.status(500).json({ error: 'Batch plagiarism detection failed' });
  }
});

export default router;