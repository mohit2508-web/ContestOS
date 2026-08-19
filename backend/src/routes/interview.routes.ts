import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';
import { authenticateToken, optionalAuth } from '../middlewares/auth';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-for-dev';

// Helper to generate 6-character uppercase alphanumeric passcode
function generatePasscode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid ambiguous chars O, 0, I, 1
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// ─────────────────────────────────────────────────────────────
// 1. SCHEDULE A MOCK INTERVIEW SESSION (Teacher / Org Member)
// ─────────────────────────────────────────────────────────────
router.post('/schedule', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const {
      title,
      description,
      scheduledAt,
      durationMinutes = 45,
      candidateEmail,
      candidateId,
      problemId,
      allowHints = true,
      allowObservers = false,
      phaseUnderstandMins = 5,
      planMins = 10,
      codeMins = 25,
      optimizeMins = 5,
      customPasscode,
    } = req.body;

    if (!title || !scheduledAt) {
      res.status(400).json({ error: 'Title and scheduled time are required' });
      return;
    }

    // Generate passcode
    const rawPasscode = (customPasscode && customPasscode.trim().length === 6)
      ? customPasscode.trim().toUpperCase()
      : generatePasscode();
    
    const accessCodeHashed = await bcrypt.hash(rawPasscode, 10);
    const yjsDocId = `interview-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    // Create session record
    const session = await prisma.mockInterviewSession.create({
      data: {
        title,
        description,
        scheduledAt: new Date(scheduledAt),
        durationMinutes: Number(durationMinutes),
        accessCode: accessCodeHashed,
        accessCodePlain: rawPasscode,
        interviewerId: userId,
        candidateId: candidateId || null,
        candidateEmail: candidateEmail || null,
        problemId: problemId || null,
        organizationId: req.user?.organizationId || null,
        allowHints: Boolean(allowHints),
        allowObservers: Boolean(allowObservers),
        phaseUnderstandMins: Number(phaseUnderstandMins),
        planMins: Number(planMins),
        codeMins: Number(codeMins),
        optimizeMins: Number(optimizeMins),
        yjsDocumentId: yjsDocId,
      },
      include: {
        problem: {
          select: { id: true, title: true, difficulty: true, category: true },
        },
        interviewer: {
          select: { id: true, name: true, email: true },
        },
        candidate: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    const frontendBaseUrl = process.env.FRONTEND_URL?.split(',')[0] || 'http://localhost:5173';
    const joinUrl = `${frontendBaseUrl.replace(/\/$/, '')}/interview/join/${session.id}`;

    res.json({
      success: true,
      session,
      passcode: rawPasscode,
      joinUrl,
    });
  } catch (error: any) {
    console.error('[Interview Route] Schedule Error:', error);
    res.status(500).json({ error: error.message || 'Failed to schedule interview' });
  }
});

// ─────────────────────────────────────────────────────────────
// 2. VERIFY SECRET PASSCODE & JOIN ROOM
// ─────────────────────────────────────────────────────────────
router.post('/verify-code', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { sessionId, accessCode } = req.body;
    if (!sessionId || !accessCode) {
      res.status(400).json({ error: 'Session ID and Access Code are required' });
      return;
    }

    const session = await prisma.mockInterviewSession.findUnique({
      where: { id: sessionId },
      include: {
        interviewer: { select: { id: true, name: true, email: true } },
        candidate: { select: { id: true, name: true, email: true } },
        problem: {
          select: { id: true, title: true, description: true, difficulty: true, starterCode: true },
        },
      },
    });

    if (!session) {
      res.status(404).json({ error: 'Interview session not found' });
      return;
    }

    if (session.status === 'CANCELLED') {
      res.status(400).json({ error: 'This interview session has been cancelled.' });
      return;
    }

    // Passcode comparison (bcrypt or plain backup match)
    const isBcryptValid = await bcrypt.compare(accessCode.trim().toUpperCase(), session.accessCode);
    const isPlainMatch = session.accessCodePlain && session.accessCodePlain.toUpperCase() === accessCode.trim().toUpperCase();

    if (!isBcryptValid && !isPlainMatch) {
      res.status(401).json({ error: 'Invalid secret passcode. Please check and try again.' });
      return;
    }

    // Issue lightweight room JWT
    const currentUserId = req.user?.userId || `guest-${Date.now()}`;
    const userRole = req.user?.userId === session.interviewerId ? 'INTERVIEWER' : 'CANDIDATE';

    const roomToken = jwt.sign(
      {
        sessionId: session.id,
        userId: currentUserId,
        userRole,
        email: req.user?.email || session.candidateEmail || 'guest@candidate',
      },
      JWT_SECRET,
      { expiresIn: '6h' }
    );

    res.json({
      success: true,
      token: roomToken,
      userRole,
      session: {
        id: session.id,
        title: session.title,
        status: session.status,
        currentPhase: session.currentPhase,
        scheduledAt: session.scheduledAt,
        durationMinutes: session.durationMinutes,
        interviewer: session.interviewer,
        problem: session.problem,
        yjsDocumentId: session.yjsDocumentId,
        allowHints: session.allowHints,
      },
    });
  } catch (error: any) {
    console.error('[Interview Route] Verify Error:', error);
    res.status(500).json({ error: error.message || 'Verification failed' });
  }
});

// ─────────────────────────────────────────────────────────────
// 3. GET MY SESSIONS (Teacher & Student Dashboard)
// ─────────────────────────────────────────────────────────────
router.get('/my-sessions', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const sessions = await prisma.mockInterviewSession.findMany({
      where: {
        OR: [
          { interviewerId: userId },
          { candidateId: userId },
          { candidateEmail: req.user?.email },
        ],
      },
      include: {
        interviewer: { select: { id: true, name: true, email: true } },
        candidate: { select: { id: true, name: true, email: true } },
        problem: { select: { id: true, title: true, difficulty: true } },
        feedback: { select: { recommendation: true, evaluatedAt: true } },
      },
      orderBy: { scheduledAt: 'desc' },
    });

    res.json({ success: true, sessions });
  } catch (error: any) {
    console.error('[Interview Route] List Error:', error);
    res.status(500).json({ error: error.message || 'Failed to retrieve sessions' });
  }
});

// ─────────────────────────────────────────────────────────────
// 4. GET SESSION DETAILS BY ID
// ─────────────────────────────────────────────────────────────
router.get('/session/:id', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const session = await prisma.mockInterviewSession.findUnique({
      where: { id },
      include: {
        interviewer: { select: { id: true, name: true, email: true } },
        candidate: { select: { id: true, name: true, email: true } },
        problem: {
          select: {
            id: true,
            title: true,
            description: true,
            difficulty: true,
            category: true,
            starterCode: true,
            testCases: { select: { id: true, input: true, expectedOutput: true, isHidden: true } },
          },
        },
        feedback: true,
        hintRequests: { orderBy: { requestedAt: 'asc' } },
      },
    });

    if (!session) {
      res.status(404).json({ error: 'Interview session not found' });
      return;
    }

    res.json({ success: true, session });
  } catch (error: any) {
    console.error('[Interview Route] Get Session Error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch session' });
  }
});

// ─────────────────────────────────────────────────────────────
// 5. START / END SESSION STATUS
// ─────────────────────────────────────────────────────────────
router.post('/session/:id/start', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const session = await prisma.mockInterviewSession.update({
      where: { id },
      data: {
        status: 'LIVE',
        startedAt: new Date(),
        currentPhase: 'UNDERSTAND',
      },
    });
    res.json({ success: true, session });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to start session' });
  }
});

router.post('/session/:id/end', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const session = await prisma.mockInterviewSession.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        endedAt: new Date(),
        currentPhase: 'COMPLETED',
      },
    });
    res.json({ success: true, session });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to end session' });
  }
});

// ─────────────────────────────────────────────────────────────
// 6. SAVE INTERVIEWER EVALUATION SCORECARD & FEEDBACK
// ─────────────────────────────────────────────────────────────
router.post('/session/:id/feedback', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      problemUnderstandingScore = 3,
      algorithmDesignScore = 3,
      codeQualityScore = 3,
      communicationScore = 3,
      edgeCaseHandlingScore = 3,
      recommendation = 'HIRE',
      privateNotes,
      candidateFeedback,
    } = req.body;

    const feedback = await prisma.interviewFeedback.upsert({
      where: { sessionId: id },
      update: {
        problemUnderstandingScore: Number(problemUnderstandingScore),
        algorithmDesignScore: Number(algorithmDesignScore),
        codeQualityScore: Number(codeQualityScore),
        communicationScore: Number(communicationScore),
        edgeCaseHandlingScore: Number(edgeCaseHandlingScore),
        recommendation,
        privateNotes,
        candidateFeedback,
        evaluatedAt: new Date(),
      },
      create: {
        sessionId: id,
        problemUnderstandingScore: Number(problemUnderstandingScore),
        algorithmDesignScore: Number(algorithmDesignScore),
        codeQualityScore: Number(codeQualityScore),
        communicationScore: Number(communicationScore),
        edgeCaseHandlingScore: Number(edgeCaseHandlingScore),
        recommendation,
        privateNotes,
        candidateFeedback,
      },
    });

    res.json({ success: true, feedback });
  } catch (error: any) {
    console.error('[Interview Route] Feedback Error:', error);
    res.status(500).json({ error: error.message || 'Failed to save feedback' });
  }
});

// ─────────────────────────────────────────────────────────────
// 7. SESSION SNAPSHOTS PLAYBACK
// ─────────────────────────────────────────────────────────────
router.get('/session/:id/snapshots', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const snapshots = await prisma.interviewCodeSnapshot.findMany({
      where: { sessionId: id },
      orderBy: { snapshotAt: 'asc' },
    });
    res.json({ success: true, snapshots });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch snapshots' });
  }
});

export default router;
