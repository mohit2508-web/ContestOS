// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SocketIOServer = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Socket = any;
import prisma from '../lib/prisma';

interface ActiveParticipant {
  socketId: string;
  userId: string;
  name: string;
  role: 'INTERVIEWER' | 'CANDIDATE' | 'OBSERVER';
  sessionId: string;
}

const activeParticipants = new Map<string, ActiveParticipant>();

export function setupInterviewSocket(io: SocketIOServer) {
  const interviewNamespace = io.of('/interview');

  interviewNamespace.on('connection', (socket: Socket) => {
    let currentSessionId = '';
    let currentUserId = '';

    // ─────────────────────────────────────────────────────────────
    // 1. JOIN SESSION ROOM
    // ─────────────────────────────────────────────────────────────
    socket.on('interview:join', ({
      sessionId,
      userId,
      name,
      role = 'CANDIDATE',
    }: {
      sessionId: string;
      userId: string;
      name: string;
      role?: 'INTERVIEWER' | 'CANDIDATE' | 'OBSERVER';
    }) => {
      currentSessionId = sessionId;
      currentUserId = userId;

      const roomName = `session:${sessionId}`;
      socket.join(roomName);

      activeParticipants.set(socket.id, {
        socketId: socket.id,
        userId,
        name,
        role,
        sessionId,
      });

      // Collect all active participants in this session
      const roomParticipants: Array<{ socketId: string; userId: string; name: string; role: string }> = [];
      for (const p of activeParticipants.values()) {
        if (p.sessionId === sessionId) {
          roomParticipants.push({
            socketId: p.socketId,
            userId: p.userId,
            name: p.name,
            role: p.role,
          });
        }
      }

      // Notify others in room that a user joined
      socket.to(roomName).emit('interview:user-joined', {
        socketId: socket.id,
        userId,
        name,
        role,
        participants: roomParticipants,
      });

      // Send state back to joined user
      socket.emit('interview:room-state', {
        sessionId,
        participants: roomParticipants,
      });
    });

    // ─────────────────────────────────────────────────────────────
    // 2. PHASE TRANSITION & TIMER SYNC
    // ─────────────────────────────────────────────────────────────
    socket.on('interview:phase-change', async ({
      sessionId,
      phase,
    }: {
      sessionId: string;
      phase: 'UNDERSTAND' | 'PLAN' | 'CODE' | 'OPTIMIZE' | 'COMPLETED';
    }) => {
      const roomName = `session:${sessionId}`;
      interviewNamespace.to(roomName).emit('interview:phase-updated', { phase });

      try {
        await prisma.mockInterviewSession.update({
          where: { id: sessionId },
          data: { currentPhase: phase },
        });
      } catch (err) {
        console.error('Failed to update session phase:', err);
      }
    });

    // ─────────────────────────────────────────────────────────────
    // 3. EDITOR CODE & LANGUAGE SYNC
    // ─────────────────────────────────────────────────────────────
    socket.on('interview:code-change', ({
      sessionId,
      code,
    }: {
      sessionId: string;
      code: string;
    }) => {
      socket.to(`session:${sessionId}`).emit('interview:code-updated', { code });
    });

    socket.on('interview:language-change', ({
      sessionId,
      language,
    }: {
      sessionId: string;
      language: string;
    }) => {
      socket.to(`session:${sessionId}`).emit('interview:language-updated', { language });
    });

    socket.on('interview:blind-mode-toggle', ({
      sessionId,
      isBlind,
    }: {
      sessionId: string;
      isBlind: boolean;
    }) => {
      interviewNamespace.to(`session:${sessionId}`).emit('interview:blind-mode-updated', { isBlind });
    });

    // ─────────────────────────────────────────────────────────────
    // 4. CODE SNAPSHOT (Auto-saved every 30s)
    // ─────────────────────────────────────────────────────────────
    socket.on('interview:code-snapshot', async ({
      sessionId,
      code,
      language,
      phase,
    }: {
      sessionId: string;
      code: string;
      language: string;
      phase?: 'UNDERSTAND' | 'PLAN' | 'CODE' | 'OPTIMIZE' | 'COMPLETED';
    }) => {
      try {
        await prisma.interviewCodeSnapshot.create({
          data: {
            sessionId,
            code,
            language,
            phase: phase || 'CODE',
          },
        });
      } catch (err) {
        console.error('Failed to save code snapshot:', err);
      }
    });

    // ─────────────────────────────────────────────────────────────
    // 5. LIVE WHITEBOARD SYNC
    // ─────────────────────────────────────────────────────────────
    socket.on('interview:whiteboard-stroke', ({
      sessionId,
      stroke,
    }: {
      sessionId: string;
      stroke: any;
    }) => {
      socket.to(`session:${sessionId}`).emit('interview:whiteboard-stroke-received', { stroke });
    });

    socket.on('interview:whiteboard-clear', ({ sessionId }: { sessionId: string }) => {
      socket.to(`session:${sessionId}`).emit('interview:whiteboard-cleared');
    });

    // ─────────────────────────────────────────────────────────────
    // 6. LIVE IN-ROOM TEXT CHAT
    // ─────────────────────────────────────────────────────────────
    socket.on('interview:chat-message', ({
      sessionId,
      senderName,
      message,
      isObserverOnly = false,
    }: {
      sessionId: string;
      senderName: string;
      message: string;
      isObserverOnly?: boolean;
    }) => {
      const roomName = `session:${sessionId}`;
      const payload = {
        senderName,
        message,
        timestamp: Date.now(),
        isObserverOnly,
      };

      if (isObserverOnly) {
        // Send only to observers
        for (const [sId, p] of activeParticipants.entries()) {
          if (p.sessionId === sessionId && p.role === 'OBSERVER') {
            interviewNamespace.to(sId).emit('interview:chat-message-received', payload);
          }
        }
      } else {
        interviewNamespace.to(roomName).emit('interview:chat-message-received', payload);
      }
    });

    // ─────────────────────────────────────────────────────────────
    // 7. WEBRTC P2P AUDIO/VIDEO SIGNALING RELAY
    // ─────────────────────────────────────────────────────────────
    socket.on('interview:rtc-offer', ({
      targetSocketId,
      sdp,
    }: {
      targetSocketId: string;
      sdp: any;
    }) => {
      interviewNamespace.to(targetSocketId).emit('interview:rtc-offer-received', {
        callerSocketId: socket.id,
        sdp,
      });
    });

    socket.on('interview:rtc-answer', ({
      targetSocketId,
      sdp,
    }: {
      targetSocketId: string;
      sdp: any;
    }) => {
      interviewNamespace.to(targetSocketId).emit('interview:rtc-answer-received', {
        responderSocketId: socket.id,
        sdp,
      });
    });

    socket.on('interview:rtc-ice-candidate', ({
      targetSocketId,
      candidate,
    }: {
      targetSocketId: string;
      candidate: any;
    }) => {
      interviewNamespace.to(targetSocketId).emit('interview:rtc-ice-candidate-received', {
        senderSocketId: socket.id,
        candidate,
      });
    });

    // ─────────────────────────────────────────────────────────────
    // 8. AI HINT SCAFFOLDING FLOW
    // ─────────────────────────────────────────────────────────────
    socket.on('interview:request-hint', async ({ sessionId }: { sessionId: string }) => {
      try {
        const hintReq = await prisma.interviewHintRequest.create({
          data: {
            sessionId,
            hintLevel: 1,
            approved: false,
          },
        });
        // Notify interviewer
        interviewNamespace.to(`session:${sessionId}`).emit('interview:hint-requested-notification', {
          requestId: hintReq.id,
          sessionId,
        });
      } catch (err) {
        console.error('Failed to create hint request:', err);
      }
    });

    socket.on('interview:approve-hint', async ({
      requestId,
      sessionId,
      hintContent,
    }: {
      requestId: string;
      sessionId: string;
      hintContent: string;
    }) => {
      try {
        await prisma.interviewHintRequest.update({
          where: { id: requestId },
          data: { approved: true, hintContent },
        });
        interviewNamespace.to(`session:${sessionId}`).emit('interview:hint-approved-received', {
          hintContent,
        });
      } catch (err) {
        console.error('Failed to approve hint:', err);
      }
    });

    // ─────────────────────────────────────────────────────────────
    // DISCONNECT & CLEANUP
    // ─────────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      const p = activeParticipants.get(socket.id);
      if (p) {
        activeParticipants.delete(socket.id);
        interviewNamespace.to(`session:${p.sessionId}`).emit('interview:user-left', {
          socketId: socket.id,
          userId: p.userId,
          name: p.name,
        });
      }
    });
  });
}
