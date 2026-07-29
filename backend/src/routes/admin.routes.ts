import { Router } from 'express';
import prisma from '../lib/prisma';
import { authenticateToken } from '../middlewares/auth';
import { requireRole } from '../middlewares/rbac';

const router = Router();

router.use(authenticateToken, requireRole('super_admin'));

router.get('/organizations', async (req, res) => {
  try {
    const { page = '1', limit = '20', search } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = search
      ? {
          OR: [
            { name: { contains: String(search), mode: 'insensitive' } },
            { slug: { contains: String(search), mode: 'insensitive' } },
          ],
        }
      : {};

    const [organizations, total] = await Promise.all([
      prisma.organization.findMany({
        where,
        skip,
        take: Number(limit),
        include: { _count: { select: { users: true, contests: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.organization.count({ where }),
    ]);

    res.json({
      organizations,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch organizations' });
  }
});

router.get('/organizations/:id', async (req, res) => {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: req.params.id },
      include: {
        users: {
          select: {
            id: true, name: true, email: true, role: true, status: true,
            lastLoginAt: true, createdAt: true,
          },
        },
        _count: { select: { users: true, contests: true } },
      },
    });
    if (!org) return res.status(404).json({ error: 'Organization not found' });
    res.json({ organization: org });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch organization' });
  }
});

router.patch('/organizations/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['ACTIVE', 'SUSPENDED'].includes(status)) {
      return res.status(400).json({ error: 'Status must be ACTIVE or SUSPENDED' });
    }

    const org = await prisma.organization.update({
      where: { id: req.params.id },
      data: { status },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        organizationId: org.id,
        action: status === 'SUSPENDED' ? 'ORG_SUSPEND' : 'ORG_ACTIVATE',
        resource: 'organization',
        resourceId: org.id,
      },
    });

    res.json({ organization: org });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update status' });
  }
});

router.patch('/organizations/:id/tier', async (req, res) => {
  try {
    const { tier } = req.body;
    if (!['FREE', 'PRO', 'ENTERPRISE'].includes(tier)) {
      return res.status(400).json({ error: 'Invalid tier' });
    }

    const tierConfig: Record<string, { maxContests: number; maxUsers: number }> = {
      FREE: { maxContests: 5, maxUsers: 50 },
      PRO: { maxContests: 25, maxUsers: 500 },
      ENTERPRISE: { maxContests: 9999, maxUsers: 99999 },
    };

    const org = await prisma.organization.update({
      where: { id: req.params.id },
      data: { subscriptionTier: tier as any, ...tierConfig[tier] },
    });

    res.json({ organization: org });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update tier' });
  }
});

router.patch('/organizations/:id/features', async (req, res) => {
  try {
    const { featureFlags } = req.body;
    const org = await prisma.organization.update({
      where: { id: req.params.id },
      data: { featureFlags },
    });
    res.json({ organization: org });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update features' });
  }
});

router.get('/analytics', async (_req, res) => {
  try {
    const [totalOrgs, activeOrgs, totalUsers, totalContests, activeContests, totalSubmissions] =
      await Promise.all([
        prisma.organization.count(),
        prisma.organization.count({ where: { status: 'ACTIVE' } }),
        prisma.user.count(),
        prisma.contest.count(),
        prisma.contest.count({
          where: { startTime: { lte: new Date() }, endTime: { gte: new Date() } },
        }),
        prisma.submission.count(),
      ]);

    const usersByRole = await prisma.user.groupBy({ by: ['role'], _count: true });
    const orgsByTier = await prisma.organization.groupBy({ by: ['subscriptionTier'], _count: true });

    res.json({
      analytics: {
        totalOrgs, activeOrgs, totalUsers, totalContests, activeContests, totalSubmissions,
        usersByRole, orgsByTier,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

router.get('/users', async (req, res) => {
  try {
    const { page = '1', limit = '20', search, role } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: String(search), mode: 'insensitive' } },
        { email: { contains: String(search), mode: 'insensitive' } },
      ];
    }
    if (role) where.role = role;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: Number(limit),
        select: {
          id: true, name: true, email: true, role: true, status: true,
          organizationId: true, lastLoginAt: true, createdAt: true,
          organization: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      users, total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.patch('/users/:id/suspend', async (req, res) => {
  try {
    const { status } = req.body;
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { status: status || 'SUSPENDED' },
      select: { id: true, name: true, email: true, role: true, status: true },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'USER_SUSPEND',
        resource: 'user',
        resourceId: user.id,
        details: { targetEmail: user.email, newStatus: user.status },
      },
    });

    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

router.get('/audit', async (req, res) => {
  try {
    const { page = '1', limit = '50', action, organizationId } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {};
    if (action) where.action = action;
    if (organizationId) where.organizationId = organizationId;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take: Number(limit),
        include: { user: { select: { name: true, email: true } } },
        orderBy: { timestamp: 'desc' },
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({
      logs, total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

export default router;
