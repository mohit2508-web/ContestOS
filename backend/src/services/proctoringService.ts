import prisma from '../lib/prisma';

export interface SyncCheatingWindow {
  questionId: string;
  userId: string;
  userIp: string;
  answeredAt: number;
  selectedOptionIds: string[];
}

// In-memory slide window for detecting rapid identical answers on same IP subnet
const submissionWindow: SyncCheatingWindow[] = [];
const WINDOW_TTL_MS = 10000; // 10s retention window

// Active frozen quiz sessions (userId:contestId -> boolean)
const frozenSessions = new Map<string, boolean>();

/**
 * Checks for synchronized cheating (multiple candidates on same IP submitting identical answers within 500ms)
 */
export async function detectSynchronizedCheating(
  userId: string,
  contestId: string,
  questionId: string,
  userIp: string,
  selectedOptionIds: string[]
): Promise<boolean> {
  const now = Date.now();

  // Prune expired entries
  while (submissionWindow.length > 0 && now - submissionWindow[0].answeredAt > WINDOW_TTL_MS) {
    submissionWindow.shift();
  }

  // Look for another user on the same IP subnet submitting identical options within 500ms
  const match = submissionWindow.find(
    (entry) =>
      entry.userId !== userId &&
      entry.questionId === questionId &&
      entry.userIp === userIp &&
      Math.abs(now - entry.answeredAt) <= 500 &&
      JSON.stringify(entry.selectedOptionIds.sort()) === JSON.stringify([...selectedOptionIds].sort())
  );

  submissionWindow.push({
    userId,
    questionId,
    userIp,
    answeredAt: now,
    selectedOptionIds,
  });

  if (match) {
    // Log suspicious proctoring event
    try {
      await prisma.proctoringLog.create({
        data: {
          contestId,
          userId,
          eventType: 'SYNCHRONIZED_ANSWER_ANOMALY',
          details: `Identical answer submitted within 500ms of user ${match.userId} on IP ${userIp}`,
        },
      });
    } catch {
      // ignore log failure
    }
    return true;
  }

  return false;
}

/**
 * Freezes a candidate's quiz session from the Proctor Live Command Center
 */
export function setQuizSessionFreeze(userId: string, contestId: string, isFrozen: boolean) {
  const key = `${userId}:${contestId}`;
  frozenSessions.set(key, isFrozen);
}

/**
 * Checks if a candidate's quiz session is currently frozen
 */
export function isQuizSessionFrozen(userId: string, contestId: string): boolean {
  const key = `${userId}:${contestId}`;
  return frozenSessions.get(key) ?? false;
}
