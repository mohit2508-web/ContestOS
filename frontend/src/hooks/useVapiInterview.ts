"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import Vapi from '@vapi-ai/web';

const VAPI_PUBLIC_KEY = import.meta.env.VITE_VAPI_PUBLIC_KEY;

export function useVapiInterview() {
  const [isCallActive, setIsCallActive] = useState(false);
  const [transcript, setTranscript] = useState<string[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [interviewerName, setInterviewerName] = useState('Interviewer');

  const vapiRef = useRef<Vapi | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const transcriptRef = useRef<string[]>([]);

  const startInterview = useCallback(async (assistantName?: string, interviewQuestions?: string[]) => {
    if (!VAPI_PUBLIC_KEY) {
      setError('VAPI_PUBLIC_KEY is not configured');
      return;
    }

    try {
      if (vapiRef.current) {
        vapiRef.current.stop();
      }

      const speakerSettings = {
        voice: {
          provider: '11labs' as const,
          voiceId: 'sarah',
          stability: 0.4,
          similarityBoost: 0.8,
          speed: 0.9,
          style: 0.5,
          useSpeakerBoost: true,
        },
      };

      const transcriberSettings = {
        transcriber: {
          provider: 'deepgram' as const,
          model: 'nova-2',
          language: 'en',
        },
      };

      const modelSettings = {
        model: {
          provider: 'openai' as const,
          model: 'gpt-4',
          messages: [{
            role: 'system' as const,
            content: assistantName 
              ? `You are ${assistantName}, a professional job interviewer. Interview the candidate using the following questions:\n${interviewQuestions?.join('\n') || '{{questions}}'}`
              : `You are a professional job interviewer conducting a real-time voice interview with a candidate. Your goal is to assess their qualifications, motivation, and fit for the role. Follow the structured question flow.\n{{questions}}`,
          }],
        },
      };

      const assistantConfig = {
        name: assistantName || 'Interviewer',
        firstMessage: "Hello! Thank you for taking the time to speak with me today. I'm excited to learn more about you and your experience.",
        ...speakerSettings,
        ...transcriberSettings,
        ...modelSettings,
      };

      vapiRef.current = new Vapi(VAPI_PUBLIC_KEY, assistantConfig);

      setInterviewerName(assistantName || 'Interviewer');
      setIsSpeaking(false);
      setElapsedTime(0);
      setTranscript([]);
      transcriptRef.current = [];
      setError(null);

      vapiRef.current.on('call-start', () => {
        setIsCallActive(true);
        setElapsedTime(0);
        timerRef.current = setInterval(() => {
          setElapsedTime((prev) => prev + 1);
        }, 1000);
      });

      vapiRef.current.on('call-end', () => {
        setIsCallActive(false);
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
      });

      vapiRef.current.on('message', (message: any) => {
        if (message.type === 'transcript') {
          const newTranscript = `${message.role === 'assistant' ? interviewerName : 'Candidate'}: ${message.text}`;
          setTranscript((prev) => {
            const updated = [...prev, newTranscript];
            transcriptRef.current = updated;
            return updated;
          });

          if (message.role === 'assistant') {
            setIsSpeaking(true);
            setTimeout(() => setIsSpeaking(false), 2000);
          }
        }

        if (message.type === 'speech-start') {
          setIsSpeaking(true);
        }

        if (message.type === 'speech-end') {
          setIsSpeaking(false);
        }
      });

      vapiRef.current.on('error', (error: any) => {
        setError(`Interview error: ${error.message}`);
        console.error('Vapi error:', error);
      });

      vapiRef.current.start();

      return () => {
        if (vapiRef.current) {
          vapiRef.current.stop();
        }
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start interview';
      setError(errorMessage);
      console.error('Start interview error:', err);
    }
  }, []);

  const stopInterview = useCallback(() => {
    if (vapiRef.current) {
      vapiRef.current.stop();
      setIsCallActive(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  }, []);

  const getTranscriptData = useCallback(() => {
    return {
      transcript: transcriptRef.current.join('\n\n'),
      messages: transcript,
      interviewerName,
      duration: elapsedTime,
    };
  }, [transcript, interviewerName, elapsedTime]);

  useEffect(() => {
    return () => {
      if (vapiRef.current) {
        vapiRef.current.stop();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  return {
    isCallActive,
    transcript,
    isSpeaking,
    error,
    elapsedTime,
    interviewerName,
    startInterview,
    stopInterview,
    getTranscriptData,
  };
}