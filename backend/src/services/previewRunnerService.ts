import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class PreviewRunnerService {
  /**
   * Generates a candidate dry-run preview session payload for a question
   */
  static async getQuestionPreview(questionId: string) {
    const question = await prisma.quizQuestion.findUnique({
      where: { id: questionId },
      include: {
        options: {
          select: { id: true, content: true, imageUrl: true, displayOrder: true, isCorrect: true },
          orderBy: { displayOrder: 'asc' },
        },
        passage: true,
        bank: true,
      },
    });

    if (!question) {
      throw new Error('Question not found for preview');
    }

    return {
      previewMode: true,
      simulatedAttemptQuestionId: `preview-aq-${question.id}`,
      question: {
        id: question.id,
        content: question.content,
        questionType: question.questionType,
        difficulty: question.difficulty,
        category: question.category,
        topic: question.topic,
        points: question.points,
        negativeMarking: question.negativeMarking,
        explanation: question.explanation,
        options: question.options,
        passage: question.passage,
        version: question.version,
        reviewStatus: question.reviewStatus,
      },
    };
  }
}
