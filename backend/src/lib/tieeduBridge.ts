import crypto from 'crypto';
import axios from 'axios';
import prisma from './prisma';

/**
 * TieEdu Assessment Bridge — Kryptavia OS (provider) side.
 *
 * Kryptavia is the *assessment platform* in TieEdu's mock-drive bridge:
 *   • TieEdu issues a one-time launch token (?lt=...) and the student lands
 *     here on GET /api/bridge/launch.
 *   • We exchange that token at TieEdu's POST /api/bridge/introspect (signed
 *     with the introspect secret) to obtain the candidate, drive/test and
 *     attempt claims.
 *   • We push attempt lifecycle events back to TieEdu's POST /api/bridge/events
 *     (signed with the webhook secret).
 *
 * Both directions use the same HMAC scheme:
 *   X-Bridge-Provider  : provider code, e.g. "kryptavia"
 *   X-Bridge-Timestamp : unix seconds
 *   X-Bridge-Signature : hex HMAC-SHA256( secret, `${timestamp}.${rawBody}` )
 *
 * All network calls are best-effort and never break the exam flow.
 */

const RAW_BASE = process.env.TIEEDU_BASE_URL || process.env.TIEEDU_BRIDGE_BASE_URL || '';
export const TIEEDU_BASE_URL = RAW_BASE.replace(/\/$/, '');
export const BRIDGE_PROVIDER_CODE = process.env.TIEEDU_BRIDGE_PROVIDER_CODE || 'kryptavia';

const INTROSPECT_SECRET =
  process.env.KRYPTAVIA_BRIDGE_INTROSPECT_SECRET || process.env.TIEEDU_BRIDGE_INTROSPECT_SECRET || '';
const WEBHOOK_SECRET =
  process.env.KRYPTAVIA_BRIDGE_WEBHOOK_SECRET || process.env.TIEEDU_BRIDGE_WEBHOOK_SECRET || '';

export function bridgeConfigured(): boolean {
  return Boolean(TIEEDU_BASE_URL && INTROSPECT_SECRET && WEBHOOK_SECRET);
}

export function introspectConfigured(): boolean {
  return Boolean(TIEEDU_BASE_URL && INTROSPECT_SECRET);
}

export function webhookConfigured(): boolean {
  return Boolean(TIEEDU_BASE_URL && WEBHOOK_SECRET);
}

function sign(secret: string, timestamp: string, rawBody: string): string {
  return crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
}

function signedHeaders(secret: string, rawBody: string): Record<string, string> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  return {
    'Content-Type': 'application/json',
    'X-Bridge-Provider': BRIDGE_PROVIDER_CODE,
    'X-Bridge-Timestamp': timestamp,
    'X-Bridge-Signature': sign(secret, timestamp, rawBody),
  };
}

export interface IntrospectClaims {
  ok?: boolean;
  sub: string;
  drive_id: string;
  test_id: string;
  provider_exam_id: string | null;
  roll_no?: string | null;
  license_id?: string | null;
  name?: string | null;
  email?: string | null;
  drive?: { drive_id?: string; title?: string; company_name?: string; ends_at?: string };
  attempt?: { number?: number; max_attempts?: number };
  window?: { closes_at?: string | null; hard_close?: boolean };
  resume?: boolean;
  return_url?: string;
  server_time?: string;
}

export interface IntrospectResult {
  ok: boolean;
  status: number;
  claims?: IntrospectClaims;
  error?: string;
}

/**
 * Exchange a one-time launch token. Returns { ok:false } on any non-2xx so the
 * caller can render a friendly page. Never throws.
 */
export async function introspectLaunchToken(token: string): Promise<IntrospectResult> {
  if (!introspectConfigured()) {
    return { ok: false, status: 503, error: 'bridge_not_configured' };
  }
  const rawBody = JSON.stringify({ token });
  try {
    const res = await axios.post(`${TIEEDU_BASE_URL}/api/bridge/introspect`, rawBody, {
      headers: signedHeaders(INTROSPECT_SECRET, rawBody),
      timeout: 15_000,
      validateStatus: () => true,
    });
    if (res.status >= 200 && res.status < 300 && res.data?.sub) {
      return { ok: true, status: res.status, claims: res.data as IntrospectClaims };
    }
    return {
      ok: false,
      status: res.status,
      error: res.data?.error || res.data?.message || `introspect_failed_${res.status}`,
    };
  } catch (err: any) {
    return { ok: false, status: 502, error: err?.code || err?.message || 'introspect_unreachable' };
  }
}

/** Fire-and-forget event push to TieEdu. Never throws. */
export async function sendTieEduEvent(event: Record<string, any>): Promise<{ ok: boolean; status: number; data?: any }> {
  if (!webhookConfigured()) return { ok: false, status: 503 };
  const rawBody = JSON.stringify(event);
  try {
    const res = await axios.post(`${TIEEDU_BASE_URL}/api/bridge/events`, rawBody, {
      headers: signedHeaders(WEBHOOK_SECRET, rawBody),
      timeout: 15_000,
      validateStatus: () => true,
    });
    return { ok: res.status >= 200 && res.status < 300, status: res.status, data: res.data };
  } catch {
    return { ok: false, status: 0 };
  }
}

function eventId(): string {
  return crypto.randomUUID();
}

function providerAttemptIdOf(session: { providerAttemptId: string }): string {
  return session.providerAttemptId;
}

/**
 * Report attempt.started to TieEdu for the candidate's active bridge session on
 * this contest. Idempotent (startedEventSent flag). Swallows all errors so the
 * exam flow is never blocked.
 */
export async function reportAttemptStarted(userId: string, contestId: string): Promise<void> {
  try {
    if (!webhookConfigured()) return;
    const session = await prisma.bridgeSession.findFirst({
      where: { kryptaviaUserId: userId, contestId, startedEventSent: false },
      orderBy: { createdAt: 'desc' },
    });
    if (!session) return;

    await sendTieEduEvent({
      event_type: 'attempt.started',
      event_id: eventId(),
      tieedu_user_id: session.tieeduUserId,
      drive_id: session.driveId,
      test_id: session.testId,
      provider_attempt_id: providerAttemptIdOf(session),
      roll_no: session.rollNo || undefined,
      started_at: new Date().toISOString(),
    });

    await prisma.bridgeSession.update({
      where: { id: session.id },
      data: { status: 'in_progress', startedEventSent: true, startedAt: new Date() },
    });
  } catch (err) {
    console.warn('[tieedu-bridge] reportAttemptStarted failed:', (err as Error)?.message);
  }
}

/**
 * Aggregate the candidate's score for a contest and report attempt.completed.
 * Idempotent (completedEventSent flag). Swallows all errors.
 */
export async function reportAttemptCompleted(userId: string, contestId: string): Promise<void> {
  try {
    if (!webhookConfigured()) return;
    const session = await prisma.bridgeSession.findFirst({
      where: { kryptaviaUserId: userId, contestId, completedEventSent: false },
      orderBy: { createdAt: 'desc' },
    });
    if (!session) return;

    const [registration, contestProblems, submissions] = await Promise.all([
      prisma.contestRegistration.findUnique({
        where: { contestId_userId: { contestId, userId } },
        select: { score: true },
      }),
      prisma.contestProblem.findMany({ where: { contestId }, select: { points: true } }),
      prisma.submission.findMany({
        where: { contestId, userId },
        select: { problemId: true, score: true, status: true },
      }),
    ]);

    const maxScore = contestProblems.reduce((sum, p) => sum + (p.points || 0), 0) || 100;

    // Best score per problem (contest scoring uses best attempt per problem).
    const bestByProblem = new Map<string, number>();
    for (const s of submissions) {
      const cur = bestByProblem.get(s.problemId) || 0;
      if ((s.score || 0) > cur) bestByProblem.set(s.problemId, s.score || 0);
    }
    let score = 0;
    bestByProblem.forEach((v) => { score += v; });
    if (!score && registration?.score) score = registration.score;

    const percentage = maxScore > 0 ? Math.round((score / maxScore) * 10000) / 100 : 0;

    await sendTieEduEvent({
      event_type: 'attempt.completed',
      event_id: eventId(),
      tieedu_user_id: session.tieeduUserId,
      drive_id: session.driveId,
      test_id: session.testId,
      provider_attempt_id: providerAttemptIdOf(session),
      roll_no: session.rollNo || undefined,
      score,
      max_score: maxScore,
      percentage,
      passed: percentage >= 40,
      disqualified: false,
      submitted_at: new Date().toISOString(),
    });

    await prisma.bridgeSession.update({
      where: { id: session.id },
      data: { status: 'completed', completedEventSent: true, completedAt: new Date() },
    });
  } catch (err) {
    console.warn('[tieedu-bridge] reportAttemptCompleted failed:', (err as Error)?.message);
  }
}
