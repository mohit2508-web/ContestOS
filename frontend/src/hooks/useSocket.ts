import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { api } from '../services/api';
import type { ChatMessage, InterviewChatMessage } from '../types';

const CHAT_SERVICE_URL = import.meta.env.VITE_CHAT_SERVICE_URL || 'http://localhost:3001';

interface UseSocketOptions {
  autoConnect?: boolean;
}

interface UseSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  joinRoom: (roomId: string) => void;
  leaveRoom: (roomId: string) => void;
  sendMessage: (roomId: string, text: string) => void;
  sendTyping: (roomId: string, isTyping: boolean) => void;
  onNewMessage: (handler: (msg: ChatMessage) => void) => () => void;
  onUserTyping: (handler: (data: { roomId: string; userId: string; email: string; isTyping: boolean }) => void) => () => void;
  onUserJoined: (handler: (data: { roomId: string; userId: string; email: string }) => void) => () => void;
  onUserLeft: (handler: (data: { roomId: string; userId: string; email: string }) => void) => () => void;
  joinSession: (sessionId: string) => void;
  leaveSession: (sessionId: string) => void;
  sendInterviewMessage: (sessionId: string, text: string) => void;
  onInterviewMessage: (handler: (msg: InterviewChatMessage) => void) => () => void;
  connect: () => void;
  disconnect: () => void;
}

export function useSocket(options: UseSocketOptions = {}): UseSocketReturn {
  const { autoConnect = true } = options;
  const socketRef = useRef<Socket | null>(null);
  const isConnectedRef = useRef(false);
  const handlersRef = useRef<Map<string, Set<(...args: any[]) => void>>>(new Map());

  const getToken = useCallback(async (): Promise<string | null> => {
    try {
      const token = await api.getToken();
      return token || null;
    } catch {
      return null;
    }
  }, []);

  const connect = useCallback(async () => {
    if (socketRef.current?.connected) return;
    const token = await getToken();
    if (!token) return;
    const socket = io(CHAT_SERVICE_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
    socket.on('connect', () => {
      isConnectedRef.current = true;
    });
    socket.on('disconnect', () => { isConnectedRef.current = false; });
    socket.on('connect_error', (err) => { console.error('[Socket] connect error:', err.message); });
    socket.io.on('reconnect_attempt', async () => {
      const newToken = await getToken();
      if (newToken) {
        socket.auth = { token: newToken };
      }
    });
    socketRef.current = socket;
  }, [getToken]);

  const disconnect = useCallback(() => {
    socketRef.current?.removeAllListeners();
    socketRef.current?.disconnect();
    socketRef.current = null;
    isConnectedRef.current = false;
  }, []);

  const emit = useCallback((event: string, ...args: any[]) => {
    socketRef.current?.emit(event, ...args);
  }, []);

  const joinRoom = useCallback((roomId: string) => emit('chat:join-room', roomId), [emit]);
  const leaveRoom = useCallback((roomId: string) => emit('chat:leave-room', roomId), [emit]);
  const sendMessage = useCallback((roomId: string, text: string) => emit('chat:send-message', { roomId, text }), [emit]);
  const sendTyping = useCallback((roomId: string, isTyping: boolean) => emit('chat:typing', { roomId, isTyping }), [emit]);
  const joinSession = useCallback((sessionId: string) => emit('chat:join-session', sessionId), [emit]);
  const leaveSession = useCallback((sessionId: string) => emit('chat:leave-session', sessionId), [emit]);
  const sendInterviewMessage = useCallback((sessionId: string, text: string) => emit('chat:send-interview-message', { sessionId, text }), [emit]);

  const on = useCallback((event: string, handler: (...args: any[]) => void): (() => void) => {
    if (!handlersRef.current.has(event)) {
      handlersRef.current.set(event, new Set());
    }
    handlersRef.current.get(event)!.add(handler);
    socketRef.current?.on(event, handler);
    return () => {
      handlersRef.current.get(event)?.delete(handler);
      socketRef.current?.off(event, handler);
    };
  }, []);

  const onNewMessage = useCallback((handler: (msg: ChatMessage) => void) => on('chat:new-message', handler), [on]);
  const onUserTyping = useCallback((handler: (data: any) => void) => on('chat:user-typing', handler), [on]);
  const onUserJoined = useCallback((handler: (data: any) => void) => on('chat:user-joined', handler), [on]);
  const onUserLeft = useCallback((handler: (data: any) => void) => on('chat:user-left', handler), [on]);
  const onInterviewMessage = useCallback((handler: (msg: InterviewChatMessage) => void) => on('chat:interview-message', handler), [on]);

  useEffect(() => {
    if (autoConnect) connect();
    return () => {
      disconnect();
      handlersRef.current.clear();
    };
  }, [autoConnect, connect, disconnect]);

  return {
    socket: socketRef.current,
    isConnected: isConnectedRef.current,
    joinRoom, leaveRoom, sendMessage, sendTyping,
    onNewMessage, onUserTyping, onUserJoined, onUserLeft,
    joinSession, leaveSession, sendInterviewMessage, onInterviewMessage,
    connect, disconnect,
  };
}
