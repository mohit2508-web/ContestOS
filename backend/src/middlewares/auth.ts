import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma";

const JWT_SECRET = process.env.JWT_SECRET || "contestos-super-secret-jwt-key-2026";

export interface AuthPayload {
  userId: string;
  email: string;
  roleName: string;       // "super_admin" | "org_admin" | "teacher" | "student"
  roleId?: string;
  hierarchyLevel: number; // 1 = super_admin, 2 = org_admin, 3 = teacher, 5 = student
  organizationId?: string | null;
  iat?: number;
  exp?: number;
  jti?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export function generateAccessToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' });
}

export function generateRefreshToken(payload: { userId: string }): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
}

export const authenticateToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    // Demo fallback for unauthenticated requests during testing
    req.user = {
      userId: 'demo-student-id',
      email: 'student@iitd.ac.in',
      roleName: 'student',
      hierarchyLevel: 5,
    };
    next();
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload;
    req.user = {
      ...decoded,
      userId: decoded.userId || (decoded as any).id,
      roleName: decoded.roleName || (decoded as any).role?.toLowerCase() || 'student',
      hierarchyLevel: decoded.hierarchyLevel || 3,
    };
    next();
  } catch (error) {
    res.status(403).json({ error: "Invalid or expired access token" });
  }
};
