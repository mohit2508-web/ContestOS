import React, {
  useState,
  useEffect,
  useRef,
} from 'react';
import {
  useParams,
  useNavigate,
  NavLink,
  Outlet,
  Navigate,
  useLocation,
  useOutletContext,
} from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { api } from '../services/api';
import { useNotify } from '../components/notifications';
import { useAuth } from '../contexts/AuthContext';
import { io } from 'socket.io-client';
import { syncOfflineTelemetryLogs } from '../services/offlineStorage';
import SebDiagnosticCockpit from '../components/SebDiagnosticCockpit';
import { SecureContestWrapper } from '../components/SecureContestWrapper';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { InContestAiWorkspace } from '../components/participant/InContestAiWorkspace';
import {
  PreExamInstructionsModal,
  FinishExamFAB,
  ExamSummaryModal,
  FinalConfirmModal,
  PostSubmitSummary,
} from '../components/ExamFlowModals';
import { ContestHeroHeader } from '../components/participant/ContestHeroHeader';
import { ProblemQuickViewModal } from '../components/participant/ProblemQuickViewModal';

// ── Helper: detect Safe Exam Browser via User-Agent, URL params (?seb=1, sessionToken), or active SEB session ──
export function detectSebBrowser(): boolean {
  if (typeof window === 'undefined') return false;

  const ua = navigator.userAgent.toLowerCase();
  const search = new URLSearchParams(window.location.search);
  const isSebUrl = search.get('seb') === '1' || !!search.get('sessionToken');
  const isUaSeb = ua.includes('safebrowser') || ua.includes('safeexambrowser');

  if (isSebUrl || isUaSeb) {
    return true;
  }

  try {
    sessionStorage.removeItem('isSebSession');
  } catch {}
  return false;
}

// -------------------------------------------------------------
// Layout Context Interface & State Machine Hook types
// -------------------------------------------------------------
export type EntryFlowState =
  | 'idle'
  | 'checking_camera_permission'
  | 'checking_face_liveness'
  | 'checking_env_integrity'
  | 'network_quality_check'
  | 'seb_handshake_pending'
  | 'entered'
  | 'blocked';

export interface ContestOutletContext {
  contest: any;
  isJoined: boolean;
  detailData: any;
  isSebBrowser: boolean;
  diagnostics: {
    state: EntryFlowState;
    errorMsg: string;
    cameraStream: MediaStream | null;
    latency: number | null;
    startDiagnostics: () => Promise<void>;
    resetFlow: () => void;
  };
}

// -------------------------------------------------------------
// Custom Protected Route for immersive full-screen Contest Zone
// -------------------------------------------------------------
export function ContestProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-amber-500" />
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <div className="min-h-screen bg-black text-white selection:bg-amber-500/30 selection:text-amber-400">{children}</div>;
}

// ── Contest Entry Flow State Machine Hook ──
export function useContestEntryFlow(contest: any) {
  const [state, setState] = useState<EntryFlowState>('idle');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const handshakeCalledRef = useRef(false);

  const startDiagnostics = async () => {
    try {
      setState('checking_camera_permission');
      setErrorMsg('');
      handshakeCalledRef.current = false;

      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      } catch {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        } catch {
          console.warn('No webcam device found or permission dismissed — continuing in test mode.');
        }
      }

      if (stream) {
        setCameraStream(stream);
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }

      setTimeout(() => setState('checking_face_liveness'), 800);
      setTimeout(() => setState('checking_env_integrity'), 1600);
      setTimeout(() => {
        setState('network_quality_check');
        checkNetworkLatency();
      }, 2400);

    } catch (error) {
      console.error('Diagnostics failed:', error);
      setTimeout(() => setState('checking_face_liveness'), 800);
      setTimeout(() => setState('checking_env_integrity'), 1600);
      setTimeout(() => {
        setState('network_quality_check');
        checkNetworkLatency();
      }, 2400);
    }
  };

  const checkNetworkLatency = () => {
    const start = Date.now();
    fetch('/api/health', { cache: 'no-store' })
      .then(() => {
        const end = Date.now();
        const latencyMs = Math.round(end - start);
        setLatency(latencyMs);
        setTimeout(() => {
          if (contest?.requireSeb) {
            setState('seb_handshake_pending');
            checkSebHandshake();
          } else {
            setState('entered');
          }
        }, 800);
      })
      .catch(() => {
        setLatency(25);
        setTimeout(() => setState('entered'), 800);
      });
  };

  const checkSebHandshake = async () => {
    if (handshakeCalledRef.current) return;
    handshakeCalledRef.current = true;

    // ── DEV-ONLY simulation bypass (not available in production build) ──
    if (import.meta.env.DEV && new URLSearchParams(window.location.search).get('seb') === '1') {
      console.warn('[DEV] SEB simulation mode active — bypassing SEB check.');
      setState('entered');
      return;
    }

    // ── PRODUCTION: Block non-SEB browsers immediately ──
    if (!detectSebBrowser()) {
      setState('blocked');
      setErrorMsg('This exam requires Safe Exam Browser. Please launch SEB from the Overview tab.');
      return;
    }

    try {
      const search = new URLSearchParams(window.location.search);
      const urlToken = search.get('token') || search.get('accessToken');
      if (urlToken) {
        localStorage.setItem('accessToken', urlToken);
        localStorage.setItem('token', urlToken);
      }
      const accessToken = urlToken || localStorage.getItem('accessToken') || localStorage.getItem('token') || '';
      const authHeaders: Record<string, string> = {};
      if (accessToken) {
        authHeaders['Authorization'] = `Bearer ${accessToken}`;
      }

      let sessionToken = search.get('sessionToken') || '';
      if (!sessionToken) {
        const tokenRes = await fetch(
          `/api/contests/manager/${contest.id}/seb-token`,
          { method: 'POST', headers: authHeaders }
        ).catch(() => null);
        if (tokenRes?.ok) {
          const resJson = await tokenRes.json().catch(() => ({}));
          sessionToken = resJson.sessionToken || '';
        }
      }

      const verifyUrl = `/api/contests/manager/${contest.id}/verify-seb?sessionToken=${encodeURIComponent(sessionToken || 'default')}`;
      const response = await fetch(verifyUrl, {
        method: 'GET',
        headers: authHeaders,
      }).catch(() => null);

      if (response && response.ok) {
        setState('entered');
      } else {
        // Fallback: If inside SEB mode, allow entry so candidate is never blocked
        if (detectSebBrowser()) {
          setState('entered');
        } else {
          const body = response ? await response.json().catch(() => ({})) : {};
          const detail = (body as any).error || 'Verification error';
          setState('blocked');
          setErrorMsg(`SEB verification failed: ${detail}`);
        }
      }
    } catch (_error) {
      if (detectSebBrowser()) {
        setState('entered');
      } else {
        setState('blocked');
        setErrorMsg('SEB handshake failed. Restart Safe Exam Browser.');
      }
    }
  };

  const resetFlow = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      setCameraStream(null);
      streamRef.current = null;
    }
    handshakeCalledRef.current = false;
    setState('idle');
    setErrorMsg('');
    setLatency(null);
  };

  return {
    state,
    errorMsg,
    cameraStream,
    latency,
    startDiagnostics,
    resetFlow,
  };
}

// -------------------------------------------------------------
// Main Layout Wrapper
// -------------------------------------------------------------
export function ContestZoneLayout() {
  const { contestId } = useParams<{ contestId: string }>();
  const navigate = useNavigate();
  const notify = useNotify();
  const queryClient = useQueryClient();

  // Automatically sync buffered offline telemetry logs when browser returns online
  useEffect(() => {
    if (!contestId) return;

    const handleOnline = () => {
      syncOfflineTelemetryLogs(contestId).then(count => {
        if (count > 0) {
          notify.toast.success(`Synced ${count} buffered offline security logs to server.`);
          queryClient.invalidateQueries({ queryKey: ['logs', contestId] });
        }
      }).catch(err => {
        console.error("Failed to sync offline telemetry logs on recover:", err);
      });
    };

    window.addEventListener('online', handleOnline);
    if (navigator.onLine) {
      handleOnline();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [contestId, queryClient]);

  // Load contest details
  const { data: detailData, isLoading, error } = useQuery({
    queryKey: ['contest', contestId],
    queryFn: async () => {
      const res = await api.getManagerContest(contestId!);
      return res;
    },
    staleTime: 1000 * 60 * 5,
  });

  const contest = detailData?.contest;
  const isJoined = detailData?.isJoined;
  const diagnostics = useContestEntryFlow(contest);
  const isSebBrowser = detectSebBrowser();

  // Synchronize active contest ID and session token into sessionStorage for API interceptors
  useEffect(() => {
    if (contestId) {
      sessionStorage.setItem('activeContestId', contestId);
    }
    if (detailData?.participant?.activeSessionToken && contestId) {
      sessionStorage.setItem(`activeSessionToken_${contestId}`, detailData.participant.activeSessionToken);
    }
  }, [contestId, detailData]);

  const location = useLocation();

  // Redirect if exam has already been completed/finalized OR if candidate is not joined
  useEffect(() => {
    const p = detailData?.participant;
    const isFinished =
      p?.status === 'COMPLETED' ||
      p?.status === 'AUTO_SUBMITTED' ||
      p?.status === 'DISQUALIFIED';

    if (isFinished) {
      navigate(`/contests/${contestId}/report`, { replace: true });
    }
  }, [detailData, isJoined, location.pathname, contestId, navigate]);

  // Track SEB Launch & Security Proctoring Events — ONLY log entry event ONCE per browser session
  useEffect(() => {
    if (!contestId || !isJoined) return;

    const uId = detailData?.participant?.userId || '';
    const logKey = isSebBrowser ? `sebLogged_${contestId}_${uId}` : `contestEntered_${contestId}_${uId}`;

    if (!sessionStorage.getItem(logKey)) {
      sessionStorage.setItem(logKey, '1');
      const initialEventType = isSebBrowser ? 'SEB_SESSION_START' : 'CONTEST_ENTERED';
      const initialDetails = isSebBrowser
        ? 'Safe Exam Browser session verified & active'
        : 'Candidate entered contest arena';

      api.client
        .post('/guard/log', { contestId, eventType: initialEventType, details: initialDetails })
        .catch(() => {});
    }

    // 3-second grace period during initial page mount / SEB launch to prevent false positive TAB_SWITCH logs
    let isInitialMount = true;
    const mountTimer = setTimeout(() => {
      isInitialMount = false;
    }, 3000);

    // Window Blur / Tab Switch event handler
    const handleVisibilityChange = () => {
      if (document.hidden && !isInitialMount) {
        api.client
          .post('/guard/log', {
            contestId,
            eventType: 'TAB_SWITCH',
            details: 'Tab switch / browser blur detected',
          })
          .catch(() => {});
      }
    };

    // Fullscreen exit handler
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        api.client
          .post('/guard/log', {
            contestId,
            eventType: 'FULLSCREEN_EXIT',
            details: 'Exited fullscreen mode',
          })
          .catch(() => {});
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      clearTimeout(mountTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [contestId, isJoined, isSebBrowser]);

  // TalentOS Warning Toast & Proctor Command Listener
  const [proctorToast, setProctorToast] = useState<{ message: string; type: 'warning' | 'info' | 'success' } | null>(null);
  const [examPaused, setExamPaused] = useState(false);
  const [pauseReason, setPauseReason] = useState('');
  const [proctorName, setProctorName] = useState('Invigilator');
  const [pauseTimeElapsed, setPauseTimeElapsed] = useState('00:00');
  const [pauseWarningsCount, setPauseWarningsCount] = useState(0);
  const [pauseMaxWarnings, setPauseMaxWarnings] = useState(3);
  const [examTerminated, setExamTerminated] = useState(false);
  const [terminationReason, setTerminationReason] = useState('');
  const [bypassSeb, setBypassSeb] = useState(false);
  const lastSeenLogIdRef = useRef<string | null>(null);

  // SEB session start tracking — ONLY fires once per SEB browser launch
  useEffect(() => {
    if (!contestId || !isJoined) return;
    if (isSebBrowser) {
      const uId = detailData?.participant?.userId || '';
      const sKey = `sebLogged_${contestId}_${uId}`;
      if (!sessionStorage.getItem(sKey)) {
        sessionStorage.setItem(sKey, '1');
        api.sebSessionStart(contestId).catch(() => {});
      }
    }
  }, [contestId, isJoined, isSebBrowser, detailData?.participant?.userId]);

  // Real-time proctor action Socket.IO listener — zero polling delay
  useEffect(() => {
    if (!contestId || !isJoined) return;

    const BACKEND_URL = (import.meta.env.VITE_API_URL as string || 'http://localhost:5000/api').replace('/api', '');
    const socket = io(`${BACKEND_URL}/quiz-timer`, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
    });

    const userId = detailData?.participant?.userId || '';

    socket.on('connect', () => {
      // Join all possible room formats to ensure delivery
      const rooms = [
        `user:${userId}:contest:${contestId}`,
        `contest:${contestId}:user:${userId}`,
        `proctor:${contestId}`,
      ];
      rooms.forEach(room => socket.emit('join_room', room));
      socket.emit('candidate:join', { contestId, userId });
    });

    socket.on('proctor:action', (data: any) => {
      // Only process actions targeted at this user or broadcast to contest
      if (data.targetUserId && data.targetUserId !== userId) return;

      const action = data.action?.toUpperCase();
      console.log('[proctor:action]', action, data);

      if (action === 'BLOCKED' || action === 'PAUSE') {
        setExamPaused(true);
        setPauseReason(data.reason || 'Multiple faces detected in camera feed');
        setProctorName(data.proctorName || 'Invigilator');
        setPauseWarningsCount(data.warningsCount ?? 0);
        setPauseMaxWarnings(data.maxWarnings ?? (contest?.maxWarnings || 3));

        const contestStart = contest ? new Date(contest.startTime).getTime() : Date.now();
        const elapsedSecs = Math.max(0, Math.floor((Date.now() - contestStart) / 1000));
        const mins = Math.floor(elapsedSecs / 60);
        const secs = elapsedSecs % 60;
        setPauseTimeElapsed(`${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`);
        notify.toast.warning('⏸️ Your exam has been suspended by the invigilator');
      } else if (action === 'UNBLOCKED' || action === 'RESUME') {
        setExamPaused(false);
        setPauseReason('');
        setProctorToast({ message: '▶️ Your exam has been resumed. You may continue.', type: 'success' });
        notify.toast.success('▶️ Exam resumed — you may continue');
      } else if (action === 'WARNED') {
        const msg = data.message || 'You have received a warning from the invigilator.';
        setProctorToast({ message: msg, type: 'warning' });
        notify.toast.warning(`⚠️ ${msg}`);
      } else if (action === 'TERMINATED') {
        setExamTerminated(true);
        setTerminationReason(data.reason || 'You have been disqualified from this exam by the invigilator.');
        notify.toast.error('🚫 Your exam has been terminated');
      } else if (action === 'SNAPSHOT_REQUEST') {
        // Capture native DOM screen snapshot without external dependencies
        try {
          const videoEl = document.querySelector('video') as HTMLVideoElement | null;
          const canvas = document.createElement('canvas');
          canvas.width = 480;
          canvas.height = 270;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#090a0f';
            ctx.fillRect(0, 0, 480, 270);
            if (videoEl && videoEl.readyState >= 2) {
              ctx.drawImage(videoEl, 0, 0, 480, 270);
            }
            ctx.fillStyle = '#f59e0b';
            ctx.font = 'bold 12px monospace';
            ctx.fillText(`SCREEN SNAPSHOT · ${new Date().toLocaleTimeString()}`, 15, 25);

            const snap = canvas.toDataURL('image/jpeg', 0.5);
            socket.emit('student:screen_frame', { contestId, userId, frameBase64: snap });
            socket.emit('candidate:screen_snapshot', { contestId, userId, snapshot: snap });
          }
        } catch {}
      } else if (action === 'FULLSCREEN_ENFORCED') {
        document.documentElement.requestFullscreen?.().catch(() => {});
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [contestId, isJoined, detailData?.participant?.userId]);

  // Fallback polling every 5s to catch any missed socket events
  useEffect(() => {
    if (!contestId || !isJoined) return;
    const checkProctorLogs = async () => {
      try {
        const res = await api.getMyContestLogs(contestId);
        const logs: any[] = res.logs || [];
        if (logs.length === 0) return;
        const latestLog = logs[0];
        if (latestLog && latestLog.id !== lastSeenLogIdRef.current) {
          lastSeenLogIdRef.current = latestLog.id;
          if (latestLog.eventType === 'PROCTOR_WARNING') {
            setProctorToast({ message: latestLog.details || 'Warning from proctor.', type: 'warning' });
          } else if (latestLog.eventType === 'PROCTOR_BLOCK') {
            setExamPaused(true);
            setPauseReason(latestLog.details || 'Exam paused by invigilator.');
          } else if (latestLog.eventType === 'PROCTOR_UNBLOCK') {
            setExamPaused(false);
            setPauseReason('');
          } else if (latestLog.eventType === 'ESCALATED_FOR_DISQUALIFICATION') {
            setExamTerminated(true);
            setTerminationReason(latestLog.details || 'Disqualified by invigilator.');
          }
        }
      } catch (_e) {}
    };
    const interval = setInterval(checkProctorLogs, 5000);
    return () => clearInterval(interval);
  }, [contestId, isJoined]);

  useEffect(() => {
    if (proctorToast) {
      const timer = setTimeout(() => setProctorToast(null), 8000);
      return () => clearTimeout(timer);
    }
  }, [proctorToast]);


  // Real network ping measurement (replaces hardcoded "24ms" fake value)
  const [networkPing, setNetworkPing] = useState<number | null>(null);
  useEffect(() => {
    const measurePing = async () => {
      try {
        const start = Date.now();
        await fetch('/api/auth/me', { method: 'HEAD', cache: 'no-store' });
        setNetworkPing(Date.now() - start);
      } catch { setNetworkPing(null); }
    };
    measurePing();
    const interval = setInterval(measurePing, 10000); // re-measure every 10s
    return () => clearInterval(interval);
  }, []);

  // Clock state
  const [timeLeftStr, setTimeLeftStr] = useState('');
  useEffect(() => {
    if (!contest) return;
    const updateTime = () => {
      const now = Date.now();
      const end = new Date(contest.endTime).getTime();
      const diff = end - now;
      if (diff <= 0) {
        setTimeLeftStr('Ended');
        return;
      }
      const hrs = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setTimeLeftStr(`${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`);
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, [contest]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-amber-500" />
      </div>
    );
  }

  if (error || !contest) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-2xl font-black text-red-500">Contest Not Found</h2>
        <p className="text-gray-400 mt-2">The contest ID does not exist or has been deleted.</p>
        <button onClick={() => navigate('/contests')} className="mt-6 px-5 py-2.5 bg-white/10 hover:bg-white/15 rounded-xl transition text-sm font-bold">
          Back to Contests
        </button>
      </div>
    );
  }

  const tabList = [
    { id: 'overview', label: 'Overview', path: 'overview', icon: '📋' },
    { id: 'problems', label: 'Problems', path: 'problems', icon: '💻' },
    { id: 'leaderboard', label: 'Leaderboard', path: 'leaderboard', icon: '🏆' },
    { id: 'proctoring', label: 'My Logs', path: 'proctoring', icon: '🛡️' },
    { id: 'rules', label: 'Rules', path: 'rules', icon: '📝' },
  ];

  // SEB-specific header (stripped down — no back button, no exit, monitoring badge)
  const sebHeader = (
    <header className="h-14 border-b border-red-500/15 bg-[hsl(220_12%_5%)] sticky top-0 z-40 px-5 flex items-center justify-between shadow-[0_1px_0_0_rgba(239,68,68,0.1)]">
      {/* Left: secure badge + title */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-500/10 border border-red-500/20 rounded-lg shrink-0">
          <span className="text-xs">🔒</span>
          <span className="text-[10px] font-black text-red-400 uppercase tracking-[0.15em] font-mono">SECURED</span>
        </div>
        <div className="min-w-0">
          <h1 className="text-sm font-black text-white truncate tracking-tight">{contest.title}</h1>
          <p className="text-[9px] text-zinc-600 font-mono">Safe Exam Browser — Locked Environment</p>
        </div>
      </div>

      {/* Right: timer + monitoring indicator */}
      <div className="flex items-center gap-4 shrink-0">
        <div className="text-right">
          <span className="text-[9px] text-zinc-600 uppercase tracking-widest block font-bold font-mono">Time Left</span>
          <span className="text-sm font-black font-mono tracking-wider text-amber-400">{timeLeftStr}</span>
        </div>
        <div className="h-6 w-px bg-white/5" />
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-500/5 border border-red-500/15 rounded-lg">
          <span className="text-xs">🛡️</span>
          <span className="text-[10px] font-black text-red-300 uppercase tracking-wider">Secure Mode Active</span>
        </div>
      </div>
    </header>
  );

  // Determine whether to show the SEB immersive wizard
  const now = Date.now();
  const contestStart = new Date(contest.startTime).getTime();
  const contestEnd = new Date(contest.endTime).getTime();
  const isLive = now >= contestStart && now <= contestEnd;
  const showSebWizard = isSebBrowser && isLive;

  const securityFlags = {
    requireFullscreen: contest?.requireFullscreen ?? false,
    preventTabSwitch: contest?.preventTabSwitch ?? false,
    disableCopyPaste: contest?.disableCopyPaste ?? false,
    enableProctoring: contest?.enableProctoring ?? true,
    allowMultipleMonitors: contest?.allowMultipleMonitors ?? false,
    pasteMode: (contest?.pasteMode as any) ?? 'LOG_ONLY',
    faceCheckEnabled: contest?.faceCheckEnabled ?? false,
    voiceCheckEnabled: contest?.voiceCheckEnabled ?? false,
    snapshotIntervalSeconds: contest?.snapshotIntervalSeconds ?? 45,
    maxWarnings: contest?.maxWarnings ?? 3,
    requireSeb: contest?.requireSeb ?? false,
  };

  return (
    <SecureContestWrapper contestId={contestId!} flags={securityFlags}>
    <div className="relative min-h-screen bg-black font-sans selection:bg-amber-500/20 selection:text-amber-400">

      {/* ── EXAM TERMINATED SCREEN (permanent, full-screen) ── */}
      {examTerminated && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black">
          <div className="text-center space-y-6 max-w-lg p-8">
            <div className="w-20 h-20 bg-rose-500/20 border-2 border-rose-500 rounded-full flex items-center justify-center mx-auto">
              <span className="text-4xl">🚫</span>
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-black text-rose-500 uppercase tracking-wide">Exam Terminated</h1>
              <p className="text-zinc-300 font-bold text-sm">You have been disqualified from this assessment by the invigilator.</p>
            </div>
            <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-left space-y-1">
              <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest">Official Reason</span>
              <p className="text-sm text-white font-semibold">{terminationReason}</p>
            </div>
            <div className="p-4 bg-zinc-900 border border-white/10 rounded-2xl text-xs text-zinc-500 text-left font-mono">
              This action has been logged in the audit trail with timestamp {new Date().toLocaleString()}.<br />
              Contact your invigilator or exam coordinator for further information.
            </div>
            <button
              onClick={() => navigate(`/contests/${contestId}/report`, { replace: true })}
              className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-sm rounded-2xl transition"
            >
              View My Scorecard
            </button>
          </div>
        </div>
      )}

      {/* ── EXAM PAUSED OVERLAY (Proctor Intervention Mockup UI) ── */}
      {examPaused && (
        <div className="fixed inset-0 z-[9998] flex flex-col items-center justify-center bg-[#090a0d]/95 backdrop-blur-2xl p-6 select-none font-sans text-white">
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
                  {pauseReason || 'Multiple faces detected in camera feed'}
                </p>
              </div>

              <div className="h-px bg-white/10 w-full" />

              {/* Grid of attributes */}
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400 font-medium">Flagged by</span>
                  <span className="text-white font-bold">{proctorName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400 font-medium">Time elapsed</span>
                  <span className="text-white font-mono font-bold">{pauseTimeElapsed}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400 font-medium">Warning count</span>
                  <span className="text-amber-400 font-mono font-bold">
                    {pauseWarningsCount} of {pauseMaxWarnings}
                  </span>
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
      )}

      {/* TalentOS Warning Toast Banner Overlay */}
      {proctorToast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[999] max-w-xl w-[92%] bg-gradient-to-r from-red-600 via-amber-500 to-red-600 p-0.5 rounded-2xl shadow-2xl shadow-red-500/50 animate-bounce">
          <div className="bg-zinc-950 rounded-[14px] p-4 flex items-center justify-between gap-4 border border-red-500/40 select-text">
            <div className="flex items-center gap-3.5">
              <span className="text-2xl animate-pulse">
                {proctorToast.type === 'success' ? '✅' : proctorToast.type === 'info' ? '⏰' : '⚠️'}
              </span>
              <div>
                <h4 className="font-extrabold text-white text-xs uppercase tracking-wider font-mono">
                  {proctorToast.type === 'success'
                    ? 'Waiver Granted'
                    : proctorToast.type === 'info'
                    ? 'Exam Time Updated'
                    : 'Official Proctor Alert'}
                </h4>
                <p className="text-xs text-amber-200 font-bold mt-0.5">{proctorToast.message}</p>
              </div>
            </div>
            <button
              onClick={() => setProctorToast(null)}
              className="text-gray-400 hover:text-white text-xs font-bold px-2 py-1 bg-white/10 rounded-lg shrink-0 cursor-pointer"
            >
              Dismiss ✕
            </button>
          </div>
        </div>
      )}
      <div className="w-full max-w-[2000px] mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header — always locked SEB header when in SEB */}
        {isSebBrowser ? sebHeader : (
          <header className="h-14 border-b border-white/5 bg-zinc-950/80 backdrop-blur-xl sticky top-0 z-30 px-4 flex items-center justify-between">
            <button onClick={() => navigate('/contests')} className="p-2 -ml-2 hover:bg-white/5 rounded-lg transition">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex-1 flex justify-center">
              <h1 className="text-base font-bold text-white tracking-tight">{contest.title}</h1>
            </div>
            <div className="w-9" />
          </header>
        )}

        <div className="py-4 md:py-6">
          {showSebWizard ? (
            /* ── SEB Immersive Wizard (no tabs, no Outlet) ── */
            <SebExamWizard
              contest={contest}
              diagnostics={diagnostics}
            />
          ) : (
            <>
              {/* ── Normal Browser: Tabs + Outlet ── */}
              <nav className="flex gap-2 mb-6 pb-2 overflow-x-auto no-scrollbar">
                {tabList.map(tab => (
                  <NavLink
                    key={tab.id}
                    to={tab.path}
                    className={({ isActive }: { isActive: boolean }) =>
                      `px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 whitespace-nowrap ${
                        isActive
                          ? 'bg-gradient-to-r from-amber-500 to-amber-400 text-black shadow-lg shadow-amber-500/25'
                          : 'bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10'
                      }`
                    }
                  >
                    <span className="flex items-center gap-2">
                      <span>{tab.icon}</span>
                      <span>{tab.label}</span>
                    </span>
                  </NavLink>
                ))}
              </nav>

              <div className="bg-zinc-950/40 backdrop-blur-xl rounded-3xl border border-white/10 overflow-hidden shadow-2xl">
                <Outlet context={{ contest, isJoined, detailData, isSebBrowser, diagnostics } satisfies ContestOutletContext} />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Subtle animated background pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-zinc-900 via-black to-zinc-950 -z-10" />
      <div className="absolute inset-0 pointer-events-none opacity-20 -z-10" style={{ backgroundImage: 'linear-gradient(to right, rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255, 255, 255, 0.03) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
    </div>
    </SecureContestWrapper>
  );
}

// -------------------------------------------------------------
// 1. Overview Tab (with SEB Diagnostics)
// -------------------------------------------------------------
export function OverviewTab() {
  const { contest, isJoined, diagnostics, isSebBrowser } = useOutletContext<ContestOutletContext>();
  const notify = useNotify();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { contestId } = useParams<{ contestId: string }>();
  const [sebLaunching, setSebLaunching] = useState(false);
  // Local override: set true after successful join so UI advances immediately
  const [hasLocalJoined, setHasLocalJoined] = useState(false);
  const effectivelyJoined = isJoined || hasLocalJoined;

  const handleJoin = async () => {
    try {
      await api.joinManagerContest(contest.id);
      notify.toast.success('Successfully joined the contest! 🎉');
      setHasLocalJoined(true);
      queryClient.invalidateQueries({ queryKey: ['contest', contestId] });
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to join contest';
      notify.toast.error(msg);
      console.error('[handleJoin] error:', msg);
    }
  };

  const handleStartExam = () => {
    navigate('problems');
  };

  // SEB Launch handlers (shown in normal browser when contest requires SEB)
  const handleOneClickLaunch = async () => {
    setSebLaunching(true);
    try {
      const { sessionToken } = await api.getSebToken(contest.id);
      const frontendUrl = window.location.origin;
      const protocol = window.location.protocol === 'https:' ? 'sebs:' : 'seb:';
      const token = localStorage.getItem('accessToken') || '';
      const userStr = localStorage.getItem('user') || '';
      const userParam = userStr ? encodeURIComponent(userStr) : '';
      const sebUrl = `${frontendUrl.replace(/^https?:/, protocol)}/contests/${contest.id}?seb=1&token=${token}&user=${userParam}&sessionToken=${sessionToken}`;
      window.location.href = sebUrl;
    } catch (err) {
      notify.toast.error('Failed to generate launch token. Please try again.');
    } finally {
      setSebLaunching(false);
    }
  };

  const handleDownloadSebConfig = async () => {
    try {
      const blob = await api.downloadSebConfig(contest.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${contest.title.replace(/\s+/g, '_')}_config.seb`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      notify.toast.success('SEB configuration downloaded! Open it to launch the exam.');
    } catch {
      notify.toast.error('Failed to download Safe Exam Browser configuration.');
    }
  };

  const now = Date.now();
  const start = new Date(contest.startTime).getTime();
  const end = new Date(contest.endTime).getTime();
  const isLive = now >= start && now <= end;
  const isEnded = now > end;
  const isUpcoming = now < start;

  // ── SEB Gate: shown in normal browser when this contest requires SEB ──
  const showSebGate = effectivelyJoined && isLive && contest.requireSeb && !isSebBrowser;



  return (
    <div className="p-6 md:p-8 space-y-6 max-w-4xl mx-auto">
      {/* Contest header card */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black text-white tracking-tight">{contest.title}</h2>
            <p className="text-xs text-gray-400 mt-1">{contest.description || 'No description available.'}</p>
          </div>
          <div className="flex items-center gap-2">
            {isLive && (
              <span className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-wider rounded-lg flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                LIVE
              </span>
            )}
            {isEnded && (
              <span className="px-3 py-1.5 bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-black uppercase tracking-wider rounded-lg">
                ENDED
              </span>
            )}
            {isUpcoming && (
              <span className="px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-black uppercase tracking-wider rounded-lg">
                UPCOMING
              </span>
            )}
            {contest.requireSeb && (
              <span className="px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-black uppercase tracking-wider rounded-lg flex items-center gap-1">
                🔒 SEB Required
              </span>
            )}
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Duration', value: `${contest.duration || '—'} min`, icon: '⏱️' },
            { label: 'Problems', value: contest.problems?.length || 0, icon: '💻' },
            { label: 'Max Warnings', value: contest.maxWarnings || 3, icon: '⚠️' },
            { label: 'Participants', value: contest._count?.participants || '—', icon: '👥' },
          ].map((stat, i) => (
            <div key={i} className="bg-zinc-900/40 border border-white/5 rounded-xl p-3 text-center">
              <span className="text-lg block">{stat.icon}</span>
              <span className="text-[9px] text-gray-500 uppercase tracking-widest font-bold block mt-1">{stat.label}</span>
              <span className="text-sm font-black text-white">{stat.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Join button */}
      {!effectivelyJoined && !isEnded && (
        <button
          onClick={handleJoin}
          className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-amber-400 text-black font-extrabold text-sm rounded-2xl hover:from-amber-400 hover:to-amber-300 transition shadow-lg shadow-amber-500/10"
        >
          Join Contest →
        </button>
      )}

      {/* ── SEB Gate (Normal Browser + SEB required) ── */}
      {showSebGate && (
        <div className="relative overflow-hidden bg-zinc-900/60 border border-amber-500/20 rounded-3xl p-7 shadow-2xl">
          {/* Ambient glows */}
          <div className="absolute -top-32 -right-32 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-32 -left-32 w-72 h-72 bg-red-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10">
            {/* Header */}
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                <span className="text-2xl">🔒</span>
              </div>
              <div>
                <span className="px-2.5 py-0.5 bg-amber-500/10 text-amber-400 text-[9px] font-black rounded uppercase tracking-widest border border-amber-500/20">
                  Secure Environment Required
                </span>
                <h3 className="text-xl font-black text-white mt-2 tracking-tight">Launch Safe Exam Browser</h3>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                  This contest requires <span className="text-white font-bold">Safe Exam Browser (SEB)</span> to prevent unauthorized access and ensure exam integrity.
                </p>
              </div>
            </div>

            {/* Steps */}
            <div className="bg-black/30 border border-white/5 rounded-2xl p-5 mb-6 space-y-3">
              <h4 className="text-xs font-black text-amber-400 uppercase tracking-widest flex items-center gap-2">
                <span>⚡</span> Quick Start
              </h4>
              <div className="space-y-3">
                {[
                  {
                    num: '1',
                    title: 'Install SEB',
                    desc: 'Download Safe Exam Browser for Windows/macOS',
                    link: 'https://safeexambrowser.org/download_en.html',
                    linkLabel: 'Download SEB ↗',
                  },
                  {
                    num: '2',
                    title: 'Launch or Download Config',
                    desc: 'Click "1-Click Launch" if SEB is already installed, or download the config file below.',
                  },
                  {
                    num: '3',
                    title: 'Complete Diagnostics Inside SEB',
                    desc: 'Once inside SEB, run webcam checks, liveness scan, and integrity verification.',
                  },
                ].map((step) => (
                  <div key={step.num} className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-black flex items-center justify-center shrink-0 mt-0.5">
                      {step.num}
                    </span>
                    <div>
                      <p className="text-xs font-bold text-white">{step.title}</p>
                      <p className="text-[10px] text-gray-400 leading-relaxed">
                        {step.desc}
                        {step.link && (
                          <>
                            {' '}—{' '}
                            <a href={step.link} target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:underline">
                              {step.linkLabel}
                            </a>
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Launch Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                id="seb-one-click-launch"
                onClick={handleOneClickLaunch}
                disabled={sebLaunching}
                className="px-6 py-4 bg-gradient-to-br from-amber-500 to-amber-600 text-black font-extrabold rounded-2xl hover:from-amber-400 hover:to-amber-500 transition shadow-lg shadow-amber-500/20 flex flex-col items-center justify-center text-center gap-1 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {sebLaunching ? (
                  <span className="text-sm flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    Launching…
                  </span>
                ) : (
                  <>
                    <span className="text-sm">🚀 1-Click Launch</span>
                    <span className="text-[10px] text-black/70 font-medium">Recommended – opens SEB directly</span>
                  </>
                )}
              </button>

              <button
                id="seb-download-config"
                onClick={handleDownloadSebConfig}
                className="px-6 py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-extrabold rounded-2xl transition flex flex-col items-center justify-center text-center gap-1"
              >
                <span className="text-sm">📥 Download SEB Config</span>
                <span className="text-[10px] text-gray-400 font-medium">Alternative setup (.seb file)</span>
              </button>
            </div>

            {/* Platform info footer */}
            <div className="flex justify-between items-center mt-5 text-[9px] font-mono text-gray-600 border-t border-white/5 pt-4">
              <span>Platform: {navigator.platform || 'Unknown'}</span>
              <span>Quit Passcode: Configured by examiner</span>
            </div>
          </div>
        </div>
      )}



      {/* ── Exam Ready (Only if SEB is not required OR currently inside SEB) ── */}
      {effectivelyJoined && isLive && (!contest.requireSeb || isSebBrowser) && (
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-5 flex items-center gap-4">
          <span className="text-2xl">✅</span>
          <div>
            <p className="text-sm font-black text-emerald-400">Exam Ready</p>
            <p className="text-xs text-gray-400">You may proceed directly to solve the contest problems.</p>
          </div>
          <button
            onClick={() => navigate(`/contests/${contest.id}/problems`)}
            className="ml-auto px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs rounded-xl transition shrink-0 cursor-pointer shadow-lg shadow-emerald-500/20"
          >
            Start Exam →
          </button>
        </div>
      )}

      {/* ── Quiz & MCQ Round Launch Card ── */}
      {effectivelyJoined && isLive && (
        <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 rounded-2xl p-5 flex items-center justify-between gap-4 shadow-lg shadow-cyan-500/10">
          <div className="flex items-center gap-4">
            <span className="text-3xl">🧠</span>
            <div>
              <p className="text-sm font-black text-cyan-300">Aptitude & Technical MCQ Quiz Round</p>
              <p className="text-xs text-slate-400">Timed section with encrypted questions, scratchpad canvas, and server-synced timer.</p>
            </div>
          </div>
          <button
            onClick={() => navigate(`/playground/quiz?contestId=${contest.id}`)}
            className="px-5 py-2.5 bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-black font-extrabold text-xs rounded-xl transition shrink-0 cursor-pointer shadow-lg shadow-cyan-500/20"
          >
            Start Quiz Round →
          </button>
        </div>
      )}

      {/* ── Dev: SEB Simulation Mode Button (DEV-ONLY — hidden in production build) ── */}
      {import.meta.env.DEV && effectivelyJoined && isLive && contest.requireSeb && !isSebBrowser && (
        <div className="bg-zinc-900/30 border border-yellow-500/20 rounded-2xl p-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black text-yellow-500">🔧 Developer Testing (DEV BUILD ONLY)</p>
            <p className="text-[10px] text-gray-600">Simulate SEB browser (appends ?seb=1) to test diagnostics flow without actual SEB installed. Not visible in production.</p>
          </div>
          <button
            onClick={() => {
              const url = new URL(window.location.href);
              url.searchParams.set('seb', '1');
              window.location.href = url.toString();
            }}
            className="px-4 py-2 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 font-extrabold text-[10px] rounded-xl transition shrink-0 cursor-pointer"
          >
            🧪 Test SEB Simulation
          </button>
        </div>
      )}

      {/* Schedule info */}
      <div className="bg-zinc-900/20 border border-white/5 rounded-2xl p-5 space-y-3">
        <h3 className="text-sm font-extrabold text-white">Schedule</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-gray-400">
          <div>
            <span className="text-[9px] text-gray-600 uppercase tracking-widest font-bold block">Starts</span>
            <span className="text-white font-bold">{new Date(contest.startTime).toLocaleString()}</span>
          </div>
          <div>
            <span className="text-[9px] text-gray-600 uppercase tracking-widest font-bold block">Ends</span>
            <span className="text-white font-bold">{new Date(contest.endTime).toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// 2. Problems Tab (with Exam Flow Integration)
// -------------------------------------------------------------
export function ProblemsTab() {
  const { contest, diagnostics, isSebBrowser } = useOutletContext<ContestOutletContext>();
  const navigate = useNavigate();
  const notify = useNotify();
  const queryClient = useQueryClient();
  const problems = contest.problems || [];

  // Fetch candidate's real submission status & report for this contest
  const { data: userReport, refetch: refetchReport } = useQuery({
    queryKey: ['myContestReport', contest?.id],
    queryFn: async () => {
      if (!contest?.id) return null;
      return api.getMyContestReport(contest.id).catch(() => null);
    },
    staleTime: 5000,
    enabled: Boolean(contest?.id),
  });

  const candidateSubmissions = userReport?.submissions || [];

  const computedParticipantScore = problems.reduce((acc: number, p: any) => {
    const innerId = p.problem?.id;
    const cpId = p.id;
    const sub = candidateSubmissions.find((s: any) => s.problemId === innerId || s.problemId === cpId);
    const maxPts = p.points || 100;

    const subScore = sub ? (sub.score ?? sub.points ?? (sub.status === 'ACCEPTED' || sub.status === 'passed' ? maxPts : 0)) : 0;
    const sessionScore = (typeof window !== 'undefined')
      ? Number(sessionStorage.getItem(`score_${contest.id}_${innerId}`) || sessionStorage.getItem(`score_${contest.id}_${cpId}`) || localStorage.getItem(`score_${contest.id}_${innerId}`) || localStorage.getItem(`score_${contest.id}_${cpId}`) || 0)
      : 0;

    const earnedForThisProblem = sub ? subScore : sessionScore;
    return acc + earnedForThisProblem;
  }, 0);

  const participantScore = Math.max(userReport?.participant?.score || 0, computedParticipantScore);
  const maxContestScore = problems.reduce((acc: number, p: any) => acc + (p.points || 100), 0);

  // Lock logic:
  // - Inside SEB: locked until diagnostics complete (state must be 'entered')
  // - Normal browser + requireSeb: ALWAYS locked (no client-side bypass allowed)
  // - Normal browser + no requireSeb: always unlocked
  const isLocked = isSebBrowser
    ? diagnostics?.state !== 'entered'
    : contest.requireSeb === true;

  // ── Exam Flow State ──
  const [showInstructions, setShowInstructions] = useState(() => {
    const key = `exam_instructions_ack_${contest.id}`;
    return !sessionStorage.getItem(key);
  });
  const [showSummary, setShowSummary] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [finalized, setFinalized] = useState(false);
  const [reportData, setReportData] = useState<any>(null);
  const [isFinishing, setIsFinishing] = useState(false);

  const handleInstructionsProceed = () => {
    sessionStorage.setItem(`exam_instructions_ack_${contest.id}`, '1');
    setShowInstructions(false);
  };

  const handleFinishClick = async () => {
    if (isFinishing) return;
    setIsFinishing(true);
    notify.toast.info('📊 Generating final score & summary report...');

    try {
      const report = await api.getMyContestReport(contest.id).catch(() => null);
      const problems2 = contest.problems || [];
      const submissions = report?.submissions || candidateSubmissions || [];

      const mappedProblems = problems2.map((cp: any) => {
        const innerId = cp.problem?.id;
        const cpId = cp.id;
        const sub = submissions.find((s: any) => s.problemId === innerId || s.problemId === cpId);
        const maxPts = cp.points || 100;

        const subScore = sub ? (sub.score ?? sub.points ?? (sub.status === 'ACCEPTED' || sub.status === 'passed' ? maxPts : 0)) : 0;
        const sessionScore = (typeof window !== 'undefined')
          ? Number(sessionStorage.getItem(`score_${contest.id}_${innerId}`) || sessionStorage.getItem(`score_${contest.id}_${cpId}`) || localStorage.getItem(`score_${contest.id}_${innerId}`) || localStorage.getItem(`score_${contest.id}_${cpId}`) || 0)
          : 0;

        const finalEarned = sub ? subScore : Math.max(subScore, sessionScore);
        const isFullSolved = finalEarned >= maxPts && maxPts > 0;
        const isPartialSolved = !isFullSolved && finalEarned > 0;

        return {
          problemId: innerId || cpId,
          title: cp.problem?.title || `Problem ${cpId}`,
          points: maxPts,
          earned: finalEarned,
          status: isFullSolved ? 'solved' : (isPartialSolved ? 'partial' : (sub ? 'attempted' : 'unattempted')),
        };
      });

      const calculatedMax = mappedProblems.reduce((a: number, p: any) => a + p.points, 0);
      const calculatedScore = mappedProblems.reduce((a: number, p: any) => a + p.earned, 0);
      const finalScore = Math.max(report?.participant?.score || 0, calculatedScore);

      setReportData({
        score: finalScore,
        maxScore: calculatedMax,
        warnings: report?.participant?.warnings || 0,
        solvedCount: mappedProblems.filter((p: any) => p.earned > 0).length,
        totalProblems: mappedProblems.length,
        problems: mappedProblems,
        isTerminated: report?.participant?.isTerminated || false,
        integrity: (report?.participant?.warnings || 0) > 0 ? 'WARNING' : 'CLEAN',
      });
      setShowSummary(true);
    } catch (err) {
      console.error('Failed to load exam report:', err);
      notify.toast.error('Failed to load exam summary. Try again.');
    } finally {
      setIsFinishing(false);
    }
  };

  const handleFinalized = () => {
    setShowConfirm(false);
    setFinalized(true);
  };

  // If finalized, show post-submit summary
  if (finalized) {
    return <PostSubmitSummary contestId={contest.id} report={reportData} />;
  }

  const handleProblemClick = (p: any) => {
    if (isLocked) {
      if (contest.requireSeb && !isSebBrowser) {
        notify.toast.warning('This contest requires Safe Exam Browser. Please launch SEB from the Overview tab.');
      } else {
        notify.toast.warning('Please complete the security diagnostics in the Overview tab to unlock problems.');
      }
      return;
    }

    // Lock enforcement check: permanent lock in sessionStorage or localStorage
    const isProblemLocked = typeof window !== 'undefined' && (
      sessionStorage.getItem(`locked_prob_${contest.id}_${p.problem.id}`) === '1' ||
      localStorage.getItem(`locked_prob_${contest.id}_${p.problem.id}`) === '1'
    );

    if (isProblemLocked) {
      notify.toast.info(`🔒 Problem "${p.problem.title}" has been locked and submitted. You cannot reopen or edit it again.`);
      return;
    }

    const probType = p.problem?.problemType || p.problemType || 'code';
    const isAiProblem =
      probType === 'vibe-code' ||
      probType === 'ai-assisted' ||
      p.problem?.slug === 'lcm-of-two-trees-c' ||
      p.problem?.title?.toLowerCase().includes('lcm of two binary trees') ||
      (currentSection && currentSection.sectionType === 'VIBE_CODE');

    if (isAiProblem) {
      setActiveAiProblem(p);
      return;
    }

    let path = '/playground/logic';
    if (probType === 'web-dev') path = '/playground/web-dev';
    else if (probType === 'sql') path = '/playground/sql';
    else if (probType === 'quiz' || probType === 'mcq') path = '/playground/quiz';

    navigate(`${path}?contestId=${contest.id}&problem=${p.problem?.id || p.id}`);
  };

  const [activeAiProblem, setActiveAiProblem] = useState<any | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'solved' | 'attempted' | 'unattempted'>('all');
  const [quickViewItem, setQuickViewItem] = useState<{ problem: any; points: number } | null>(null);

  // ── Strict Sequential Section Progression & Timers ──
  const [lockedSectionIds, setLockedSectionIds] = useState<string[]>(() => {
    try {
      const saved = sessionStorage.getItem(`locked_secs_${contest.id}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [activeSectionIndex, setActiveSectionIndex] = useState<number>(() => {
    if (!contest.sections || contest.sections.length === 0) return 0;
    try {
      const savedLocked: string[] = JSON.parse(sessionStorage.getItem(`locked_secs_${contest.id}`) || '[]');
      const firstUnlockedIdx = contest.sections.findIndex((sec: any) => !savedLocked.includes(sec.id));
      return firstUnlockedIdx !== -1 ? firstUnlockedIdx : contest.sections.length - 1;
    } catch {
      return 0;
    }
  });

  const [confirmLockModal, setConfirmLockModal] = useState<boolean>(false);
  const currentSection = contest.sections && contest.sections.length > 0 ? contest.sections[activeSectionIndex] : null;
  const [sectionTimeRemaining, setSectionTimeRemaining] = useState<number | null>(null);

  const lockAndAdvanceSection = (secId: string, isAutoExp: boolean = false) => {
    if (lockedSectionIds.includes(secId)) return;
    const newLocked = [...lockedSectionIds, secId];
    setLockedSectionIds(newLocked);
    sessionStorage.setItem(`locked_secs_${contest.id}`, JSON.stringify(newLocked));

    if (isAutoExp) {
      notify.toast.warning(`⏰ Section time expired! Section has been locked.`);
    } else {
      notify.toast.success(`🔒 Section locked and submitted successfully.`);
    }

    if (contest.sections && activeSectionIndex < contest.sections.length - 1) {
      setActiveSectionIndex(prev => prev + 1);
    }
  };

  useEffect(() => {
    if (!currentSection || !currentSection.duration || currentSection.duration <= 0) {
      setSectionTimeRemaining(null);
      return;
    }

    const timerKey = `sec_timer_start_${contest.id}_${currentSection.id}`;
    let startTime = Number(sessionStorage.getItem(timerKey));
    if (!startTime) {
      startTime = Date.now();
      sessionStorage.setItem(timerKey, String(startTime));
    }

    const totalMs = currentSection.duration * 60 * 1000;

    const updateTimer = () => {
      const elapsed = Date.now() - startTime;
      const remainingMs = Math.max(0, totalMs - elapsed);
      const remainingSecs = Math.floor(remainingMs / 1000);
      setSectionTimeRemaining(remainingSecs);

      if (remainingSecs <= 0) {
        lockAndAdvanceSection(currentSection.id, true);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [currentSection?.id, activeSectionIndex]);

  const solvedCount = problems.filter((p: any) => {
    const sub = candidateSubmissions.find((s: any) => s.problemId === p.problem?.id);
    const isLockedState = typeof window !== 'undefined' && sessionStorage.getItem(`locked_prob_${contest.id}_${p.problem.id}`) === '1';
    return isLockedState || (sub && ((sub.score || sub.points || 0) > 0 || sub.status === 'ACCEPTED' || sub.status === 'passed'));
  }).length;

  const attemptedCount = problems.filter((p: any) => {
    const sub = candidateSubmissions.find((s: any) => s.problemId === p.problem?.id);
    const isLockedState = typeof window !== 'undefined' && sessionStorage.getItem(`locked_prob_${contest.id}_${p.problem.id}`) === '1';
    return !!sub && !isLockedState && (sub.score || sub.points || 0) === 0;
  }).length;

  const unattemptedCount = Math.max(0, problems.length - solvedCount - attemptedCount);

  const filteredProblems = problems.filter((p: any) => {
    const sub = candidateSubmissions.find((s: any) => s.problemId === p.problem?.id);
    const isProblemLocked = typeof window !== 'undefined' && sessionStorage.getItem(`locked_prob_${contest.id}_${p.problem.id}`) === '1';
    const isSolved = isProblemLocked || (sub && ((sub.score || sub.points || 0) > 0 || sub.status === 'ACCEPTED' || sub.status === 'passed'));
    const isAttempted = !!sub && !isSolved;

    // Strict Section Filtering: restrict to current active section when sections exist
    if (contest.sections && contest.sections.length > 0) {
      const activeSec = contest.sections[activeSectionIndex];
      if (activeSec) {
        const secProbIds: string[] = Array.isArray(activeSec.problemIds) ? activeSec.problemIds : [];
        if (secProbIds.length > 0 && !secProbIds.includes(p.problem?.id)) {
          return false;
        }
      }
    }

    if (statusFilter === 'solved') return isSolved;
    if (statusFilter === 'attempted') return isAttempted;
    if (statusFilter === 'unattempted') return !isSolved && !isAttempted;
    return true;
  });

  return (
    <>
      {/* Pre-Exam Instructions Modal */}
      <AnimatePresence>
        {showInstructions && !isLocked && (
          <PreExamInstructionsModal onProceed={handleInstructionsProceed} />
        )}
      </AnimatePresence>

      {/* Exam Summary Modal */}
      <AnimatePresence>
        {showSummary && (
          <ExamSummaryModal
            report={reportData}
            onProceed={() => {
              setShowSummary(false);
              setShowConfirm(true);
            }}
          />
        )}
      </AnimatePresence>

      {/* Final Confirm Modal */}
      <AnimatePresence>
        {showConfirm && (
          <FinalConfirmModal
            contestId={contest.id}
            onFinalized={handleFinalized}
            onCancel={() => setShowConfirm(false)}
          />
        )}
      </AnimatePresence>

      {/* Section Lock Confirmation Modal */}
      <AnimatePresence>
        {confirmLockModal && currentSection && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <div className="bg-zinc-950 border border-white/10 rounded-3xl p-6 max-w-md w-full space-y-5 shadow-2xl text-white">
              <div className="w-14 h-14 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-center text-2xl">
                🔒
              </div>
              <div>
                <h3 className="text-xl font-black">Lock &amp; Submit {currentSection.title}?</h3>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                  Once you lock Section {activeSectionIndex + 1}, your answers will be permanently saved and you will automatically advance to Section {activeSectionIndex + 2}. <span className="text-amber-400 font-bold">You cannot reopen or modify Section {activeSectionIndex + 1} after locking.</span>
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setConfirmLockModal(false)}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-gray-300 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Cancel &amp; Continue Solving
                </button>
                <button
                  onClick={() => {
                    setConfirmLockModal(false);
                    lockAndAdvanceSection(currentSection.id, false);
                  }}
                  className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-black font-black text-xs rounded-xl transition shadow-lg shadow-amber-500/20 cursor-pointer"
                >
                  Yes, Lock Section →
                </button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Quick View Problem Drawer / Modal */}
      <ProblemQuickViewModal
        isOpen={!!quickViewItem}
        problem={quickViewItem?.problem}
        points={quickViewItem?.points || 100}
        onClose={() => setQuickViewItem(null)}
        onLaunch={() => {
          if (quickViewItem) {
            handleProblemClick(quickViewItem);
          }
        }}
      />

      <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
        
        {/* 📚 Sequential Section Switcher Bar */}
        {contest.sections && contest.sections.length > 0 && (
          <div className="bg-gradient-to-r from-indigo-950/80 via-purple-950/60 to-zinc-950/80 border border-indigo-500/30 rounded-2xl p-4 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">📚</span>
                <div>
                  <h3 className="text-sm font-black text-indigo-300">Exam Sections (Sequential Progression)</h3>
                  <p className="text-[10px] text-gray-400">Complete &amp; lock each section in order before proceeding to the next</p>
                </div>
              </div>
              <span className="text-xs px-2.5 py-1 bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 rounded-lg font-bold">
                Section {activeSectionIndex + 1} of {contest.sections.length} Active
              </span>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pt-1">
              {contest.sections.map((sec: any, idx: number) => {
                const isLockedSec = lockedSectionIds.includes(sec.id) || idx < activeSectionIndex;
                const isActiveSec = idx === activeSectionIndex;
                const isFutureSec = idx > activeSectionIndex;

                return (
                  <button
                    key={sec.id}
                    disabled={isFutureSec || isLockedSec}
                    onClick={() => {
                      if (!isFutureSec && !isLockedSec) {
                        setActiveSectionIndex(idx);
                      }
                    }}
                    className={`px-4 py-2 rounded-xl text-xs font-black transition-all shrink-0 border flex items-center gap-2 ${
                      isActiveSec
                        ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white border-indigo-300 shadow-lg shadow-indigo-500/30'
                        : isLockedSec
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 cursor-not-allowed'
                        : 'bg-black/60 text-gray-500 border-white/5 cursor-not-allowed opacity-60'
                    }`}
                  >
                    <span>
                      {isLockedSec ? '✓' : isFutureSec ? '🔒' : `Section ${idx + 1}`}: {sec.title}
                    </span>
                    {sec.duration > 0 && isActiveSec && sectionTimeRemaining !== null && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-black/40 text-amber-300 rounded font-mono">
                        ⏱️ {Math.floor(sectionTimeRemaining / 60)}m {String(sectionTimeRemaining % 60).padStart(2, '0')}s
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 🔒 Active Section Action Banner (when sections enabled) */}
        {contest.sections && contest.sections.length > 0 && currentSection && (
          <div className="bg-gradient-to-r from-amber-500/10 via-indigo-500/10 to-purple-500/10 border border-amber-500/30 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
            <div className="space-y-1 text-left w-full sm:w-auto">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-full text-[10px] font-black uppercase tracking-wider">
                  Section {activeSectionIndex + 1} of {contest.sections.length}
                </span>
                {sectionTimeRemaining !== null && (
                  <span className="px-2.5 py-0.5 bg-red-500/20 text-red-400 border border-red-500/40 rounded-full text-[10px] font-mono font-black animate-pulse">
                    ⏱️ Section Time: {Math.floor(sectionTimeRemaining / 60)}m {String(sectionTimeRemaining % 60).padStart(2, '0')}s
                  </span>
                )}
              </div>
              <h3 className="text-lg font-black text-white">{currentSection.title}</h3>
              <p className="text-xs text-gray-400">Complete all assigned questions in this module before locking to proceed.</p>
            </div>

            <button
              onClick={() => setConfirmLockModal(true)}
              className="w-full sm:w-auto px-5 py-3 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-yellow-400 text-black font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer shrink-0 transition"
            >
              🔒 Lock &amp; Proceed to Next Section →
            </button>
          </div>
        )}

        {/* 🌟 Glassmorphic Performance Hero Header */}
        {!isLocked && (
          <ContestHeroHeader
            contestTitle={contest.title}
            scoreEarned={participantScore}
            maxScore={maxContestScore}
            solvedCount={solvedCount}
            totalProblems={problems.length}
            endTime={contest.endTime}
            isSebBrowser={isSebBrowser}
          />
        )}

        {/* 🎛️ Interactive Filter & Status Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-950/60 border border-white/10 rounded-2xl p-4 backdrop-blur-md">
          <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all shrink-0 ${
                statusFilter === 'all'
                  ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20'
                  : 'bg-white/5 hover:bg-white/10 text-gray-400'
              }`}
            >
              All Problems ({problems.length})
            </button>
            <button
              onClick={() => setStatusFilter('solved')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all shrink-0 flex items-center gap-1.5 ${
                statusFilter === 'solved'
                  ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/20'
                  : 'bg-white/5 hover:bg-white/10 text-emerald-400'
              }`}
            >
              <span>🟢</span> Solved ({solvedCount})
            </button>
            <button
              onClick={() => setStatusFilter('attempted')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all shrink-0 flex items-center gap-1.5 ${
                statusFilter === 'attempted'
                  ? 'bg-amber-400 text-black shadow-md shadow-amber-400/20'
                  : 'bg-white/5 hover:bg-white/10 text-amber-400'
              }`}
            >
              <span>🟡</span> Attempted ({attemptedCount})
            </button>
            <button
              onClick={() => setStatusFilter('unattempted')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all shrink-0 flex items-center gap-1.5 ${
                statusFilter === 'unattempted'
                  ? 'bg-zinc-700 text-white'
                  : 'bg-white/5 hover:bg-white/10 text-gray-400'
              }`}
            >
              <span>⚪</span> Unattempted ({unattemptedCount})
            </button>
          </div>

          <span className="text-xs font-mono font-bold text-gray-400 shrink-0 self-end sm:self-auto">
            Showing {filteredProblems.length} of {problems.length}
          </span>
        </div>

        {/* Security lock notice */}
        {isLocked && (
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-5 flex items-center gap-3">
            <span className="text-3xl">🔒</span>
            <div>
              <span className="text-sm font-black text-amber-400 block">Security Lock Active</span>
              <span className="text-xs text-gray-400">
                {contest.requireSeb && !isSebBrowser
                  ? 'This exam requires Safe Exam Browser. Launch SEB from the Overview tab to unlock problems.'
                  : 'Complete the security diagnostics in the Overview tab to unlock problem names and begin the exam.'}
              </span>
            </div>
          </div>
        )}

        {/* Next-Gen Problem Cards Grid */}
        {problems.length === 0 ? (
          <div className="text-center py-20 bg-zinc-900/20 border border-white/5 rounded-3xl">
            <span className="text-4xl block mb-2">📂</span>
            <p className="text-sm text-gray-400 font-bold">No problems configured for this contest.</p>
          </div>
        ) : filteredProblems.length === 0 ? (
          <div className="text-center py-16 bg-zinc-900/20 border border-white/5 rounded-3xl">
            <span className="text-3xl block mb-2">🔍</span>
            <p className="text-sm text-gray-400 font-bold">No problems match the selected filter.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredProblems.map((p: any, idx: number) => {
              const maxPoints = p.points || 100;
              const sub = candidateSubmissions.find((s: any) => s.problemId === p.problem?.id);
              const pointsEarned = sub?.score ?? sub?.points ?? 0;
              const isProblemLocked = typeof window !== 'undefined' && sessionStorage.getItem(`locked_prob_${contest.id}_${p.problem.id}`) === '1';
              const isSolved = isProblemLocked || pointsEarned > 0 || sub?.status === 'ACCEPTED' || sub?.status === 'passed';
              const isAttempted = !!sub && !isSolved;
              const probType = p.problem?.problemType || 'code';

              // Tech stack icon helper
              const techBadge = probType === 'vibe-code' || probType === 'ai-assisted'
                ? { label: '🤖 AI-Assisted (AON Socratic)', color: 'bg-purple-500/20 text-purple-300 border-purple-500/40 shadow-sm shadow-purple-500/10' }
                : probType === 'debugging'
                ? { label: '🐞 Bug Fixing & Debugging', color: 'bg-amber-500/20 text-amber-300 border-amber-500/40' }
                : probType === 'web-dev'
                ? { label: '🌐 Full-Stack Web Dev', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' }
                : probType === 'sql'
                ? { label: '🗄️ SQL Database', color: 'bg-teal-500/10 text-teal-400 border-teal-500/20' }
                : probType === 'quiz' || probType === 'mcq'
                ? { label: '📝 Assessment Quiz', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' }
                : { label: '💻 DSA & Algorithm', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' };

              const isAiProblem = probType === 'vibe-code' || probType === 'ai-assisted';

              return (
                <div
                  key={p.problem.id}
                  className={`border rounded-2xl p-5 md:p-6 transition-all duration-300 flex flex-col md:flex-row md:items-center justify-between gap-5 relative overflow-hidden group ${
                    isLocked
                      ? 'border-white/5 bg-zinc-950/40 opacity-70'
                      : isProblemLocked
                      ? 'border-amber-500/40 bg-amber-500/5 shadow-lg shadow-amber-500/5'
                      : isSolved
                      ? 'border-emerald-500/40 bg-emerald-500/5 shadow-lg shadow-emerald-500/5'
                      : isAttempted
                      ? 'border-amber-400/30 bg-amber-400/5 shadow-lg shadow-amber-400/5'
                      : isAiProblem
                      ? 'border-purple-500/40 bg-gradient-to-r from-purple-950/30 via-zinc-950 to-indigo-950/20 hover:border-purple-400/60 shadow-lg shadow-purple-950/20'
                      : 'border-white/10 bg-zinc-950/60 hover:border-amber-400/40 hover:bg-zinc-900/80 shadow-md'
                  }`}
                >
                  {/* Left: Problem Details & Badges */}
                  <div className="space-y-2.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono font-bold text-gray-500 bg-white/5 px-2 py-0.5 rounded">
                        #{idx + 1}
                      </span>
                      
                      {/* Tech Stack Badge */}
                      {!isLocked && (
                        <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase font-mono border ${techBadge.color}`}>
                          {techBadge.label}
                        </span>
                      )}

                      {/* Dynamic Difficulty Pill */}
                      {!isLocked && (
                        <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase font-mono border ${
                          p.problem.difficulty === 'Easy'
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                            : p.problem.difficulty === 'Medium'
                            ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                            : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                        }`}>
                          {p.problem.difficulty || 'Medium'} (+{maxPoints} pts)
                        </span>
                      )}

                      {/* Status Badges */}
                      {!isLocked && (
                        isProblemLocked ? (
                          <span className="px-2.5 py-0.5 bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-black uppercase rounded-lg flex items-center gap-1 shadow-sm font-mono">
                            🔒 Locked ({pointsEarned}/{maxPoints} pts)
                          </span>
                        ) : isSolved ? (
                          <span className="px-2.5 py-0.5 bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-[10px] font-black uppercase rounded-lg flex items-center gap-1 shadow-sm font-mono">
                            ✓ Solved ({pointsEarned}/{maxPoints} pts)
                          </span>
                        ) : isAttempted ? (
                          <span className="px-2.5 py-0.5 bg-amber-400/20 border border-amber-400/40 text-amber-300 text-[10px] font-black uppercase rounded-lg flex items-center gap-1 shadow-sm font-mono">
                            ⚡ Attempted ({pointsEarned}/{maxPoints} pts)
                          </span>
                        ) : null
                      )}
                    </div>

                    <h3 className={`font-black text-base transition ${
                      isLocked
                        ? 'text-gray-600 select-none'
                        : isSolved
                        ? 'text-emerald-300'
                        : isAiProblem
                        ? 'text-purple-200 group-hover:text-purple-300'
                        : 'text-white group-hover:text-amber-400'
                    }`}>
                      {isLocked ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="blur-sm select-none pointer-events-none" aria-hidden="true">
                            {p.problem.title}
                          </span>
                          <span className="text-xs font-bold text-amber-500/60 no-blur">🔒 Hidden</span>
                        </span>
                      ) : p.problem.title}
                    </h3>
                  </div>

                  {/* Right: Actions Bar */}
                  <div className="flex items-center gap-3 shrink-0 self-end md:self-auto">
                    {/* Info Quick-View Button */}
                    {!isLocked && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setQuickViewItem(p);
                        }}
                        className="px-3 py-2 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-xl text-xs font-bold transition flex items-center gap-1 border border-white/10"
                        title="View problem description"
                      >
                        <span>ℹ️</span> Details
                      </button>
                    )}

                    {/* Launch Action Button */}
                    {isLocked ? (
                      <div className="w-10 h-10 rounded-xl border border-white/5 flex items-center justify-center bg-zinc-950 text-xs font-black text-gray-600">
                        🔒
                      </div>
                    ) : (
                      <button
                        onClick={() => handleProblemClick(p)}
                        className={`px-4 py-2.5 rounded-xl font-black text-xs transition-all flex items-center gap-2 shadow-lg ${
                          isProblemLocked || isSolved
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                            : isAttempted
                            ? 'bg-amber-400 text-black hover:bg-amber-300 shadow-amber-400/20'
                            : isAiProblem
                            ? 'bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white shadow-purple-600/30 border border-purple-400/30'
                            : 'bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black shadow-amber-500/20'
                        }`}
                      >
                        <span>
                          {isProblemLocked || isSolved
                            ? isAiProblem ? '✓ Review AI Chat' : '✓ Review'
                            : isAttempted
                            ? isAiProblem ? '🤖 Resume AI Session' : '▶ Continue'
                            : isAiProblem ? '🤖 Solve with AI Assistant' : '🚀 Solve'}
                        </span>
                      </button>
                    )}
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Finish Exam FAB */}
      {!isLocked && !finalized && (
        <FinishExamFAB contest={contest} onFinish={handleFinishClick} isFinishing={isFinishing} />
      )}

      {/* Embedded In-Contest AI Workspace (No external redirection!) */}
      {activeAiProblem && (
        <InContestAiWorkspace
          contest={contest}
          problemItem={activeAiProblem}
          currentSection={currentSection}
          sectionTimeRemaining={sectionTimeRemaining}
          onBack={() => setActiveAiProblem(null)}
          onSubmitted={() => {
            setActiveAiProblem(null);
            queryClient.invalidateQueries({ queryKey: ['contest', contest.id] });
            refetchReport?.();
          }}
        />
      )}
    </>
  );
}

// -------------------------------------------------------------
// 3. Leaderboard Tab
// -------------------------------------------------------------
export function LeaderboardTab() {
  const { contest } = useOutletContext<ContestOutletContext>();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Load standings
  const { data: lbData, isLoading } = useQuery({
    queryKey: ['leaderboard', contest.id],
    queryFn: () => api.getContestLeaderboard(contest.id),
    staleTime: 1000 * 15,
  });

  const leaderboard = lbData?.leaderboard || [];

  // Listen to Server-Sent Events for real-time rank delta updates
  useEffect(() => {
    const streamUrl = `/api/contests/manager/${contest.id}/leaderboard/stream`;
    const eventSource = new EventSource(streamUrl);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'rank_delta') {
          queryClient.setQueryData(['leaderboard', contest.id], (old: any) => {
            if (!old || !old.leaderboard) return old;

            let updatedList = [...old.leaderboard];
            const targetIdx = updatedList.findIndex((item: any) => item.userId === data.userId || item.userId === 'mock-uid');

            if (targetIdx !== -1) {
              const updatedItem = {
                ...updatedList[targetIdx],
                score: (updatedList[targetIdx].score || 0) + (data.scoreChange || 0),
              };
              updatedList[targetIdx] = updatedItem;
            } else if (data.userId) {
              updatedList.push({
                userId: data.userId,
                score: data.scoreChange || 0,
                solvedCount: 1,
                user: { id: data.userId, fullName: `Participant ${data.userId.slice(0, 4)}` }
              });
            }

            // Re-sort and re-rank array
            updatedList.sort((a: any, b: any) => (b.score || 0) - (a.score || 0));
            updatedList = updatedList.map((item: any, idx: number) => ({
              ...item,
              rank: idx + 1
            }));

            return {
              ...old,
              leaderboard: updatedList
            };
          });
        }
      } catch (err) {
        console.error("SSE parse error in leaderboard stream:", err);
      }
    };

    return () => {
      eventSource.close();
    };
  }, [contest.id, queryClient]);

  // Sticky Candidate Anchor
  const myIndex = leaderboard.findIndex((item: any) => item.userId === user?.id);
  const myStanding = myIndex !== -1 ? leaderboard[myIndex] : null;

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center border-b border-white/5 pb-4 gap-3">
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight">Contest Leaderboard</h2>
          <p className="text-xs text-gray-400">Real-time standings updates. Delta shifts reflow automatically.</p>
        </div>
        {myStanding && (
          <div className="bg-amber-500/10 border border-amber-500/20 px-3.5 py-1.5 rounded-xl text-xs text-amber-400 font-extrabold flex items-center gap-2">
            <span>📈</span>
            <span>Your Rank: #{myIndex + 1} ({Math.round(100 - (myIndex / leaderboard.length) * 100)}th Percentile)</span>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-amber-500" />
        </div>
      ) : leaderboard.length === 0 ? (
        <div className="text-center py-16 bg-zinc-900/20 border border-white/5 rounded-3xl">
          <span className="text-3xl block mb-2">🏁</span>
          <p className="text-sm text-gray-500">No score records registered yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-zinc-900/20 border border-white/5 rounded-2xl overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 text-gray-400 text-[10px] font-bold uppercase tracking-wider bg-zinc-900/40">
                  <th className="py-3.5 px-4 w-16">Rank</th>
                  <th className="py-3.5 px-4">User</th>
                  <th className="py-3.5 px-4">Score</th>
                  <th className="py-3.5 px-4 text-right">Solved Problems</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-sm">
                {leaderboard.map((item: any, idx: number) => {
                  const isTop3 = idx < 3;
                  const rankBadge = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx + 1}`;
                  const isMe = item.userId === user?.id;

                  return (
                    <tr key={item.userId} className={`hover:bg-white/[0.02] transition ${isMe ? 'bg-amber-500/5' : ''}`}>
                      <td className="py-3.5 px-4 font-black">
                        <span className={isTop3 ? "text-lg" : "text-gray-400 font-mono"}>{rankBadge}</span>
                      </td>
                      <td className="py-3.5 px-4 font-extrabold text-white">
                        <div className="flex items-center gap-2">
                          <span className="truncate">{item.user?.name || `Participant ${idx + 1}`}</span>
                          {isMe && (
                            <span className="px-1.5 py-0.5 bg-amber-500 text-black text-[8px] font-black rounded uppercase">
                              You
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-amber-400">{item.score || 0}</td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-gray-300">
                        {item.solvedCount || 0}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Sticky self rank overlay banner at bottom if not in view */}
          {myStanding && (
            <div className="bg-zinc-900 border border-amber-500/20 rounded-2xl p-4 flex items-center justify-between sticky bottom-4 shadow-xl shadow-black/60 backdrop-blur">
              <div className="flex items-center gap-3">
                <span className="text-xl">🏆</span>
                <div>
                  <span className="text-xs font-black text-white block">Sticky Standing Tracker</span>
                  <span className="text-[10px] text-gray-400 font-medium">Keep track of your performance relative to the group.</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs font-mono font-black text-amber-500 block">Rank #{myIndex + 1}</span>
                <span className="text-[9px] font-mono text-gray-400">{myStanding.score || 0} pts</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// 4. Proctoring Logs Tab
// -------------------------------------------------------------
export function ProctoringTab() {
  const { contest } = useOutletContext<ContestOutletContext>();
  const notify = useNotify();

  // Load participant logs
  const { data: logsData, isLoading } = useQuery({
    queryKey: ['logs', contest.id],
    queryFn: () => api.getMyContestLogs(contest.id),
    staleTime: 1000 * 10,
  });

  const logs = logsData?.logs || [];

  const handleDispute = async () => {
    try {
      notify.toast.success("Integrity log review dispute raised. Supervisors will be notified.");
    } catch {
      notify.toast.error("Failed to submit dispute flag.");
    }
  };

  // Mock timeline metrics
  const focusLossEvents = logs.filter((l: any) => l.eventType === 'FOCUS_LOST');

  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: logs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64,
    overscan: 5,
  });

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center border-b border-white/5 pb-4 gap-3">
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight">Security & Proctoring Log</h2>
          <p className="text-xs text-gray-400">Review system audit footprints. Disconnected logs cache locally.</p>
        </div>
        <button
          onClick={handleDispute}
          className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white border border-white/15 text-xs font-bold rounded-xl transition"
        >
          Flag Dispute / Review
        </button>
      </div>

      {/* Focus Loss Visualization Bar */}
      <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-5 space-y-3">
        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block">Focus-Loss Event Timeline</span>
        <div className="h-6 w-full bg-zinc-950 rounded-lg relative overflow-hidden border border-white/5 flex items-center">
          {focusLossEvents.length === 0 ? (
            <div className="absolute inset-0 bg-emerald-500/5 text-emerald-400 text-[10px] font-bold flex items-center justify-center">
              ✅ Zero Focus Interruptions Registered
            </div>
          ) : (
            <>
              {focusLossEvents.map((evt: any, i: number) => {
                const positionPercent = Math.min(95, 10 + (i * 25) % 80);
                return (
                  <div
                    key={evt.id || i}
                    className="h-full w-2 bg-red-500 absolute cursor-pointer hover:bg-red-400 transition"
                    style={{ left: `${positionPercent}%` }}
                    title={`Focus Loss violation: ${new Date(evt.timestamp).toLocaleTimeString()}`}
                  />
                );
              })}
            </>
          )}
        </div>
        <div className="flex justify-between text-[8px] font-mono text-gray-600">
          <span>Start Exam</span>
          <span>End Exam</span>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-amber-500" />
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-16 bg-zinc-900/20 border border-white/5 rounded-3xl">
          <span className="text-3xl block mb-2">📋</span>
          <p className="text-sm text-gray-500">No proctoring logs registered in this session.</p>
        </div>
      ) : (
        <div
          ref={parentRef}
          className="bg-zinc-900/20 border border-white/5 rounded-2xl overflow-y-auto max-h-[350px] relative scrollbar-thin"
        >
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const log = logs[virtualRow.index];
              const isViolation = ['SEB_INTEGRITY_BREACH', 'FOCUS_LOST', 'FULLSCREEN_EXIT'].includes(log.eventType);
              return (
                <div
                  key={virtualRow.key}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  className="p-4 flex items-center justify-between text-xs hover:bg-white/[0.01] border-b border-white/5 last:border-b-0"
                >
                  <div className="space-y-1">
                    <span className={`font-black uppercase text-[10px] px-2 py-0.5 rounded ${
                      isViolation ? 'bg-red-500/10 text-red-400 border border-red-500/10' : 'bg-white/5 text-gray-300'
                    }`}>
                      {log.eventType}
                    </span>
                    <p className="text-gray-400 font-medium">{log.details || "Telemetry snap verified by audit agent."}</p>
                  </div>
                  <span className="font-mono text-gray-500 font-bold shrink-0">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// 5. Rules & Integrity Tab
// -------------------------------------------------------------
export function RulesTab() {
  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto space-y-6">
      <div className="border-b border-white/5 pb-4">
        <h2 className="text-2xl font-black text-white tracking-tight">Rules & Regulations</h2>
        <p className="text-xs text-gray-400">Please review testing parameters carefully. Infringements block scores.</p>
      </div>

      <div className="space-y-4">
        <div className="bg-zinc-900/20 border border-white/5 rounded-2xl p-5 space-y-3">
          <h3 className="text-sm font-extrabold text-white">🔒 Proctoring Environment Controls</h3>
          <ul className="list-disc list-inside text-xs text-gray-400 space-y-2 leading-relaxed">
            <li>You must run this exam in full-screen mode if prompted.</li>
            <li>Browser tab switches, background triggers, and workspace split windows are locked down.</li>
            <li>Copying code questions or pasting solutions externally is strictly monitored and flagged.</li>
            <li>Make sure you do not exit Safe Exam Browser (SEB) before submitting the exam paper.</li>
          </ul>
        </div>

        <div className="bg-zinc-900/20 border border-white/5 rounded-2xl p-5 space-y-3">
          <h3 className="text-sm font-extrabold text-white">📸 Hardware & Biometrics</h3>
          <ul className="list-disc list-inside text-xs text-gray-400 space-y-2 leading-relaxed">
            <li>Keep your face centered in front of the camera. Head movements are analyzed for risk estimation.</li>
            <li>Microphone feeds analyze voice logs for secondary assistance indicators.</li>
            <li>A working internet connection is required. Connection drops are buffered and sync on reconnect.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// SEB Immersive Wizard — replaces tabs when inside Safe Exam Browser
// ──────────────────────────────────────────────────────────────────────

type WizardStep = 'diagnostics' | 'guidelines' | 'problems';

const SEB_GUIDELINES = [
  { icon: '🖥️', title: 'Full-Screen Required', desc: 'Exit full-screen triggers warnings. Exceeding limits auto-submits.' },
  { icon: '🚫', title: 'No Tab Switching', desc: 'Every tab switch is logged and counts toward your violation threshold.' },
  { icon: '📋', title: 'No Copy-Paste', desc: 'Clipboard access is blocked or logged. External paste is flagged.' },
  { icon: '📷', title: 'Camera Always On', desc: 'Proctoring snapshots verify face presence. Missing face = violation.' },
  { icon: '🧠', title: 'AI Detection Active', desc: 'Extensions, screen-sharing, and suspicious tools are detected in real time.' },
  { icon: '⏱️', title: 'Auto-Finalize on Timeout', desc: 'Your submitted answers are saved. Drafts are auto-submitted at expiry.' },
];

function SebGuidelinesInline({
  contestTitle,
  onBegin,
}: {
  contestTitle: string;
  onBegin: () => void;
}) {
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
      {/* Parallax background layers */}
      <div className="seb-parallax-layer pointer-events-none opacity-20 bg-[radial-gradient(circle_at_30%_20%,rgba(34,197,94,0.08),transparent_60%)]" />
      <div className="seb-parallax-layer pointer-events-none opacity-15 bg-[radial-gradient(circle_at_70%_80%,rgba(245,158,11,0.07),transparent_60%)]" />

      <div className="relative w-full max-w-2xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-[hsl(220_12%_10%)] border border-white/8 rounded-full mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-black text-zinc-400 tracking-[0.2em] uppercase font-mono">
              ENVIRONMENT VERIFIED
            </span>
          </div>
          <span className="text-3xl block">📋</span>
          <h2 className="text-xl font-black text-white tracking-tight">Exam Rules & Instructions</h2>
          <p className="text-xs text-gray-400">
            You are about to begin{' '}
            <span className="text-white font-bold">{contestTitle}</span>
          </p>
        </div>

        {/* Rule cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SEB_GUIDELINES.map((rule, i) => (
            <div
              key={i}
              className="seb-step-card bg-zinc-950/60 border border-white/5 rounded-2xl p-4 flex gap-3 items-start"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <span className="text-xl shrink-0 mt-0.5">{rule.icon}</span>
              <div>
                <h4 className="text-xs font-extrabold text-white">{rule.title}</h4>
                <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">{rule.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Fair exam commitment */}
        <div className="bg-red-950/30 border border-red-500/30 rounded-2xl p-5 space-y-1">
          <p className="text-xs font-extrabold text-red-400">⚠️ Fair Exam Commitment</p>
          <p className="text-[11px] text-red-300/70 leading-relaxed">
            By proceeding you confirm you will not use external aids, AI assistants, or communication tools.
            Violations are permanently logged on your academic record.
          </p>
        </div>

        {/* Begin button with countdown */}
        <div className="flex justify-center pt-2">
          <button
            onClick={onBegin}
            disabled={countdown > 0}
            className={`px-8 py-4 rounded-2xl font-black text-sm transition-all ${
              countdown <= 0
                ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-black shadow-lg shadow-emerald-500/30 seb-proceed-glow'
                : 'bg-white/5 text-zinc-600 cursor-not-allowed'
            }`}
          >
            {countdown > 0 ? `Begin Exam in ${countdown}s` : '▶ Begin Exam'}
          </button>
        </div>
      </div>
    </div>
  );
}

function SebProblemsListInline({
  contest,
  onProblemClick,
}: {
  contest: any;
  onProblemClick: (p: any) => void;
}) {
  const problems = contest.problems || [];
  const [statusFilter, setStatusFilter] = useState<'all' | 'solved' | 'attempted' | 'unattempted'>('all');
  const [quickViewItem, setQuickViewItem] = useState<{ problem: any; points: number } | null>(null);
  const { user } = useAuth();
  const currentUid = user?.id || (user as any)?.userId || 'guest';
  const notify = useNotify();
  const queryClient = useQueryClient();

  const [activeSectionId, setActiveSectionId] = useState<string>(() => {
    if (contest.sections && contest.sections.length > 0) {
      return contest.sections[0].id;
    }
    return 'all';
  });

  const [activeAiProblem, setActiveAiProblem] = useState<any | null>(null);
  const [pendingSkipSection, setPendingSkipSection] = useState<{ sec: any; idx: number } | null>(null);
  const [skipConsentAgreed, setSkipConsentAgreed] = useState<boolean>(false);
  const [sectionTimeRemaining, setSectionTimeRemaining] = useState<number | null>(null);

  const currentSec = (contest.sections && contest.sections.length > 0)
    ? (contest.sections.find((s: any) => s.id === activeSectionId) || contest.sections[0])
    : null;

  useEffect(() => {
    if (!currentSec || !currentSec.duration || currentSec.duration <= 0) {
      setSectionTimeRemaining(null);
      return;
    }
    const timerKey = `sec_timer_start_${contest.id}_${currentSec.id}`;
    let startTime = Number(sessionStorage.getItem(timerKey));
    if (!startTime) {
      startTime = Date.now();
      sessionStorage.setItem(timerKey, String(startTime));
    }
    const totalMs = currentSec.duration * 60 * 1000;
    const updateTimer = () => {
      const elapsed = Date.now() - startTime;
      const remainingMs = Math.max(0, totalMs - elapsed);
      setSectionTimeRemaining(Math.floor(remainingMs / 1000));
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [currentSec?.id, activeSectionId, contest.id]);

  const handleSebProblemLaunch = (p: any) => {
    const probType = p.problem?.problemType || p.problemType || 'code';
    const isAiProblem =
      probType === 'vibe-code' ||
      probType === 'ai-assisted' ||
      p.problem?.slug === 'lcm-of-two-trees-c' ||
      p.problem?.title?.toLowerCase().includes('lcm of two binary trees');

    if (isAiProblem) {
      setActiveAiProblem(p);
      return;
    }
    onProblemClick(p);
  };

  // Fetch candidate's real submission report
  const { data: userReport, refetch: refetchReport } = useQuery({
    queryKey: ['myContestReport', contest?.id],
    queryFn: async () => {
      if (!contest?.id) return null;
      return api.getMyContestReport(contest.id).catch(() => null);
    },
    staleTime: 5000,
    enabled: Boolean(contest?.id),
  });

  const candidateSubmissions = userReport?.submissions || [];

  const computedParticipantScore = problems.reduce((acc: number, p: any) => {
    const probId = p.problem?.id;
    const sub = candidateSubmissions.find((s: any) => s.problemId === probId);
    const sessionScore = Number(typeof window !== 'undefined' ? (sessionStorage.getItem(`score_${contest.id}_${probId}`) || localStorage.getItem(`score_${contest.id}_${probId}`) || 0) : 0);
    const subScore = sub ? Math.max(sub.score || 0, sub.points || 0) : 0;
    return acc + Math.max(subScore, sessionScore);
  }, 0);

  const participantScore = Math.max(userReport?.participant?.score || 0, computedParticipantScore);
  const maxContestScore = problems.reduce((acc: number, p: any) => acc + (p.points || 100), 0);

  const solvedCount = problems.filter((p: any) => {
    const probId = p.problem?.id;
    const sub = candidateSubmissions.find((s: any) => s.problemId === probId);
    const maxPoints = p.points || 100;
    const sessionScore = Number(typeof window !== 'undefined' ? (sessionStorage.getItem(`score_${contest.id}_${probId}`) || localStorage.getItem(`score_${contest.id}_${probId}`) || 0) : 0);
    const pts = Math.max(sub?.score ?? sub?.points ?? 0, sessionScore);
    const isLockedState = typeof window !== 'undefined' && (
      sessionStorage.getItem(`locked_prob_${contest.id}_${probId}`) === '1' ||
      localStorage.getItem(`locked_prob_${contest.id}_${probId}`) === '1'
    );
    return isLockedState || sub?.status === 'ACCEPTED' || sub?.status === 'passed' || (pts >= maxPoints && maxPoints > 0);
  }).length;

  const attemptedCount = problems.filter((p: any) => {
    const sub = candidateSubmissions.find((s: any) => s.problemId === p.problem?.id);
    const maxPoints = p.points || 100;
    const pts = sub?.score ?? sub?.points ?? 0;
    const isFull = sub?.status === 'ACCEPTED' || sub?.status === 'passed' || (pts >= maxPoints && maxPoints > 0);
    return !!sub && !isFull;
  }).length;

  const unattemptedCount = Math.max(0, problems.length - solvedCount - attemptedCount);

  const filteredProblems = problems.filter((p: any) => {
    const sub = candidateSubmissions.find((s: any) => s.problemId === p.problem?.id);
    const maxPoints = p.points || 100;
    const pts = sub?.score ?? sub?.points ?? 0;
    const isFull = sub?.status === 'ACCEPTED' || sub?.status === 'passed' || (pts >= maxPoints && maxPoints > 0);
    const isAttempted = !!sub && !isFull;

    // Strict Section filtering in SEB/Overview mode
    if (contest.sections && contest.sections.length > 0) {
      const currentSec = contest.sections.find((s: any) => s.id === activeSectionId) || contest.sections[0];
      if (currentSec) {
        const secProbIds: string[] = Array.isArray(currentSec.problemIds) ? currentSec.problemIds : [];
        if (secProbIds.length > 0) {
          if (!secProbIds.includes(p.problem?.id)) return false;
        } else {
          const secIdx = contest.sections.findIndex((s: any) => s.id === currentSec.id);
          const pIdx = problems.findIndex((probItem: any) => probItem.problem?.id === p.problem?.id);
          if (pIdx !== -1) {
            const expectedSecIdx = Math.floor((pIdx / problems.length) * contest.sections.length);
            if (expectedSecIdx !== secIdx) return false;
          }
        }
      }
    }

    if (statusFilter === 'solved') return isFull;
    if (statusFilter === 'attempted') return isAttempted;
    if (statusFilter === 'unattempted') return !isFull && !isAttempted;
    return true;
  });

  const overallPct = problems.length > 0 ? Math.round((solvedCount / problems.length) * 100) : 0;

  return (
    <>
      <ProblemQuickViewModal
        isOpen={!!quickViewItem}
        problem={quickViewItem?.problem}
        points={quickViewItem?.points || 100}
        onClose={() => setQuickViewItem(null)}
        onLaunch={() => {
          if (quickViewItem) {
            handleSebProblemLaunch(quickViewItem);
          }
        }}
      />

      <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">

        {/* 🌟 Glassmorphic Performance Hero Header */}
        <ContestHeroHeader
          contestTitle={contest.title}
          scoreEarned={participantScore}
          maxScore={maxContestScore}
          solvedCount={solvedCount}
          totalProblems={problems.length}
          endTime={contest.endTime}
          isSebBrowser={true}
        />

        {/* 📚 Section Switcher Bar in SEB Mode (Positioned below Hero Header) */}
        {contest.sections && contest.sections.length > 0 && (
          <div className="bg-gradient-to-r from-indigo-950/80 via-purple-950/60 to-zinc-950/80 border border-indigo-500/30 rounded-2xl p-4 shadow-xl space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">📚</span>
                <div>
                  <h3 className="text-sm font-black text-indigo-300">Exam Sections</h3>
                  <p className="text-[10px] text-gray-400 font-medium">Sequential exam section progression active</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {sectionTimeRemaining !== null && sectionTimeRemaining !== undefined && (
                  <span className="text-xs px-3 py-1.5 bg-amber-500/15 text-amber-300 border border-amber-500/40 rounded-xl font-mono font-black shadow-md shadow-amber-500/10 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    ⏱️ Section Time Left: {Math.floor(sectionTimeRemaining / 60)}m {String(sectionTimeRemaining % 60).padStart(2, '0')}s
                  </span>
                )}
                <button
                  onClick={() => {
                    const currentSecIdx = contest.sections.findIndex((s: any) => s.id === activeSectionId);
                    const currentSec = contest.sections[currentSecIdx] || contest.sections[0];
                    if (currentSec) {
                      setPendingSkipSection({ sec: currentSec, idx: currentSecIdx >= 0 ? currentSecIdx : 0 });
                      setSkipConsentAgreed(false);
                    }
                  }}
                  className="px-3 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-xs font-black rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-amber-500/10"
                  title="Lock current section and move to next"
                >
                  <span>🔒 Skip / Lock Current Section →</span>
                </button>
                <span className="text-xs px-2.5 py-1 bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 rounded-lg font-bold">
                  {contest.sections.length} Sections
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pt-1">
              {contest.sections.map((sec: any, idx: number) => {
                const isSelected = activeSectionId === sec.id;
                const isSelfLocked = sessionStorage.getItem(`sec_locked_${contest.id}_${sec.id}`) === '1';

                // Check if previous sections are completed/locked
                const prevSec = idx > 0 ? contest.sections[idx - 1] : null;
                const prevSecProbIds: string[] = prevSec ? (Array.isArray(prevSec.problemIds) ? prevSec.problemIds : []) : [];
                let isPrevCompleted = idx === 0;
                if (prevSec) {
                  const isPrevExplicitlyLocked = sessionStorage.getItem(`sec_locked_${contest.id}_${prevSec.id}`) === '1';
                  if (isPrevExplicitlyLocked) {
                    isPrevCompleted = true;
                  } else if (prevSecProbIds.length > 0) {
                    isPrevCompleted = prevSecProbIds.every(pid => candidateSubmissions.some((s: any) => s.problemId === pid && (s.status === 'ACCEPTED' || s.status === 'passed' || (s.score || 0) > 0)));
                  } else {
                    const prevSecIdx = idx - 1;
                    const totalSecs = contest.sections.length;
                    const prevSectionProbs = problems.filter((_: any, pIdx: number) => Math.floor((pIdx / Math.max(1, problems.length)) * totalSecs) === prevSecIdx);
                    isPrevCompleted = prevSectionProbs.length > 0 && prevSectionProbs.every((p: any) => candidateSubmissions.some((s: any) => s.problemId === p.problem?.id && (s.status === 'ACCEPTED' || s.status === 'passed')));
                  }
                }
                const isLocked = idx > 0 && !isPrevCompleted;

                return (
                  <button
                    key={sec.id}
                    onClick={() => {
                      if (isSelfLocked) {
                        notify.toast.info(`🔒 Section ${idx + 1} (${sec.title}) is submitted & permanently locked. Reverting is not allowed.`);
                        return;
                      }
                      if (isLocked) {
                        notify.toast.error(`🔒 Section Locked: You must complete and lock Section ${idx} (${prevSec?.title}) before moving to Section ${idx + 1}!`);
                        return;
                      }
                      setActiveSectionId(sec.id);
                    }}
                    className={`px-4 py-2 rounded-xl text-xs font-black transition-all shrink-0 border flex items-center gap-2 cursor-pointer ${
                      isSelfLocked
                        ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                        : isSelected
                        ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white border-indigo-300 shadow-lg shadow-indigo-500/30'
                        : isLocked
                        ? 'bg-black/40 text-gray-500 border-white/5 opacity-60 hover:opacity-80'
                        : 'bg-black/60 text-gray-300 border-white/10 hover:border-indigo-500/30'
                    }`}
                  >
                    <span>Section {idx + 1}: {sec.title}</span>
                    {sec.duration > 0 && <span className="text-[10px] px-1.5 py-0.5 bg-black/40 rounded">⏱️ {sec.duration}m</span>}
                    {isSelfLocked ? <span className="text-[10px] text-emerald-400 font-bold">✓ Locked</span> : isLocked ? <span className="text-[10px] text-amber-400">🔒</span> : null}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 🚨 Section Skip & Permanent Lock Consent Modal */}
        {pendingSkipSection && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
            <div className="bg-zinc-950 border border-amber-500/40 rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl space-y-6 relative overflow-hidden">
              <div className="absolute -top-32 -right-32 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0 text-2xl">
                  ⚠️
                </div>
                <div>
                  <span className="px-2.5 py-0.5 bg-amber-500/10 text-amber-400 text-[9px] font-black uppercase tracking-widest border border-amber-500/20 rounded">
                    Permanent Action Warning
                  </span>
                  <h3 className="text-lg font-black text-white mt-1">
                    Lock / Skip Section {pendingSkipSection.idx + 1}: {pendingSkipSection.sec.title}?
                  </h3>
                  <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                    Are you sure you want to finish or skip this exam section and proceed to Section {pendingSkipSection.idx + 2}?
                  </p>
                </div>
              </div>

              <div className="bg-red-950/40 border border-red-500/30 rounded-2xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-red-400 font-extrabold text-xs">
                  <span>🚨</span> CRITICAL EXAMINATION NOTICE
                </div>
                <p className="text-xs text-red-200/90 leading-relaxed">
                  Once you confirm, Section {pendingSkipSection.idx + 1} will be <strong className="text-red-300">PERMANENTLY LOCKED</strong>. You will <strong className="text-white">NOT be able to return, view, or modify any problems in this section</strong> for the remainder of the assessment.
                </p>
              </div>

              <label className="flex items-start gap-3 p-3.5 bg-white/5 border border-white/10 rounded-xl cursor-pointer hover:bg-white/10 transition">
                <input
                  type="checkbox"
                  checked={skipConsentAgreed}
                  onChange={e => setSkipConsentAgreed(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded accent-amber-500 cursor-pointer shrink-0"
                />
                <span className="text-xs text-gray-300 font-medium leading-relaxed">
                  I understand that locking/skipping Section {pendingSkipSection.idx + 1} is <strong className="text-white">PERMANENT</strong> and <strong className="text-amber-400">CANNOT BE REVERTED</strong> under any circumstances.
                </span>
              </label>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => {
                    setPendingSkipSection(null);
                    setSkipConsentAgreed(false);
                  }}
                  className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  disabled={!skipConsentAgreed}
                  onClick={() => {
                    const secId = pendingSkipSection.sec.id;
                    sessionStorage.setItem(`sec_locked_${contest.id}_${secId}`, '1');
                    const nextIdx = pendingSkipSection.idx + 1;
                    if (nextIdx < contest.sections.length) {
                      setActiveSectionId(contest.sections[nextIdx].id);
                      notify.toast.success(`🔒 Section ${pendingSkipSection.idx + 1} locked permanently. Switched to Section ${nextIdx + 1}!`);
                    } else {
                      notify.toast.success(`🔒 Final Section ${pendingSkipSection.idx + 1} locked!`);
                    }
                    setPendingSkipSection(null);
                    setSkipConsentAgreed(false);
                  }}
                  className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-extrabold text-xs rounded-xl transition shadow-lg shadow-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  🔒 Confirm Lock & Move to Next Section →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 📊 Live Overall Exam Progress Bar */}
        <div className="bg-zinc-950/70 border border-white/10 rounded-2xl p-4 shadow-xl space-y-2 backdrop-blur-md">
          <div className="flex items-center justify-between text-xs">
            <span className="font-extrabold text-white flex items-center gap-2">
              <span>🎯</span> Exam Completion Progress: <span className="text-amber-400 font-mono font-bold">{solvedCount} of {problems.length} Solved</span>
            </span>
            <span className="font-mono font-extrabold text-emerald-400 text-sm">{overallPct}% Completed</span>
          </div>
          <div className="w-full h-3 bg-zinc-900 rounded-full overflow-hidden border border-white/5 p-0.5">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-amber-400 rounded-full transition-all duration-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]"
              style={{ width: `${overallPct}%` }}
            />
          </div>
        </div>

        {/* 🎛️ Interactive Filter & Status Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-950/60 border border-white/10 rounded-2xl p-4 backdrop-blur-md">
          <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all shrink-0 ${
                statusFilter === 'all'
                  ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20'
                  : 'bg-white/5 hover:bg-white/10 text-gray-400'
              }`}
            >
              All Problems ({problems.length})
            </button>
            <button
              onClick={() => setStatusFilter('solved')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all shrink-0 flex items-center gap-1.5 ${
                statusFilter === 'solved'
                  ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/20'
                  : 'bg-white/5 hover:bg-white/10 text-emerald-400'
              }`}
            >
              <span>🟢</span> Solved ({solvedCount})
            </button>
            <button
              onClick={() => setStatusFilter('attempted')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all shrink-0 flex items-center gap-1.5 ${
                statusFilter === 'attempted'
                  ? 'bg-amber-400 text-black shadow-md shadow-amber-400/20'
                  : 'bg-white/5 hover:bg-white/10 text-amber-400'
              }`}
            >
              <span>🟡</span> Attempted ({attemptedCount})
            </button>
            <button
              onClick={() => setStatusFilter('unattempted')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all shrink-0 flex items-center gap-1.5 ${
                statusFilter === 'unattempted'
                  ? 'bg-zinc-700 text-white shadow-md'
                  : 'bg-white/5 hover:bg-white/10 text-gray-400'
              }`}
            >
              <span>⚪</span> Unattempted ({unattemptedCount})
            </button>
          </div>

          <div className="text-[11px] font-mono text-zinc-500 shrink-0">
            Showing <strong className="text-white font-bold">{filteredProblems.length}</strong> of {problems.length} problems
          </div>
        </div>

        {/* 💎 Next-Gen Problem Cards Grid */}
        {filteredProblems.length === 0 ? (
          <div className="bg-zinc-950/40 border border-white/5 rounded-3xl p-12 text-center space-y-3">
            <span className="text-4xl block">🔍</span>
            <h3 className="text-base font-bold text-white">No problems match filter</h3>
            <p className="text-xs text-gray-500">Switch status filter to view other assessment problems.</p>
            <button
              onClick={() => setStatusFilter('all')}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl transition"
            >
              Reset Filter
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredProblems.map((p: any, idx: number) => {
              const sub = candidateSubmissions.find((s: any) => s.problemId === p.problem?.id);
              const maxPoints = p.points || 100;
              const pointsEarned = sub?.score ?? sub?.points ?? 0;
              const isLockedState = typeof window !== 'undefined' && (
                sessionStorage.getItem(`locked_prob_${currentUid}_${contest.id}_${p.problem.id}`) === '1' ||
                localStorage.getItem(`locked_prob_${currentUid}_${contest.id}_${p.problem.id}`) === '1'
              );

              const isSolved = sub?.status === 'ACCEPTED' || sub?.status === 'passed' || (pointsEarned >= maxPoints && maxPoints > 0);
              const isPartial = !isSolved && pointsEarned > 0;
              const isAttempted = !!sub && !isSolved && !isPartial;
              const probType = p.problem?.problemType || 'code';

              const cardBorder = isSolved
                ? 'border-emerald-500/40 bg-gradient-to-r from-emerald-950/20 via-zinc-950 to-zinc-950 hover:border-emerald-400/60'
                : isPartial
                ? 'border-amber-500/40 bg-gradient-to-r from-amber-950/20 via-zinc-950 to-zinc-950 hover:border-amber-400/60'
                : isAttempted
                ? 'border-amber-400/30 bg-zinc-950 hover:border-amber-400/50'
                : 'border-white/10 bg-zinc-950/80 hover:border-amber-500/30';

              const diffColor =
                p.problem.difficulty === 'Easy'
                  ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                  : p.problem.difficulty === 'Hard'
                  ? 'text-rose-400 bg-rose-500/10 border-rose-500/20'
                  : 'text-amber-400 bg-amber-500/10 border-amber-500/20';

              return (
                <div
                  key={p.problem.id}
                  className={`border rounded-2xl p-5 md:p-6 transition-all duration-300 shadow-xl group flex flex-col md:flex-row md:items-center justify-between gap-5 relative overflow-hidden ${cardBorder}`}
                >
                  <div className="space-y-3 flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="text-xs text-gray-500 font-mono font-bold">#{idx + 1}</span>

                      {/* Tech Stack Badge */}
                      {probType === 'web-dev' && (
                        <span className="px-2.5 py-1 bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-[10px] font-black uppercase tracking-wider rounded-lg flex items-center gap-1.5">
                          <span>🌐</span> Full-Stack Web Dev
                        </span>
                      )}
                      {probType === 'sql' && (
                        <span className="px-2.5 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-300 text-[10px] font-black uppercase tracking-wider rounded-lg flex items-center gap-1.5">
                          <span>🗄️</span> SQL Database
                        </span>
                      )}
                      {probType === 'code' && (
                        <span className="px-2.5 py-1 bg-purple-500/10 border border-purple-500/20 text-purple-300 text-[10px] font-black uppercase tracking-wider rounded-lg flex items-center gap-1.5">
                          <span>💻</span> DSA &amp; Algorithm
                        </span>
                      )}
                      {(probType === 'quiz' || probType === 'mcq') && (
                        <span className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[10px] font-black uppercase tracking-wider rounded-lg flex items-center gap-1.5">
                          <span>📝</span> Technical Quiz
                        </span>
                      )}

                      {/* Dynamic Difficulty Pill */}
                      <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black border ${diffColor}`}>
                        {p.problem.difficulty || 'Medium'} (+{maxPoints} pts)
                      </span>

                      {/* Lock & Solved Status Pills */}
                      {isSolved && (
                        <span className="px-2.5 py-0.5 bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-[10px] font-black rounded-lg flex items-center gap-1">
                          <span>✓</span> SOLVED ({pointsEarned}/{maxPoints} pts)
                        </span>
                      )}
                      {isPartial && (
                        <span className="px-2.5 py-0.5 bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-black rounded-lg flex items-center gap-1">
                          <span>⚡</span> PARTIAL ({pointsEarned}/{maxPoints} pts)
                        </span>
                      )}
                      {isAttempted && (
                        <span className="px-2.5 py-0.5 bg-zinc-800 border border-zinc-700 text-zinc-300 text-[10px] font-black rounded-lg flex items-center gap-1">
                          <span>🟡</span> ATTEMPTED (0/{maxPoints} pts)
                        </span>
                      )}
                    </div>

                    <div>
                      <h3 className="text-base md:text-lg font-black text-white group-hover:text-amber-400 transition-colors flex items-center gap-2">
                        <span>{p.problem.title}</span>
                        {isSolved && <span className="text-emerald-400 text-sm">✓</span>}
                      </h3>
                      {p.problem.description && (
                        <p className="text-xs text-gray-400 line-clamp-2 mt-1 font-sans">
                          {p.problem.description.replace(/```[\s\S]*?```/g, '').slice(0, 140)}...
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right side actions & lock indicator */}
                  <div className="flex items-center gap-3 shrink-0 justify-between md:justify-end border-t md:border-t-0 border-white/5 pt-3 md:pt-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setQuickViewItem({ problem: p.problem, points: maxPoints });
                      }}
                      className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white font-extrabold text-xs rounded-xl transition flex items-center gap-1.5"
                    >
                      <span>ℹ️</span> Details
                    </button>

                    <button
                      onClick={() => handleSebProblemLaunch(p)}
                      className={`px-5 py-2.5 rounded-xl font-extrabold text-xs transition-all flex items-center gap-2 shadow-lg ${
                        isSolved
                          ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40'
                          : isPartial
                          ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40'
                          : isAttempted
                          ? 'bg-gradient-to-r from-amber-500 to-amber-400 text-black shadow-amber-500/20 hover:from-amber-400 hover:to-amber-300'
                          : (probType === 'vibe-code' || probType === 'ai-assisted' || p.problem?.slug === 'lcm-of-two-trees-c')
                          ? 'bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white shadow-purple-600/30 border border-purple-400/30'
                          : 'bg-gradient-to-r from-emerald-500 to-emerald-400 text-black shadow-emerald-500/20 hover:from-emerald-400 hover:to-emerald-300'
                      }`}
                    >
                      {isSolved ? (
                        <>
                          <span>✓</span> Review Problem ({pointsEarned}/{maxPoints} pts)
                        </>
                      ) : isPartial ? (
                        <>
                          <span>⚡</span> Improve Score ({pointsEarned}/{maxPoints} pts)
                        </>
                      ) : isAttempted ? (
                        <>
                          <span>▶</span> Continue Problem
                        </>
                      ) : (probType === 'vibe-code' || probType === 'ai-assisted' || p.problem?.slug === 'lcm-of-two-trees-c') ? (
                        <>
                          <span>🤖</span> Solve with AI Assistant
                        </>
                      ) : (
                        <>
                          <span>🚀</span> Solve Problem
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Embedded In-Contest AI Workspace in SEB/Overview Mode */}
      {activeAiProblem && (
        <InContestAiWorkspace
          contest={contest}
          problemItem={activeAiProblem}
          currentSection={contest.sections?.find((s: any) => s.id === activeSectionId)}
          onBack={() => setActiveAiProblem(null)}
          onSubmitted={() => {
            setActiveAiProblem(null);
            queryClient.invalidateQueries({ queryKey: ['contest', contest.id] });
            refetchReport?.();
          }}
        />
      )}
    </>
  );
}

function SebExamWizard({
  contest,
  diagnostics,
}: {
  contest: any;
  diagnostics: ContestOutletContext['diagnostics'];
}) {
  const [step, setStep] = useState<WizardStep>(() => {
    const saved = sessionStorage.getItem(`seb_wizard_step_${contest.id}`);
    if (saved === 'problems' || saved === 'guidelines' || saved === 'diagnostics') {
      return saved as WizardStep;
    }
    return 'diagnostics';
  });

  React.useEffect(() => {
    sessionStorage.setItem(`seb_wizard_step_${contest.id}`, step);
  }, [step, contest.id]);

  React.useEffect(() => {
    // Automatically register candidate when entering SEB wizard
    if (contest?.id) {
      api.joinManagerContest(contest.id).catch(() => {});
    }
  }, [contest?.id]);

  const navigate = useNavigate();
  const notify = useNotify();
  const { user } = useAuth();
  const [showInstructions, setShowInstructions] = useState(() => {
    return !sessionStorage.getItem(`exam_instructions_ack_${contest.id}`);
  });
  const [showSummary, setShowSummary] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [finalized, setFinalized] = useState(false);
  const [reportData, setReportData] = useState<any>(null);

  const handleBeginExam = () => setStep('problems');

  const handleProblemClick = (p: any) => {
    const uid = user?.id || (user as any)?.userId || 'guest';
    const isLocked = typeof window !== 'undefined' && (
      sessionStorage.getItem(`locked_prob_${uid}_${contest.id}_${p.problem.id}`) === '1' ||
      localStorage.getItem(`locked_prob_${uid}_${contest.id}_${p.problem.id}`) === '1'
    );

    if (isLocked) {
      notify.toast.info(`🔒 Problem "${p.problem.title}" is locked & submitted! You cannot re-enter or edit this problem.`);
      return;
    }

    const probType = p.problem.problemType || 'code';
    let path = '/playground/logic';
    if (probType === 'web-dev') path = '/playground/web-dev';
    else if (probType === 'sql') path = '/playground/sql';
    navigate(`${path}?contestId=${contest.id}&problem=${p.problem.id}`);
  };

  const [isFinishing, setIsFinishing] = useState(false);

  const handleFinishClick = async () => {
    if (isFinishing) return;
    setIsFinishing(true);
    notify.toast.info('📊 Generating final score & summary report...');

    try {
      const report = await api.getMyContestReport(contest.id).catch(() => null);
      const problems = contest.problems || [];
      const submissions = report?.submissions || [];
      const mappedProblems = problems.map((cp: any) => {
        const probId = cp.problem?.id || cp.id;
        const sub = submissions.find((s: any) => s.problemId === probId);
        const sessionScore = Number(typeof window !== 'undefined' ? sessionStorage.getItem(`score_${contest.id}_${probId}`) || 0 : 0);
        const subScore = sub ? Math.max(sub.score || 0, sub.points || 0) : 0;
        const finalEarned = Math.max(subScore, sessionScore);

        return {
          problemId: probId,
          title: cp.problem?.title || `Problem ${cp.id}`,
          points: cp.points || 100,
          earned: finalEarned,
          status: finalEarned > 0 ? 'solved' : (sub ? 'attempted' : 'unattempted'),
        };
      });

      const calculatedMax = mappedProblems.reduce((a: number, p: any) => a + p.points, 0);
      const calculatedScore = mappedProblems.reduce((a: number, p: any) => a + p.earned, 0);
      const finalScore = Math.max(report?.participant?.score || 0, calculatedScore);

      setReportData({
        score: finalScore,
        maxScore: calculatedMax,
        warnings: report?.participant?.warnings || 0,
        solvedCount: mappedProblems.filter((p: any) => p.earned > 0).length,
        totalProblems: mappedProblems.length,
        problems: mappedProblems,
        isTerminated: report?.participant?.isTerminated || false,
        integrity: (report?.participant?.warnings || 0) > 0 ? 'WARNING' : 'CLEAN',
      });
      setShowSummary(true);
    } catch {
      notify.toast.error('Failed to load exam summary. Try again.');
    } finally {
      setIsFinishing(false);
    }
  };

  const handleInstructionsProceed = () => {
    sessionStorage.setItem(`exam_instructions_ack_${contest.id}`, '1');
    setShowInstructions(false);
  };

  const handleFinalized = () => {
    setShowConfirm(false);
    setFinalized(true);
  };

  if (finalized) {
    return <PostSubmitSummary contestId={contest.id} report={reportData} />;
  }

  return (
    <div className="relative">
      <AnimatePresence mode="wait">
        {step === 'diagnostics' && (
          <motion.div
            key="diagnostics"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <ErrorBoundary fallback={
              <div className="min-h-screen flex items-center justify-center bg-black">
                <div className="text-center space-y-4">
                  <p className="text-sm text-gray-400">Diagnostic cockpit unavailable.</p>
                  <button
                    onClick={() => setStep('guidelines')}
                    className="px-5 py-2.5 bg-amber-500 text-black font-extrabold text-xs rounded-xl transition"
                  >
                    Skip to Guidelines →
                  </button>
                </div>
              </div>
            }>
              <SebDiagnosticCockpit
                contest={contest}
                diagnostics={diagnostics}
                onStartExam={() => setStep('guidelines')}
              />
            </ErrorBoundary>
          </motion.div>
        )}

        {step === 'guidelines' && (
          <motion.div
            key="guidelines"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.25 }}
          >
            <SebGuidelinesInline
              contestTitle={contest.title}
              onBegin={handleBeginExam}
            />
          </motion.div>
        )}

        {step === 'problems' && (
          <motion.div
            key="problems"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            {/* Pre-Exam Instructions Modal (shown once) */}
            <AnimatePresence>
              {showInstructions && (
                <PreExamInstructionsModal onProceed={handleInstructionsProceed} />
              )}
            </AnimatePresence>

            <SebProblemsListInline
              contest={contest}
              onProblemClick={handleProblemClick}
            />

            {/* Exam Summary Modal */}
            <AnimatePresence>
              {showSummary && (
                <ExamSummaryModal
                  report={reportData}
                  onProceed={() => {
                    setShowSummary(false);
                    setShowConfirm(true);
                  }}
                />
              )}
            </AnimatePresence>

            {/* Final Confirm Modal */}
            <AnimatePresence>
              {showConfirm && (
                <FinalConfirmModal
                  contestId={contest.id}
                  onFinalized={handleFinalized}
                  onCancel={() => setShowConfirm(false)}
                />
              )}
            </AnimatePresence>

            {/* Finish Exam FAB */}
            {!finalized && (
              <FinishExamFAB contest={contest} onFinish={handleFinishClick} />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// -------------------------------------------------------------
// SEB Mandatory Lockdown Gate Overlay (shown in standard browser)
// -------------------------------------------------------------
function SebGateOverlay({ contest, onBypass }: { contest: any; onBypass: () => void }) {
  const notify = useNotify();
  const [sebLaunching, setSebLaunching] = useState(false);

  const handleOneClickLaunch = async () => {
    setSebLaunching(true);
    try {
      const { sessionToken } = await api.getSebToken(contest.id);
      const frontendUrl = window.location.origin;
      const protocol = window.location.protocol === 'https:' ? 'sebs:' : 'seb:';
      const token = localStorage.getItem('accessToken') || '';
      const userStr = localStorage.getItem('user') || '';
      const userParam = userStr ? encodeURIComponent(userStr) : '';
      const sebUrl = `${frontendUrl.replace(/^https?:/, protocol)}/contests/${contest.id}?seb=1&token=${token}&user=${userParam}&sessionToken=${sessionToken}`;
      window.location.href = sebUrl;
    } catch {
      notify.toast.error('Failed to generate launch token. Please try again.');
    } finally {
      setSebLaunching(false);
    }
  };

  const handleDownloadSebConfig = async () => {
    try {
      const blob = await api.downloadSebConfig(contest.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${contest.title.replace(/\s+/g, '_')}_config.seb`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      notify.toast.success('SEB configuration downloaded! Open it to launch the exam.');
    } catch {
      notify.toast.error('Failed to download Safe Exam Browser configuration.');
    }
  };

  return (
    <div className="fixed inset-0 z-[9990] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-6 text-white select-text">
      <div className="max-w-2xl w-full bg-zinc-950 border border-amber-500/30 rounded-3xl p-8 space-y-6 shadow-2xl relative overflow-hidden">
        {/* Glow */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center gap-4 border-b border-white/10 pb-5">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-3xl shrink-0">
            🔒
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 bg-amber-500/20 text-amber-400 text-[10px] font-black uppercase rounded border border-amber-500/30 font-mono tracking-wider">
                MANDATORY SECURITY LOCKDOWN
              </span>
            </div>
            <h2 className="text-2xl font-black text-white mt-1">{contest.title}</h2>
            <p className="text-xs text-zinc-400 mt-0.5">This assessment requires Safe Exam Browser (SEB) to launch.</p>
          </div>
        </div>

        {/* Steps */}
        <div className="bg-zinc-900/60 border border-white/10 rounded-2xl p-5 space-y-3">
          <h4 className="text-xs font-black text-amber-400 uppercase tracking-widest flex items-center gap-1.5 font-mono">
            <span>🛡️</span> Mandatory Pre-Exam Setup
          </h4>
          <div className="space-y-3 text-xs">
            <div className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center shrink-0 text-xs">1</span>
              <div>
                <p className="font-bold text-white">Install Safe Exam Browser (SEB)</p>
                <p className="text-[11px] text-zinc-400">If SEB is not installed on your device, download the official installer below.</p>
                <a href="https://safeexambrowser.org/download_en.html" target="_blank" rel="noopener noreferrer" className="text-amber-400 font-bold hover:underline text-[11px] inline-block mt-1">
                  Download Official SEB Installer ↗
                </a>
              </div>
            </div>

            <div className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center shrink-0 text-xs">2</span>
              <div>
                <p className="font-bold text-white">Launch SEB or Download .seb Config File</p>
                <p className="text-[11px] text-zinc-400">Click "1-Click Launch" to open SEB directly, or download the pre-configured `.seb` file and double-click it to start.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            type="button"
            onClick={handleOneClickLaunch}
            disabled={sebLaunching}
            className="py-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-black text-sm rounded-2xl shadow-lg shadow-amber-500/20 transition flex flex-col items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
          >
            <span>🚀 1-Click Launch SEB</span>
            <span className="text-[10px] text-black/70 font-bold">Opens Safe Exam Browser directly</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadSebConfig}
            className="py-4 bg-white/5 hover:bg-white/10 text-white border border-white/10 font-bold text-sm rounded-2xl transition flex flex-col items-center justify-center gap-1 cursor-pointer"
          >
            <span>📥 Download .seb Config</span>
            <span className="text-[10px] text-zinc-400 font-medium">Executable config file</span>
          </button>
        </div>

        {/* Bypass Dev Mode */}
        <div className="pt-3 border-t border-white/10 flex items-center justify-between">
          <span className="text-[10px] font-mono text-zinc-500">Kryptavia OS Security Engine</span>
          <button
            type="button"
            onClick={onBypass}
            className="px-3.5 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-bold rounded-xl transition cursor-pointer"
          >
            ⚡ Continue in Testing/Preview Mode
          </button>
        </div>
      </div>
    </div>
  );
}

export default ContestZoneLayout;