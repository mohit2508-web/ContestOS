import { QuestionReviewStatus } from '../generated/client';
import prisma from '../lib/prisma';

export class QuestionAnalyticsEngine {
  /**
   * Recalculate Difficulty Index (P) & Point-Biserial Correlation (r_pbis) for a question
   */
  static async recalculateItemAnalytics(questionId: string) {
    // Fetch all attempt responses for this question along with total user score in contest
    const responses = await prisma.quizResponse.findMany({
      where: {
        attemptQuestion: { questionId },
      },
      include: {
        user: true,
        attemptQuestion: true,
      },
    });

    if (responses.length === 0) {
      return null;
    }

    const totalAttempts = responses.length;
    const correctAttempts = responses.filter((r) => r.isCorrect).length;
    const p = correctAttempts / totalAttempts;
    const q = 1 - p;

    // Fetch total test scores for candidates who attempted this question
    const userScores: { userId: string; totalScore: number; isCorrectOnItem: boolean; timeSpentMs: number }[] = [];

    for (const resp of responses) {
      const allUserResponses = await prisma.quizResponse.findMany({
        where: { userId: resp.userId },
        select: { scoreAwarded: true },
      });

      const totalScore = allUserResponses.reduce((sum, r) => sum + r.scoreAwarded, 0);
      userScores.push({
        userId: resp.userId,
        totalScore,
        isCorrectOnItem: resp.isCorrect,
        timeSpentMs: resp.timeSpentMs,
      });
    }

    const avgTimeSpentMs = Math.round(
      userScores.reduce((sum, u) => sum + u.timeSpentMs, 0) / userScores.length
    );

    // Compute Overall Mean Score (X_bar) and Standard Deviation (sigma)
    const scores = userScores.map((u) => u.totalScore);
    const meanScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance = scores.reduce((sum, s) => sum + Math.pow(s - meanScore, 2), 0) / scores.length;
    const stdDev = Math.sqrt(variance) || 1.0;

    // Compute Mean Score of candidates who got THIS question CORRECT (X_bar_1)
    const correctUserScores = userScores.filter((u) => u.isCorrectOnItem).map((u) => u.totalScore);
    const meanCorrectScore = correctUserScores.length > 0
      ? correctUserScores.reduce((a, b) => a + b, 0) / correctUserScores.length
      : meanScore;

    // Point-Biserial Correlation Formula: r_pbis = ((X_bar_1 - X_bar) / sigma) * sqrt(p / q)
    let r_pbis = 0.0;
    if (p > 0 && q > 0 && stdDev > 0) {
      r_pbis = Number((((meanCorrectScore - meanScore) / stdDev) * Math.sqrt(p / q)).toFixed(3));
    }

    // Upsert QuizItemAnalytics
    const analytics = await prisma.quizItemAnalytics.upsert({
      where: { questionId },
      create: {
        questionId,
        totalAttempts,
        correctAttempts,
        avgTimeSpentMs,
        pointBiserialCorr: r_pbis,
        calibratedDifficulty: Number((1 + (1 - p) * 4).toFixed(2)),
      },
      update: {
        totalAttempts,
        correctAttempts,
        avgTimeSpentMs,
        pointBiserialCorr: r_pbis,
        calibratedDifficulty: Number((1 + (1 - p) * 4).toFixed(2)),
      },
    });

    // Auto-Flag Loop: If r_pbis < 0.15 (ambiguous question), reset status to UNDER_REVIEW
    if (r_pbis < 0.15 && totalAttempts >= 5) {
      await prisma.quizQuestion.update({
        where: { id: questionId },
        data: { reviewStatus: QuestionReviewStatus.UNDER_REVIEW },
      });
    }

    return analytics;
  }
}
