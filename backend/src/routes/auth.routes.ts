import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import prisma, { withDbRetry } from '../lib/prisma';
import { generateAccessToken, generateRefreshToken, AuthPayload } from '../middlewares/auth';
import { rateLimit } from '../middlewares/rateLimit';

const router = Router();

const HIERARCHY_MAP: Record<string, number> = {
  SUPER_ADMIN: 1,
  PLATFORM_CONTENT_AUTHOR: 2,
  ORG_ADMIN: 3,
  PROCTOR: 4,
  ORG_MEMBER: 4,
  EVALUATOR: 4,
  CONTEST_MODERATOR: 4,    // Chief examiner — same operational tier as EVALUATOR/PROCTOR
  COMPLIANCE_OFFICER: 4,   // Compliance officer — same operational tier
  ANALYTICS_VIEWER: 5,     // Read-only HR viewer — lowest org-level privilege
  STUDENT: 6,
  CANDIDATE: 6,
  GUEST_CANDIDATE: 7,      // External invite-only — most restricted
};

function validatePasswordStrength(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters long';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number';
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) return 'Password must contain at least one special character';
  return null;
}

router.post('/register', rateLimit(3, 15 * 60 * 1000), async (req, res) => {
  try {
    const { email, password, name, username, phone } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }

    const strengthError = validatePasswordStrength(password);
    if (strengthError) {
      return res.status(400).json({ error: strengthError });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    if (username) {
      const existingUsername = await prisma.user.findUnique({ where: { username } });
      if (existingUsername) {
        return res.status(409).json({ error: 'Username already taken' });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        username: username || null,
        phone: phone || null,
        role: 'STUDENT',
        organizationId: null,
      },
      select: { id: true, email: true, name: true, role: true, organizationId: true },
    });

    const payload: AuthPayload = {
      userId: user.id,
      email: user.email,
      roleName: 'student',
      hierarchyLevel: 5,
      organizationId: null,
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken({ userId: user.id });

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    res.status(201).json({ accessToken, refreshToken, user });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', rateLimit(20, 15 * 60 * 1000), async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await withDbRetry(() => prisma.user.findUnique({ where: { email } }));
    if (!user) {
      const pendingReq = await prisma.organizationRequest.findFirst({
        where: { contactEmail: email, status: 'PENDING' },
      });
      if (pendingReq) {
        return res.status(403).json({
          error: `⏳ Verification Pending: Your organization application for "${pendingReq.orgName}" is currently under review by Platform Super Admin (24-48 hr SLA). Your account will be activated automatically upon Super Admin approval.`,
        });
      }
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (user.status === 'SUSPENDED') {
      return res.status(403).json({ error: 'Account suspended. Contact support.' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const payload: AuthPayload = {
      userId: user.id,
      email: user.email,
      roleName: user.role.toLowerCase(),
      hierarchyLevel: HIERARCHY_MAP[user.role] || 5,
      organizationId: user.organizationId,
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken({ userId: user.id });

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    // Run non-blocking background tasks for lastLoginAt update and AuditLog
    Promise.allSettled([
      prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }),
      prisma.auditLog.create({
        data: {
          userId: user.id,
          organizationId: user.organizationId,
          action: 'USER_LOGIN',
          resource: 'user',
          resourceId: user.id,
        },
      }),
    ]).catch(() => {});

    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organizationId: user.organizationId,
        hierarchyLevel: HIERARCHY_MAP[user.role] || 5,
      },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    if (error?.message?.includes('Timed out fetching a new connection from the connection pool')) {
      return res.status(503).json({ error: 'Database connection pool busy. Please try clicking sign in again in a moment.' });
    }
    res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/refresh', rateLimit(10, 15 * 60 * 1000), async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
    if (!stored || stored.expiresAt < new Date()) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    const user = await prisma.user.findUnique({ where: { id: stored.userId } });
    if (!user || user.status === 'SUSPENDED') {
      return res.status(401).json({ error: 'User not found or suspended' });
    }

    // Delete old refresh token (rotation)
    await prisma.refreshToken.delete({ where: { id: stored.id } });

    const payload: AuthPayload = {
      userId: user.id,
      email: user.email,
      roleName: user.role.toLowerCase(),
      hierarchyLevel: HIERARCHY_MAP[user.role] || 5,
      organizationId: user.organizationId,
    };

    const newAccessToken = generateAccessToken(payload);
    const newRefreshToken = generateRefreshToken({ userId: user.id });

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: newRefreshToken,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
  } catch (error) {
    console.error('Refresh error:', error);
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

router.post('/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
    }
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Logout failed' });
  }
});

router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const jwt = await import('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) return res.status(500).json({ error: 'Server configuration error' });

    const decoded = jwt.default.verify(token, JWT_SECRET) as AuthPayload;

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true, email: true, name: true, username: true, phone: true,
        role: true, status: true, organizationId: true, lastLoginAt: true, createdAt: true,
        organization: {
          select: {
            id: true, name: true, slug: true, subscriptionTier: true,
            featureFlags: true, status: true,
          },
        },
      },
    });

    if (!user || user.status === 'SUSPENDED') {
      return res.status(401).json({ error: 'User not found or suspended' });
    }

    res.json({
      user: {
        ...user,
        hierarchyLevel: HIERARCHY_MAP[user.role] || 5,
      },
    });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

router.post('/accept-invite-signup', rateLimit(5, 15 * 60 * 1000), async (req, res) => {
  try {
    const { token, name, password } = req.body;
    if (!token || !name || !password) {
      return res.status(400).json({ error: 'Token, name, and password are required' });
    }

    const strengthError = validatePasswordStrength(password);
    if (strengthError) {
      return res.status(400).json({ error: strengthError });
    }

    const invitation = await prisma.teamInvitation.findUnique({
      where: { token },
      include: { organization: { select: { id: true, name: true, slug: true } } },
    });

    if (!invitation) return res.status(404).json({ error: 'Invitation not found' });
    if (invitation.status !== 'PENDING') return res.status(400).json({ error: 'Invitation already used' });
    if (invitation.expiresAt < new Date()) return res.status(400).json({ error: 'Invitation expired' });

    const existing = await prisma.user.findUnique({ where: { email: invitation.email } });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists. Please log in and accept the invite from your dashboard.' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email: invitation.email,
        password: hashedPassword,
        name,
        role: invitation.role as any,
        organizationId: invitation.organizationId,
        status: 'ACTIVE',
      },
      select: { id: true, email: true, name: true, role: true, organizationId: true },
    });

    await prisma.teamInvitation.update({
      where: { id: invitation.id },
      data: { status: 'ACCEPTED', acceptedAt: new Date() },
    });

    const payload: AuthPayload = {
      userId: user.id,
      email: user.email,
      roleName: user.role.toLowerCase(),
      hierarchyLevel: HIERARCHY_MAP[user.role] || 5,
      organizationId: user.organizationId,
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken({ userId: user.id });

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        organizationId: user.organizationId,
        action: 'INVITE_ACCEPTED',
        resource: 'team_invitation',
        resourceId: invitation.id,
        details: { email: invitation.email, role: invitation.role },
      },
    });

    res.status(201).json({
      accessToken, refreshToken,
      user,
      organization: invitation.organization,
    });
  } catch (error) {
    console.error('Accept invite signup error:', error);
    res.status(500).json({ error: 'Failed to accept invitation' });
  }
});

export default router;
