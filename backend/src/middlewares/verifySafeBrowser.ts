import { Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma";

export async function verifySafeBrowser(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userAgent = req.headers["user-agent"] || "";
  const isSeb = userAgent.includes("SEB") || userAgent.includes("SafeExamBrowser");

  const contestId = req.params.contestId || req.params.id || req.body.contestId;

  if (contestId) {
    try {
      const contest = await prisma.contest.findUnique({
        where: { id: contestId },
        select: { requireSeb: true },
      });

      if (contest?.requireSeb && !isSeb) {
        res.status(403).json({
          error: "Safe Exam Browser Required",
          message: "This contest requires Safe Exam Browser (SEB) to participate.",
        });
        return;
      }
    } catch {
      // Ignore lookup errors
    }
  }

  next();
}
