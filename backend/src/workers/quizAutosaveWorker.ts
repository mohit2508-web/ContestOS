import prisma from '../lib/prisma';

export interface PendingAnswerPayload {
  attemptQuestionId: string;
  userId: string;
  selectedOptionIds?: string[];
  numericAnswer?: number | null;
  textAnswer?: string | null;
  scratchpadData?: any;
  timeSpentMs?: number;
  flaggedForReview?: boolean;
}

const answerQueue: PendingAnswerPayload[] = [];

/**
 * Enqueues a response payload for background database flush
 */
export function enqueueAutosaveAnswer(payload: PendingAnswerPayload) {
  answerQueue.push(payload);
}

/**
 * Background worker: flushes queued candidate answers to CockroachDB
 */
export async function flushAutosaveQueue(): Promise<number> {
  if (answerQueue.length === 0) return 0;

  const batch = answerQueue.splice(0, 50);
  let processed = 0;

  for (const item of batch) {
    try {
      const existing = await prisma.quizResponse.findFirst({
        where: { attemptQuestionId: item.attemptQuestionId, userId: item.userId },
      });

      if (existing) {
        await prisma.quizResponse.update({
          where: { id: existing.id },
          data: {
            selectedOptionIds: item.selectedOptionIds || [],
            numericAnswer: item.numericAnswer != null ? Number(item.numericAnswer) : null,
            textAnswer: item.textAnswer || null,
            scratchpadData: item.scratchpadData || null,
            timeSpentMs: (existing.timeSpentMs || 0) + (item.timeSpentMs || 0),
            flaggedForReview: item.flaggedForReview ?? existing.flaggedForReview,
            answeredAt: new Date(),
          },
        });
      } else {
        await prisma.quizResponse.create({
          data: {
            attemptQuestionId: item.attemptQuestionId,
            userId: item.userId,
            selectedOptionIds: item.selectedOptionIds || [],
            numericAnswer: item.numericAnswer != null ? Number(item.numericAnswer) : null,
            textAnswer: item.textAnswer || null,
            scratchpadData: item.scratchpadData || null,
            timeSpentMs: item.timeSpentMs || 0,
            flaggedForReview: item.flaggedForReview ?? false,
          },
        });
      }
      processed++;
    } catch (err) {
      console.error('Autosave flush error:', err);
    }
  }

  return processed;
}

// Background timer: flush every 3 seconds
setInterval(() => {
  flushAutosaveQueue().catch(() => {});
}, 3000);
