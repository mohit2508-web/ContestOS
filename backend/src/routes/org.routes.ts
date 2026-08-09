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
      where: {
        organizationId: req.params.id,
        role: { notIn: ['STUDENT', 'CANDIDATE', 'GUEST_CANDIDATE'] },
      },
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

import { notificationEmitter } from './notification.routes';

router.get('/:id/invitations', authenticateToken, requireRole('super_admin', 'org_admin'), async (req, res) => {
  try {
    if (req.user!.hierarchyLevel > 1 && req.user!.organizationId !== req.params.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const invitations = await prisma.teamInvitation.findMany({
      where: { organizationId: req.params.id },
      include: {
        invitedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ invitations });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch team invitations' });
  }
});

router.post('/:id/team/invite', authenticateToken, requireRole('super_admin', 'org_admin'), async (req, res) => {
  try {
    if (req.user!.hierarchyLevel > 1 && req.user!.organizationId !== req.params.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { email, role } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const inviteRole = (role || 'ORG_MEMBER').toUpperCase();

    const existingInvitation = await prisma.teamInvitation.findFirst({
      where: { email, organizationId: req.params.id, status: 'PENDING' },
    });
    if (existingInvitation) {
      return res.status(409).json({ error: 'Invitation already pending for this email address' });
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

    // Check if target user exists in system to deliver instant in-app notification
    const targetUser = await prisma.user.findUnique({ where: { email } });
    if (targetUser) {
      const inviterName = invitation.invitedBy?.name || invitation.invitedBy?.email || 'Org Admin';
      const notification = await prisma.notification.create({
        data: {
          userId: targetUser.id,
          title: `🏛️ Team Invitation from ${invitation.organization.name}`,
          message: `${inviterName} invited you to join ${invitation.organization.name} as ${inviteRole}. Click to review and respond.`,
          type: 'TEAM_INVITATION',
          data: {
            invitationId: invitation.id,
            token,
            organizationId: req.params.id,
            orgName: invitation.organization.name,
            role: inviteRole,
            invitedByName: inviterName,
          },
        },
      });

      notificationEmitter.emit('push', { targetUserId: targetUser.id, notification });
    }

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
      message: `Invitation sent to ${email} as ${inviteRole}.`,
    });
  } catch (error) {
    console.error('Invite error:', error);
    res.status(500).json({ error: 'Failed to create invitation' });
  }
});

router.post('/invitations/:id/accept', authenticateToken, async (req, res) => {
  try {
    const invitation = await prisma.teamInvitation.findUnique({
      where: { id: req.params.id },
      include: { organization: true, invitedBy: true },
    });

    if (!invitation) return res.status(404).json({ error: 'Invitation not found' });
    if (invitation.status !== 'PENDING') return res.status(400).json({ error: `Invitation already ${invitation.status.toLowerCase()}` });
    if (invitation.expiresAt < new Date()) return res.status(400).json({ error: 'Invitation expired' });

    // Update user role & org
    const updatedUser = await prisma.user.update({
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

    // Update recipient's notification so action card changes to accepted status
    await prisma.notification.updateMany({
      where: {
        userId: req.user!.userId,
        type: 'TEAM_INVITATION',
      },
      data: {
        isRead: true,
        title: `✅ Joined ${invitation.organization.name}`,
        message: `You accepted the invitation to join ${invitation.organization.name} as ${invitation.role}.`,
        data: { invitationId: invitation.id, token: invitation.token, status: 'ACCEPTED' },
      },
    });

    // Notify OrgAdmin about acceptance
    const adminNotification = await prisma.notification.create({
      data: {
        userId: invitation.invitedById,
        title: `✅ Invitation Accepted!`,
        message: `${updatedUser.name} (${updatedUser.email}) accepted your invitation to join ${invitation.organization.name} as ${invitation.role}.`,
        type: 'SYSTEM_ALERT',
        data: { organizationId: invitation.organizationId, acceptedUserId: updatedUser.id },
      },
    });
    notificationEmitter.emit('push', { targetUserId: invitation.invitedById, notification: adminNotification });

    res.json({ message: `Successfully joined ${invitation.organization.name} as ${invitation.role}!`, organization: invitation.organization, user: updatedUser });
  } catch (error) {
    console.error('Accept invitation error:', error);
    res.status(500).json({ error: 'Failed to accept invitation' });
  }
});

router.post('/invitations/:id/decline', authenticateToken, async (req, res) => {
  try {
    const invitation = await prisma.teamInvitation.findUnique({
      where: { id: req.params.id },
      include: { organization: true },
    });

    if (!invitation) return res.status(404).json({ error: 'Invitation not found' });
    if (invitation.status !== 'PENDING') return res.status(400).json({ error: `Invitation already ${invitation.status.toLowerCase()}` });

    await prisma.teamInvitation.update({
      where: { id: invitation.id },
      data: { status: 'REVOKED' },
    });

    const currentUser = await prisma.user.findUnique({ where: { id: req.user!.userId } });

    // Update recipient's notification status
    await prisma.notification.updateMany({
      where: {
        userId: req.user!.userId,
        type: 'TEAM_INVITATION',
      },
      data: {
        isRead: true,
        title: `❌ Invitation Declined`,
        message: `You declined the invitation to join ${invitation.organization.name}.`,
        data: { invitationId: invitation.id, status: 'DECLINED' },
      },
    });

    // Notify OrgAdmin about decline
    const adminNotification = await prisma.notification.create({
      data: {
        userId: invitation.invitedById,
        title: `❌ Invitation Declined`,
        message: `${currentUser?.name || currentUser?.email || 'Invited user'} declined the invitation to join ${invitation.organization.name}.`,
        type: 'SYSTEM_ALERT',
        data: { organizationId: invitation.organizationId },
      },
    });
    notificationEmitter.emit('push', { targetUserId: invitation.invitedById, notification: adminNotification });

    res.json({ message: 'Invitation declined.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to decline invitation' });
  }
});

router.delete('/invitations/:id', authenticateToken, requireRole('super_admin', 'org_admin'), async (req, res) => {
  try {
    const invitation = await prisma.teamInvitation.findUnique({ where: { id: req.params.id } });
    if (!invitation) return res.status(404).json({ error: 'Invitation not found' });

    if (req.user!.hierarchyLevel > 1 && req.user!.organizationId !== invitation.organizationId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await prisma.teamInvitation.delete({ where: { id: req.params.id } });
    res.json({ message: 'Invitation revoked.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to revoke invitation' });
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
      return res.status(400).json({ error: 'Cannot remove yourself from the organization team' });
    }

    const { reasonCategory, detailedNotes } = req.body || {};
    if (!reasonCategory || !detailedNotes || String(detailedNotes).trim().length < 15) {
      return res.status(400).json({
        error: 'Compliance Violation: Mandatory offboarding reason category and detailed justification notes (min 15 chars) are required.',
      });
    }

    const [member, organization, performingAdmin] = await Promise.all([
      prisma.user.findUnique({ where: { id: req.params.userId } }),
      prisma.organization.findUnique({ where: { id: req.params.id }, select: { name: true } }),
      prisma.user.findUnique({ where: { id: req.user!.userId }, select: { name: true, email: true } }),
    ]);

    if (!member || member.organizationId !== req.params.id) {
      return res.status(404).json({ error: 'Member not found in this organization' });
    }

    if (member.role === 'ORG_ADMIN' && req.user!.hierarchyLevel > 1) {
      return res.status(403).json({ error: 'Security Exception: Cannot remove other ORG_ADMIN accounts.' });
    }

    // 1. Delete active contest assignments for this user
    const deletedAssignments = await prisma.contestAssignment.deleteMany({
      where: { userId: req.params.userId, contest: { organizationId: req.params.id } },
    });

    // 2. Remove member from organization
    await prisma.user.update({
      where: { id: req.params.userId },
      data: { organizationId: null, role: 'STUDENT' },
    });

    // 3. Create AuditLog entry for compliance tracking
    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'TEAM_MEMBER_OFFBOARDED',
        resource: 'user',
        resourceId: req.params.userId,
        details: {
          offboardedUserEmail: member.email,
          offboardedUserName: member.name,
          offboardedUserRole: member.role,
          reasonCategory,
          detailedNotes,
          unassignedContestsCount: deletedAssignments.count,
          performedByAdmin: performingAdmin?.name || performingAdmin?.email,
          organizationId: req.params.id,
        },
      },
    });

    // 4. Send formal Exit Notice Notification to offboarded member
    const exitNotification = await prisma.notification.create({
      data: {
        userId: req.params.userId,
        title: `📋 Formal Organization Offboarding Notice — ${organization?.name || 'Organization'}`,
        message: `Your staff privileges and contest assignments at ${organization?.name || 'Organization'} have been officially revoked by ${performingAdmin?.name || 'Admin'}.\nReason: ${reasonCategory}.\nSummary Notes: ${detailedNotes}`,
        type: 'OFFBOARDING_NOTICE',
        data: {
          organizationId: req.params.id,
          organizationName: organization?.name,
          adminName: performingAdmin?.name || 'Org Admin',
          adminEmail: performingAdmin?.email,
          reasonCategory,
          detailedNotes,
          offboardedAt: new Date().toISOString(),
          unassignedContestsCount: deletedAssignments.count,
        },
      },
    });

    notificationEmitter.emit('push', { targetUserId: req.params.userId, notification: exitNotification });

    res.json({
      message: `Member ${member.name} offboarded successfully. Exit notice delivered & audit log created.`,
      unassignedContestsCount: deletedAssignments.count,
    });
  } catch (error) {
    console.error('Offboard member error:', error);
    res.status(500).json({ error: 'Failed to offboard team member' });
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
