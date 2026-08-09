import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '../generated/client';

const prisma = new PrismaClient();

/**
 * Super Admin Break-Glass Audit Logging Middleware
 * Intercepts SUPER_ADMIN requests to tenant-private resources and logs mandatory break-glass reasons.
 */
export async function breakGlassAuditMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const user = req.user;
    const userRole = String(user?.role || user?.roleName || '').toUpperCase();

    // Only inspect SUPER_ADMIN cross-tenant access
    if (user && userRole === 'SUPER_ADMIN') {
      const targetOrgId = req.query.orgId || req.body?.organizationId || req.params?.orgId;
      const breakGlassReason = req.headers['x-break-glass-reason'] as string;

      if (targetOrgId && targetOrgId !== user.organizationId) {
        if (!breakGlassReason || breakGlassReason.trim().length < 5) {
          return res.status(403).json({
            success: false,
            error: 'Break-Glass Security Policy: Mandatory X-Break-Glass-Reason header required for cross-tenant data access.',
          });
        }

        // Log Break-Glass Access Event
        await prisma.breakGlassAuditLog.create({
          data: {
            superAdminId: user.userId,
            organizationId: targetOrgId as string,
            resourcePath: req.originalUrl || req.path,
            actionType: req.method,
            reason: breakGlassReason,
          },
        });
      }
    }

    next();
  } catch (error: any) {
    console.error('Break-Glass Middleware Error:', error);
    next();
  }
}
