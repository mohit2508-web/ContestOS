import { useRef, useCallback, useState } from 'react';

interface UseSpeechRecognitionOptions {
  onTranscription?: (text: string) => void;
  onError?: (error: string) => void;
}

export function useSpeechRecognition({ onTranscription, onError }: UseSpeechRecognitionOptions = {}) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startListening = useCallback(async (token: string) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3000';
      const wsUrl = API_URL.replace('http', 'ws') + '/ws/transcribe';
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        // Send auth token as the first message instead of a URL query parameter
        // to avoid token leaking via server logs, browser history, and referrer headers.
        ws.send(JSON.stringify({ type: 'auth', token }));

        setIsListening(true);
        setTranscript('');

        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
            ? 'audio/webm;codecs=opus'
            : 'audio/webm',
        });
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
            e.data.arrayBuffer().then(buffer => {
              const base64 = btoa(
                new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
              );
              ws.send(JSON.stringify({ type: 'audio_chunk', chunk: base64 }));
            });
          }
        };

        mediaRecorder.start(1000); // Send chunks every 1 second
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'transcription') {
            setTranscript(msg.transcription);
            onTranscription?.(msg.transcription);
          } else if (msg.type === 'error') {
            onError?.(msg.error);
          }
        } catch {}
      };

      ws.onerror = () => {
        onError?.('WebSocket connection failed');
        setIsListening(false);
      };

      ws.onclose = () => {
        setIsListening(false);
      };
    } catch (err) {
      onError?.((err as Error).message || 'Microphone access denied');
    }
  }, [onTranscription, onError]);

  const stopListening = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'end', mimeType: 'audio/webm' }));
    }
    streamRef.current?.getTracks().forEach(t => t.stop());
    setIsListening(false);
  }, []);

  const cancelListening = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'cancel' }));
    }
    streamRef.current?.getTracks().forEach(t => t.stop());
    setIsListening(false);
    setTranscript('');
  }, []);

  return { isListening, transcript, startListening, stopListening, cancelListening };
}
