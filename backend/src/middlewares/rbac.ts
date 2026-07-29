import { Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma";

export function requireMinLevel(minLevel: number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    const userLevel = req.user.hierarchyLevel || 5;
    if (userLevel > minLevel) {
      res.status(403).json({ error: "Insufficient permission for this resource" });
      return;
    }
    next();
  };
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    const userRole = req.user.roleName.toLowerCase();
    if (!roles.map(r => r.toLowerCase()).includes(userRole)) {
      res.status(403).json({ error: "Access denied for your role" });
      return;
    }
    next();
  };
}

export function requireOrgAccess(paramName: string = 'id') {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    if (req.user.hierarchyLevel === 1) {
      next();
      return;
    }

    if (!req.user.organizationId) {
      res.status(403).json({ error: "No organization associated with your account" });
      return;
    }

    const resourceId = req.params[paramName];
    if (!resourceId) {
      next();
      return;
    }

    const contest = await prisma.contest.findUnique({
      where: { id: resourceId },
      select: { organizationId: true, createdById: true },
    });

    if (contest && contest.organizationId === req.user.organizationId) {
      next();
      return;
    }

    if (contest && contest.createdById === req.user.userId) {
      next();
      return;
    }

    res.status(403).json({ error: "You don't have access to this resource" });
  };
}

export function requireContestAccess() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    if (req.user.hierarchyLevel <= 2) {
      next();
      return;
    }

    const contestId = req.params.id || req.params.contestId;
    if (!contestId) {
      next();
      return;
    }

    const contest = await prisma.contest.findUnique({
      where: { id: contestId },
      select: { createdById: true },
    });

    if (contest?.createdById === req.user.userId) {
      next();
      return;
    }

    const assignment = await (prisma as any).contestAssignment.findUnique({
      where: { contestId_userId: { contestId, userId: req.user.userId } },
    });

    if (assignment) {
      next();
      return;
    }

    res.status(403).json({ error: "You are not assigned to this contest" });
  };
}

export function requireOwnership() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    if (req.user.hierarchyLevel <= 3) {
      next();
      return;
    }

    if (req.params.id) {
      const submission = await prisma.submission.findUnique({
        where: { id: req.params.id },
        select: { userId: true },
      });
      if (submission?.userId === req.user.userId) {
        next();
        return;
      }
    }

    if (req.params.userId && req.params.userId === req.user.userId) {
      next();
      return;
    }

    res.status(403).json({ error: "You do not own this resource" });
  };
}
