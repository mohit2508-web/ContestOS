import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_BASE_URL = import.meta.env.VITE_SOCKET_URL || window.location.origin;

interface RealtimeData {
  executionResult: any;
  liveFeedback: any;
  sessionStatus: any;
  typingIndicators: { userId: string; userName: string; isTyping: boolean; timestamp: Date }[];
  progressSaved: any;
  codeChange: { code: string; language: string; userId: string; timestamp: Date } | null;
  feedbackResult: any;
  feedbackError: string | null;
}

export function useRealtimeInterview(sessionId: string | null) {
  const [connected, setConnected] = useState(false);
  const [realtimeData, setRealtimeData] = useState<RealtimeData>({
    executionResult: null,
    liveFeedback: null,
    sessionStatus: null,
    typingIndicators: [],
    progressSaved: null,
    codeChange: null,
    feedbackResult: null,
    feedbackError: null,
  });
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    const socket = io(`${SOCKET_BASE_URL}/maya-realtime`, {
      transports: ['websocket', 'polling'],
      timeout: 10000,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('join-interview-room', sessionId);
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('connect_error', (err) => {
      console.error('[useRealtimeInterview] connect error:', err.message);
    });

    socket.on('code-change', (data: any) => {
      if (data.sessionId === sessionId) {
        setRealtimeData(prev => ({ ...prev, codeChange: data }));
      }
    });

    socket.on('typing-indicator', (data: any) => {
      if (data.sessionId === sessionId) {
        setRealtimeData(prev => ({
          ...prev,
          typingIndicators: prev.typingIndicators
            .filter(t => t.userId !== data.userId)
            .concat(data.isTyping ? [data] : []),
        }));
      }
    });

    socket.on('feedback-result', (data: any) => {
      if (data.sessionId === sessionId) {
        setRealtimeData(prev => ({ ...prev, feedbackResult: data }));
      }
    });

    socket.on('feedback-error', (data: any) => {
      if (data.sessionId === sessionId) {
        setRealtimeData(prev => ({ ...prev, feedbackError: data.error }));
      }
    });

    return () => {
      socket.emit('leave-interview-room', sessionId);
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [sessionId]);

  const emitCodeChange = useCallback((code: string, language: string) => {
    if (socketRef.current?.connected && sessionId) {
      socketRef.current.emit('code-change', { sessionId, code, language });
    }
  }, [sessionId]);

  const emitTypingIndicator = useCallback((isTyping: boolean) => {
    if (socketRef.current?.connected && sessionId) {
      socketRef.current.emit('typing-indicator', { sessionId, isTyping });
    }
  }, [sessionId]);

  const requestFeedback = useCallback((code: string, language: string, questionId: string) => {
    if (socketRef.current?.connected && sessionId) {
      socketRef.current.emit('request-feedback', { sessionId, code, language, questionId });
    }
  }, [sessionId]);

  const clearRealtimeData = useCallback((type: keyof RealtimeData) => {
    setRealtimeData(prev => ({ ...prev, [type]: null }));
  }, []);

  return {
    connected,
    realtimeData,
    emitCodeChange,
    emitTypingIndicator,
    requestFeedback,
    clearRealtimeData,
  };
}
