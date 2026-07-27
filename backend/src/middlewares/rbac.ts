import { Request, Response, NextFunction } from "express";

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
