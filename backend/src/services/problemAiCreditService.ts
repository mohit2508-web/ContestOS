import { prisma } from '../lib/prisma';

export const DEFAULT_PROBLEM_AI_CREDITS = 2000;

export async function getProblemAiCredits(problemId: string) {
  if (!problemId) {
    return { remaining: DEFAULT_PROBLEM_AI_CREDITS, max: DEFAULT_PROBLEM_AI_CREDITS };
  }

  const problem = await prisma.problem.findUnique({
    where: { id: problemId },
    select: { aiCreditsRemaining: true, aiCreditsMax: true }
  });

  if (!problem) {
    return { remaining: DEFAULT_PROBLEM_AI_CREDITS, max: DEFAULT_PROBLEM_AI_CREDITS };
  }

  return {
    remaining: problem.aiCreditsRemaining,
    max: problem.aiCreditsMax
  };
}

export async function checkAndDeductProblemAiCredits(params: {
  problemId?: string;
  cost: number;
  userId: string;
  action: string;
}): Promise<{ allowed: boolean; remaining: number; max: number }> {
  const { problemId, cost, userId, action } = params;

  if (!problemId || problemId === 'new' || problemId === 'test') {
    // Draft / un-persisted problem: allow action with default max
    return { allowed: true, remaining: DEFAULT_PROBLEM_AI_CREDITS - cost, max: DEFAULT_PROBLEM_AI_CREDITS };
  }

  const problem = await prisma.problem.findUnique({
    where: { id: problemId },
    select: { id: true, aiCreditsRemaining: true, aiCreditsMax: true }
  });

  if (!problem) {
    return { allowed: true, remaining: DEFAULT_PROBLEM_AI_CREDITS - cost, max: DEFAULT_PROBLEM_AI_CREDITS };
  }

  if (problem.aiCreditsRemaining < cost) {
    const error: any = new Error(`AI Credit limit reached for this question (${problem.aiCreditsRemaining} / ${problem.aiCreditsMax} credits remaining). AI assistance is disabled for this problem.`);
    error.statusCode = 402;
    error.remaining = problem.aiCreditsRemaining;
    error.max = problem.aiCreditsMax;
    throw error;
  }

  const updated = await prisma.problem.update({
    where: { id: problemId },
    data: {
      aiCreditsRemaining: { decrement: cost },
      aiCreditLogs: {
        create: {
          userId,
          action,
          creditsDeducted: cost,
          creditsRemaining: Math.max(0, problem.aiCreditsRemaining - cost)
        }
      }
    },
    select: { aiCreditsRemaining: true, aiCreditsMax: true }
  });

  return {
    allowed: true,
    remaining: updated.aiCreditsRemaining,
    max: updated.aiCreditsMax
  };
}
