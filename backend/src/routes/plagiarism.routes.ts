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

export default router;