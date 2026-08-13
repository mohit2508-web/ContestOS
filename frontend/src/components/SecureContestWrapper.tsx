import { useEffect, useState, useRef, type ReactNode } from 'react';
import { api } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { WarningModal } from './exam/WarningModal';
import { PostAutoSubmitScreen } from './exam/PostAutoSubmitScreen';
import { ProctorBlockScreen } from './exam/ProctorBlockScreen';
import { useProctorSocket } from '../hooks/useProctorSocket';
import { useNotify } from './notifications';

interface SecurityFlags {
  requireFullscreen: boolean;
  preventTabSwitch: boolean;
  disableCopyPaste: boolean;
  enableProctoring: boolean;
  allowMultipleMonitors: boolean;
  pasteMode: 'ALLOWED' | 'LOG_ONLY' | 'BLOCKED';
  faceCheckEnabled: boolean;
  voiceCheckEnabled: boolean;
  snapshotIntervalSeconds: number;
  maxWarnings: number;
  requireSeb?: boolean;
}

interface Props {
  contestId: string;
  flags: SecurityFlags;
  children: ReactNode;
}

export function SecureContestWrapper({ contestId, flags, children }: Props) {
  const navigate = useNavigate();
  const notify = useNotify();
  const { user } = useAuth();
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);
  const [isTerminated, setIsTerminated] = useState(false);
  const [activeViolations, setActiveViolations] = useState<string[]>([]);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isSessionReplaced, setIsSessionReplaced] = useState(false);
  const [_warnings, setWarnings] = useState(0);
  const [participantId, setParticipantId] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [proctoringStream, setProctoringStream] = useState<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chunkIndexRef = useRef(0);
  const sessionIdRef = useRef(self.crypto.randomUUID());

  // Keyboard Lock API States & Refs
  const [keyboardLockActive, setKeyboardLockActive] = useState(false);
  const lastShortcutLogTime = useRef(0);

  // ── Proctor Socket: Block/Unblock/Warn/Terminate & Live Video Streaming ──
  const {
    isBlocked: proctorBlocked,
    blockReason: proctorBlockReason,
    proctorName: proctorBlockerName,
    isTerminated: proctorTerminated,
    terminationReason: proctorTerminationReason,
    warnMessage: proctorWarnMessage,
    sendWebcamFrame,
    sendScreenFrame,
  } = useProctorSocket({
    userId: user?.id || '',
    contestId,
    enabled: !!(user?.id && contestId),
    onAction: (action) => {
      if (action.action === 'TERMINATED') {
        setIsTerminated(true);
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(console.error);
        }
      }
      if (action.action === 'WARNED' && action.message) {
        if (action.warnings !== undefined) {
          setWarnings(action.warnings);
        } else {
          setWarnings((prev) => prev + 1);
        }
        setWarningReason(action.message);
        setShowWarningModal(true);
      }
    },
  });

  // Stream live webcam frames (4 FPS adaptive) & live screen frames (2 FPS) to invigilator live grid
  // FIX #1: RAF-driven adaptive quality loop — 4fps, smaller canvas, drops quality under load
  useEffect(() => {
    if (!flags.enableProctoring || !user?.id || !contestId) return;

    const isSEB = navigator.userAgent.includes('SEB') || navigator.userAgent.includes('SafeExamBrowser');

    // Webcam canvas: 160x120 (small = fast = smooth)
    const camCanvas = document.createElement('canvas');
    camCanvas.width = 160;
    camCanvas.height = 120;
    const camCtx = camCanvas.getContext('2d');

    // Screen canvas: 480x270
    const screenCanvas = document.createElement('canvas');
    screenCanvas.width = 480;
    screenCanvas.height = 270;
    const screenCtx = screenCanvas.getContext('2d');

    let lastCamSend = 0;
    let lastScreenSend = 0;
    let rafId: number;
    const CAM_INTERVAL = 250;    // 4fps
    const SCREEN_INTERVAL = 500; // 2fps

    const loop = (now: number) => {
      // Webcam frame at 4fps
      if (now - lastCamSend > CAM_INTERVAL) {
        const v = videoRef.current || sysVideoRef.current;
        if (v && v.readyState >= 2 && camCtx) {
          try {
            const t0 = performance.now();
            camCtx.drawImage(v, 0, 0, 160, 120);
            const elapsed = performance.now() - t0;
            // Adaptive quality: drop to 0.15 if encode took > 30ms
            const quality = elapsed > 30 ? 0.15 : 0.22;
            const frameBase64 = camCanvas.toDataURL('image/jpeg', quality);
            sendWebcamFrame(frameBase64);
            lastCamSend = now;
          } catch {}
        }
      }

      // Screen frame at 2fps — FIX #2: SEB-safe screen capture & continuous frame delivery
      if (now - lastScreenSend > SCREEN_INTERVAL) {
        let srcCanvas: HTMLCanvasElement | null = canvasRef.current;
        if (screenCtx) {
          try {
            if (srcCanvas) {
              screenCtx.drawImage(srcCanvas, 0, 0, 480, 270);
            } else if (isSEB && screenStreamRef.current) {
              const sv = document.querySelector('video[data-seb-screen]') as HTMLVideoElement;
              if (sv && sv.videoWidth > 0) screenCtx.drawImage(sv, 0, 0, 480, 270);
            }
            const frameBase64 = screenCanvas.toDataURL('image/jpeg', 0.25);
            // Send frame if valid base64 data generated
            if (frameBase64 && frameBase64.length > 100) {
              sendScreenFrame(frameBase64);
            }
            lastScreenSend = now;
          } catch {}
        }
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [flags.enableProctoring, user?.id, contestId, sendWebcamFrame, sendScreenFrame]);

  // Gesture & Warning Consequence States & Refs
  const lastVisibilityHiddenTime = useRef<number | null>(null);
  const lastFullscreenExitTime = useRef<number | null>(null);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [warningReason, setWarningReason] = useState("");
  const [showAutoSubmitScreen, setShowAutoSubmitScreen] = useState(false);
  const [contestTitle, setContestTitle] = useState("");

  // Registration & System Check States
  const [hasRegistered, setHasRegistered] = useState(false);
  const [showSystemCheck, setShowSystemCheck] = useState(false);
  const [micVolume, setMicVolume] = useState(0);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [tempRollNo, setTempRollNo] = useState('');
  const [registering, setRegistering] = useState(false);
  const [sysCamStream, setSysCamStream] = useState<MediaStream | null>(null);
  const sysVideoRef = useRef<HTMLVideoElement>(null);

  // Load participant ID and check status
  useEffect(() => {
    let active = true;
    const checkTermination = async () => {
      try {
        const res = await api.getManagerContest(contestId);
        if (active && res.participant) {
          setContestTitle(res.contest?.title || res.title || "Contest Exam");
          setWarnings(res.participant.warnings || 0);
          setParticipantId(res.participant.id || res.participant.participantId);
          if (res.participant.activeSessionToken) {
            sessionStorage.setItem(`activeSessionToken_${contestId}`, res.participant.activeSessionToken);
          }
          if (res.participant.isTerminated) {
            setIsTerminated(true);
          }
          // Only mark completed if the participant actually has a submission or
          // explicitly submitted (not just on first visit before any work)
          if (res.participant.status === "COMPLETED" && res.participant.submittedAt) {
            setIsCompleted(true);
          }

          // Check if already registered via DB photo or session storage
          const isSEB = navigator.userAgent.includes('SEB') || navigator.userAgent.includes('SafeExamBrowser');
          const requiresSeb = res.contest?.requireSeb;

          if (requiresSeb && !isSEB) {
            // Normal browser: DO NOT open camera or system check modal
            setHasRegistered(true);
          } else if (res.participant.registrationPhoto) {
            setHasRegistered(true);
            sessionStorage.setItem(`regPhoto_${contestId}`, res.participant.registrationPhoto);
          } else {
            const localPhoto = sessionStorage.getItem(`regPhoto_${contestId}`);
            if (localPhoto) {
              setHasRegistered(true);
            } else {
              // Only show system check inside SEB or for non-SEB proctored exams
              if (res.contest?.enableProctoring !== false) {
                setShowSystemCheck(true);
              } else {
                setHasRegistered(true);
              }
            }
          }
        }
      } catch (err) {
        console.error("Failed to check contest participant status:", err);
      }
    };
    checkTermination();
    return () => {
      active = false;
    };
  }, [contestId]);

  // System check webcam & mic monitoring
  useEffect(() => {
    if (!showSystemCheck) return;

    let sysStream: MediaStream | null = null;
    let audioContext: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let animationFrameId: number;

    const setupSystemCheckMedia = async () => {
      try {
        sysStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setSysCamStream(sysStream);

        if (sysVideoRef.current) {
          sysVideoRef.current.srcObject = sysStream;
        }

        // Setup microphone level indicator
        const AudioCtx = window.AudioContext || (window as Window & typeof globalThis & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioContext = new AudioCtx();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        source = audioContext.createMediaStreamSource(sysStream);
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const updateVolume = () => {
          if (!analyser) return;
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          setMicVolume(Math.min(100, Math.round((avg / 128) * 100)));
          animationFrameId = requestAnimationFrame(updateVolume);
        };
        updateVolume();
      } catch (err) {
        console.error("Failed to acquire camera/mic for system check:", err);
      }
    };

    setupSystemCheckMedia();

    // Auto-capture baseline verification photo 1.5s after camera stream activates
    const autoCapTimer = setTimeout(() => {
      if (sysVideoRef.current && sysVideoRef.current.readyState >= 2) {
        capturePhoto();
      }
    }, 1500);

    return () => {
      clearTimeout(autoCapTimer);
      if (sysStream) {
        sysStream.getTracks().forEach(track => track.stop());
      }
      if (source) source.disconnect();
      if (audioContext) audioContext.close().catch(console.error);
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [showSystemCheck]);

  const capturePhoto = () => {
    if (!sysVideoRef.current) return;
    try {
      const video = sysVideoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setCapturedPhoto(dataUrl);
      }
    } catch (err) {
      console.error("Failed to capture photo:", err);
    }
  };

  const handleRegisterAndStart = async () => {
    // If photo hasn't been captured yet, trigger an immediate capture
    let photoToUpload = capturedPhoto;
    if (!photoToUpload && sysVideoRef.current) {
      capturePhoto();
      photoToUpload = capturedPhoto;
    }

    const finalRollNo = (user as any)?.enrollmentNumber || tempRollNo || user?.email?.split('@')[0] || 'ROLL-2026';

    setRegistering(true);
    try {
      if (participantId && photoToUpload) {
        const uploadRes = await api.uploadRegistrationPhoto(contestId, participantId, photoToUpload).catch(() => ({ registrationPhoto: photoToUpload }));
        const storagePath = uploadRes.registrationPhoto || photoToUpload;
        sessionStorage.setItem(`regPhoto_${contestId}`, storagePath);
      } else {
        sessionStorage.setItem(`regPhoto_${contestId}`, 'verified');
      }

      setHasRegistered(true);
      setShowSystemCheck(false);
      notify.toast.success("✅ System Check & Registration verified! Entering assessment...");
    } catch (err) {
      console.error("Failed to complete system check registration:", err);
      // Fail-soft: advance user into exam so they are never blocked from taking test
      sessionStorage.setItem(`regPhoto_${contestId}`, 'verified');
      setHasRegistered(true);
      setShowSystemCheck(false);
    } finally {
      setRegistering(false);
    }
  };

  // Global Session Replacement Checker (intercepts 409 SESSION_CONFLICT errors)
  useEffect(() => {
    const interceptor = api.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 409 && error.response?.data?.error === 'SESSION_CONFLICT') {
          setIsSessionReplaced(true);
        }
        return Promise.reject(error);
      }
    );
    return () => {
      api.client.interceptors.response.eject(interceptor);
    };
  }, []);

  const requestFullscreen = async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch (err) {
      console.error('Error attempting to enable fullscreen:', err);
      notify.toast.warning('Please enable fullscreen to continue the exam.');
    }
    // Block clipboard API (triggers browser permission prompt via user gesture)
    await blockClipboardApi();
  };

  const startProctoring = async () => {
    try {
      // 1. Get webcam video and audio
      const webcamStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = webcamStream;
      setProctoringStream(webcamStream);
      if (videoRef.current) {
        videoRef.current.srcObject = webcamStream;
      }

      // 2. Get screen share stream — FIX #2: SEB-aware screen capture
      const isSEB = navigator.userAgent.includes('SEB') || navigator.userAgent.includes('SafeExamBrowser');
      let screenStream: MediaStream | null = null;
      try {
        if (!isSEB) {
          screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
          screenStreamRef.current = screenStream;
        } else {
          // In SEB, getDisplayMedia is blocked. Use captureStream from the document body
          // SEB renders the page — we can capture the exam canvas or a body stream
          console.info('[SEB] getDisplayMedia blocked — using SEB native page captureStream');
          // Try to get a stream from the canvas/body element
          try {
            const bodyCanvas = document.createElement('canvas');
            bodyCanvas.width = 1280;
            bodyCanvas.height = 720;
            // We'll draw the existing canvasRef (which draws screen + webcam PiP) in the loop
            // For now capture the composited canvas stream
            screenStream = bodyCanvas.captureStream(2);
            screenStreamRef.current = screenStream;
          } catch (sebErr) {
            console.warn('[SEB] captureStream not available:', sebErr);
          }
        }
      } catch (screenErr) {
        if (!isSEB) {
          console.error("Screen share prompt was denied:", screenErr);
          await notify.alert("Screen Share Required", {
            description: "Screen sharing is mandatory to participate in this contest.",
            variant: "danger"
          });
          webcamStream.getTracks().forEach(t => t.stop());
          setProctoringStream(null);
          navigate("/contests");
          return;
        }
      }

      // Trigger violation if student stops screen share (only if non-SEB stream)
      if (screenStream && screenStream.getVideoTracks().length > 0) {
        screenStream.getVideoTracks()[0].onended = () => {
          logViolation("SCREEN_SHARE_STOPPED", "Student stopped screen sharing.");
        };
      }

      // 3. Create canvas for PiP combining
      const canvas = document.createElement("canvas");
      canvas.width = 640;
      canvas.height = 480;
      canvasRef.current = canvas;
      const ctx = canvas.getContext("2d");

      const webcamVideoEl = document.createElement("video");
      webcamVideoEl.setAttribute("playsinline", "true");
      webcamVideoEl.srcObject = webcamStream;
      webcamVideoEl.muted = true;
      webcamVideoEl.play().catch(console.error);

      const screenVideoEl = document.createElement("video");
      screenVideoEl.setAttribute("playsinline", "true");
      if (screenStream) {
        screenVideoEl.srcObject = screenStream;
        screenVideoEl.muted = true;
        screenVideoEl.onloadedmetadata = () => {
          screenVideoEl.play().catch(console.error);
        };
        screenVideoEl.play().catch(console.error);
      }

      const drawFrame = () => {
        if (!ctx) return;
        if (!webcamStream.active || (screenStream && !screenStream.active)) return;

        // Clear canvas
        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw screen capture as background (if stream present and ready)
        if (screenStream && screenVideoEl.readyState >= 2 && screenVideoEl.videoWidth > 0) {
          ctx.drawImage(screenVideoEl, 0, 0, canvas.width, canvas.height);
        }

        // Draw webcam picture-in-picture in the bottom-right corner
        if (webcamVideoEl.readyState >= 2 && webcamVideoEl.videoWidth > 0) {
          const pipWidth = 160;
          const pipHeight = 120;
          const pipX = canvas.width - pipWidth - 10;
          const pipY = canvas.height - pipHeight - 10;
          ctx.drawImage(webcamVideoEl, pipX, pipY, pipWidth, pipHeight);
        }

        requestAnimationFrame(drawFrame);
      };

      drawFrame();

      // 4. Capture canvas as a stream and combine with webcam audio track
      const canvasStream = canvas.captureStream(10); // 10 fps is lightweight
      const combinedStream = new MediaStream();
      canvasStream.getVideoTracks().forEach(track => combinedStream.addTrack(track));
      webcamStream.getAudioTracks().forEach(track => combinedStream.addTrack(track));

      let mimeType = "video/webm;codecs=vp8,opus";
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = "video/webm";
      }

      const recorder = new MediaRecorder(combinedStream, { mimeType });
      recorderRef.current = recorder;

      recorder.ondataavailable = async (e) => {
        if (e.data && e.data.size > 0) {
          const reader = new FileReader();
          reader.onloadend = async () => {
            if (typeof reader.result !== "string") return;
            const base64Data = reader.result.split(",")[1];
            try {
              await api.client.post(`/contests/manager/${contestId}/participants/recording-chunk`, {
                sessionId: sessionIdRef.current,
                index: chunkIndexRef.current++,
                chunk: base64Data
              });
            } catch (err) {
              console.error("Failed to upload recording chunk:", err);
            }
          };
          reader.readAsDataURL(e.data);
        }
      };

      recorder.start();

      // Request data slices every 10 seconds
      recordingIntervalRef.current = setInterval(() => {
        if (recorder.state === "recording") {
          recorder.requestData();
        }
      }, 10000);

    } catch (err) {
      console.error("Proctoring access denied (camera/mic):", err);
      await notify.alert("Proctoring Access Required", {
        description: "Camera and microphone access are required for this proctored exam.",
        variant: "danger"
      });
      navigate("/contests");
    }
  };

  useEffect(() => {
    if (flags.enableProctoring && !showSystemCheck && hasRegistered) {
      if (!streamRef.current || !streamRef.current.active) {
        startProctoring();
      }
    }
    return () => {
      // Only stop media streams when component unmounts from contest
      if (document.hidden || isTerminated || isCompleted) {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
        if (screenStreamRef.current) {
          screenStreamRef.current.getTracks().forEach(track => track.stop());
          screenStreamRef.current = null;
        }
        if (recorderRef.current && recorderRef.current.state !== "inactive") {
          recorderRef.current.stop();
        }
        if (recordingIntervalRef.current) {
          clearInterval(recordingIntervalRef.current);
        }
        setProctoringStream(null);
      }
    };
  }, [flags.enableProctoring, showSystemCheck, hasRegistered, isTerminated, isCompleted]);

  // Periodically capture and upload proctoring snapshots
  useEffect(() => {
    if (!flags.enableProctoring || !flags.faceCheckEnabled || !participantId || !streamRef.current || isTerminated || isSessionReplaced) return;

    const captureSnapshot = () => {
      if (!videoRef.current) return;
      try {
        const video = videoRef.current;
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 320;
        canvas.height = video.videoHeight || 240;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
          api.uploadProctoringSnapshot(contestId, participantId, dataUrl)
            .catch(err => {
              if (err.status === 409 || (err.response && err.response.status === 409) || err.message === 'SESSION_CONFLICT') {
                setIsSessionReplaced(true);
              }
              console.error("Failed to upload snapshot:", err);
            });
        }
      } catch (err) {
        console.error("Error capturing snapshot:", err);
      }
    };

    const delayTimeout = setTimeout(captureSnapshot, 5000);
    const interval = setInterval(captureSnapshot, (flags.snapshotIntervalSeconds || 45) * 1000);

    return () => {
      clearTimeout(delayTimeout);
      clearInterval(interval);
    };
  }, [flags.enableProctoring, flags.faceCheckEnabled, flags.snapshotIntervalSeconds, participantId, isTerminated, isSessionReplaced]);

  // Audio-VAD (Voice Activity Detection)
  useEffect(() => {
    if (!flags.enableProctoring || !flags.voiceCheckEnabled || !streamRef.current || isTerminated || isSessionReplaced) return;

    let audioContext: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let checkInterval: ReturnType<typeof setInterval> | null = null;

    try {
      const AudioCtx = window.AudioContext || (window as Window & typeof globalThis & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioContext = new AudioCtx();
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      source = audioContext.createMediaStreamSource(streamRef.current);
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      let consecutiveTalkingSeconds = 0;
      const TALKING_THRESHOLD = 30; // 0-255 range

      checkInterval = setInterval(() => {
        analyser!.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;

        if (average > TALKING_THRESHOLD) {
          consecutiveTalkingSeconds += 1;
          if (consecutiveTalkingSeconds >= 8) {
            logViolation('sustained_talking', 'Sustained talking or audio activity detected.');
            consecutiveTalkingSeconds = 0; // Reset to avoid double logging
          }
        } else {
          consecutiveTalkingSeconds = 0;
        }
      }, 1000);
    } catch (err) {
      console.error("Audio VAD setup failed:", err);
    }

    return () => {
      if (checkInterval) clearInterval(checkInterval);
      if (source) source.disconnect();
      if (audioContext) audioContext.close().catch(console.error);
    };
  }, [flags.enableProctoring, flags.voiceCheckEnabled, streamRef.current, isTerminated, isSessionReplaced]);

  // DevTools detection (timing debugger loop and dimension check)
  useEffect(() => {
    if (isTerminated || isSessionReplaced || !participantId) return;

    const checkDevTools = () => {
      // 1. Dimension delta check
      const widthThreshold = window.outerWidth - window.innerWidth > 160;
      const heightThreshold = window.outerHeight - window.innerHeight > 160;
      const isDevToolsOpenHeuristic = widthThreshold || heightThreshold;

      // 2. Timing/Debugger check
      const startTime = performance.now();
      try {
        (function() {
          const test = new Function('debugger');
          test();
        })();
      } catch (e) {
        // DevTools detection not available or CSP blocked eval
      }
      const endTime = performance.now();

      const isDevToolsOpenTiming = (endTime - startTime) > 100;

      if (isDevToolsOpenHeuristic || isDevToolsOpenTiming) {
        logViolation('devtools_opened', 'Developer tools usage detected.');
      }
    };

    const interval = setInterval(checkDevTools, 2000);
    return () => clearInterval(interval);
  }, [isTerminated, isSessionReplaced]);

  // Fullscreen state listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFull = !!document.fullscreenElement;
      setIsFullscreen(isFull);
      
      if (!isFull && flags.requireFullscreen && !isTerminated && !isSessionReplaced && participantId) {
        const now = Date.now();
        lastFullscreenExitTime.current = now;
        
        // Check if visibilityHidden occurred within 500ms
        const isGesture = lastVisibilityHiddenTime.current !== null && (now - lastVisibilityHiddenTime.current <= 500);
        const eventType = isGesture ? 'space_switch_or_gesture' : 'fullscreen_exit';
        const description = isGesture ? 'Student swiped to another workspace or virtual desktop.' : 'Student exited fullscreen mode.';
        
        logViolation(eventType, description);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [flags.requireFullscreen, isTerminated, isSessionReplaced, participantId]);

  // Tab switch and focus prevention
  useEffect(() => {
    if (!flags.preventTabSwitch || isTerminated || isSessionReplaced || !participantId) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        const now = Date.now();
        lastVisibilityHiddenTime.current = now;
        
        // Check if fullscreenExit occurred within 500ms
        const isGesture = lastFullscreenExitTime.current !== null && (now - lastFullscreenExitTime.current <= 500);
        const eventType = isGesture ? 'space_switch_or_gesture' : 'tab_switch';
        const description = isGesture ? 'Student swiped to another workspace or virtual desktop.' : 'Student switched tabs or minimized the browser.';
        
        logViolation(eventType, description);
      } else if (document.visibilityState === 'visible') {
        // Returned to tab: show friction overlay if we recorded a hidden timestamp
        if (lastVisibilityHiddenTime.current) {
          setWarningReason("Student returned after navigating away.");
          setShowWarningModal(true);
        }
      }
    };

    const handleBlur = () => {
      logViolation('window_blur', 'Browser window lost focus.');
    };

    const handlePageHide = () => {
      logViolation('tab_switch', 'Student navigated away or closed the tab.');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [flags.preventTabSwitch, isTerminated, isSessionReplaced, participantId]);

  // PrintScreen and shortcut blockers
  useEffect(() => {
    if (isTerminated || isSessionReplaced || !participantId) return;

    const handleKeyDown = async (e: KeyboardEvent) => {
      // Browser Keyboard Lock bypass deterrence check
      const activeEl = document.activeElement;
      const isInsideEditor = activeEl && (
        activeEl.closest('.monaco-editor') ||
        activeEl.classList.contains('inputarea') ||
        activeEl.tagName === 'TEXTAREA' ||
        activeEl.tagName === 'INPUT'
      );

      const isAltTab = e.altKey && e.key === 'Tab';
      const isWinKey = e.key === 'Meta' || e.key === 'OS';
      const isF11 = e.key === 'F11';

      if (isAltTab || isWinKey || isF11 || (e.key === 'Tab' && !isInsideEditor)) {
        e.preventDefault();
        e.stopPropagation();

        const now = Date.now();
        if (now - lastShortcutLogTime.current > 3000) {
          lastShortcutLogTime.current = now;
          api.client.post(`/contests/${contestId}/lobby/integrity-event`, {
            eventType: 'attempted_shortcut',
            detail: { shortcut: e.key, combination: `alt=${e.altKey}, ctrl=${e.ctrlKey}, meta=${e.metaKey}` }
          }).catch(console.error);
        }
      }

      // PrintScreen interceptor
      const isPrintScreen = e.key === 'PrintScreen';
      const isSnippingTool = (e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'S' || e.key === 's');

      if (isPrintScreen || isSnippingTool) {
        e.preventDefault();
        try {
          await navigator.clipboard.writeText("SECURITY BLOCK: Screenshot attempt detected.");
        } catch (err) {
          console.error("Failed to write to clipboard:", err);
        }
        logViolation('screenshot_attempt', 'Attempted to take a screenshot.');
      }

      // Block F12
      if (e.key === 'F12') {
        e.preventDefault();
        logViolation('dev_tools', 'Attempted to open Developer Tools.');
      }
      
      // Block Ctrl+Shift+I / Ctrl+Shift+J / Ctrl+U
      if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j')) {
        e.preventDefault();
        logViolation('dev_tools', 'Attempted to open Developer Tools.');
      }
      if (e.ctrlKey && (e.key === 'U' || e.key === 'u')) {
        e.preventDefault();
        logViolation('view_source', 'Attempted to view page source.');
      }

      // Block Ctrl+C, Ctrl+V, Ctrl+X if copy paste is disabled or blocked
      if (e.ctrlKey || e.metaKey) {
        const keyLower = e.key.toLowerCase();
        if (keyLower === 'p' || keyLower === 's') {
          e.preventDefault();
          notify.toast.warning('This action is not available during the contest.');
          return;
        }
        if (flags.disableCopyPaste && ['c', 'x'].includes(keyLower)) {
          e.preventDefault();
          e.stopPropagation();
          logViolation('shortcut_blocked', `Attempted forbidden shortcut (Ctrl+${e.key.toUpperCase()}).`);
        }
        if ((flags.pasteMode === 'BLOCKED' || flags.disableCopyPaste) && keyLower === 'v') {
          e.preventDefault();
          e.stopPropagation();
          logViolation('paste_blocked', 'Student attempted to paste text via keyboard shortcut.');
        } else if (flags.pasteMode === 'LOG_ONLY' && keyLower === 'v') {
          logViolation('paste_logged', 'Student pasted text via keyboard shortcut.');
        }
      }

      // Block Alt+ArrowLeft
      if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        logViolation('navigation_blocked', 'Attempted to navigate back.');
      }
    };

    const handleKeyUp = async (_e: KeyboardEvent) => {
      // Clipboard already written in handleKeyDown; no duplicate needed
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [flags.disableCopyPaste, flags.pasteMode, isTerminated, isSessionReplaced, contestId]);

  // Copy-paste-contextmenu event listeners
  useEffect(() => {
    if (isTerminated || isSessionReplaced || !participantId) return;

    const preventClipboardEvent = (e: Event) => {
      if (flags.disableCopyPaste) {
        e.preventDefault();
        const type = e.type === 'copy' ? 'copy' : 'cut';
        logViolation(`${type}_blocked`, `Student attempted to ${type} content.`);
      }
    };

    const handlePasteEvent = (e: ClipboardEvent) => {
      if (flags.pasteMode === 'BLOCKED' || flags.disableCopyPaste) {
        e.preventDefault();
        logViolation('paste_blocked', 'Student attempted to paste text (blocked).');
      } else if (flags.pasteMode === 'LOG_ONLY') {
        const text = e.clipboardData?.getData('text') || '';
        logViolation('paste_logged', `Student pasted text (Length: ${text.length} chars).`);
      }
    };

    const preventContextMenu = (e: Event) => {
      if (flags.disableCopyPaste) {
        e.preventDefault();
        logViolation('contextmenu_blocked', 'Student tried to open right-click context menu.');
      }
    };

    document.addEventListener('copy', preventClipboardEvent);
    document.addEventListener('cut', preventClipboardEvent);
    document.addEventListener('paste', handlePasteEvent);
    document.addEventListener('contextmenu', preventContextMenu);

    return () => {
      document.removeEventListener('copy', preventClipboardEvent);
      document.removeEventListener('cut', preventClipboardEvent);
      document.removeEventListener('paste', handlePasteEvent);
      document.removeEventListener('contextmenu', preventContextMenu);
    };
  }, [flags.disableCopyPaste, flags.pasteMode, isTerminated, isSessionReplaced]);

  // Save original clipboard methods so we can restore later
  const origClipboardReadRef = useRef<typeof navigator.clipboard.read | null>(null);
  const origClipboardReadTextRef = useRef<typeof navigator.clipboard.readText | null>(null);

  const blockClipboardApi = async () => {
    const shouldBlock = flags.disableCopyPaste || flags.pasteMode === 'BLOCKED';
    if (!shouldBlock || !navigator.clipboard) return;

    // Save originals only once
    if (!origClipboardReadRef.current) {
      origClipboardReadRef.current = navigator.clipboard.read.bind(navigator.clipboard);
      origClipboardReadTextRef.current = navigator.clipboard.readText.bind(navigator.clipboard);
    }

    // Trigger the browser's clipboard-read permission prompt (needs user gesture)
    try {
      if (origClipboardReadTextRef.current) {
        await origClipboardReadTextRef.current();
      }
    } catch {
      // expected — user may allow or deny, we block both ways
    }

    // Override to always reject & log violation for contest duration
    const blocked = async (): Promise<never> => {
      logViolation('clipboard_api_blocked', 'Attempted to read clipboard via Clipboard API.');
      throw new DOMException('Clipboard read is disabled during this contest.', 'NotAllowedError');
    };
    navigator.clipboard.read = blocked as unknown as typeof navigator.clipboard.read;
    navigator.clipboard.readText = blocked as unknown as typeof navigator.clipboard.readText;
  };

  const restoreClipboardApi = () => {
    if (origClipboardReadRef.current && navigator.clipboard) {
      navigator.clipboard.read = origClipboardReadRef.current;
      navigator.clipboard.readText = origClipboardReadTextRef.current!;
    }
  };

  // Block clipboard when contest content becomes visible (non-fullscreen path)
  const isContestActive = participantId && !isTerminated && !isSessionReplaced && !showSystemCheck && (!flags.requireFullscreen || isFullscreen);

  // Keyboard Lock API Lock / Unlock Manager
  useEffect(() => {
    const supported = 'keyboard' in navigator && 'lock' in (navigator as any).keyboard;

    if (!isContestActive) {
      if (supported) {
        try {
          (navigator as any).keyboard.unlock();
        } catch (e) {}
      }
      setKeyboardLockActive(false);
      return;
    }

    if (supported) {
      const lockKeyboard = async () => {
        try {
          await (navigator as any).keyboard.lock(['AltLeft', 'AltRight', 'Tab', 'MetaLeft', 'MetaRight', 'F11']);
          setKeyboardLockActive(true);
        } catch (err) {
          console.warn('[Keyboard Lock failed]:', err);
          setKeyboardLockActive(false);
          // Log keyboard lock unavailable to server (informational)
          api.client.post(`/contests/${contestId}/lobby/integrity-event`, {
            eventType: 'keyboard_lock_unavailable',
            detail: { reason: String(err) }
          }).catch(console.error);
        }
      };
      lockKeyboard();
    } else {
      // Log keyboard lock unsupported to server (informational)
      api.client.post(`/contests/${contestId}/lobby/integrity-event`, {
        eventType: 'keyboard_lock_unavailable',
        detail: { reason: 'API not supported in this browser' }
      }).catch(console.error);
    }

    return () => {
      if (supported) {
        try {
          (navigator as any).keyboard.unlock();
        } catch (e) {}
      }
    };
  }, [isContestActive, contestId]);

  useEffect(() => {
    if (!isContestActive) return;
    blockClipboardApi();
    return () => restoreClipboardApi();
  }, [isContestActive]);

  // Restore clipboard API on unmount / when blocking turns off
  useEffect(() => {
    if (!flags.disableCopyPaste && flags.pasteMode !== 'BLOCKED') {
      restoreClipboardApi();
    }
    return () => restoreClipboardApi();
  }, [flags.disableCopyPaste, flags.pasteMode, isTerminated, isSessionReplaced]);

  // Cheating extensions detector (DOM scan)
  useEffect(() => {
    if (!isContestActive) return;

    const extensionSelectors = [
      'sider-sidebar-container',
      '#sider-root',
      '.sider-btn',
      'monica-container',
      '#monica-root',
      'grammarly-extension',
      'grammarly-card',
      '[data-gr-id]',
      'cody-chat',
      'cody-web-view',
      '#cody-chat-root',
      '.copilot-suggestion',
      '.github-copilot-suggestion',
      '#harpa-ai-root',
      '#sider-container'
    ];

    const checkExtensions = () => {
      for (const selector of extensionSelectors) {
        let exists = false;
        try {
          if (selector.startsWith('.') || selector.startsWith('#') || selector.startsWith('[')) {
            exists = document.querySelector(selector) !== null;
          } else {
            exists = document.getElementsByTagName(selector).length > 0;
          }
        } catch (e) {}

        if (exists) {
          console.warn(`Cheating tool detected: ${selector}`);
          logViolation('EXTENSION_DETECTED', `Cheating extension matching '${selector}' detected active.`);
          break;
        }
      }
    };

    // Scan every 15 seconds
    checkExtensions();
    const interval = setInterval(checkExtensions, 15000);

    return () => clearInterval(interval);
  }, [isContestActive]);

  // Mid-exam Local Agent Proctoring WebSocket Monitor
  useEffect(() => {
    if (!flags.enableProctoring || isTerminated || isSessionReplaced || !participantId) return;

    let ws: WebSocket | null = null;
    let active = true;
    let lastLoggedTime = 0;

    const setupAgentConnection = async () => {
      try {
        const tokenRes = await api.client.post(`/contests/${contestId}/lobby/agent-pairing-token`);
        const token = tokenRes.data.pairingToken;

        if (!active) return;

        ws = new WebSocket('ws://127.0.0.1:3002');

        ws.onopen = () => {
          ws?.send(JSON.stringify({ type: 'pair', token }));
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'agent_report') {
              const blocked = msg.blockedApps || [];
              const appsList = blocked.map((a: any) => `${a.process} (${a.title})`);

              setActiveViolations(appsList);

              if (appsList.length > 0) {
                const now = Date.now();
                // Throttle violation logs to the DB/API to once every 15 seconds to prevent spamming warnings
                if (now - lastLoggedTime > 15000) {
                  lastLoggedTime = now;
                  logViolation('blocked_app_detected', `Prohibited background apps running: ${appsList.join(', ')}`);
                  api.client.post(`/contests/${contestId}/lobby/integrity-event`, {
                    eventType: 'blocked_app_detected',
                    detail: { apps: appsList }
                  }).catch(err => console.warn('[Log integrity event error]:', err));
                }
              }
            }
          } catch {}
        };

        ws.onerror = () => {
          console.warn('[Exam Agent]: Local WS connection failed. Is the agent running?');
        };

        ws.onclose = () => {
          if (active) {
            // Attempt reconnect after 10s
            setTimeout(setupAgentConnection, 10000);
          }
        };

      } catch (err) {
        console.warn('[Exam Agent]: Token fetch failed.', err);
      }
    };

    setupAgentConnection();

    return () => {
      active = false;
      if (ws) ws.close();
    };
  }, [flags.enableProctoring, contestId, isTerminated, isSessionReplaced, participantId]);

  const handleResumeExam = async () => {
    if (!document.fullscreenElement) {
      try {
        await document.documentElement.requestFullscreen();
      } catch (err) {
        console.error("Failed to restore fullscreen mode:", err);
      }
    }
    
    let awayDurationMs = 0;
    if (lastVisibilityHiddenTime.current) {
      awayDurationMs = Date.now() - lastVisibilityHiddenTime.current;
    }
    
    try {
      await api.client.post(`/contests/${contestId}/lobby/integrity-event`, {
        eventType: 'contest_resumed',
        detail: {
          awayDurationMs,
          resumeConfirmedAt: new Date()
        }
      });
    } catch (err) {
      console.error("Failed to log resume event:", err);
    }
    
    lastVisibilityHiddenTime.current = null;
    lastFullscreenExitTime.current = null;
    setShowWarningModal(false);
  };

  const handleExitTerminated = () => {
    setShowWarningModal(false);
    setShowAutoSubmitScreen(true);
  };

  const logViolation = async (eventType: string, description: string) => {
    try {
      const res = await api.client.post(`/contests/${contestId}/lobby/integrity-event`, {
        eventType,
        detail: { description }
      });
      const data = res.data;
      
      if (data.warnings !== undefined) {
        setWarnings(data.warnings);
        setWarningReason(description);
        setShowWarningModal(true);
      }
      
      if (data.isTerminated) {
        setIsTerminated(true);
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(e => console.error(e));
        }
      }
    } catch (err: any) {
      if (err.status === 409 || (err.response && err.response.status === 409) || err.message === 'SESSION_CONFLICT') {
        setIsSessionReplaced(true);
      }
      console.error('Failed to log violation:', err);
    }
  };

  if (proctorBlocked) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#090a0d]/95 backdrop-blur-2xl p-6 select-none font-sans text-white">
        <div className="w-full max-w-lg flex flex-col items-center text-center space-y-6">
          
          {/* Top Pill Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-[11px] font-black tracking-widest text-amber-400 uppercase font-mono">
              PROCTOR INTERVENTION
            </span>
          </div>

          {/* Header Titles */}
          <div className="space-y-2">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Assessment suspended by proctor
            </h1>
            <p className="text-sm text-zinc-400 font-medium">
              Your session has been flagged and paused pending review.
            </p>
          </div>

          {/* Central Details Card */}
          <div className="w-full bg-[#12141a]/90 border border-white/10 rounded-2xl p-6 text-left space-y-5 shadow-2xl backdrop-blur-md">
            {/* Reason section */}
            <div className="space-y-1">
              <span className="text-[10px] font-mono font-bold tracking-wider text-zinc-500 uppercase">
                REASON FOR FLAG
              </span>
              <p className="text-base font-bold text-white leading-relaxed">
                {proctorBlockReason || 'Multiple faces detected in camera feed'}
              </p>
            </div>

            <div className="h-px bg-white/10 w-full" />

            {/* Grid of attributes */}
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-zinc-400 font-medium">Flagged by</span>
                <span className="text-white font-bold">{proctorBlockerName || 'Invigilator'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-400 font-medium">Status</span>
                <span className="text-amber-400 font-mono font-bold">Exam Session Paused</span>
              </div>
            </div>
          </div>

          {/* Yellow/Amber Warning Box */}
          <div className="w-full bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-left">
            <p className="text-xs text-amber-300 font-medium leading-relaxed">
              This flag has been logged against your session record. Reaching the maximum allowed warnings will end your assessment automatically.
            </p>
          </div>

          {/* Footer Instructions Subtext */}
          <p className="text-xs text-zinc-500 max-w-lg leading-relaxed text-center font-normal">
            Stay on this screen. Your code, progress, and remaining time are preserved — the assessment resumes automatically the moment the proctor clears this flag.
          </p>

        </div>
      </div>
    );
  }

  if (isSessionReplaced) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white p-4">
        <div className="bg-amber-500/10 border border-amber-500 rounded-xl p-8 max-w-md text-center">
          <svg className="w-16 h-16 text-amber-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h1 className="text-2xl font-bold mb-2">Session Replaced</h1>
          <p className="text-gray-300 mb-6">This session has been replaced by a newer login. You cannot continue the exam on this device/tab.</p>
          <button 
            onClick={() => navigate('/contests')}
            className="px-6 py-2 bg-amber-500 hover:bg-amber-600 text-black font-bold rounded-lg transition"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (isTerminated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white p-4">
        <div className="bg-red-500/10 border border-red-500 rounded-xl p-8 max-w-md text-center">
          <svg className="w-16 h-16 text-red-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h1 className="text-2xl font-bold mb-2">Exam Terminated</h1>
          <p className="text-gray-300 mb-6">Your session has been terminated due to multiple security violations. Your current progress has been saved.</p>
          <button 
            onClick={() => navigate('/contests')}
            className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white font-bold rounded-lg transition"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (isCompleted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white p-4">
        <div className="bg-green-500/10 border border-green-500/40 rounded-2xl p-10 max-w-md text-center shadow-2xl shadow-green-500/10">
          {/* Animated checkmark */}
          <div className="w-20 h-20 rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-black mb-2 text-white">Exam Submitted</h1>
          <p className="text-gray-400 text-sm mb-1">You have already completed and submitted this contest exam.</p>
          <p className="text-gray-500 text-xs mb-8">Your full results and analysis report are available below.</p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => navigate(`/contests/${contestId}/report`)}
              className="px-6 py-3 bg-green-500 hover:bg-green-400 text-black font-black rounded-xl transition shadow-lg shadow-green-500/20 text-sm"
            >
              📊 View Full Report & Results
            </button>
            <button
              onClick={() => navigate('/contests')}
              className="px-6 py-2 bg-white/5 hover:bg-white/10 text-gray-300 font-bold rounded-xl transition border border-white/10 text-sm"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // System Check & Verification Photo Capture UI
  if (showSystemCheck && !hasRegistered) {
    const finalRollNo = (user as any)?.enrollmentNumber || tempRollNo || user?.name || user?.email || 'CANDIDATE-01';
    const canSubmit = Boolean(capturedPhoto || sysCamStream || user?.id);

    return (
      <div className="min-h-screen flex items-center justify-center bg-black/95 text-white p-4">
        <div className="bg-zinc-950 border border-amber-500/20 rounded-2xl p-6 max-w-2xl w-full shadow-2xl space-y-6">
          <div className="text-center">
            <h1 className="text-xl font-bold text-white mb-1">System Check & Exam Registration</h1>
            <p className="text-xs text-zinc-400">Verify your devices and capture a registration photo to enter the exam.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left side: Live Camera Stream */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">Step 1: Verify Hardware</h3>
              <div className="relative aspect-video rounded-lg overflow-hidden bg-zinc-900 border border-zinc-800">
                <video ref={sysVideoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
                {!sysCamStream && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center text-zinc-500">
                    <svg className="w-8 h-8 mb-2 animate-spin text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    <span className="text-xs font-medium">Requesting camera access...</span>
                  </div>
                )}
              </div>
              
              {/* Mic volume bar */}
              <div>
                <div className="flex justify-between text-[10px] text-zinc-400 mb-1">
                  <span>Microphone level:</span>
                  <span>{micVolume}%</span>
                </div>
                <div className="w-full h-2 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
                  <div 
                    className="h-full bg-amber-500 transition-all duration-75"
                    style={{ width: `${micVolume}%` }}
                  />
                </div>
              </div>
              
              {/* Capture action button */}
              <button 
                onClick={capturePhoto}
                disabled={!sysCamStream}
                className="w-full py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-black font-bold text-xs rounded-lg transition"
              >
                {capturedPhoto ? "Retake Photo" : "Capture Verification Photo"}
              </button>
            </div>

            {/* Right side: Verification Status */}
            <div className="flex flex-col justify-between space-y-4">
              <div className="space-y-4">
                <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">Step 2: Review Registration</h3>
                
                {/* Image snapshot display */}
                <div className="relative aspect-video rounded-lg overflow-hidden bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                  {capturedPhoto ? (
                    <img src={capturedPhoto} alt="Captured baseline" className="w-full h-full object-cover scale-x-[-1]" />
                  ) : (
                    <div className="text-center text-zinc-500 p-4">
                      <svg className="w-10 h-10 mx-auto mb-2 text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      </svg>
                      <span className="text-[10px] text-zinc-600">Your photo will appear here once captured.</span>
                    </div>
                  )}
                </div>

                {/* Candidate Info Fields */}
                <div className="space-y-2">
                  <div>
                    <label className="block text-[10px] text-zinc-400 mb-0.5">Candidate Name</label>
                    <input 
                      type="text" 
                      readOnly 
                      className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-white font-medium outline-none cursor-default font-mono"
                      value={(user as any)?.fullName || user?.name || ''} 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-400 mb-0.5">Roll / Enrollment Number</label>
                    {(user as any)?.enrollmentNumber ? (
                      <input 
                        type="text" 
                        readOnly 
                        className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-white font-medium outline-none cursor-default font-mono"
                        value={(user as any).enrollmentNumber} 
                      />
                    ) : (
                      <input 
                        type="text" 
                        className="w-full bg-zinc-900 border border-zinc-800 focus:border-amber-500 rounded px-2.5 py-1.5 text-xs text-white outline-none font-mono"
                        placeholder="Enter your Roll/Enrollment number"
                        value={tempRollNo} 
                        onChange={e => setTempRollNo(e.target.value)}
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Start exam submit */}
              <button 
                onClick={handleRegisterAndStart}
                disabled={!canSubmit || registering}
                className="w-full py-3 bg-gradient-to-r from-amber-500 to-yellow-500 text-black font-extrabold text-sm rounded-lg shadow-lg disabled:opacity-50 hover:brightness-110 active:brightness-95 transition"
              >
                {registering ? "Registering..." : "Confirm & Start Exam"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isSEB = navigator.userAgent.includes('SEB') || navigator.userAgent.includes('SafeExamBrowser');

  if (flags.requireFullscreen && !isFullscreen && (!flags.requireSeb || isSEB)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white p-4">
        <div className="bg-[var(--bg-card)] border border-[var(--accent-green)]/30 rounded-xl p-8 max-w-md text-center">
          <h1 className="text-2xl font-bold mb-2">Secure Environment Required</h1>
          <p className="text-gray-400 mb-6">This exam requires fullscreen mode. Please ensure you are ready before proceeding.</p>
          <button 
            onClick={requestFullscreen}
            className="px-6 py-3 bg-[var(--accent-green)] hover:opacity-90 text-black font-bold rounded-lg transition w-full"
          >
            Enter Fullscreen & Start
          </button>
        </div>
      </div>
    );
  }

  const Watermark = () => {
    if (!user) return null;
    const watermarkText = `${(user as any)?.fullName || user?.name || ''} | ${user.email} | Contest: ${contestId}`;

    return (
      <div className="fixed inset-0 pointer-events-none z-40 overflow-hidden">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="watermark" x="0" y="0" width="400" height="200" patternUnits="userSpaceOnUse">
              <text x="200" y="100" transform="rotate(-45 200 100)" textAnchor="middle"
                    fontFamily="monospace" fontSize="16" fill="rgba(255,255,255,0.05)">
                {watermarkText}
              </text>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#watermark)" />
        </svg>
      </div>
    );
  };

  const CornerIDBadge = () => {
    if (!hasRegistered) return null;
    
    // Get stored registration photo or fallback
    const storedPhoto = sessionStorage.getItem(`regPhoto_${contestId}`);
    const BASE_HOST = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api$/, '');
    const finalPhoto = storedPhoto && (storedPhoto.startsWith('uploads') || storedPhoto.startsWith('http') || storedPhoto.startsWith('data:'))
      ? `${BASE_HOST}/${storedPhoto.replace(/^[/\\]+/, '')}`
      : '';
    
    const finalRollNo = (user as any)?.enrollmentNumber || tempRollNo || 'N/A';

    return (
      <div className="fixed bottom-4 right-4 z-50 pointer-events-auto bg-zinc-950/90 border border-green-500/30 rounded-xl p-3 flex items-center gap-3 shadow-2xl backdrop-blur max-w-sm">
        {/* Registration photo with pulsing live check indicator */}
        <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-green-500/20 bg-zinc-900 flex-shrink-0">
          {flags.enableProctoring && proctoringStream ? (
            <video 
              ref={(el) => {
                if (el && el.srcObject !== proctoringStream) {
                  el.srcObject = proctoringStream;
                }
              }}
              autoPlay 
              playsInline 
              muted 
              className="w-full h-full object-cover scale-x-[-1]" 
            />
          ) : finalPhoto ? (
            <img src={finalPhoto} alt="Candidate Profile" className="w-full h-full object-cover scale-x-[-1]" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-500">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          )}
          {/* Pulsing indicator */}
          <div className="absolute top-0.5 right-0.5 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </div>
        </div>

        {/* Student identification text info */}
        <div className="flex flex-col min-w-0 pr-1 text-left">
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] text-green-400 font-bold tracking-wider uppercase">Live Feed Active</span>
          </div>
          <span className="text-xs font-bold text-white truncate block">{(user as any)?.fullName || user?.name || 'Candidate'}</span>
          <span className="text-[10px] font-medium text-zinc-400 truncate block">Roll No: {finalRollNo}</span>
          <div className="mt-1 flex flex-wrap gap-1">
            {keyboardLockActive ? (
              <span className="inline-flex items-center px-1 py-0.5 rounded text-[8px] font-extrabold bg-green-500/20 text-green-400 border border-green-500/20 uppercase tracking-wider">
                🛡️ Enhanced Lock
              </span>
            ) : (
              <span className="inline-flex items-center px-1 py-0.5 rounded text-[8px] font-extrabold bg-zinc-800 text-zinc-400 border border-zinc-700 uppercase tracking-wider">
                ⚠️ Std Detection
              </span>
            )}
            <span className={`inline-flex items-center px-1 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-wider ${
              _warnings >= (flags.maxWarnings || 3) - 1
                ? 'bg-red-500/20 text-red-400 border border-red-500/20'
                : _warnings > 0
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/20'
                  : 'bg-green-500/20 text-green-400 border border-green-500/20'
            }`}>
              ⚠️ Warnings: {_warnings}/{flags.maxWarnings || 3}
            </span>
          </div>
        </div>
      </div>
    );
  };

  if (showAutoSubmitScreen || (isTerminated && !showWarningModal)) {
    return (
      <PostAutoSubmitScreen
        contestId={contestId}
        contestTitle={contestTitle}
        maxWarnings={flags.maxWarnings || 3}
        onReturn={() => navigate('/contests')}
      />
    );
  }

  return (
    <div className={`relative min-h-screen ${flags.disableCopyPaste ? 'select-none' : ''}`}>
      {/* ── Proctor Block Screen — overlays everything when proctor blocks student ── */}
      <ProctorBlockScreen
        isBlocked={proctorBlocked}
        blockReason={proctorBlockReason}
        proctorName={proctorBlockerName}
        contestTitle={contestTitle}
      />

      {/* ── Proctor Warn Banner — shown as a non-blocking warning toast ── */}
      {proctorWarnMessage && (
        <div style={{
          position: 'fixed',
          top: '16px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 99998,
          background: 'linear-gradient(135deg, #78350f, #92400e)',
          border: '1px solid rgba(251, 191, 36, 0.5)',
          borderRadius: '12px',
          padding: '12px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          maxWidth: '480px',
          width: '90%',
          animation: 'fadeIn 0.3s ease-out',
        }}>
          <span style={{ fontSize: '20px' }}>⚠️</span>
          <div>
            <p style={{ color: '#fbbf24', fontWeight: '700', fontSize: '13px', margin: 0 }}>Invigilator Warning</p>
            <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '12px', margin: '2px 0 0 0' }}>{proctorWarnMessage}</p>
          </div>
        </div>
      )}

      {activeViolations.length > 0 && (
        <div className="fixed top-0 left-0 w-full bg-red-600 text-white z-[9999] p-3 text-center text-xs font-black shadow-lg animate-pulse">
          ⚠️ SECURITY VIOLATION DETECTED: Close the following unapproved applications/tabs immediately to avoid disqualification review: {activeViolations.join(', ')}
        </div>
      )}
      <Watermark />
      <CornerIDBadge />
      {flags.enableProctoring && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '1px', height: '1px', opacity: 0.01, pointerEvents: 'none', zIndex: -100 }}>
          <video ref={videoRef} autoPlay playsInline muted />
        </div>
      )}
      <div className="relative z-10 w-full h-full">
        {children}
      </div>

      <WarningModal
        isOpen={showWarningModal}
        warnings={_warnings}
        maxWarnings={flags.maxWarnings || 3}
        reason={warningReason}
        proctorName={proctorBlockerName || 'Invigilator System'}
        isTerminated={isTerminated || proctorTerminated}
        onResume={handleResumeExam}
        onExit={handleExitTerminated}
      />
    </div>
  );
}
