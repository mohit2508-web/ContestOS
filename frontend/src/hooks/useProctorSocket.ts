import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export type ProctorActionType = 'BLOCKED' | 'UNBLOCKED' | 'WARNED' | 'TERMINATED';

export interface ProctorAction {
  action: ProctorActionType;
  reason?: string;
  message?: string;
  proctorName?: string;
  contestId?: string;
  warningsCount?: number;
  maxWarnings?: number;
}

interface UseProctorSocketOptions {
  userId: string;
  contestId: string;
  sectionId?: string;
  durationMinutes?: number;
  enabled?: boolean;
  onAction?: (action: ProctorAction) => void;
  onTimerTick?: (remainingMs: number, isFrozen: boolean) => void;
  onTimerExpired?: (sectionId: string) => void;
}

interface ProctorSocketState {
  isBlocked: boolean;
  blockReason: string;
  proctorName: string;
  warningsCount: number;
  maxWarnings: number;
  isTerminated: boolean;
  terminationReason: string;
  warnMessage: string;
  remainingMs: number | null;
  connected: boolean;
}

const BACKEND_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';

export function useProctorSocket({
  userId,
  contestId,
  sectionId = '',
  durationMinutes = 0,
  enabled = true,
  onAction,
  onTimerTick,
  onTimerExpired,
}: UseProctorSocketOptions): ProctorSocketState & {
  emitBlock: (targetUserId: string, reason?: string) => void;
  emitUnblock: (targetUserId: string) => void;
  emitWarn: (targetUserId: string, message?: string) => void;
  emitTerminate: (targetUserId: string, reason?: string) => void;
  sendWebcamFrame: (frameBase64: string) => void;
  sendScreenFrame: (frameBase64: string) => void;
} {
  const socketRef = useRef<Socket | null>(null);
  const [state, setState] = useState<ProctorSocketState>({
    isBlocked: false,
    blockReason: '',
    proctorName: '',
    warningsCount: 0,
    maxWarnings: 3,
    isTerminated: false,
    terminationReason: '',
    warnMessage: '',
    remainingMs: null,
    connected: false,
  });

  useEffect(() => {
    if (!enabled || !userId || !contestId) return;

    const socket = io(`${BACKEND_URL}/quiz-timer`, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setState((s) => ({ ...s, connected: true }));

      // Join the timer session room
      if (sectionId && durationMinutes > 0) {
        socket.emit('timer:join', { contestId, sectionId, userId, durationMinutes });
      }
    });

    socket.on('disconnect', () => {
      setState((s) => ({ ...s, connected: false }));
    });

    // Listen for proctor actions
    socket.on('proctor:action', (data: ProctorAction) => {
      onAction?.(data);

      switch (data.action) {
        case 'BLOCKED':
          setState((s) => ({
            ...s,
            isBlocked: true,
            blockReason: data.reason || 'Your exam has been paused by the invigilator.',
            proctorName: data.proctorName || 'Invigilator',
            warningsCount: data.warningsCount ?? s.warningsCount,
            maxWarnings: data.maxWarnings ?? s.maxWarnings,
          }));
          break;

        case 'UNBLOCKED':
          setState((s) => ({
            ...s,
            isBlocked: false,
            blockReason: '',
            proctorName: '',
          }));
          break;

        case 'WARNED':
          setState((s) => ({
            ...s,
            warnMessage: data.message || 'You have received a warning from the invigilator.',
          }));
          // Auto-clear after 8 seconds
          setTimeout(() => {
            setState((s) => ({ ...s, warnMessage: '' }));
          }, 8000);
          break;

        case 'TERMINATED':
          setState((s) => ({
            ...s,
            isTerminated: true,
            terminationReason: data.reason || 'You have been disqualified from this exam.',
          }));
          break;
      }
    });

    // Timer tick
    socket.on('timer:tick', ({ remainingMs, isFrozen }: { remainingMs: number; isFrozen: boolean }) => {
      setState((s) => ({ ...s, remainingMs, isBlocked: isFrozen }));
      onTimerTick?.(remainingMs, isFrozen);
    });

    socket.on('timer:sync', ({ remainingMs, isFrozen }: { remainingMs: number; isFrozen: boolean }) => {
      setState((s) => ({ ...s, remainingMs, isBlocked: isFrozen }));
    });

    socket.on('timer:expired', ({ sectionId: expiredSectionId }: { sectionId: string }) => {
      onTimerExpired?.(expiredSectionId);
    });

    // Legacy freeze events
    socket.on('session:frozen', ({ isFrozen }: { isFrozen: boolean }) => {
      if (!isFrozen) {
        setState((s) => ({ ...s, isBlocked: false, blockReason: '' }));
      }
    });

    // Listen for live broadcast announcements
    const broadcastHandler = (data: { message: string; priority?: string }) => {
      setState((s) => ({
        ...s,
        warnMessage: `📢 PROCTOR ANNOUNCEMENT: ${data.message}`,
      }));
      setTimeout(() => {
        setState((s) => ({ ...s, warnMessage: '' }));
      }, 10000);
    };
    socket.on('proctor:broadcast', broadcastHandler);

    // Candidate Ping Heartbeat
    const pingInterval = setInterval(() => {
      if (socket.connected && userId && contestId) {
        socket.emit('candidate:ping', { contestId, userId, latencyMs: 20 });
      }
    }, 5000);

    return () => {
      clearInterval(pingInterval);
      socket.off('proctor:broadcast', broadcastHandler);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [enabled, userId, contestId, sectionId, durationMinutes]);

  // Proctor emit helpers (for use in ProctorConsole)
  const emitBlock = (targetUserId: string, reason?: string) => {
    socketRef.current?.emit('proctor:block_student', { targetUserId, contestId, reason });
  };

  const emitUnblock = (targetUserId: string) => {
    socketRef.current?.emit('proctor:unblock_student', { targetUserId, contestId });
  };

  const emitWarn = (targetUserId: string, message?: string) => {
    socketRef.current?.emit('proctor:warn_student', { targetUserId, contestId, message });
  };

  const emitTerminate = (targetUserId: string, reason?: string) => {
    socketRef.current?.emit('proctor:terminate_student', { targetUserId, contestId, reason });
  };

  const sendWebcamFrame = (frameBase64: string) => {
    socketRef.current?.emit('student:webcam_frame', { contestId, userId, frameBase64 });
  };

  const sendScreenFrame = (frameBase64: string) => {
    socketRef.current?.emit('student:screen_frame', { contestId, userId, frameBase64 });
  };

  return { ...state, emitBlock, emitUnblock, emitWarn, emitTerminate, sendWebcamFrame, sendScreenFrame };
}
