import { Router } from 'express';
import crypto from 'crypto';
import prisma from '../lib/prisma';
import { authenticateToken, optionalAuth } from '../middlewares/auth';
import { requireRole } from '../middlewares/rbac';

const router = Router();

// ─── POST /api/guest/invite/bulk ─────────────────────────────────────────────
// ORG_ADMIN bulk-invites external candidates to a contest
router.post('/invite/bulk', authenticateToken, requireRole('org_admin', 'super_admin'), async (req, res) => {
  try {
    const { contestId, emails }: { contestId: string; emails: { email: string; name?: string }[] } = req.body;
    if (!contestId || !emails || !emails.length) {
      return res.status(400).json({ error: 'contestId and emails[] are required' });
    }

    const contest = await prisma.contest.findUnique({ where: { id: contestId }, select: { id: true, title: true, endTime: true, organizationId: true } });
    if (!contest) return res.status(404).json({ error: 'Contest not found' });

    const orgId = req.user!.organizationId;
    if (req.user!.hierarchyLevel > 1 && contest.organizationId !== orgId) {
      return res.status(403).json({ error: 'Access denied to this contest' });
    }

    const expiresAt = new Date(Math.max(contest.endTime.getTime(), Date.now() + 7 * 24 * 60 * 60 * 1000));

    const invites = await Promise.all(
      emails.map(async ({ email, name }) => {
        const token = crypto.randomBytes(32).toString('hex');
        return prisma.guestInvite.upsert({
          where: { token },
          create: { contestId, email, name: name || null, token, expiresAt },
          update: { expiresAt }, // refresh expiry on re-invite
        });
      })
    );

    res.status(201).json({
      message: `${invites.length} guest invites created`,
      invites: invites.map(i => ({ email: i.email, token: i.token, link: `/guest/join/${i.token}` })),
    });
  } catch (err) {
    console.error('Guest bulk invite error:', err);
    res.status(500).json({ error: 'Failed to create guest invites' });
  }
});

// ─── GET /api/guest/invite/:token ────────────────────────────────────────────
// Validate a guest invite token and return contest info (no auth required)
router.get('/invite/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const invite = await prisma.guestInvite.findUnique({
      where: { token },
      include: {
        contest: {
          select: {
            id: true, title: true, description: true,
            startTime: true, endTime: true, duration: true, difficulty: true,
            organization: { select: { name: true, logoUrl: true } },
          },
        },
      },
    });

    if (!invite) return res.status(404).json({ error: 'Invalid or expired invite link' });
    if (invite.expiresAt < new Date()) return res.status(410).json({ error: 'This invite link has expired' });
    if (invite.usedAt && invite.guestUserId) return res.status(409).json({ error: 'This invite has already been used', alreadyUsed: true });

    res.json({
      valid: true,
      invite: { email: invite.email, name: invite.name },
      contest: invite.contest,
    });
  } catch (err) {
    console.error('Guest token validate error:', err);
    res.status(500).json({ error: 'Failed to validate invite' });
  }
});

// ─── POST /api/guest/join/:token ─────────────────────────────────────────────
// Guest candidate joins contest — creates ephemeral GUEST_CANDIDATE account
router.post('/join/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { name } = req.body;

    const invite = await prisma.guestInvite.findUnique({
      where: { token },
      include: { contest: { select: { id: true, endTime: true } } },
    });

    if (!invite) return res.status(404).json({ error: 'Invalid invite link' });
    if (invite.expiresAt < new Date()) return res.status(410).json({ error: 'Invite link has expired' });
    if (invite.usedAt) return res.status(409).json({ error: 'This invite has already been used' });

    // Create an ephemeral user account with GUEST_CANDIDATE role
    const guestEmail = `guest_${token.slice(0, 8)}@guest.contestos`;
    const guestName = name || invite.name || `Guest ${invite.email.split('@')[0]}`;

    let guestUser = await prisma.user.findFirst({ where: { email: guestEmail } });
    if (!guestUser) {
      guestUser = await prisma.user.create({
        data: {
          email: guestEmail,
          name: guestName,
          password: crypto.randomBytes(32).toString('hex'), // random unguessable password
          role: 'GUEST_CANDIDATE' as any,
          status: 'ACTIVE',
        },
      });
    }

    // Register the guest for the contest
    await prisma.contestRegistration.upsert({
      where: { contestId_userId: { contestId: invite.contestId, userId: guestUser.id } },
      create: { contestId: invite.contestId, userId: guestUser.id, status: 'REGISTERED' },
      update: {},
    });

    // Mark invite as used
    await prisma.guestInvite.update({
      where: { token },
      data: { usedAt: new Date(), guestUserId: guestUser.id },
    });

    // Generate short-lived access token (contest duration + 1hr buffer)
    const { generateAccessToken } = await import('../middlewares/auth');
    const accessToken = generateAccessToken({
      userId: guestUser.id,
      email: guestEmail,
      roleName: 'guest_candidate',
      hierarchyLevel: 7,
      organizationId: null,
    });

    res.json({
      accessToken,
      guestToken: token, // for result retrieval later
      contestId: invite.contestId,
      user: { id: guestUser.id, name: guestName, role: 'GUEST_CANDIDATE' },
    });
  } catch (err) {
    console.error('Guest join error:', err);
    res.status(500).json({ error: 'Failed to join contest as guest' });
  }
});

// ─── GET /api/guest/result/:token ─────────────────────────────────────────────
// Guest views their own results after contest ends
router.get('/result/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const invite = await prisma.guestInvite.findUnique({
      where: { token },
      include: {
        contest: { select: { id: true, title: true, endTime: true } },
      },
    });

    if (!invite || !invite.guestUserId) {
      return res.status(404).json({ error: 'Result not found' });
    }

    if (invite.contest.endTime > new Date()) {
      return res.status(403).json({ error: 'Results are not yet available — contest is still ongoing' });
    }

    const registration = await prisma.contestRegistration.findUnique({
      where: { contestId_userId: { contestId: invite.contestId, userId: invite.guestUserId } },
    });

    const submissions = await prisma.submission.findMany({
      where: { contestId: invite.contestId, userId: invite.guestUserId },
      select: { status: true, score: true, language: true, submittedAt: true, problem: { select: { title: true } } },
      orderBy: { submittedAt: 'asc' },
    });

    // Compute rank
    const allRegs = await prisma.contestRegistration.findMany({
      where: { contestId: invite.contestId },
      orderBy: [{ score: 'desc' }, { penalty: 'asc' }],
      select: { userId: true },
    });
    const rank = allRegs.findIndex(r => r.userId === invite.guestUserId) + 1;

    res.json({
      contest: { title: invite.contest.title },
      candidate: { name: invite.name || 'Guest Candidate', email: invite.email },
      result: { score: registration?.score || 0, penalty: registration?.penalty || 0, rank, totalParticipants: allRegs.length },
      submissions,
    });
  } catch (err) {
    console.error('Guest result error:', err);
    res.status(500).json({ error: 'Failed to fetch result' });
  }
});

// ─── GET /api/guest/invite/status/:contestId ──────────────────────────────────
// ORG_ADMIN: View how many guests joined vs total invited for a contest
router.get('/invite/status/:contestId', authenticateToken, requireRole('org_admin', 'super_admin'), async (req, res) => {
  try {
    const { contestId } = req.params;
    const invites = await prisma.guestInvite.findMany({
      where: { contestId },
      select: { email: true, name: true, usedAt: true, expiresAt: true, token: true },
    });

    const total = invites.length;
    const joined = invites.filter(i => i.usedAt).length;
    const pending = invites.filter(i => !i.usedAt && i.expiresAt > new Date()).length;
    const expired = invites.filter(i => !i.usedAt && i.expiresAt <= new Date()).length;

    res.json({ total, joined, pending, expired, invites: invites.map(i => ({ ...i, link: `/guest/join/${i.token}` })) });
  } catch (err) {
    console.error('Guest invite status error:', err);
    res.status(500).json({ error: 'Failed to fetch invite status' });
  }
});

export default router;
