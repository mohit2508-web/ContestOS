import { Server as SocketIOServer, Socket } from 'socket.io';
import { isQuizSessionFrozen, setQuizSessionFreeze } from '../services/proctoringService';

interface TimerSession {
  contestId: string;
  sectionId: string;
  userId: string;
  endTime: number;
}

const activeSessions = new Map<string, TimerSession>();

export function setupQuizTimerSocket(io: SocketIOServer) {
  const quizNamespace = io.of('/quiz-timer');

  quizNamespace.on('connection', (socket: Socket) => {
    let currentKey = '';

    socket.on('timer:join', ({ contestId, sectionId, userId, durationMinutes }) => {
      currentKey = `${userId}:${contestId}:${sectionId}`;
      socket.join(currentKey);

      let session = activeSessions.get(currentKey);
      if (!session) {
        const endTime = Date.now() + durationMinutes * 60 * 1000;
        session = { contestId, sectionId, userId, endTime };
        activeSessions.set(currentKey, session);
      }

      const remainingMs = Math.max(0, session.endTime - Date.now());
      const isFrozen = isQuizSessionFrozen(userId, contestId);

      socket.emit('timer:sync', {
        remainingMs,
        isFrozen,
        serverTime: Date.now(),
      });
    });

    socket.on('proctor:freeze_session', ({ targetUserId, contestId }) => {
      setQuizSessionFreeze(targetUserId, contestId, true);
      quizNamespace.to(`${targetUserId}:${contestId}`).emit('session:frozen', { isFrozen: true });
    });

    socket.on('proctor:unfreeze_session', ({ targetUserId, contestId }) => {
      setQuizSessionFreeze(targetUserId, contestId, false);
      quizNamespace.to(`${targetUserId}:${contestId}`).emit('session:frozen', { isFrozen: false });
    });

    socket.on('disconnect', () => {
      if (currentKey) {
        socket.leave(currentKey);
      }
    });
  });

  // Background interval: sync timer remainingMs every 5s
  setInterval(() => {
    const now = Date.now();
    for (const [key, session] of activeSessions.entries()) {
      const remainingMs = Math.max(0, session.endTime - now);
      const isFrozen = isQuizSessionFrozen(session.userId, session.contestId);

      quizNamespace.to(key).emit('timer:tick', {
        remainingMs,
        isFrozen,
        serverTime: now,
      });

      if (remainingMs === 0) {
        quizNamespace.to(key).emit('timer:expired', { sectionId: session.sectionId });
        activeSessions.delete(key);
      }
    }
  }, 5000);
}
