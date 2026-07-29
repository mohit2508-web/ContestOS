import { Router } from 'express';
import prisma from '../lib/prisma';
import { authenticateToken } from '../middlewares/auth';
import { requireRole } from '../middlewares/rbac';

const router = Router();

router.get('/subscription', authenticateToken, requireRole('super_admin', 'org_admin'), async (req, res) => {
  try {
    const orgId = req.user!.hierarchyLevel === 1 ? (req.query.orgId as string) : req.user!.organizationId;
    if (!orgId) return res.status(400).json({ error: 'Organization ID required' });

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, name: true, subscriptionTier: true, maxContests: true, maxUsers: true, status: true },
    });

    if (!org) return res.status(404).json({ error: 'Organization not found' });

    const [contestCount, userCount] = await Promise.all([
      prisma.contest.count({ where: { organizationId: orgId } }),
      prisma.user.count({ where: { organizationId: orgId } }),
    ]);

    res.json({
      subscription: {
        ...org,
        usage: {
          contests: { current: contestCount, max: org.maxContests },
          users: { current: userCount, max: org.maxUsers },
        },
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch subscription' });
  }
});

router.post('/upgrade', authenticateToken, requireRole('super_admin', 'org_admin'), async (req, res) => {
  try {
    const { tier, orgId } = req.body;
    const allowedTiers = ['FREE', 'PRO', 'ENTERPRISE'];
    if (!allowedTiers.includes(tier?.toUpperCase())) {
      return res.status(400).json({ error: 'Invalid tier' });
    }

    const targetOrgId = req.user!.hierarchyLevel === 1 ? (orgId || req.user!.organizationId) : req.user!.organizationId;
    if (!targetOrgId) return res.status(400).json({ error: 'Organization ID required' });

    const tierConfig: Record<string, { maxContests: number; maxUsers: number }> = {
      FREE: { maxContests: 5, maxUsers: 50 },
      PRO: { maxContests: 25, maxUsers: 500 },
      ENTERPRISE: { maxContests: 9999, maxUsers: 99999 },
    };

    const org = await prisma.organization.update({
      where: { id: targetOrgId },
      data: {
        subscriptionTier: tier.toUpperCase() as any,
        ...tierConfig[tier.toUpperCase()],
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        organizationId: targetOrgId,
        action: 'TIER_UPGRADE',
        resource: 'organization',
        resourceId: targetOrgId,
        details: { newTier: tier },
      },
    });

    res.json({ message: `Upgraded to ${tier}`, organization: org });
  } catch (error) {
    res.status(500).json({ error: 'Failed to upgrade' });
  }
});

router.get('/usage', authenticateToken, requireRole('super_admin', 'org_admin'), async (req, res) => {
  try {
    const orgId = req.user!.hierarchyLevel === 1 ? (req.query.orgId as string) : req.user!.organizationId;
    if (!orgId) return res.status(400).json({ error: 'Organization ID required' });

    const [totalContests, activeContests, totalUsers, totalSubmissions, recentSubmissions] = await Promise.all([
      prisma.contest.count({ where: { organizationId: orgId } }),
      prisma.contest.count({
        where: { organizationId: orgId, startTime: { lte: new Date() }, endTime: { gte: new Date() } },
      }),
      prisma.user.count({ where: { organizationId: orgId } }),
      prisma.submission.count({ where: { contest: { organizationId: orgId } } }),
      prisma.submission.count({
        where: { contest: { organizationId: orgId }, submittedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
      }),
    ]);

    res.json({
      usage: {
        totalContests, activeContests, totalUsers, totalSubmissions,
        recentSubmissionsLast30Days: recentSubmissions,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch usage' });
  }
});

export default router;
