import { PrismaClient, BankScope, QuestionReviewStatus } from '../generated/client';

const prisma = new PrismaClient();

export interface CreateBankParams {
  name: string;
  description?: string;
  scope: BankScope;
  organizationId?: string | null;
  createdById: string;
}

export interface CreateQuestionParams {
  bankId?: string | null;
  sectionId?: string | null;
  passageId?: string | null;
  questionType: any;
  content: string;
  imageUrl?: string | null;
  difficulty: number;
  category: string;
  topic?: string | null;
  subtopic?: string | null;
  points: number;
  negativeMarking: number;
  explanation?: string | null;
  allowPlatformSharing?: boolean;
  options: { content: string; imageUrl?: string | null; isCorrect: boolean; displayOrder: number }[];
  createdById: string;
}

export class QuestionBankService {
  /**
   * Create a new Question Bank (Global, Private, or Shared)
   */
  static async createBank(params: CreateBankParams) {
    return prisma.questionBank.create({
      data: {
        name: params.name,
        description: params.description,
        scope: params.scope,
        organizationId: params.organizationId,
        createdById: params.createdById,
      },
    });
  }

  /**
   * List accessible Question Banks for a given organization / user
   */
  static async listAccessibleBanks(organizationId?: string | null, isSuperAdmin: boolean = false) {
    if (isSuperAdmin) {
      return prisma.questionBank.findMany({
        include: { _count: { select: { questions: true } } },
        orderBy: { createdAt: 'desc' },
      });
    }

    return prisma.questionBank.findMany({
      where: {
        OR: [
          { scope: BankScope.PLATFORM_GLOBAL },
          { scope: BankScope.SHARED_CONTRIBUTED },
          { scope: BankScope.TENANT_PRIVATE, organizationId: organizationId || 'NO_ORG' },
        ],
      },
      include: { _count: { select: { questions: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Create a Question in DRAFT state
   */
  static async createQuestion(params: CreateQuestionParams) {
    const createdQ = await prisma.quizQuestion.create({
      data: {
        bankId: params.bankId,
        sectionId: params.sectionId,
        passageId: params.passageId,
        questionType: params.questionType,
        reviewStatus: QuestionReviewStatus.DRAFT,
        content: params.content,
        imageUrl: params.imageUrl,
        difficulty: params.difficulty,
        category: params.category,
        topic: params.topic,
        subtopic: params.subtopic,
        points: params.points,
        negativeMarking: params.negativeMarking,
        explanation: params.explanation,
        allowPlatformSharing: params.allowPlatformSharing || false,
        version: 1,
        options: {
          create: params.options.map((opt) => ({
            content: opt.content,
            imageUrl: opt.imageUrl,
            isCorrect: opt.isCorrect,
            displayOrder: opt.displayOrder,
          })),
        },
      },
      include: { options: true },
    });

    // Create initial v1 snapshot
    await prisma.questionVersion.create({
      data: {
        questionId: createdQ.id,
        versionNumber: 1,
        contentSnapshot: JSON.parse(JSON.stringify(createdQ)),
        changeSummary: 'Initial Question Draft Created',
        createdById: params.createdById,
      },
    });

    return createdQ;
  }

  /**
   * Transition Question Review Status (Four-Eyes Principle)
   */
  static async transitionReviewStatus(
    questionId: string,
    reviewerId: string,
    targetStatus: QuestionReviewStatus,
    comments?: string
  ) {
    const question = await prisma.quizQuestion.findUnique({
      where: { id: questionId },
      include: { options: true },
    });

    if (!question) {
      throw new Error('Question not found');
    }

    // System-Enforced Four-Eyes Principle: Author cannot self-approve their own draft question!
    const initialVersion = await prisma.questionVersion.findFirst({
      where: { questionId, versionNumber: 1 },
    });
    if (initialVersion && initialVersion.createdById === reviewerId && targetStatus === QuestionReviewStatus.APPROVED) {
      throw new Error('Four-Eyes Principle Violation: Question author cannot self-approve their own draft question.');
    }

    const fromStatus = question.reviewStatus;

    // Execute status transition & audit log
    const [updatedQ] = await prisma.$transaction([
      prisma.quizQuestion.update({
        where: { id: questionId },
        data: { reviewStatus: targetStatus },
        include: { options: true },
      }),
      prisma.questionReviewLog.create({
        data: {
          questionId,
          reviewerId,
          fromStatus,
          toStatus: targetStatus,
          comments: comments || `Transitioned from ${fromStatus} to ${targetStatus}`,
        },
      }),
    ]);

    return updatedQ;
  }

  /**
   * Edit Question with Immutable Versioning
   * If question is PUBLISHED, create a new version snapshot without breaking existing attempt links.
   */
  static async updateQuestionWithVersioning(
    questionId: string,
    editorId: string,
    updates: Partial<CreateQuestionParams>,
    changeSummary: string
  ) {
    const current = await prisma.quizQuestion.findUnique({
      where: { id: questionId },
      include: { options: true },
    });

    if (!current) {
      throw new Error('Question not found');
    }

    // If PUBLISHED, increment version & reset status to UNDER_REVIEW
    const isPublished = current.reviewStatus === QuestionReviewStatus.PUBLISHED;
    const newVersion = isPublished ? current.version + 1 : current.version;
    const nextStatus = isPublished ? QuestionReviewStatus.UNDER_REVIEW : current.reviewStatus;

    // Delete old options if new options are provided
    if (updates.options && updates.options.length > 0) {
      await prisma.quizOption.deleteMany({ where: { questionId } });
    }

    const updated = await prisma.quizQuestion.update({
      where: { id: questionId },
      data: {
        content: updates.content ?? current.content,
        imageUrl: updates.imageUrl ?? current.imageUrl,
        difficulty: updates.difficulty ?? current.difficulty,
        category: updates.category ?? current.category,
        topic: updates.topic ?? current.topic,
        subtopic: updates.subtopic ?? current.subtopic,
        points: updates.points ?? current.points,
        negativeMarking: updates.negativeMarking ?? current.negativeMarking,
        explanation: updates.explanation ?? current.explanation,
        allowPlatformSharing: updates.allowPlatformSharing ?? current.allowPlatformSharing,
        version: newVersion,
        reviewStatus: nextStatus,
        options: updates.options
          ? {
              create: updates.options.map((opt) => ({
                content: opt.content,
                imageUrl: opt.imageUrl,
                isCorrect: opt.isCorrect,
                displayOrder: opt.displayOrder,
              })),
            }
          : undefined,
      },
      include: { options: true },
    });

    // Save immutable version snapshot
    await prisma.questionVersion.create({
      data: {
        questionId: updated.id,
        versionNumber: newVersion,
        contentSnapshot: JSON.parse(JSON.stringify(updated)),
        changeSummary: changeSummary || `Updated to version ${newVersion}`,
        createdById: editorId,
      },
    });

    return updated;
  }
}
