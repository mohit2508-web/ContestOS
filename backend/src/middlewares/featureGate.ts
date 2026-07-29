import { Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma";

const TIER_FEATURES: Record<string, string[]> = {
  FREE: ['basic_proctoring'],
  PRO: ['basic_proctoring', 'full_proctoring', 'plagiarism', 'seb', 'custom_branding'],
  ENTERPRISE: ['basic_proctoring', 'full_proctoring', 'plagiarism', 'seb', 'custom_branding', 'api_access', 'priority_support'],
};

export function featureGate(...requiredFeatures: string[]) {
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
      res.status(403).json({ error: "No organization associated" });
      return;
    }

    const org = await prisma.organization.findUnique({
      where: { id: req.user.organizationId },
      select: { subscriptionTier: true, featureFlags: true, status: true },
    });

    if (!org || org.status !== 'ACTIVE') {
      res.status(403).json({ error: "Organization is not active" });
      return;
    }

    const tierFeatures = TIER_FEATURES[org.subscriptionTier] || TIER_FEATURES.FREE;
    const customFlags = (org.featureFlags as Record<string, boolean>) || {};

    for (const feature of requiredFeatures) {
      if (tierFeatures.includes(feature)) continue;
      if (customFlags[feature] === true) continue;

      res.status(403).json({
        error: `Feature '${feature}' requires a higher subscription tier`,
        currentTier: org.subscriptionTier,
        requiredFeature: feature,
      });
      return;
    }

    next();
  };
}
