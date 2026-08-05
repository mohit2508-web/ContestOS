import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticateToken } from '../middlewares/auth';
import { materializeQuizAttempt, encryptQuizPayload } from '../services/quizMaterializer';
import { evaluateQuizResponse } from '../services/quizEvaluator';
import { detectSynchronizedCheating, isQuizSessionFrozen, setQuizSessionFreeze } from '../services/proctoringService';

const router = Router();

// POST /api/quiz/sections/:sectionId/start — Start section & materialize per-attempt question set
router.post('/sections/:sectionId/start', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { sectionId } = req.params;
    const { contestId } = req.body;

    if (!contestId) {
      res.status(400).json({ error: 'contestId is required' });
      return;
    }

    const section = await prisma.contestSection.findUnique({
      where: { id: sectionId },
    });

    if (!section) {
      res.status(404).json({ error: 'Section not found' });
      return;
    }

    // Materialize question set (randomized order & option shuffle per candidate)
    const materialized = await materializeQuizAttempt(userId, contestId, sectionId);

    // Fetch candidate's active session token for encryption key
    const registration = await prisma.contestRegistration.findUnique({
      where: { contestId_userId: { contestId, userId } },
    });

    const sessionToken = registration?.activeSessionToken || userId;

    // Build question summary items (without correct answers) for candidate HUD navigation
    const questionItems = [];
    for (const aq of materialized) {
      const q = await prisma.quizQuestion.findUnique({
        where: { id: aq.questionId },
        include: { passage: true, options: true },
      });

      if (q) {
        // Map options using candidate's optionOrderMap
        const optionOrderMap = (aq.optionOrderMap as string[]) || [];
        const optionMap = new Map(q.options.map((o) => [o.id, o]));
        const orderedOptions = optionOrderMap
          .map((id, idx) => {
            const opt = optionMap.get(id);
            return opt
              ? {
                  id: opt.id,
                  content: opt.content,
                  imageUrl: opt.imageUrl,
                  displayOrder: idx + 1,
                }
              : null;
          })
          .filter(Boolean);

        const payload = {
          attemptQuestionId: aq.id,
          questionId: q.id,
          questionType: q.questionType,
          content: q.content,
          imageUrl: q.imageUrl,
          passage: q.passage ? { id: q.passage.id, title: q.passage.title, content: q.passage.content } : null,
          options: orderedOptions,
          presentedOrder: aq.presentedOrder,
          totalQuestions: materialized.length,
        };

        const encrypted = encryptQuizPayload(payload, sessionToken);
        questionItems.push({
          attemptQuestionId: aq.id,
          presentedOrder: aq.presentedOrder,
          encryptedPayload: encrypted,
        });
      }
    }

    res.json({
      success: true,
      section: {
        id: section.id,
        title: section.title,
        duration: section.duration,
        sectionLocked: section.sectionLocked,
      },
      questions: questionItems,
    });
  } catch (error: any) {
    console.error('Quiz start error:', error);
    res.status(500).json({ error: 'Failed to start quiz section', details: error.message });
  }
});

// POST /api/quiz/responses — Save response & scratchpad stroke data
router.post('/responses', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { attemptQuestionId, selectedOptionIds, numericAnswer, textAnswer, scratchpadData, timeSpentMs, flaggedForReview } = req.body;

    if (!attemptQuestionId) {
      res.status(400).json({ error: 'attemptQuestionId is required' });
      return;
    }

    const attemptQuestion = await prisma.quizAttemptQuestion.findUnique({
      where: { id: attemptQuestionId },
      include: { question: { include: { options: true } } },
    });

    if (!attemptQuestion || attemptQuestion.userId !== userId) {
      res.status(403).json({ error: 'Invalid attempt question' });
      return;
    }

    // Check if session is frozen by proctor
    if (isQuizSessionFrozen(userId, attemptQuestion.contestId)) {
      res.status(423).json({ error: 'Quiz session is frozen by proctor', isFrozen: true });
      return;
    }

    // Evaluate answer server-side
    const evalResult = evaluateQuizResponse({
      questionType: attemptQuestion.question.questionType,
      points: attemptQuestion.question.points,
      negativeMarking: attemptQuestion.question.negativeMarking,
      options: attemptQuestion.question.options,
      selectedOptionIds,
      numericAnswer,
      textAnswer,
    });

    // Detect synchronized cheating
    const userIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
    const isAnomaly = await detectSynchronizedCheating(
      userId,
      attemptQuestion.contestId,
      attemptQuestion.questionId,
      userIp,
      selectedOptionIds || []
    );

    // Upsert response
    const existing = await prisma.quizResponse.findFirst({
      where: { attemptQuestionId, userId },
    });

    let quizResp;
    if (existing) {
      quizResp = await prisma.quizResponse.update({
        where: { id: existing.id },
        data: {
          selectedOptionIds: selectedOptionIds || [],
          numericAnswer: numericAnswer != null ? Number(numericAnswer) : null,
          textAnswer: textAnswer || null,
          scratchpadData: scratchpadData || null,
          timeSpentMs: (existing.timeSpentMs || 0) + (timeSpentMs || 0),
          flaggedForReview: flaggedForReview ?? existing.flaggedForReview,
          isCorrect: evalResult.isCorrect,
          scoreAwarded: evalResult.scoreAwarded,
          answeredAt: new Date(),
        },
      });
    } else {
      quizResp = await prisma.quizResponse.create({
        data: {
          attemptQuestionId,
          userId,
          selectedOptionIds: selectedOptionIds || [],
          numericAnswer: numericAnswer != null ? Number(numericAnswer) : null,
          textAnswer: textAnswer || null,
          scratchpadData: scratchpadData || null,
          timeSpentMs: timeSpentMs || 0,
          flaggedForReview: flaggedForReview ?? false,
          isCorrect: evalResult.isCorrect,
          scoreAwarded: evalResult.scoreAwarded,
        },
      });
    }

    res.json({
      success: true,
      responseId: quizResp.id,
      flaggedForReview: quizResp.flaggedForReview,
      synchronizedCheatingAnomaly: isAnomaly,
    });
  } catch (error: any) {
    console.error('Quiz response error:', error);
    res.status(500).json({ error: 'Failed to save quiz response', details: error.message });
  }
});

// POST /api/quiz/sections/:sectionId/submit — Submit section & evaluate score
router.post('/sections/:sectionId/submit', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { sectionId } = req.params;
    const { contestId } = req.body;

    const attemptQuestions = await prisma.quizAttemptQuestion.findMany({
      where: { userId, contestId, sectionId },
      include: { responses: true },
    });

    let totalScore = 0;
    let totalCorrect = 0;
    let totalAnswered = 0;

    for (const aq of attemptQuestions) {
      const resp = aq.responses[0];
      if (resp) {
        if ((resp.selectedOptionIds && resp.selectedOptionIds.length > 0) || resp.numericAnswer != null || resp.textAnswer) {
          totalAnswered++;
        }
        if (resp.isCorrect) {
          totalCorrect++;
        }
        totalScore += resp.scoreAwarded || 0;
      }
    }

    // Floor-clamp section score at 0
    const finalSectionScore = Math.max(0, Math.round(totalScore));

    // Update contest registration score
    await prisma.contestRegistration.updateMany({
      where: { contestId, userId },
      data: { score: { increment: finalSectionScore } },
    });

    res.json({
      success: true,
      summary: {
        totalQuestions: attemptQuestions.length,
        totalAnswered,
        totalCorrect,
        scoreAwarded: finalSectionScore,
      },
    });
  } catch (error: any) {
    console.error('Quiz section submit error:', error);
    res.status(500).json({ error: 'Failed to submit quiz section', details: error.message });
  }
});

// POST /api/quiz/proctor/freeze — Proctor session freeze/unfreeze endpoint
router.post('/proctor/freeze', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { targetUserId, contestId, freeze } = req.body;

    if (!targetUserId || !contestId) {
      res.status(400).json({ error: 'targetUserId and contestId are required' });
      return;
    }

    setQuizSessionFreeze(targetUserId, contestId, !!freeze);

    // Log proctoring intervention
    await prisma.proctoringLog.create({
      data: {
        contestId,
        userId: targetUserId,
        eventType: freeze ? 'SESSION_FROZEN_BY_PROCTOR' : 'SESSION_UNFROZEN_BY_PROCTOR',
        details: `Quiz session ${freeze ? 'frozen' : 'unfrozen'} by proctor ${req.user!.userId}`,
      },
    });

    res.json({ success: true, targetUserId, isFrozen: !!freeze });
  } catch (error: any) {
    console.error('Proctor freeze error:', error);
    res.status(500).json({ error: 'Failed to update session freeze status', details: error.message });
  }
});

// GET /api/quiz/sections/:sectionId/analytics — Recruiter Cohort Analytics & Question Heatmap
router.get('/sections/:sectionId/analytics', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { sectionId } = req.params;

    const questions = await prisma.quizQuestion.findMany({
      where: { sectionId },
      include: {
        attemptQuestions: {
          include: { responses: true },
        },
        options: true,
      },
    });

    const totalCandidates = await prisma.quizAttemptQuestion.groupBy({
      by: ['userId'],
      where: { sectionId },
    });

    const questionAnalytics = questions.map((q: any) => {
      const allResponses = q.attemptQuestions ? q.attemptQuestions.flatMap((aq: any) => aq.responses || []) : [];
      const totalResponses = allResponses.length;
      const correctResponses = allResponses.filter((r: any) => r.isCorrect).length;
      const accuracyPct = totalResponses > 0 ? Math.round((correctResponses / totalResponses) * 100) : 0;

      const totalTimeMs = allResponses.reduce((sum: number, r: any) => sum + (r.timeSpentMs || 0), 0);
      const avgTimeSec = totalResponses > 0 ? Math.round(totalTimeMs / totalResponses / 1000) : 0;

      return {
        questionId: q.id,
        content: q.content.length > 60 ? q.content.slice(0, 60) + '...' : q.content,
        questionType: q.questionType,
        category: q.category || 'General',
        totalResponses,
        correctResponses,
        accuracyPct,
        avgTimeSec,
        discriminationIndex: accuracyPct > 80 || accuracyPct < 20 ? 0.35 : 0.72,
      };
    });

    res.json({
      success: true,
      sectionId,
      totalCandidatesCount: totalCandidates.length,
      questionsCount: questions.length,
      questions: questionAnalytics,
    });
  } catch (error: any) {
    console.error('Quiz analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch quiz analytics', details: error.message });
  }
});

export default router;
