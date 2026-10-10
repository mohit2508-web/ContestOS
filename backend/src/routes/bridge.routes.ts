import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma';
import { authenticateToken, generateAccessToken, generateRefreshToken } from '../middlewares/auth';
import {
  bridgeConfigured,
  introspectLaunchToken,
  reportAttemptStarted,
  reportAttemptCompleted,
  IntrospectClaims,
} from '../lib/tieeduBridge';

/**
 * TieEdu ⇄ Kryptavia assessment-bridge entry points.
 *
 * GET  /api/bridge/launch?lt=<token>  — browser entry; introspects the one-time
 *                                       token at TieEdu, provisions/authenticates
 *                                       the candidate and redirects into the exam.
 * GET  /api/bridge/health             — liveness + configuration probe.
 * POST /api/bridge/attempt/started    — (auth) manual attempt.started report.
 * POST /api/bridge/attempt/completed  — (auth) manual attempt.completed report.
 *
 * started/completed are normally fired automatically from the contest join /
 * finalize handlers, so the POST endpoints exist only as an explicit fallback.
 */

const router = Router();

const FRONTEND_URL = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',')[0].trim();

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string)
  );
}

function renderPage(opts: { title: string; heading: string; body: string; tone?: 'error' | 'info' }): string {
  const tone = opts.tone === 'error' ? '#f87171' : '#fbbf24';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(opts.title)}</title>
<style>
  :root { color-scheme: dark; }
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
    background:#050505; color:#fafafa; font:15px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; padding:24px; }
  .card { max-width:460px; width:100%; background:#0b0b0d; border:1px solid #1f1f23; border-radius:24px; padding:32px; text-align:center; }
  .dot { width:48px; height:48px; border-radius:16px; margin:0 auto 16px; display:flex; align-items:center; justify-content:center;
    font-size:22px; background:${tone}1a; border:1px solid ${tone}55; color:${tone}; }
  h1 { font-size:18px; font-weight:800; margin:0 0 10px; }
  p { color:#a1a1aa; font-size:13px; margin:0 0 18px; }
  a { display:inline-block; padding:12px 18px; border-radius:12px; background:${tone}; color:#000; font-weight:800; text-decoration:none; }
  code { color:#e4e4e7; font-size:12px; word-break:break-all; }
</style></head><body><div class="card">
<div class="dot">${opts.tone === 'error' ? '⚠️' : '🔗'}</div>
<h1>${escapeHtml(opts.heading)}</h1>
<p>${opts.body}</p>
<a href="${escapeHtml(FRONTEND_URL)}/contests">Go to Kryptavia OS</a>
</div></body></html>`;
}

function fail(res: Response, status: number, heading: string, body: string): void {
  res.status(status).type('html').send(renderPage({ title: heading, heading, body, tone: 'error' }));
}

function synthesizeEmail(sub: string): string {
  const safe = String(sub).replace(/[^a-zA-Z0-9]/g, '').slice(0, 24) || crypto.randomBytes(6).toString('hex');
  return `tieedu_${safe}@bridge.kryptavia`;
}

async function upsertCandidateUser(claims: IntrospectClaims): Promise<{ id: string; name: string; email: string }> {
  const email = (claims.email || '').trim().toLowerCase() || synthesizeEmail(claims.sub);
  const name = (claims.name || claims.roll_no || 'TieEdu Candidate').toString();

  let user = await prisma.user.findFirst({
    where: { OR: [{ ssoProvider: 'TIEEDU', ssoId: claims.sub }, { email }] },
  });

  if (user) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { ssoProvider: 'TIEEDU', ssoId: claims.sub, lastLoginAt: new Date() },
    });
  } else {
    let username = String(claims.roll_no || `tieedu_${claims.sub}`)
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .slice(0, 20);
    const clash = await prisma.user.findUnique({ where: { username } });
    if (clash) username = `${username.slice(0, 14)}_${Date.now().toString().slice(-5)}`;

    user = await prisma.user.create({
      data: {
        email,
        name,
        username,
        password: await bcrypt.hash(`TIEEDU_${crypto.randomBytes(16).toString('hex')}_${Date.now()}`, 12),
        role: 'STUDENT' as any,
        status: 'ACTIVE',
        ssoProvider: 'TIEEDU',
        ssoId: claims.sub,
        lastLoginAt: new Date(),
      },
    });
  }

  return { id: user.id, name: user.name, email: user.email };
}

/* ----------------------------------------------------------------- services */

router.get('/health', async (_req: Request, res: Response) => {
  let dbOk = true;
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbOk = false;
  }
  res.json({
    ok: true,
    provider: 'kryptavia',
    configured: bridgeConfigured(),
    db: dbOk,
    frontend: FRONTEND_URL,
  });
});

/* ------------------------------------------------------------------- launch */

router.get('/launch', async (req: Request, res: Response) => {
  const lt = String(req.query.lt || '').trim();
  if (!lt) return fail(res, 400, 'Launch token missing', 'This link is missing its TieEdu launch token.');
  if (!bridgeConfigured()) {
    return fail(res, 503, 'Bridge not configured', 'Kryptavia OS is not yet linked to TieEdu (bridge secrets or base URL missing).');
  }

  const result = await introspectLaunchToken(lt);
  if (!result.ok || !result.claims) {
    const reason =
      result.error === 'invalid_token'
        ? 'This launch link is invalid, expired, or has already been used.'
        : `Could not verify this launch with TieEdu (${escapeHtml(result.error || 'unknown error')}).`;
    return fail(res, 401, 'Launch verification failed', reason);
  }

  const claims = result.claims;
  const contestId = String(claims.provider_exam_id || '').trim();
  if (!contestId) {
    return fail(res, 409, 'Test not mapped', 'This drive test has no Kryptavia contest id configured on TieEdu.');
  }

  try {
    const contest = await prisma.contest.findUnique({
      where: { id: contestId },
      select: { id: true, title: true, endTime: true },
    });
    if (!contest) {
      return fail(res, 404, 'Contest not found', 'The mapped Kryptavia contest no longer exists.');
    }

    const candidate = await upsertCandidateUser(claims);

    await prisma.contestRegistration.upsert({
      where: { contestId_userId: { contestId, userId: candidate.id } },
      create: { contestId, userId: candidate.id, score: 0, penalty: 0, status: 'REGISTERED' },
      update: {},
    });

    const providerAttemptId = `${claims.drive_id}:${claims.test_id}:${claims.sub}`;
    await prisma.bridgeSession.upsert({
      where: { kryptaviaUserId_testId: { kryptaviaUserId: candidate.id, testId: claims.test_id } },
      create: {
        kryptaviaUserId: candidate.id,
        contestId,
        tieeduUserId: claims.sub,
        driveId: claims.drive_id,
        testId: claims.test_id,
        providerAttemptId,
        rollNo: claims.roll_no || null,
        returnUrl: claims.return_url || null,
        status: 'launched',
      },
      update: {
        contestId,
        driveId: claims.drive_id,
        providerAttemptId,
        rollNo: claims.roll_no || null,
        returnUrl: claims.return_url || null,
      },
    });

    const accessToken = generateAccessToken({
      userId: candidate.id,
      email: candidate.email,
      roleName: 'student',
      hierarchyLevel: 6,
      organizationId: null,
    });
    const refreshToken = generateRefreshToken({ userId: candidate.id });
    await prisma.refreshToken.create({
      data: { userId: candidate.id, token: refreshToken, expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
    });

    const next = `/${encodeURIComponent('contests')}/${encodeURIComponent(contestId)}`;
    const target = `${FRONTEND_URL}/auth/sso/callback?token=${encodeURIComponent(accessToken)}&refreshToken=${encodeURIComponent(
      refreshToken
    )}&name=${encodeURIComponent(candidate.name)}&email=${encodeURIComponent(candidate.email)}&role=STUDENT&provider=${encodeURIComponent(
      'TieEdu OS'
    )}&next=${encodeURIComponent(next)}`;

    return res.redirect(target);
  } catch (err: any) {
    console.error('[tieedu-bridge] launch error:', err);
    return fail(res, 500, 'Launch failed', 'Something went wrong while preparing your exam. Please return to TieEdu and try again.');
  }
});

/* ---------------------------------------------------------- manual reporters */

router.post('/attempt/started', authenticateToken, async (req: Request, res: Response) => {
  const contestId = String(req.body?.contestId || '').trim();
  if (!contestId) return res.status(400).json({ error: 'contestId is required' });
  await reportAttemptStarted(req.user!.userId, contestId);
  return res.json({ ok: true });
});

router.post('/attempt/completed', authenticateToken, async (req: Request, res: Response) => {
  const contestId = String(req.body?.contestId || '').trim();
  if (!contestId) return res.status(400).json({ error: 'contestId is required' });
  await reportAttemptCompleted(req.user!.userId, contestId);
  return res.json({ ok: true });
});

export default router;
