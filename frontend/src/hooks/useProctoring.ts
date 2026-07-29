import { useEffect, useRef, useCallback, useState } from 'react';
import { api } from '../services/api';

export interface ProctoringAlert {
  type: string;
  severity: 'info' | 'warning' | 'flag';
  message: string;
  timestamp: number;
}

interface UseProctoringOptions {
  sessionId: string;
  enabled?: boolean;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  faceDetectionInterval?: number;
  heartbeatInterval?: number;
  silenceWarningMs?: number;
  silenceFlagMs?: number;
  onSilenceWarning?: () => void;
  onAutoTerminate?: () => void;
}

const COOLDOWNS: Record<string, number> = {
  window_blur: 30_000,
  fullscreen_exit: 30_000,
  devtools_open: 60_000,
  face_missing: 30_000,
  multiple_faces: 15_000,
  phone_detected: 15_000,
  virtual_camera: 60_000,
  second_monitor: 60_000,
  right_click: 5_000,
  copy_paste: 5_000,
};

const STRIKE_WEIGHTS: Record<string, number> = {
  window_blur: 1,
  fullscreen_exit: 2,
  devtools_open: 3,
  face_missing: 2,
  multiple_faces: 2,
  phone_detected: 3,
  virtual_camera: 3,
  second_monitor: 2,
  right_click: 0.5,
  copy_paste: 1,
};

const MAX_STRIKES = 20;
const STRIKE_DECAY_INTERVAL = 300_000; // 5 minutes
const STRIKE_DECAY_AMOUNT = 0.5;
const FULLSCREEN_ENFORCE_DELAY = 30_000; // 30s grace period
const DEFAULT_SILENCE_WARNING_MS = 60_000; // 60s no interaction → warning
const DEFAULT_SILENCE_FLAG_MS = 120_000; // 120s no interaction → flag

const FACE_MISS_THRESHOLD = 12;
const MULTIPLE_FACES_THRESHOLD = 2;
const BLUR_SUSTAINED_MS = 5_000;
const SHORT_BLUR_WINDOW_MS = 60_000;
const SHORT_BLUR_THRESHOLD = 3;
const PHONE_DETECT_INTERVAL_MS = 5_000;
const PHONE_DIFF_THRESHOLD = 0.35;

export function useProctoring({
  sessionId,
  enabled = true,
  videoRef,
  faceDetectionInterval = 1500,
  heartbeatInterval = 30000,
  silenceWarningMs = DEFAULT_SILENCE_WARNING_MS,
  silenceFlagMs = DEFAULT_SILENCE_FLAG_MS,
  onSilenceWarning,
  onAutoTerminate,
}: UseProctoringOptions) {
  const [violations, setViolations] = useState<ProctoringAlert[]>([]);
  const [violationCount, setViolationCount] = useState(0);
  const [latestAlert, setLatestAlert] = useState<ProctoringAlert | null>(null);
  const [strikeScore, setStrikeScore] = useState(0);
  const [isTerminated, setIsTerminated] = useState(false);

  const faceDetectorRef = useRef<any>(null);
  const nativeDetectorRef = useRef<any>(null);
  const detectionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const strikeDecayTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fullscreenGraceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lastCooldownRef = useRef<Record<string, number>>({});
  const faceMissCountRef = useRef(0);
  const multipleFacesCountRef = useRef(0);
  const shortBlurTimestampsRef = useRef<number[]>([]);
  const blurStartRef = useRef<number | null>(null);
  const sustainedBlurSentRef = useRef(false);
  const strikeScoreRef = useRef(0);
  const onAutoTerminateRef = useRef(onAutoTerminate);
  onAutoTerminateRef.current = onAutoTerminate;
  const onSilenceWarningRef = useRef(onSilenceWarning);
  onSilenceWarningRef.current = onSilenceWarning;

  const videoRefValue = useRef(videoRef?.current);
  videoRefValue.current = videoRef?.current;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const prevFrameRef = useRef<ImageData | null>(null);
  const phoneAlertCooldownRef = useRef(0);
  const lastInteractionRef = useRef(Date.now());
  const silenceWarningSentRef = useRef(false);
  const silenceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const sendViolation = useCallback(async (type: string, severity: 'info' | 'warning' | 'flag', message: string) => {
    const now = Date.now();
    const cooldown = COOLDOWNS[type] || 5000;
    if (now - (lastCooldownRef.current[type] || 0) < cooldown) return;
    lastCooldownRef.current[type] = now;

    const weight = STRIKE_WEIGHTS[type] || 1;
    const newStrikeScore = strikeScoreRef.current + weight;
    strikeScoreRef.current = newStrikeScore;
    setStrikeScore(newStrikeScore);

    const alert: ProctoringAlert = { type, severity, message, timestamp: now };
    setViolations(prev => [...prev, alert]);
    setViolationCount(prev => prev + 1);
    setLatestAlert(alert);

    // Capture screenshot on flag-level violations
    let photoData: string | undefined;
    if (severity === 'flag' && videoRefValue.current) {
      try {
        const video = videoRefValue.current;
        if (video.videoWidth > 0 && video.videoHeight > 0) {
          if (!canvasRef.current) canvasRef.current = document.createElement('canvas');
          const canvas = canvasRef.current;
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0);
            photoData = canvas.toDataURL('image/jpeg', 0.5).split(',')[1];
          }
        }
      } catch {}
    }

    try {
      await api.sendViolation(sessionId, type, photoData);
    } catch {
      // silently fail — proctoring should never block the interview
    }

    if (newStrikeScore >= MAX_STRIKES) {
      setIsTerminated(true);
      onAutoTerminateRef.current?.();
    }
  }, [sessionId]);

  const initMediaPipe = useCallback(async () => {
    try {
      const { FilesetResolver, FaceDetector } = await import('@mediapipe/tasks-vision');
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm'
      );
      let runningMode: 'VIDEO' | 'IMAGE' = 'VIDEO';
      const detector = await FaceDetector.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
          delegate: 'GPU',
        },
        runningMode,
      });
      faceDetectorRef.current = detector;
    } catch {
      // GPU mode failed, try CPU
      try {
        const { FilesetResolver, FaceDetector } = await import('@mediapipe/tasks-vision');
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm'
        );
        const detector = await FaceDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
            delegate: 'CPU',
          },
          runningMode: 'VIDEO',
        });
        faceDetectorRef.current = detector;
      } catch {
        faceDetectorRef.current = null;
      }
    }
  }, []);

  const initNativeDetector = useCallback(async () => {
    try {
      const FaceDetector = (window as any).FaceDetector;
      if (FaceDetector) {
        nativeDetectorRef.current = new FaceDetector({ maxDetectedFaces: 3 });
      }
    } catch {
      nativeDetectorRef.current = null;
    }
  }, []);

  const detectFace = useCallback(async () => {
    const video = videoRefValue.current;
    if (!video || !video.videoWidth) return;

    let faces: any[] = [];

    if (faceDetectorRef.current) {
      try {
        const result = faceDetectorRef.current.detectForVideo(video, performance.now());
        faces = result.detections || [];
      } catch {
        // fall through to native
      }
    }

    if (faces.length === 0 && nativeDetectorRef.current) {
      try {
        const result = await nativeDetectorRef.current.detect(video);
        faces = result || [];
      } catch {
        // no detection available
      }
    }

    if (faces.length === 0) {
      faceMissCountRef.current++;
      multipleFacesCountRef.current = 0;
      if (faceMissCountRef.current >= FACE_MISS_THRESHOLD) {
        sendViolation('face_missing', 'flag', 'No face detected for extended period');
        faceMissCountRef.current = 0;
      }
    } else {
      faceMissCountRef.current = 0;
      if (faces.length > 1) {
        multipleFacesCountRef.current++;
        if (multipleFacesCountRef.current >= MULTIPLE_FACES_THRESHOLD) {
          sendViolation('multiple_faces', 'flag', 'Multiple faces detected');
          multipleFacesCountRef.current = 0;
        }
      } else {
        multipleFacesCountRef.current = 0;
      }
    }
  }, [sendViolation]);

  const detectPhone = useCallback(() => {
    const video = videoRefValue.current;
    if (!video || !video.videoWidth) return;

    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
    }
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const currentData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    if (prevFrameRef.current) {
      const prev = prevFrameRef.current.data;
      const curr = currentData.data;
      const total = prev.length;
      let diff = 0;

      for (let i = 0; i < total; i += 16) {
        const dr = Math.abs(prev[i] - curr[i]);
        const dg = Math.abs(prev[i + 1] - curr[i + 1]);
        const db = Math.abs(prev[i + 2] - curr[i + 2]);
        if (dr > 40 || dg > 40 || db > 40) diff++;
      }

      const diffRatio = diff / (total / 16);
      const now = Date.now();
      if (diffRatio > PHONE_DIFF_THRESHOLD && now - phoneAlertCooldownRef.current > 15000) {
        phoneAlertCooldownRef.current = now;
        sendViolation('phone_detected', 'warning', 'Sudden large movement detected — possible phone usage');
      }
    }

    prevFrameRef.current = currentData;
  }, [sendViolation]);

  useEffect(() => {
    if (!enabled || !sessionId) return;

    if (videoRef?.current) {
      initMediaPipe();
      initNativeDetector();

      // ── Virtual camera detection ──
      navigator.mediaDevices?.enumerateDevices?.().then(devices => {
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        const virtualPatterns = /obs|virtual|droidcam|manycam|snap camera|rylabs|zoom|teams|meet|discord|logi|camtasia|screen.?rec|xsplit|_wire/i;
        const suspicious = videoDevices.filter(d => d.label && virtualPatterns.test(d.label));
        if (suspicious.length > 0) {
          sendViolation('virtual_camera', 'flag',
            `Virtual camera detected: ${suspicious.map(d => d.label).join(', ')}. Only physical webcams are allowed.`);
        }
      }).catch(() => {});
    }

    const handleBlur = () => {
      blurStartRef.current = Date.now();
    };

    const handleFocus = () => {
      if (blurStartRef.current !== null) {
        const duration = Date.now() - blurStartRef.current;
        if (duration >= BLUR_SUSTAINED_MS) {
          sustainedBlurSentRef.current = true;
          sendViolation('window_blur', 'flag', `Window was out of focus for ${Math.round(duration / 1000)}s`);
        } else {
          shortBlurTimestampsRef.current.push(Date.now());
          const cutoff = Date.now() - SHORT_BLUR_WINDOW_MS;
          shortBlurTimestampsRef.current = shortBlurTimestampsRef.current.filter(t => t > cutoff);
          if (shortBlurTimestampsRef.current.length >= SHORT_BLUR_THRESHOLD) {
            sendViolation('window_blur', 'flag', 'Repeated short window switches detected');
            shortBlurTimestampsRef.current = [];
          }
        }
        blurStartRef.current = null;
        sustainedBlurSentRef.current = false;
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        blurStartRef.current = Date.now();
      } else {
        handleFocus();
      }
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        sendViolation('fullscreen_exit', 'flag', 'Exited fullscreen mode');
      }
    };

    const handleDevToolsCheck = () => {
      const threshold = 160;
      if (window.outerWidth - window.innerWidth > threshold || window.outerHeight - window.innerHeight > threshold) {
        sendViolation('devtools_open', 'flag', 'Developer tools window detected');
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && ['I', 'J', 'C'].includes(e.key.toUpperCase()))
      ) {
        e.preventDefault();
        sendViolation('devtools_open', 'warning', 'Developer tools shortcut blocked');
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    window.addEventListener('resize', handleDevToolsCheck);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('contextmenu', handleContextMenu);

    // ── Second monitor detection ──
    const checkSecondMonitor = () => {
      try {
        // If available screens > 1, a second monitor is connected
        const screenCount = (window.screen as any).availWidth !== undefined
          ? Math.round((window.screen as any).availWidth / window.screen.width)
          : 1;
        // More reliable: check if window was placed outside primary screen bounds
        if (window.screenLeft > window.screen.width || window.screenLeft < -window.screen.width) {
          sendViolation('second_monitor', 'warning', 'Window appears to be on a secondary display');
        }
      } catch {}
    };
    const secondMonitorInterval = setInterval(checkSecondMonitor, 30_000);
    checkSecondMonitor(); // initial check

    // Silence / inactivity detection
    const resetSilenceTimer = () => {
      lastInteractionRef.current = Date.now();
      silenceWarningSentRef.current = false;
    };
    const handleInteraction = () => resetSilenceTimer();
    window.addEventListener('mousemove', handleInteraction);
    window.addEventListener('keydown', handleInteraction);
    window.addEventListener('click', handleInteraction);
    window.addEventListener('scroll', handleInteraction);
    window.addEventListener('input', handleInteraction);

    silenceTimerRef.current = setInterval(() => {
      const idle = Date.now() - lastInteractionRef.current;
      if (idle >= silenceFlagMs) {
        if (!silenceWarningSentRef.current) {
          sendViolation('inactivity', 'flag', `No interaction for ${Math.round(idle / 1000)}s — interview may be abandoned`);
          silenceWarningSentRef.current = true;
        }
      } else if (idle >= silenceWarningMs) {
        if (!silenceWarningSentRef.current) {
          silenceWarningSentRef.current = true;
          onSilenceWarningRef.current?.();
          sendViolation('inactivity', 'warning', `No interaction for ${Math.round(idle / 1000)}s — please respond`);
        }
      }
    }, 5_000);

    if (videoRef?.current) {
      detectionTimerRef.current = setInterval(() => {
        detectFace();
        detectPhone();
      }, faceDetectionInterval);
    }

    heartbeatTimerRef.current = setInterval(() => {
      api.sendHeartbeat(sessionId).catch(() => {});
    }, heartbeatInterval);

    strikeDecayTimerRef.current = setInterval(() => {
      if (strikeScoreRef.current > 0) {
        const decayed = Math.max(0, strikeScoreRef.current - STRIKE_DECAY_AMOUNT);
        strikeScoreRef.current = decayed;
        setStrikeScore(decayed);
      }
    }, STRIKE_DECAY_INTERVAL);

    fullscreenGraceTimerRef.current = setTimeout(() => {
      if (!document.fullscreenElement) {
        const el = document.documentElement;
        if (el.requestFullscreen) {
          el.requestFullscreen().catch(() => {
            sendViolation('fullscreen_exit', 'flag', 'Could not enter fullscreen mode');
          });
        }
      }
    }, FULLSCREEN_ENFORCE_DELAY);

    return () => {
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('resize', handleDevToolsCheck);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('mousemove', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('scroll', handleInteraction);
      window.removeEventListener('input', handleInteraction);

      if (detectionTimerRef.current) clearInterval(detectionTimerRef.current);
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
      if (strikeDecayTimerRef.current) clearInterval(strikeDecayTimerRef.current);
      if (fullscreenGraceTimerRef.current) clearTimeout(fullscreenGraceTimerRef.current);
      if (silenceTimerRef.current) clearInterval(silenceTimerRef.current);
      clearInterval(secondMonitorInterval);

      faceDetectorRef.current?.close();
      faceDetectorRef.current = null;
      nativeDetectorRef.current = null;
    };
  }, [enabled, sessionId, videoRef, initMediaPipe, initNativeDetector, detectFace, sendViolation, faceDetectionInterval, heartbeatInterval]);

  const reset = useCallback(() => {
    setViolations([]);
    setViolationCount(0);
    setLatestAlert(null);
    setStrikeScore(0);
    setIsTerminated(false);
    strikeScoreRef.current = 0;
    faceMissCountRef.current = 0;
    multipleFacesCountRef.current = 0;
    shortBlurTimestampsRef.current = [];
    blurStartRef.current = null;
    sustainedBlurSentRef.current = false;
    lastCooldownRef.current = {};
  }, []);

  const captureSnapshot = useCallback((): string | null => {
    const video = videoRefValue.current;
    if (!video || !video.videoWidth) return null;
    const c = document.createElement('canvas');
    c.width = video.videoWidth;
    c.height = video.videoHeight;
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0);
    return c.toDataURL('image/jpeg', 0.6);
  }, []);

  return { violations, violationCount, latestAlert, strikeScore, isTerminated, reset, captureSnapshot };
}
