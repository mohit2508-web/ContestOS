import { QuestionReviewStatus, BankScope } from '../generated/client';
import prisma from '../lib/prisma';

export interface AddAssemblyRuleParams {
  sectionId: string;
  category: string;
  topic?: string | null;
  minDifficulty?: number;
  maxDifficulty?: number;
  sampleCount: number;
  points?: number;
}

export class ContestAssemblyEngine {
  /**
   * Add a rule definition to a contest section
   */
  static async addRule(params: AddAssemblyRuleParams) {
    return prisma.contestAssemblyRule.create({
      data: {
        sectionId: params.sectionId,
        category: params.category,
        topic: params.topic,
        minDifficulty: params.minDifficulty ?? 1,
        maxDifficulty: params.maxDifficulty ?? 5,
        sampleCount: params.sampleCount,
        points: params.points ?? 4.0,
      },
    });
  }

  /**
   * Manual Assembly: Attach specific PUBLISHED question IDs to a section
   */
  static async attachQuestionsManual(sectionId: string, questionIds: string[]) {
    // Enforce that only PUBLISHED questions can be attached
    const validQuestions = await prisma.quizQuestion.findMany({
      where: {
        id: { in: questionIds },
        reviewStatus: QuestionReviewStatus.PUBLISHED,
      },
      select: { id: true },
    });

    const validIds = validQuestions.map((q) => q.id);

    if (validIds.length === 0) {
      throw new Error('No valid PUBLISHED questions found to attach');
    }

    await prisma.quizQuestion.updateMany({
      where: { id: { in: validIds } },
      data: { sectionId },
    });

    return { attachedCount: validIds.length, attachedIds: validIds };
  }

  /**
   * Rule-Based Auto-Assembly Engine:
   * Dynamically samples per-candidate question pool matching rules
   */
  static async assembleCandidateQuestionsByRules(
    userId: string,
    contestId: string,
    sectionId: string,
    organizationId?: string | null
  ) {
    // 1. Fetch section rules
    const rules = await prisma.contestAssemblyRule.findMany({
      where: { sectionId },
    });

    if (rules.length === 0) {
      // Fallback to static questions attached to section
      return prisma.quizQuestion.findMany({
        where: {
          sectionId,
          reviewStatus: QuestionReviewStatus.PUBLISHED,
        },
        include: { options: true },
        orderBy: { createdAt: 'asc' },
      });
    }

    const sampledQuestionIds: string[] = [];

    // 2. For each rule, query matching PUBLISHED questions from accessible banks
    for (const rule of rules) {
      const candidates = await prisma.quizQuestion.findMany({
        where: {
          reviewStatus: QuestionReviewStatus.PUBLISHED,
          category: { equals: rule.category, mode: 'insensitive' },
          difficulty: { gte: rule.minDifficulty, lte: rule.maxDifficulty },
          ...(rule.topic ? { topic: { equals: rule.topic, mode: 'insensitive' } } : {}),
          bank: {
            OR: [
              { scope: BankScope.PLATFORM_GLOBAL },
              { scope: BankScope.SHARED_CONTRIBUTED },
              { scope: BankScope.TENANT_PRIVATE, organizationId: organizationId || 'NO_ORG' },
            ],
          },
        },
        select: { id: true },
      });

      // Fisher-Yates Random Sampling
      const availableIds = candidates.map((c) => c.id).filter((id) => !sampledQuestionIds.includes(id));
      for (let i = availableIds.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [availableIds[i], availableIds[j]] = [availableIds[j], availableIds[i]];
      }

      const picked = availableIds.slice(0, rule.sampleCount);
      sampledQuestionIds.push(...picked);
    }

    // 3. Fetch full question objects
    return prisma.quizQuestion.findMany({
      where: { id: { in: sampledQuestionIds } },
      include: { options: true },
    });
  }
}
