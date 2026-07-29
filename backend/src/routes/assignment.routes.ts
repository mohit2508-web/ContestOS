import { Router } from 'express';
import prisma from '../lib/prisma';
import { authenticateToken } from '../middlewares/auth';
import { requireRole } from '../middlewares/rbac';

const router = Router();

const VALID_CONTEST_ROLES = ['CONTENT_EDITOR', 'PROCTOR', 'EVALUATOR'];

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
      select: { organizationId: true },
    });
    if (!contest) return res.status(404).json({ error: 'Contest not found' });

    if (req.user!.hierarchyLevel > 1 && contest.organizationId !== req.user!.organizationId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const member = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true, role: true },
    });
    if (!member || member.organizationId !== contest.organizationId) {
      return res.status(400).json({ error: 'User is not a member of this organization' });
    }

    const assignment = await prisma.contestAssignment.create({
      data: {
        contestId,
        userId,
        assignedById: req.user!.userId,
        role: role || 'CONTENT_EDITOR',
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    res.status(201).json({ assignment });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return res.status(409).json({ error: 'User already assigned to this contest' });
    }
    console.error('Assign error:', error);
    res.status(500).json({ error: 'Failed to assign member' });
  }
});

router.delete('/:contestId/:userId', authenticateToken, requireRole('super_admin', 'org_admin'), async (req, res) => {
  try {
    await prisma.contestAssignment.delete({
      where: {
        contestId_userId: {
          contestId: req.params.contestId,
          userId: req.params.userId,
        },
      },
    });
    res.json({ message: 'Member unassigned from contest' });
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
