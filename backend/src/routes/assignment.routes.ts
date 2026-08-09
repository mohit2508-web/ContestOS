import { Router } from 'express';
import prisma from '../lib/prisma';
import { authenticateToken } from '../middlewares/auth';
import { requireRole } from '../middlewares/rbac';

const router = Router();

const VALID_CONTEST_ROLES = ['CONTENT_EDITOR', 'PROCTOR', 'EVALUATOR'];

import { notificationEmitter } from './notification.routes';

router.post('/:contestId/assign', authenticateToken, requireRole('super_admin', 'org_admin'), async (req, res) => {
  try {
    const { userId, role } = req.body;
    const contestId = req.params.contestId;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    if (role && !VALID_CONTEST_ROLES.includes(role)) {
      return res.status(400).json({
        error: `Invalid role '${role}'. Must be one of: ${VALID_CONTEST_ROLES.join(', ')}`,
      });
    }

    const contest = await prisma.contest.findUnique({
      where: { id: contestId },
      select: { id: true, title: true, duration: true, startTime: true, organizationId: true },
    });
    if (!contest) return res.status(404).json({ error: 'Contest drive not found' });

    // Allow assignment if admin belongs to same org OR if contest has no org bound yet (auto-bind to admin's org)
    if (req.user!.hierarchyLevel > 1) {
      if (contest.organizationId && contest.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ error: 'Access denied: Contest belongs to another organization' });
      }
      // Auto-bind unlinked contest to admin's organization
      if (!contest.organizationId && req.user!.organizationId) {
        await prisma.contest.update({
          where: { id: contestId },
          data: { organizationId: req.user!.organizationId },
        });
      }
    }

    const member = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, organizationId: true, role: true },
    });
    if (!member) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    const assignedRole = role || (member.role === 'PROCTOR' ? 'PROCTOR' : 'EVALUATOR');

    const assignment = await prisma.contestAssignment.upsert({
      where: {
        contestId_userId: { contestId, userId },
      },
      update: {
        role: assignedRole,
        assignedById: req.user!.userId,
      },
      create: {
        contestId,
        userId,
        assignedById: req.user!.userId,
        role: assignedRole,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        assignedBy: { select: { id: true, name: true, email: true } },
      },
    });

    // 1. Role-specific Code of Conduct & Enterprise Guidelines
    let notificationTitle = '';
    let notificationMessage = '';
    let guidelines: string[] = [];

    if (assignedRole === 'EVALUATOR') {
      notificationTitle = `🎯 Official Evaluation Drive Assignment — ${contest.title}`;
      notificationMessage = `You have been officially appointed as Evaluator for drive "${contest.title}". Review candidate submissions and adhere strictly to evaluation rubrics.`;
      guidelines = [
        '1. Confidentiality: Candidate code and submissions are strictly confidential under organization policy.',
        '2. Rubric Alignment: Score submissions objectively following predefined problem rubrics without personal bias.',
        '3. SLA Compliance: Complete assigned evaluation queue within the drive window.',
        '4. Escalation: Refer ambiguous or zero-margin submissions to the Contest Moderator.',
      ];
    } else if (assignedRole === 'PROCTOR') {
      notificationTitle = `🛡️ Official Invigilation Drive Assignment — ${contest.title}`;
      notificationMessage = `You have been appointed as Chief Proctor for drive "${contest.title}". Monitor live feeds and log proctoring incidents immediately.`;
      guidelines = [
        '1. Real-time Vigilance: Continuously monitor webcam feeds, screen streams, and audio flags.',
        '2. Incident Verification: Verify automated AI flags (tab switch, face mismatch) before taking action.',
        '3. Session Termination: Terminate candidate session in cases of confirmed impersonation or unauthorized secondary device.',
        '4. Audit Trail: Maintain detailed incident notes in the official Proctor Log.',
      ];
    } else {
      notificationTitle = `📝 Official Contest Drive Assignment — ${contest.title}`;
      notificationMessage = `You have been assigned to drive "${contest.title}" as ${assignedRole}. Review drive settings and test cases.`;
      guidelines = [
        '1. Verify problem statements, constraints, and sample I/O prior to drive start.',
        '2. Maintain Question Bank and Test Case secrecy.',
        '3. Address candidate clarification queries during live drive window.',
      ];
    }

    // 2. Dispatch Professional Notification
    const assignNotification = await prisma.notification.create({
      data: {
        userId,
        title: notificationTitle,
        message: notificationMessage,
        type: 'CONTEST_ASSIGNMENT',
        data: {
          contestId: contest.id,
          contestTitle: contest.title,
          assignedRole,
          assignedByName: assignment.assignedBy?.name || 'Org Admin',
          assignedByEmail: assignment.assignedBy?.email,
          guidelines,
          assignedAt: new Date().toISOString(),
        },
      },
    });

    notificationEmitter.emit('push', { targetUserId: userId, notification: assignNotification });

    // 3. Log Audit Entry
    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'CONTEST_DRIVE_ASSIGNED',
        resource: 'contest',
        resourceId: contestId,
        details: {
          assignedToUserId: userId,
          assignedToName: member.name,
          assignedRole,
          contestTitle: contest.title,
        },
      },
    });

    res.status(201).json({
      assignment,
      message: `Drive "${contest.title}" assigned to ${member.name}. Official Code of Conduct notice delivered.`,
    });
  } catch (error: any) {
    console.error('Assign error:', error);
    res.status(500).json({ error: 'Failed to assign member to contest drive' });
  }
});

router.delete('/:contestId/:userId', authenticateToken, requireRole('super_admin', 'org_admin'), async (req, res) => {
  try {
    const contestId = req.params.contestId;
    const userId = req.params.userId;

    const [contest, member, performingAdmin] = await Promise.all([
      prisma.contest.findUnique({ where: { id: contestId }, select: { title: true } }),
      prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
      prisma.user.findUnique({ where: { id: req.user!.userId }, select: { name: true } }),
    ]);

    await prisma.contestAssignment.delete({
      where: {
        contestId_userId: { contestId, userId },
      },
    });

    if (contest && member) {
      const revokeNotification = await prisma.notification.create({
        data: {
          userId,
          title: `📋 Contest Drive Unassignment — ${contest.title}`,
          message: `Your drive assignment for "${contest.title}" has been updated and revoked by ${performingAdmin?.name || 'Org Admin'}.`,
          type: 'CONTEST_ASSIGNMENT',
          data: { contestId, contestTitle: contest.title, unassignedAt: new Date().toISOString() },
        },
      });

      notificationEmitter.emit('push', { targetUserId: userId, notification: revokeNotification });
    }

    res.json({ message: 'Member unassigned from contest drive.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to unassign member' });
  }
});

router.get('/:contestId', authenticateToken, async (req, res) => {
  try {
    const assignments = await prisma.contestAssignment.findMany({
      where: { contestId: req.params.contestId },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        assignedBy: { select: { id: true, name: true } },
      },
    });
    res.json({ assignments });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch assignments' });
  }
});

export default router;
