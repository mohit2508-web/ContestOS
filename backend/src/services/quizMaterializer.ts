import crypto from 'crypto';
import prisma from '../lib/prisma';

export interface ShuffledOption {
  id: string;
  content: string;
  imageUrl?: string | null;
  displayOrder: number;
}

export interface QuizQuestionPayload {
  attemptQuestionId: string;
  questionId: string;
  questionType: string;
  content: string;
  imageUrl?: string | null;
  passage?: {
    id: string;
    title?: string | null;
    content: string;
  } | null;
  options: ShuffledOption[];
  presentedOrder: number;
  totalQuestions: number;
}

/**
  Fisher-Yates Shuffle helper
 */
function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Materializes a candidate's per-attempt question set upon section start.
 * Shuffles question order and option IDs per question to prevent answer leaks.
 */
export async function materializeQuizAttempt(userId: string, contestId: string, sectionId: string) {
  // Check if materialized attempt questions already exist for this user & section
  const existing = await prisma.quizAttemptQuestion.findMany({
    where: { userId, contestId, sectionId },
    orderBy: { presentedOrder: 'asc' },
  });

  if (existing.length > 0) {
    return existing;
  }

  // Fetch all questions for this section along with options
  const questions = (await prisma.quizQuestion.findMany({
    where: { sectionId },
    include: { options: true, passage: true },
  })) as any[];

  if (questions.length === 0) {
    return [];
  }

  // Shuffle question order
  const shuffledQuestions = shuffleArray(questions);

  const materialized = [];
  for (let idx = 0; idx < shuffledQuestions.length; idx++) {
    const q: any = shuffledQuestions[idx];
    
    // Shuffle options if enabled for this question
    const options: any[] = q.randomizeOptions ? shuffleArray(q.options) : q.options;
    const optionOrderMap = options.map((opt: any) => opt.id);

    const attemptQuestion = await prisma.quizAttemptQuestion.create({
      data: {
        userId,
        contestId,
        sectionId,
        questionId: q.id,
        presentedOrder: idx + 1,
        optionOrderMap,
        imageTransformApplied: q.imageUrl ? { rotationDeg: (idx * 90) % 360, mirrored: idx % 2 === 1 } : { rotationDeg: 0, mirrored: false },
      },
    });

    materialized.push(attemptQuestion);
  }

  return materialized;
}

/**
 * Derive AES-256 key from a session token string
 */
function deriveKey(sessionToken: string): Buffer {
  return crypto.createHash('sha256').update(sessionToken || 'contestos-default-secret-key-32b').digest();
}

/**
 * Encrypts a question payload with AES-256-GCM
 */
export function encryptQuizPayload(payload: any, sessionToken: string): { ciphertext: string; iv: string; authTag: string } {
  const key = deriveKey(sessionToken);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const jsonStr = JSON.stringify(payload);
  let encrypted = cipher.update(jsonStr, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex');

  return {
    ciphertext: encrypted,
    iv: iv.toString('hex'),
    authTag,
  };
}

/**
 * Decrypts an encrypted question payload with AES-256-GCM
 */
export function decryptQuizPayload(encrypted: { ciphertext: string; iv: string; authTag: string }, sessionToken: string): any {
  const key = deriveKey(sessionToken);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(encrypted.iv, 'hex'));
  decipher.setAuthTag(Buffer.from(encrypted.authTag, 'hex'));

  let decrypted = decipher.update(encrypted.ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return JSON.parse(decrypted);
}
