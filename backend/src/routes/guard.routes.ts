import { Router, Request, Response } from "express";
import { authenticateToken } from "../middlewares/auth";
import prisma from "../lib/prisma";
import jwt from "jsonwebtoken";
import { autoSubmitContestDrafts } from "./contest-manager.routes";

const router = Router();
if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET environment variable is required");
const JWT_SECRET = process.env.JWT_SECRET;

// POST /api/contests/:id/lobby/agent-pairing-token
router.post("/:id/lobby/agent-pairing-token", authenticateToken, async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const userId = req.user!.userId;
  try {
    const token = jwt.sign(
      {
        userId,
        contestId: id,
        type: "agent_pairing"
      },
      JWT_SECRET,
      { expiresIn: "10m" }
    );
    res.json({ pairingToken: token });
  } catch (error) {
    res.status(500).json({ error: "Failed to create pairing token" });
  }
});

// POST /api/contests/:id/lobby/agent-report
router.post("/:id/lobby/agent-report", authenticateToken, async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { pairingToken, blockedAppsFound, remoteSessionDetected, displayCount } = req.body;

  try {
    if (!pairingToken) {
      res.status(400).json({ error: "Missing pairing token" });
      return;
    }

    const decoded = jwt.verify(pairingToken, JWT_SECRET) as any;
    if (decoded.contestId !== id || decoded.type !== "agent_pairing") {
      res.status(403).json({ error: "Invalid pairing token context" });
      return;
    }

    const studentId = decoded.userId;

    // Load student user to get their name for WS broadcast
    const user = await prisma.user.findUnique({
      where: { id: studentId }
    });
    const userName = user?.fullName || user?.email || "Anonymous Student";

    // Find or create StudentDiagnostics record
    let diagnostics = await prisma.studentDiagnostics.findFirst({
      where: { contestId: id, studentId }
    });

    if (diagnostics) {
      diagnostics = await prisma.studentDiagnostics.update({
        where: { id: diagnostics.id },
        data: {
          integrityTier: "verified",
          agentPaired: true,
          blockedAppsFound: blockedAppsFound || [],
          remoteSessionDetected: !!remoteSessionDetected,
          displayCount: Number(displayCount) || 1,
          lastAgentReportAt: new Date()
        }
      });
    } else {
      diagnostics = await prisma.studentDiagnostics.create({
        data: {
          contestId: id,
          studentId,
          integrityTier: "verified",
          agentPaired: true,
          blockedAppsFound: blockedAppsFound || [],
          remoteSessionDetected: !!remoteSessionDetected,
          displayCount: Number(displayCount) || 1,
          lastAgentReportAt: new Date(),
          reportHash: "AGENT_VERIFIED_INITIAL"
        }
      });
    }

    // Push real-time update to WebSocket room
    if (typeof (global as any).wsBroadcast === "function") {
      (global as any).wsBroadcast(`contest_lobby_${id}`, {
        type: "lobby_status",
        userId: studentId,
        userName,
        status: blockedAppsFound?.length > 0 || remoteSessionDetected ? "Failed Check" : "Ready",
        checkpoint: 3,
        diagnostics: {
          agentPaired: true,
          blockedAppsFound: blockedAppsFound || [],
          remoteSessionDetected: !!remoteSessionDetected,
          monitors: Number(displayCount) || 1
        }
      });
    }

    res.json({ success: true, diagnostics });
  } catch (error) {
    res.status(403).json({ error: "Pairing token validation failed" });
  }
});

// POST /api/contests/:id/lobby/integrity-event
router.post("/:id/lobby/integrity-event", authenticateToken, async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const userId = req.user!.userId;
  const { eventType, detail } = req.body;

  try {
    // 1. Create IntegrityEvent
    const integrityEvent = await prisma.integrityEvent.create({
      data: {
        contestId: id,
        studentId: userId,
        eventType,
        detail: detail || {}
      }
    });

    // 2. Load student user details
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });
    const userName = user?.fullName || user?.email || "Anonymous Student";

    // 3. If the student has an active contest participant record, increment their warnings count (skip for informational events)
    const participant = await prisma.contestParticipant.findUnique({
      where: { contestId_userId: { contestId: id, userId } }
    });

    if (participant && !participant.isTerminated) {
      const isInformational = ["keyboard_lock_unavailable", "attempted_shortcut", "contest_resumed"].includes(eventType);

      if (isInformational) {
        // Create informational activity log
        await prisma.contestActivityLog.create({
          data: {
            contestId: id,
            userId,
            eventType,
            description: `App Integrity Info: ${eventType} - ${JSON.stringify(detail)}`
          }
        });

        // Push real-time alert via WebSocket room
        if (typeof (global as any).wsBroadcast === "function") {
          (global as any).wsBroadcast(`contest_lobby_${id}`, {
            type: "lobby_status",
            userId,
            userName,
            status: "Failed Check",
            checkpoint: 3,
            diagnostics: {
              warnings: participant.warnings,
              maxWarnings: 3,
              isTerminated: false,
              integrityEvent: {
                eventType,
                detail
              }
            }
          });
        }

        res.json({
          success: true,
          integrityEvent,
          warnings: participant.warnings,
          isTerminated: false
        });
        return;
      }

      // Check 1.5s warning debounce for standard violations
      const recentLog = await prisma.contestActivityLog.findFirst({
        where: {
          contestId: id,
          userId,
          createdAt: { gte: new Date(Date.now() - 1500) },
          eventType: { notIn: ["keyboard_lock_unavailable", "attempted_shortcut", "contest_resumed"] }
        }
      });
      const isDebounced = !!recentLog;

      // Create standard ContestActivityLog for actual violations
      await prisma.contestActivityLog.create({
        data: {
          contestId: id,
          userId,
          eventType,
          description: `App Integrity Violation: ${eventType} - ${JSON.stringify(detail)}`
        }
      });

      const contest = await prisma.contest.findUnique({
        where: { id },
        select: { maxWarnings: true }
      });
      const maxAllowed = contest?.maxWarnings ?? 3;

      let newWarnings = participant.warnings;
      let shouldTerminate: boolean = participant.isTerminated;

      if (!isDebounced) {
        const updatedParticipant = await prisma.contestParticipant.update({
          where: { id: participant.id },
          data: { warnings: { increment: 1 } }
        });
        newWarnings = updatedParticipant.warnings;
        shouldTerminate = newWarnings >= maxAllowed;

        if (shouldTerminate && !participant.isTerminated) {
          await prisma.contestParticipant.update({
            where: { id: participant.id },
            data: {
              isTerminated: true,
              status: "TERMINATED",
              blockReason: "EXCEEDED_WARNINGS",
              blockedAt: new Date(),
              autoSubmitted: true,
              autoSubmittedAt: new Date()
            }
          });
          // Perform server-side auto-submit of student drafts
          await autoSubmitContestDrafts(id, userId, participant.id, "auto_violation");
        }
      }

      // Push real-time alert via WebSocket room
      if (typeof (global as any).wsBroadcast === "function") {
        (global as any).wsBroadcast(`contest_lobby_${id}`, {
          type: "lobby_status",
          userId,
          userName,
          status: shouldTerminate ? "Terminated" : newWarnings >= maxAllowed - 1 ? "At Risk" : "Failed Check",
          checkpoint: 3,
          diagnostics: {
            warnings: newWarnings,
            maxWarnings: maxAllowed,
            isTerminated: shouldTerminate,
            integrityEvent: {
              eventType,
              detail: {
                ...detail,
                isDebounced,
                warnings: newWarnings,
                maxWarnings: maxAllowed,
                isTerminated: shouldTerminate
              }
            }
          }
        });
      }

      res.json({
        success: true,
        integrityEvent,
        warnings: newWarnings,
        isTerminated: shouldTerminate
      });
      return;
    }

    res.json({ success: true, integrityEvent });
  } catch (error: any) {
    console.error("Error logging app integrity event:", error);
    res.status(500).json({ error: "Failed to log integrity event" });
  }
});

// POST /api/contests/:id/attempts/:userId/reset-warnings
router.post("/:id/attempts/:userId/reset-warnings", authenticateToken, async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const userId = req.params.userId as string;
  const { reason } = req.body;

  try {
    // Re-verify caller role is teacher or admin
    if (req.user!.roleName !== "teacher" && req.user!.roleName !== "admin") {
      res.status(403).json({ error: "Only instructors can reset warnings." });
      return;
    }

    // Verify contest ownership — only the contest creator or an admin may reset warnings
    const contest = await prisma.contest.findUnique({
      where: { id },
      select: { createdById: true }
    });
    if (!contest) {
      res.status(404).json({ error: "Contest not found" });
      return;
    }
    if (contest.createdById !== req.user!.userId && req.user!.roleName !== "admin") {
      res.status(403).json({ error: "You are not authorized to reset warnings for this contest." });
      return;
    }

    const updatedParticipant = await prisma.contestParticipant.update({
      where: { contestId_userId: { contestId: id, userId } },
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

    // Log reset audit event
    await prisma.contestActivityLog.create({
      data: {
        contestId: id,
        userId,
        eventType: "warnings_reset",
        description: `Warnings reset to 0 by teacher. Reason: ${reason || "N/A"}`
      }
    });

    // Push real-time alert via WebSocket room to sync UI
    if (typeof (global as any).wsBroadcast === "function") {
      (global as any).wsBroadcast(`contest_lobby_${id}`, {
        type: "lobby_status",
        userId,
        status: "Verified Integrity",
        checkpoint: 3,
        diagnostics: {
          warnings: 0,
          isTerminated: false,
          integrityEvent: {
            eventType: "warnings_reset",
            detail: { reason }
          }
        }
      });
    }

    res.json({ success: true, participant: updatedParticipant });
  } catch (error: any) {
    console.error("Failed to reset warnings:", error);
    res.status(500).json({ error: "Failed to reset warnings" });
  }
});

// POST /api/contests/:id/attempts/request-review
router.post("/:id/attempts/request-review", authenticateToken, async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const userId = req.user!.userId;
  const { note } = req.body;

  try {
    await prisma.contestParticipant.update({
      where: { contestId_userId: { contestId: id, userId } },
      data: {
        reviewRequestNote: note
      }
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error("Failed to submit review request:", error);
    res.status(500).json({ error: "Failed to submit review request" });
  }
});

export default router;
