// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SocketIOServer = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Socket = any;
import { isQuizSessionFrozen, setQuizSessionFreeze } from '../services/proctoringService';
import prisma from '../lib/prisma';
import { notifyUser } from '../lib/notifyUser';

interface TimerSession {
  contestId: string;
  sectionId: string;
  userId: string;
  endTime: number;
  frozenMs: number; // Accumulated frozen time so timer resumes correctly
  frozenAt: number | null; // Timestamp when freeze started
}

const activeSessions = new Map<string, TimerSession>();

// Track which socket belongs to which user+contest (for proctor targeting)
const userSocketMap = new Map<string, string>(); // `userId:contestId` -> socketId

export let ioInstance: SocketIOServer = null;

export function setupQuizTimerSocket(io: SocketIOServer) {
  ioInstance = io;
  const quizNamespace = io.of('/quiz-timer');

  quizNamespace.on('connection', (socket: Socket) => {
    let currentKey = '';
    let currentUserId = '';
    let currentContestId = '';

    // ─── STUDENT: Join timer session ──────────────────────────────────────────
    socket.on('timer:join', ({ contestId, sectionId, userId, durationMinutes }: {
      contestId: string;
      sectionId: string;
      userId: string;
      durationMinutes: number;
    }) => {
      currentKey = `${userId}:${contestId}:${sectionId}`;
      currentUserId = userId;
      currentContestId = contestId;
      socket.join(currentKey);

      // Also join a user-contest room for direct proctor targeting
      const userContestRoom = `user:${userId}:contest:${contestId}`;
      socket.join(userContestRoom);
      userSocketMap.set(`${userId}:${contestId}`, socket.id);

      let session = activeSessions.get(currentKey);
      if (!session) {
        const endTime = Date.now() + durationMinutes * 60 * 1000;
        session = { contestId, sectionId, userId, endTime, frozenMs: 0, frozenAt: null };
        activeSessions.set(currentKey, session);
      }

      const isFrozen = isQuizSessionFrozen(userId, contestId);
      const remainingMs = computeRemainingMs(session);

      socket.emit('timer:sync', {
        remainingMs,
        isFrozen,
        serverTime: Date.now(),
      });

      // Send current block status if they reconnect while blocked
      if (isFrozen) {
        socket.emit('proctor:action', {
          action: 'BLOCKED',
          reason: 'Your session is currently paused by the invigilator.',
          contestId,
        });
      }
    });

    // ─── PROCTOR: Freeze quiz session (legacy) ─────────────────────────────────
    socket.on('proctor:freeze_session', ({ targetUserId, contestId }: { targetUserId: string; contestId: string }) => {
      setQuizSessionFreeze(targetUserId, contestId, true);
      const room = `user:${targetUserId}:contest:${contestId}`;
      quizNamespace.to(room).emit('session:frozen', { isFrozen: true });
      quizNamespace.to(room).emit('proctor:action', {
        action: 'BLOCKED',
        reason: 'Your session has been paused by the invigilator.',
        contestId,
      });
    });

    socket.on('proctor:unfreeze_session', ({ targetUserId, contestId }: { targetUserId: string; contestId: string }) => {
      setQuizSessionFreeze(targetUserId, contestId, false);
      const room = `user:${targetUserId}:contest:${contestId}`;
      quizNamespace.to(room).emit('session:frozen', { isFrozen: false });
      quizNamespace.to(room).emit('proctor:action', {
        action: 'UNBLOCKED',
        contestId,
      });
    });

    // ─── PROCTOR: Block student (full exam pause + block screen) ──────────────
    socket.on('proctor:block_student', async ({
      targetUserId,
      contestId,
      reason,
      proctorName,
    }: {
      targetUserId: string;
      contestId: string;
      reason?: string;
      proctorName?: string;
    }) => {
      setQuizSessionFreeze(targetUserId, contestId, true);

      // Freeze the timer - record frozen start time
      for (const [key, session] of activeSessions.entries()) {
        if (session.userId === targetUserId && session.contestId === contestId) {
          session.frozenAt = Date.now();
          activeSessions.set(key, session);
          break;
        }
      }

      const room = `user:${targetUserId}:contest:${contestId}`;
      quizNamespace.to(room).emit('proctor:action', {
        action: 'BLOCKED',
        reason: reason || 'Your exam has been paused by the invigilator. Please wait.',
        proctorName: proctorName || 'Invigilator',
        contestId,
      });
      quizNamespace.to(room).emit('session:frozen', { isFrozen: true });

      // Notify proctor rooms of status change
      quizNamespace.to(`proctor:contest:${contestId}`).emit('proctor:candidate_status_change', { userId: targetUserId, contestId, newStatus: 'BLOCKED' });
      quizNamespace.to('proctor:all').emit('proctor:candidate_status_change', { userId: targetUserId, contestId, newStatus: 'BLOCKED' });

      // Log to DB
      try {
        await prisma.proctoringLog.create({
          data: {
            contestId,
            userId: targetUserId,
            eventType: 'PROCTOR_BLOCK',
            details: `Proctor blocked student: ${reason || 'No reason provided'}`,
          },
        });
        await notifyUser(targetUserId, {
          title: '⛔ Exam Paused by Invigilator',
          message: reason || 'Your exam has been paused. Please wait for instructions.',
          type: 'PROCTOR_ACTION',
          referenceId: contestId,
        });
      } catch (e) {
        console.error('Failed to log proctor block:', e);
      }
    });

    // ─── PROCTOR: Unblock student (resume exam) ────────────────────────────────
    socket.on('proctor:unblock_student', async ({
      targetUserId,
      contestId,
    }: {
      targetUserId: string;
      contestId: string;
    }) => {
      setQuizSessionFreeze(targetUserId, contestId, false);

      // Resume timer - add frozen duration to extend end time
      for (const [key, session] of activeSessions.entries()) {
        if (session.userId === targetUserId && session.contestId === contestId) {
          if (session.frozenAt !== null) {
            const frozenDuration = Date.now() - session.frozenAt;
            session.endTime += frozenDuration;
            session.frozenMs += frozenDuration;
            session.frozenAt = null;
            activeSessions.set(key, session);
          }
          break;
        }
      }

      const room = `user:${targetUserId}:contest:${contestId}`;
      quizNamespace.to(room).emit('proctor:action', {
        action: 'UNBLOCKED',
        contestId,
      });
      quizNamespace.to(room).emit('session:frozen', { isFrozen: false });

      // Notify proctor rooms of status change
      quizNamespace.to(`proctor:contest:${contestId}`).emit('proctor:candidate_status_change', { userId: targetUserId, contestId, newStatus: 'RESUMED' });
      quizNamespace.to('proctor:all').emit('proctor:candidate_status_change', { userId: targetUserId, contestId, newStatus: 'RESUMED' });

      // Log to DB
      try {
        await prisma.proctoringLog.create({
          data: {
            contestId,
            userId: targetUserId,
            eventType: 'PROCTOR_UNBLOCK',
            details: 'Proctor unblocked student — exam resumed.',
          },
        });
        await notifyUser(targetUserId, {
          title: '✅ Exam Resumed',
          message: 'Your exam has been resumed by the invigilator. You may continue.',
          type: 'PROCTOR_ACTION',
          referenceId: contestId,
        });
      } catch (e) {
        console.error('Failed to log proctor unblock:', e);
      }
    });

    // ─── PROCTOR: Warn student (show warning toast, no block) ─────────────────
    socket.on('proctor:warn_student', async ({
      targetUserId,
      contestId,
      message,
    }: {
      targetUserId: string;
      contestId: string;
      message?: string;
    }) => {
      const room = `user:${targetUserId}:contest:${contestId}`;
      quizNamespace.to(room).emit('proctor:action', {
        action: 'WARNED',
        message: message || 'You have received a warning from the invigilator.',
        contestId,
      });

      try {
        await prisma.proctoringLog.create({
          data: {
            contestId,
            userId: targetUserId,
            eventType: 'PROCTOR_WARNING',
            details: message || 'Proctor issued a live warning.',
          },
        });
        await notifyUser(targetUserId, {
          title: '⚠️ Invigilator Warning',
          message: message || 'You have received a warning from the invigilator.',
          type: 'WARNING',
          referenceId: contestId,
        });
      } catch (e) {
        console.error('Failed to log proctor warn:', e);
      }
    });

    // ─── PROCTOR: Terminate student (disqualify) ──────────────────────────────
    socket.on('proctor:terminate_student', async ({
      targetUserId,
      contestId,
      reason,
    }: {
      targetUserId: string;
      contestId: string;
      reason?: string;
    }) => {
      const room = `user:${targetUserId}:contest:${contestId}`;
      quizNamespace.to(room).emit('proctor:action', {
        action: 'TERMINATED',
        reason: reason || 'You have been disqualified from this exam.',
        contestId,
      });

      // Notify proctor rooms of status change
      quizNamespace.to(`proctor:contest:${contestId}`).emit('proctor:candidate_status_change', { userId: targetUserId, contestId, newStatus: 'DISQUALIFIED' });
      quizNamespace.to('proctor:all').emit('proctor:candidate_status_change', { userId: targetUserId, contestId, newStatus: 'DISQUALIFIED' });

      try {
        await prisma.contestRegistration.updateMany({
          where: { contestId, userId: targetUserId },
          data: { status: 'DISQUALIFIED' },
        });
        await prisma.proctoringLog.create({
          data: {
            contestId,
            userId: targetUserId,
            eventType: 'ESCALATED_FOR_DISQUALIFICATION',
            details: `Proctor terminated student: ${reason || 'No reason provided'}`,
          },
        });
        await notifyUser(targetUserId, {
          title: '🚫 Exam Terminated',
          message: reason || 'You have been disqualified from this exam by the invigilator.',
          type: 'PROCTOR_ACTION',
          referenceId: contestId,
        });
      } catch (e) {
        console.error('Failed to terminate student:', e);
      }
    });

    // ─── PROCTOR: Join contest proctor room ──────────────────────────────────
    socket.on('proctor:join_room', ({ contestId }: { contestId: string }) => {
      socket.join(`proctor:contest:${contestId}`);
      socket.join(`proctor:all`);
    });

    // ─── STUDENT: Stream live webcam frame to invigilator ────────────────────
    socket.on('student:webcam_frame', ({
      contestId,
      userId,
      frameBase64,
    }: {
      contestId: string;
      userId: string;
      frameBase64: string;
    }) => {
      // Broadcast frame to proctor room for this contest & all proctors
      quizNamespace.to(`proctor:contest:${contestId}`).emit('proctor:candidate_frame', {
        contestId,
        userId,
        frameBase64,
        timestamp: Date.now(),
      });
      quizNamespace.to('proctor:all').emit('proctor:candidate_frame', {
        contestId,
        userId,
        frameBase64,
        timestamp: Date.now(),
      });
    });

    // ─── STUDENT: Stream live desktop screen frame to invigilator ────────────
    socket.on('student:screen_frame', ({
      contestId,
      userId,
      frameBase64,
    }: {
      contestId: string;
      userId: string;
      frameBase64: string;
    }) => {
      quizNamespace.to(`proctor:contest:${contestId}`).emit('proctor:candidate_screen_frame', {
        contestId,
        userId,
        frameBase64,
        timestamp: Date.now(),
      });
      quizNamespace.to('proctor:all').emit('proctor:candidate_screen_frame', {
        contestId,
        userId,
        frameBase64,
        timestamp: Date.now(),
      });
    });

    socket.on('disconnect', () => {
      if (currentKey) {
        socket.leave(currentKey);
      }
      if (currentUserId && currentContestId) {
        userSocketMap.delete(`${currentUserId}:${currentContestId}`);
      }
    });
  });

  // Background interval: sync timer remainingMs every 5s
  setInterval(() => {
    const now = Date.now();
    for (const [key, session] of activeSessions.entries()) {
      const isFrozen = isQuizSessionFrozen(session.userId, session.contestId);
      const remainingMs = computeRemainingMs(session);

      quizNamespace.to(key).emit('timer:tick', {
        remainingMs,
        isFrozen,
        serverTime: now,
      });

      if (remainingMs === 0 && !isFrozen) {
        quizNamespace.to(key).emit('timer:expired', { sectionId: session.sectionId });
        activeSessions.delete(key);
      }
    }
  }, 5000);
}

function computeRemainingMs(session: TimerSession): number {
  const isFrozen = isQuizSessionFrozen(session.userId, session.contestId);
  if (isFrozen && session.frozenAt !== null) {
    // Return the remaining time at the moment of freeze
    return Math.max(0, session.endTime - session.frozenAt);
  }
  return Math.max(0, session.endTime - Date.now());
}
