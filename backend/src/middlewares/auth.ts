import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-for-dev';

export interface AuthPayload {
  userId: string;
  email: string;
  roleName: string;
  role?: string;
  roleId?: string;
  hierarchyLevel: number;
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
  if (!JWT_SECRET) throw new Error("JWT_SECRET not configured");
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function generateRefreshToken(payload: { userId: string }): string {
  if (!JWT_SECRET) throw new Error("JWT_SECRET not configured");
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
}

export const authenticateToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  if (!JWT_SECRET) {
    res.status(500).json({ error: "Server configuration error" });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload;
    const roleVal = decoded.role || decoded.roleName || (decoded as any).role?.toLowerCase() || 'student';
    req.user = {
      ...decoded,
      userId: decoded.userId || (decoded as any).id,
      roleName: roleVal,
      role: roleVal,
      hierarchyLevel: decoded.hierarchyLevel || 5,
    };
    next();
  } catch (error) {
    res.status(401).json({ error: "Invalid or expired token" });
  }
};

export const optionalAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];

  if (!token || !JWT_SECRET) {
    next();
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload;
    req.user = {
      ...decoded,
      userId: decoded.userId || (decoded as any).id,
      roleName: decoded.roleName || (decoded as any).role?.toLowerCase() || 'student',
      hierarchyLevel: decoded.hierarchyLevel || 5,
    };
  } catch {
    // Token invalid, proceed without user
  }
  next();
};
