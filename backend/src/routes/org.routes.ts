import { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma';
import { authenticateToken, AuthPayload } from '../middlewares/auth';
import { requireRole } from '../middlewares/rbac';

const router = Router();

router.get('/', authenticateToken, requireRole('super_admin', 'org_admin'), async (req, res) => {
  try {
    if (req.user!.hierarchyLevel === 1) {
      const orgs = await prisma.organization.findMany({
        include: { _count: { select: { users: true, contests: true } } },
        orderBy: { createdAt: 'desc' },
      });
      return res.json({ organizations: orgs });
    }

    const org = await prisma.organization.findUnique({
      where: { id: req.user!.organizationId! },
      include: {
        _count: { select: { users: true, contests: true } },
        users: {
          select: { id: true, name: true, email: true, role: true, status: true, lastLoginAt: true },
        },
      },
    });

    if (!org) return res.status(404).json({ error: 'Organization not found' });
    res.json({ organization: org });
  } catch (error) {
    console.error('Get orgs error:', error);
    res.status(500).json({ error: 'Failed to fetch organizations' });
  }
});

router.post('/', authenticateToken, requireRole('super_admin'), async (req, res) => {
  try {
    const { name, slug, domain, logoUrl } = req.body;
    if (!name || !slug) {
      return res.status(400).json({ error: 'Name and slug are required' });
    }

    const existing = await prisma.organization.findUnique({ where: { slug } });
    if (existing) {
      return res.status(409).json({ error: 'Slug already taken' });
    }

    const org = await prisma.organization.create({
      data: { name, slug, domain, logoUrl },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        organizationId: org.id,
        action: 'ORG_CREATE',
        resource: 'organization',
        resourceId: org.id,
        details: { name, slug },
      },
    });

    res.status(201).json({ organization: org });
  } catch (error) {
    console.error('Create org error:', error);
    res.status(500).json({ error: 'Failed to create organization' });
  }
});

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: req.params.id },
      include: {
        _count: { select: { users: true, contests: true } },
        users: { select: { id: true, name: true, email: true, role: true, status: true } },
      },
    });

    if (!org) return res.status(404).json({ error: 'Organization not found' });

    if (req.user!.hierarchyLevel > 1 && req.user!.organizationId !== org.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ organization: org });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch organization' });
  }
});

router.patch('/:id', authenticateToken, requireRole('super_admin', 'org_admin'), async (req, res) => {
  try {
    if (req.user!.hierarchyLevel > 1 && req.user!.organizationId !== req.params.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { name, domain, logoUrl, status, subscriptionTier, featureFlags, maxContests, maxUsers } = req.body;
    const updateData: any = {};

    if (name !== undefined) updateData.name = name;
    if (domain !== undefined) updateData.domain = domain;
    if (logoUrl !== undefined) updateData.logoUrl = logoUrl;

    if (req.user!.hierarchyLevel === 1) {
      if (status !== undefined) updateData.status = status;
      if (subscriptionTier !== undefined) updateData.subscriptionTier = subscriptionTier;
      if (featureFlags !== undefined) updateData.featureFlags = featureFlags;
      if (maxContests !== undefined) updateData.maxContests = maxContests;
      if (maxUsers !== undefined) updateData.maxUsers = maxUsers;
    }

    const org = await prisma.organization.update({
      where: { id: req.params.id },
      data: updateData,
    });

    res.json({ organization: org });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update organization' });
  }
});

router.get('/:id/analytics', authenticateToken, requireRole('super_admin', 'org_admin'), async (req, res) => {
  try {
    if (req.user!.hierarchyLevel > 1 && req.user!.organizationId !== req.params.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const [userCount, contestCount, activeContests, submissionCount] = await Promise.all([
      prisma.user.count({ where: { organizationId: req.params.id } }),
      prisma.contest.count({ where: { organizationId: req.params.id } }),
      prisma.contest.count({
        where: {
          organizationId: req.params.id,
          startTime: { lte: new Date() },
          endTime: { gte: new Date() },
        },
      }),
      prisma.submission.count({
        where: { contest: { organizationId: req.params.id } },
      }),
    ]);

    res.json({
      analytics: {
        totalUsers: userCount,
        totalContests: contestCount,
        activeContests,
        totalSubmissions: submissionCount,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Team Member Routes

router.get('/:id/team', authenticateToken, requireRole('super_admin', 'org_admin'), async (req, res) => {
  try {
    if (req.user!.hierarchyLevel > 1 && req.user!.organizationId !== req.params.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const members = await prisma.user.findMany({
      where: { organizationId: req.params.id },
      select: {
        id: true, name: true, email: true, role: true, status: true,
        lastLoginAt: true, createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ members });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch team members' });
  }
});

router.post('/:id/team/invite', authenticateToken, requireRole('super_admin', 'org_admin'), async (req, res) => {
  try {
    if (req.user!.hierarchyLevel > 1 && req.user!.organizationId !== req.params.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const inviteRole = 'ORG_MEMBER';

    const existingInvitation = await prisma.teamInvitation.findFirst({
      where: { email, organizationId: req.params.id, status: 'PENDING' },
    });
    if (existingInvitation) {
      return res.status(409).json({ error: 'Invitation already pending for this email' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const invitation = await prisma.teamInvitation.create({
      data: {
        email,
        role: inviteRole as any,
        token,
        organizationId: req.params.id,
        invitedById: req.user!.userId,
        expiresAt,
      },
      include: {
        organization: { select: { name: true } },
        invitedBy: { select: { name: true, email: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        organizationId: req.params.id,
        action: 'MEMBER_INVITE',
        resource: 'team_invitation',
        resourceId: invitation.id,
        details: { email, role: inviteRole },
      },
    });

    res.status(201).json({
      invitation: { ...invitation, inviteLink: `/accept-invite?token=${token}` },
      message: 'Invitation created.',
    });
  } catch (error) {
    console.error('Invite error:', error);
    res.status(500).json({ error: 'Failed to create invitation' });
  }
});

router.post('/accept-invite', authenticateToken, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Invitation token required' });

    const invitation = await prisma.teamInvitation.findUnique({
      where: { token },
      include: { organization: true },
    });

    if (!invitation) return res.status(404).json({ error: 'Invitation not found' });
    if (invitation.status !== 'PENDING') return res.status(400).json({ error: 'Invitation already used' });
    if (invitation.expiresAt < new Date()) return res.status(400).json({ error: 'Invitation expired' });

    const currentUser = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (currentUser?.organizationId && currentUser.organizationId !== invitation.organizationId) {
      return res.status(409).json({
        error: 'You already belong to an organization. Leave your current organization before accepting this invitation.',
        currentOrganizationId: currentUser.organizationId,
      });
    }

    if (currentUser?.organizationId === invitation.organizationId) {
      await prisma.user.update({
        where: { id: req.user!.userId },
        data: { role: invitation.role as any, status: 'ACTIVE' },
      });
      await prisma.teamInvitation.update({
        where: { id: invitation.id },
        data: { status: 'ACCEPTED', acceptedAt: new Date() },
      });
      return res.json({ message: `Role updated in ${invitation.organization.name}`, organization: invitation.organization });
    }

    await prisma.user.update({
      where: { id: req.user!.userId },
      data: {
        organizationId: invitation.organizationId,
        role: invitation.role as any,
        status: 'ACTIVE',
      },
    });

    await prisma.teamInvitation.update({
      where: { id: invitation.id },
      data: { status: 'ACCEPTED', acceptedAt: new Date() },
    });

    res.json({ message: `Welcome to ${invitation.organization.name}!`, organization: invitation.organization });
  } catch (error) {
    res.status(500).json({ error: 'Failed to accept invitation' });
  }
});

router.delete('/:id/team/:userId', authenticateToken, requireRole('super_admin', 'org_admin'), async (req, res) => {
  try {
    if (req.user!.hierarchyLevel > 1 && req.user!.organizationId !== req.params.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (req.params.userId === req.user!.userId) {
      return res.status(400).json({ error: 'Cannot remove yourself from the team' });
    }

    const member = await prisma.user.findUnique({ where: { id: req.params.userId } });
    if (!member || member.organizationId !== req.params.id) {
      return res.status(404).json({ error: 'Member not found in this organization' });
    }

    if (member.role === 'ORG_ADMIN' && req.user!.hierarchyLevel > 1) {
      return res.status(403).json({ error: 'Cannot remove other admin accounts' });
    }

    await prisma.user.update({
      where: { id: req.params.userId },
      data: { organizationId: null, role: 'STUDENT' },
    });

    res.json({ message: 'Member removed from organization' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

router.patch('/:id/team/:userId/role', authenticateToken, requireRole('super_admin', 'org_admin'), async (req, res) => {
  try {
    if (req.user!.hierarchyLevel > 1 && req.user!.organizationId !== req.params.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { role } = req.body;
    const allowedRoles = ['ORG_MEMBER', 'EVALUATOR'];
    if (!allowedRoles.includes(role?.toUpperCase())) {
      return res.status(400).json({ error: 'Invalid role. Can only assign ORG_MEMBER or EVALUATOR.' });
    }

    await prisma.user.update({
      where: { id: req.params.userId },
      data: { role: role.toUpperCase() as any },
    });

    res.json({ message: 'Role updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update role' });
  }
});

export default router;
