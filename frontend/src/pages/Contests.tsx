import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { api } from '../services/api';
import axios from 'axios';
import { SecureContestWrapper } from '../components/SecureContestWrapper';
import { useSidebar } from '../contexts/SidebarContext';
import { CodePlaygroundPage } from './CodePlaygroundPage';
import { WebPlaygroundPage } from './WebPlaygroundPage';
import { SqlPlaygroundPage } from './SqlPlaygroundPage';
import { useAuth } from '../contexts/AuthContext';

import { useNavigate } from 'react-router-dom';
import { useNotify } from '../components/notifications';
import MarkdownRenderer from '../components/MarkdownRenderer';
import { EmptyState } from '../components/common/EmptyState';

// Lobby Suite Imports
import { LobbyStepper } from '../components/lobby/LobbyStepper';
import { LivenessCheck } from '../components/lobby/LivenessCheck';
import { NetworkDiagnostics } from '../components/lobby/NetworkDiagnostics';
import { EnvironmentIntegrityCheck } from '../components/lobby/EnvironmentIntegrityCheck';
import { BoardingPass } from '../components/lobby/BoardingPass';
import { ScratchpadRunner } from '../components/lobby/ScratchpadRunner';

const PLATFORM_META: Record<string, { label: string; color: string; bg: string; image: string }> = {
  codeforces: { label: 'CodeForces', color: 'text-blue-400', bg: 'bg-blue-500/10', image: '/images/contest/codeforces.webp' },
  codechef: { label: 'CodeChef', color: 'text-orange-400', bg: 'bg-orange-500/10', image: '/images/contest/codechef.png' },
  leetcode: { label: 'LeetCode', color: 'text-yellow-400', bg: 'bg-yellow-500/10', image: '/images/contest/leetcode.png' },
  atcoder: { label: 'AtCoder', color: 'text-red-400', bg: 'bg-red-500/10', image: '/images/contest/codechef.png' },
  geeksforgeeks: { label: 'GFG', color: 'text-green-400', bg: 'bg-green-500/10', image: '/images/contest/gfg.png' },
};

const formatDuration = (minutes: number | null) => {
  if (!minutes) return '—';
  if (minutes >= 1440) return `${Math.floor(minutes / 1440)}d`;
  if (minutes >= 60) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  return `${minutes}m`;
};

interface Contest {
  id: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  duration: number;
  difficulty: string;
  requireFullscreen?: boolean;
  preventTabSwitch?: boolean;
  disableCopyPaste?: boolean;
  enableProctoring?: boolean;
  allowMultipleMonitors?: boolean;
  pasteMode?: 'ALLOWED' | 'LOG_ONLY' | 'BLOCKED';
  faceCheckEnabled?: boolean;
  voiceCheckEnabled?: boolean;
  snapshotIntervalSeconds?: number;
  maxWarnings?: number;
  integrityTier?: 'standard' | 'verified_required';
  requireSeb?: boolean;
  _count: { participants: number; problems: number };
}

interface ContestDetail extends Contest {
  problems: Array<{
    order: number;
    points: number;
    problem: { id: string; title: string; difficulty: string; problemType?: string };
  }>;
  isJoined: boolean;
  isActive: boolean;
}

interface LeaderboardEntry {
  rank: number;
  user: { id: string; fullName: string; email: string };
  score: number;
  solvedCount: number;
}

interface Participation {
  contest: Contest;
  score: number;
  solvedCount: number;
  joinedAt: string;
}

type Tab = 'active' | 'upcoming' | 'ended' | 'my' | 'multi-platform' | 'exam' | 'live-contests';

interface ExamCategory {
  id: number;
  name: string;
  description: string | null;
}

interface ExamQuestion {
  id: number;
  categoryId: number;
  question: string;
  answer: string | null;
  options: string[] | null;
  type: string;
  difficulty: string;
}

interface ExamAttempt {
  id: number;
  categoryId: number;
  category: ExamCategory;
  answers: any;
  score: number | null;
  total: number | null;
  completedAt: string | null;
  createdAt: string;
}

const DIFFICULTY_COLORS: Record<string, string> = {
  Easy: 'text-green-400 bg-green-500/10',
  Medium: 'text-yellow-400 bg-yellow-500/10',
  Hard: 'text-red-400 bg-red-500/10',
};

function getTimeStatus(contest: { startTime: string; endTime: string }) {
  const now = new Date();
  const start = new Date(contest.startTime);
  const end = new Date(contest.endTime);
  if (now < start) return { label: 'Upcoming', color: 'text-blue-400 bg-blue-500/10' };
  if (now > end) return { label: 'Ended', color: 'text-gray-500 bg-gray-500/10' };
  return { label: 'Active', color: 'text-green-400 bg-green-500/10' };
}

function Countdown({ target }: { target: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const diff = new Date(target).getTime() - now;
  if (diff <= 0) return <span className="text-green-400 text-xs font-medium">Started</span>;
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return <span className="text-[var(--accent-yellow)] text-xs font-mono">{h}h {m}m {s}s</span>;
}





function LiveCountdown({ target }: { target: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const diff = new Date(target).getTime() - now;
  if (diff <= 0) return <span className="text-green-400 text-xs font-bold">Started</span>;

  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);

  return (
    <span className="text-[var(--accent-yellow)] text-xs font-mono tabular-nums font-medium">
      {d > 0 ? `${d}d ` : ''}
      {String(h).padStart(2, '0')}:{String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
    </span>
  );
}

function LiveContestCard({ contest }: { contest: any }) {
  const now = Date.now();
  const startTime = new Date(contest.startTime).getTime();
  const durationMs = (contest.duration || 0) * 60 * 1000;
  const endTime = startTime + durationMs;

  let status: string;
  let statusColor: string;
  if (now < startTime) {
    status = 'upcoming';
    statusColor = 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/25';
  } else if (now <= endTime) {
    status = 'ongoing';
    statusColor = 'bg-gradient-to-r from-green-600 to-green-500 text-white shadow-lg shadow-green-500/25';
  } else {
    status = 'past';
    statusColor = 'bg-gradient-to-r from-gray-600 to-gray-500 text-white shadow-lg shadow-gray-500/25';
  }

  const relativeTime = (() => {
    const diff = startTime - now;
    if (diff <= 0) return 'Started';
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `in ${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `in ${hours}h ${mins % 60}m`;
    const days = Math.floor(hours / 24);
    return `in ${days}d ${hours % 24}h`;
  })();

  const meta = PLATFORM_META[contest.platform] || { label: contest.platform, color: 'text-gray-400', bg: 'bg-gray-500/10', image: '' };

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/20 transition p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-bold ${meta.bg} ${meta.color}`}>
            {meta.image && <img src={meta.image} alt={meta.label} className="w-4 h-4 object-contain rounded" />}
            {meta.label}
          </div>
          <h3 className="text-white font-semibold truncate">{contest.name}</h3>
          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 ${statusColor}`}>
            {status}
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-500 shrink-0 ml-4">
          {status === 'upcoming' && <LiveCountdown target={contest.startTime} />}
          <span className="text-gray-400">{relativeTime}</span>
          <span className="text-gray-400">{formatDuration(contest.duration)}</span>
          {contest.url && (
            <a
              href={contest.url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1 bg-white/10 text-white rounded-md font-medium hover:bg-white/20 transition"
              onClick={(e) => e.stopPropagation()}
            >
              Register ↗
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

type TabKey = 'active' | 'upcoming' | 'ended';
type DifficultyFilter = 'all' | 'Easy' | 'Medium' | 'Hard';

const DIFFICULTY_BARS: Record<'Easy' | 'Medium' | 'Hard', number> = { Easy: 1, Medium: 2, Hard: 3 };
const DIFFICULTY_COLOR: Record<'Easy' | 'Medium' | 'Hard', string> = {
  Easy: "bg-emerald-400",
  Medium: "bg-status-live",
  Hard: "bg-rose-500",
};

function DifficultyPill({ level, selected, onClick }: {
  level: DifficultyFilter; selected: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-xs transition-all ${
        selected ? "border-white/30 bg-white/10 text-white shadow-sm font-semibold" : "border-console-border text-white/50 hover:text-white/80 hover:border-white/20"
      }`}
    >
      {level === 'all' ? "All" : (
        <>
          <span className="flex gap-0.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <span
                key={i}
                className={`h-2.5 w-1 rounded-sm ${i < (DIFFICULTY_BARS[level as 'Easy' | 'Medium' | 'Hard'] || 1) ? DIFFICULTY_COLOR[level as 'Easy' | 'Medium' | 'Hard'] : "bg-white/10"}`}
              />
            ))}
          </span>
          {level}
        </>
      )}
    </button>
  );
}

function formatCountdown(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = String(Math.floor(total / 3600)).padStart(2, "0");
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function formatRelativeEnded(endTime: string, now: number) {
  const diff = Math.max(0, now - new Date(endTime).getTime());
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days > 0) return `${days}d ago`;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours > 0) return `${hours}h ago`;
  const mins = Math.floor(diff / (1000 * 60));
  return `${mins}m ago`;
}

function LaunchConsoleCard({
  contest,
  status,
  now,
  matchPart,
  onOpen,
  onViewReport
}: {
  contest: any;
  status: TabKey;
  now: number;
  matchPart?: any;
  onOpen: () => void;
  onViewReport: (e: React.MouseEvent) => void;
}) {
  const accent = {
    active: "border-l-status-live",
    upcoming: "border-l-status-upcoming",
    ended: "border-l-status-ended"
  }[status];

  const start = new Date(contest.startTime).getTime();
  const end = new Date(contest.endTime).getTime();

  const isCompleted = matchPart?.status === 'COMPLETED' || !!matchPart?.submittedAt;

  return (
    <div
      onClick={(e) => {
        if (status === 'ended' || isCompleted) {
          onViewReport(e);
        } else {
          onOpen();
        }
      }}
      className={`card-enter flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-console-border ${accent} border-l-4 bg-console-panel p-4 md:p-5 hover:border-white/20 hover:bg-zinc-900/80 transition-all duration-200 cursor-pointer shadow-lg`}
    >
      <div className="space-y-1.5 flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2.5 font-mono text-xs uppercase text-white/50">
          {status === "active" && (
            <span className="flex items-center gap-1.5 text-status-live font-bold tracking-wider">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-status-live" />
              LIVE NOW
            </span>
          )}
          {status === "upcoming" && (
            <span className="text-status-upcoming font-bold tracking-wider">
              T-MINUS
            </span>
          )}
          {status === "ended" && (
            <span className="text-white/40 font-medium">
              ARCHIVED · ended {formatRelativeEnded(contest.endTime, now)}
            </span>
          )}

          {status !== "ended" && (
            <span className="tabular-nums font-mono text-status-live tracking-widest font-bold text-xs bg-black/40 px-2 py-0.5 rounded border border-white/5 drop-shadow-[0_0_6px_rgba(255,176,32,0.3)]">
              {formatCountdown(status === "active" ? end - now : start - now)}
            </span>
          )}

          {contest.difficulty && (
            <span className="flex items-center gap-1 text-[10px] text-white/60 bg-white/5 px-2 py-0.5 rounded border border-white/10 font-mono">
              <span className="flex gap-0.5">
                {Array.from({ length: 3 }).map((_, i) => (
                  <span
                    key={i}
                    className={`h-2 w-0.5 rounded-xs ${
                      i < (DIFFICULTY_BARS[contest.difficulty as 'Easy' | 'Medium' | 'Hard'] || 1)
                        ? DIFFICULTY_COLOR[contest.difficulty as 'Easy' | 'Medium' | 'Hard'] || "bg-white/40"
                        : "bg-white/10"
                    }`}
                  />
                ))}
              </span>
              {contest.difficulty}
            </span>
          )}
        </div>

        <h3 className="font-display font-bold text-lg text-white group-hover:text-status-live transition-colors tracking-tight truncate">
          {contest.title}
        </h3>

        <div className="flex items-center gap-4 font-mono text-xs text-white/50">
          <span className="flex items-center gap-1">👥 <strong className="text-white/80">{contest._count?.participants || contest.participantCount || 0}</strong> participants</span>
          <span className="flex items-center gap-1">💻 <strong className="text-white/80">{contest._count?.problems || contest.problemCount || 0}</strong> problems</span>
          {contest.duration && (
            <span className="flex items-center gap-1">⏱️ <strong className="text-white/80">{contest.duration}m</strong></span>
          )}
        </div>

        {matchPart ? (
          <div className="flex items-center gap-2 text-xs font-mono pt-1">
            <span className="px-2 py-0.5 bg-status-personal/20 text-status-personal rounded border border-status-personal/30 text-[10px] font-bold">
              {isCompleted ? 'COMPLETED' : 'JOINED'} ({matchPart.score || 0} pts)
            </span>
            <button
              type="button"
              onClick={onViewReport}
              className="text-status-live hover:underline font-bold text-[11px] transition"
            >
              View Report &rarr;
            </button>
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-3 shrink-0 sm:self-center">
        <button
          type="button"
          onClick={(e) => {
            if (status === 'ended' || isCompleted) {
              onViewReport(e);
            } else {
              onOpen();
            }
          }}
          className={`rounded-lg px-4 py-2 font-mono text-xs font-bold transition-all shadow-md ${
            isCompleted || status === "ended"
              ? "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white border border-console-border"
              : status === "active"
              ? "bg-status-live text-black hover:bg-yellow-400 hover:shadow-yellow-500/20 active:scale-95"
              : "border border-status-upcoming/40 text-status-upcoming hover:bg-status-upcoming/10"
          }`}
        >
          {isCompleted || status === "ended" ? "View Report →" : status === "active" ? "Enter Exam →" : "Boarding Details"}
        </button>
      </div>
    </div>
  );
}

export function ContestsPage() {
  const navigate = useNavigate();
  const notify = useNotify();
  const [tab, setTab] = useState<Tab>('active');
  const [contests, setContests] = useState<Contest[]>(() => {
    try {
      const c = sessionStorage.getItem('contests:list');
      return c ? JSON.parse(c) : [];
    } catch { return []; }
  });
  const [participations, setParticipations] = useState<Participation[]>([]);
  const [loading, setLoading] = useState(!contests.length);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<ContestDetail | null>(null);
  const [participantDetails, setParticipantDetails] = useState<any | null>(null);
  const [myContestLogs, setMyContestLogs] = useState<any[] | null>(null);
  const [logsModalOpen, setLogsModalOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [joining, setJoining] = useState(false);
  const [activeContest, setActiveContest] = useState<ContestDetail | null>(null);
  const [solvingProblem, setSolvingProblem] = useState<{ id: string; type: string } | null>(null);
  const [solvedProblems, setSolvedProblems] = useState<Set<string>>(new Set());
  const [contestScore, setContestScore] = useState(0);

  // --- Mission Control Lobby State Hooks ---
  const [lobbyStep, setLobbyStep] = useState(1);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [rollNumber, setRollNumber] = useState('');
  const [livenessResult, setLivenessResult] = useState<any>(null);
  const [networkMetrics, setNetworkMetrics] = useState<any>(null);
  const [envDetails, setEnvDetails] = useState<any>(null);
  const [_signedLobbyToken, setSignedLobbyToken] = useState('');
  const [diagnosticsHash, setDiagnosticsHash] = useState('');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [showSandbox, setShowSandbox] = useState(false);
  const [submittingLobby, setSubmittingLobby] = useState(false);

  const lobbyWsRef = useRef<WebSocket | null>(null);
  const photoVideoRef = useRef<HTMLVideoElement | null>(null);
  const [photoStream, setPhotoStream] = useState<MediaStream | null>(null);

  // Stop webcam capture in Step 1
  const stopPhotoStream = () => {
    if (photoStream) {
      photoStream.getTracks().forEach(t => t.stop());
      setPhotoStream(null);
    }
  };

  // Close and cleanup lobby
  const closeLobby = () => {
    stopPhotoStream();
    if (lobbyWsRef.current) {
      lobbyWsRef.current.close();
      lobbyWsRef.current = null;
    }
    setSelected(null);
    resetLobbyState();
  };

  const resetLobbyState = () => {
    setLobbyStep(1);
    setCapturedPhoto(null);
    setRollNumber('');
    setLivenessResult(null);
    setNetworkMetrics(null);
    setEnvDetails(null);
    setSignedLobbyToken('');
    setDiagnosticsHash('');
    setQrCodeDataUrl('');
    setShowSandbox(false);
  };

  // Send status update over REST & WebSocket
  const sendLobbyStatus = (step: number, status: string, diagnosticsData?: any) => {
    if (!selected) return;

    // Broadcast via HTTP POST
    api.client.post(`/contests/${selected.id}/lobby/status`, {
      status,
      checkpoint: step,
      diagnostics: diagnosticsData
    }).catch(err => console.warn('[Lobby Status Broadcast failed]:', err));

    // Broadcast via WebSocket
    if (lobbyWsRef.current && lobbyWsRef.current.readyState === WebSocket.OPEN) {
      lobbyWsRef.current.send(JSON.stringify({
        type: 'lobby_status',
        status,
        checkpoint: step,
        diagnostics: diagnosticsData
      }));
    }
  };

  // Lobby WebSocket connection
  useEffect(() => {
    if (!selected || !selected.isJoined || getTimeStatus(selected!).label === 'Ended') {
      if (lobbyWsRef.current) {
        lobbyWsRef.current.close();
        lobbyWsRef.current = null;
      }
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) return;

    // Connect to WebSocket lobby room
    const wsUrl = `ws://localhost:5000/ws/interview?token=${token}&sessionId=contest_lobby_${selected.id}`;
    const ws = new WebSocket(wsUrl);
    lobbyWsRef.current = ws;

    ws.onopen = () => {
      // Send initial check-in status
      ws.send(JSON.stringify({
        type: 'lobby_status',
        status: 'In Progress',
        checkpoint: lobbyStep
      }));
    };

    ws.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'lobby_status' && msg.bypassTargetId === user?.id) {
          await notify.alert('Clearance Authorized', {
            description: 'The examiner has issued a security checkpoint waiver for your device.',
          });
          setDiagnosticsHash('EXAMINER_WAIVER_BYPASS');
          setQrCodeDataUrl('EXAMINER_WAIVER_BYPASS');
          setSignedLobbyToken('EXAMINER_WAIVER_BYPASS');
          setLobbyStep(4);
        }
      } catch (err) {
        console.warn('Lobby WS message handle error:', err);
      }
    };

    return () => {
      if (lobbyWsRef.current) {
        lobbyWsRef.current.close();
        lobbyWsRef.current = null;
      }
    };
  }, [selected, selected?.isJoined]);

  // Sync lobby checkpoint transitions
  useEffect(() => {
    if (selected && selected.isJoined && getTimeStatus(selected!).label !== 'Ended') {
      sendLobbyStatus(
        lobbyStep,
        lobbyStep === 4 ? 'Ready' : 'In Progress',
        lobbyStep === 3 ? { ping: networkMetrics?.pingMs, download: networkMetrics?.downloadSpeedMbps, monitors: envDetails?.monitorCount } : undefined
      );
    }
  }, [lobbyStep]);

  // Webcam access helpers for Checkpoint 1
  const startPhotoCamera = async () => {
    try {
      if (photoStream) return;
      const s = await navigator.mediaDevices.getUserMedia({ video: true });
      setPhotoStream(s);
      if (photoVideoRef.current) {
        photoVideoRef.current.srcObject = s;
      }
    } catch (e) {
      await notify.alert('Camera Access Required', {
        description: 'Camera access is required for passenger profile photo validation.',
      });
    }
  };

  const capturePhoto = () => {
    const video = photoVideoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg');
      setCapturedPhoto(dataUrl);
      stopPhotoStream();
    }
  };

  // Submit complete diagnostics payload in step 3
  const submitDiagnostics = async (metrics: any, env: any) => {
    if (!selected) return;
    setSubmittingLobby(true);
    try {
      const res = await api.client.post(`/contests/${selected.id}/lobby/diagnostics`, {
        cameraPass: true,
        micPass: true,
        livenessMethod: livenessResult?.method || 'headturn',
        livenessConfidence: livenessResult?.confidence || 0.98,
        monitorCount: env.monitorCount,
        virtualCameraDetected: env.virtualCameraDetected,
        networkResults: metrics,
        integrityTier: env.integrityTier,
        agentPaired: env.agentPaired,
        blockedAppsFound: env.blockedAppsFound,
        remoteSessionDetected: env.remoteSessionDetected,
        ambientBaseline: {
          capturedPhoto,
          rollNumber,
          browser: env.userAgent,
          resolution: env.screenResolution
        }
      });

      if (res.data) {
        setSignedLobbyToken(res.data.signedToken);
        setDiagnosticsHash(res.data.reportHash);
        setQrCodeDataUrl(res.data.qrCode);
        setLobbyStep(4);
      }
    } catch (err) {
      await notify.alert('Authorization Failed', {
        description: 'Failed to authorize device security clearance. Please retry check-in.',
      });
    } finally {
      setSubmittingLobby(false);
    }
  };

  // Countdown timer for Boarding Pass
  const [lobbyCountdown, setLobbyCountdown] = useState('');
  useEffect(() => {
    if (selected && lobbyStep === 4) {
      const start = new Date(selected.startTime).getTime();
      const interval = setInterval(() => {
        const diff = start - Date.now();
        if (diff <= 0) {
          setLobbyCountdown('');
          clearInterval(interval);
        } else {
          const h = Math.floor(diff / 3600000);
          const m = Math.floor((diff % 3600000) / 60000);
          const s = Math.floor((diff % 60000) / 1000);
          setLobbyCountdown(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [selected, lobbyStep]);

  const renderLobbyView = () => {
    if (!selected) return null;

    // Check if user is not joined - render pre-boarding details booking
    if (!selected.isJoined) {
      return (
        <div className="min-h-screen bg-black p-6 text-white flex items-center justify-center">
          <div className="w-full max-w-3xl bg-zinc-900 border border-white/10 rounded-3xl p-8 shadow-2xl">
            <div className="flex justify-between items-start mb-6">
              <div>
                <span className="px-2.5 py-1 bg-yellow-500/10 text-yellow-400 text-xs font-bold rounded-lg border border-yellow-500/20">
                  ASSESSMENT GATE DETECTED
                </span>
                <h1 className="text-3xl font-black mt-2 text-white">{selected.title}</h1>
                {selected.description && <p className="text-gray-400 text-sm mt-2">{selected.description}</p>}
              </div>
              <button onClick={() => setSelected(null)} className="p-2 bg-white/5 hover:bg-white/10 rounded-xl transition text-gray-400 hover:text-white">
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-6 border-y border-white/5 mb-6 text-sm">
              <div>
                <div className="text-gray-500 text-xs uppercase font-semibold">Start Time</div>
                <div className="font-bold mt-0.5 text-white">{new Date(selected.startTime).toLocaleString()}</div>
              </div>
              <div>
                <div className="text-gray-500 text-xs uppercase font-semibold">End Time</div>
                <div className="font-bold mt-0.5 text-white">{new Date(selected.endTime).toLocaleString()}</div>
              </div>
              <div>
                <div className="text-gray-500 text-xs uppercase font-semibold">Duration</div>
                <div className="font-bold mt-0.5 text-white">{selected.duration} Minutes</div>
              </div>
              <div>
                <div className="text-gray-500 text-xs uppercase font-semibold">Difficulty</div>
                <span className={`inline-block mt-1 px-2.5 py-0.5 rounded text-xs font-semibold ${DIFFICULTY_COLORS[selected.difficulty] || 'text-gray-400'}`}>
                  {selected.difficulty}
                </span>
              </div>
            </div>

            {/* Do's and Don'ts / Guidelines */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="bg-green-500/5 border border-green-500/10 rounded-2xl p-5">
                <h3 className="text-sm font-bold text-green-400 mb-3 uppercase tracking-wider">Do's (Checklist)</h3>
                <ul className="text-xs text-gray-400 space-y-2 list-disc pl-4">
                  <li>Keep your webcam and microphone active.</li>
                  <li>Perform the diagnostic system checks on the next screen.</li>
                  <li>Disconnect external monitors and close cheat extensions.</li>
                  <li>Remain focused on the exam browser window at all times.</li>
                </ul>
              </div>

              <div className="bg-red-500/5 border border-red-500/10 rounded-2xl p-5">
                <h3 className="text-sm font-bold text-red-400 mb-3 uppercase tracking-wider">Don'ts (Violations)</h3>
                <ul className="text-xs text-gray-400 space-y-2 list-disc pl-4">
                  <li>Do not switch browser tabs or open developers console tools (F12).</li>
                  <li>Do not copy, paste, or right-click within the browser window.</li>
                  <li>Do not use virtual camera software or screenshot loop systems.</li>
                  <li>Do not cover your webcam or mute your microphone.</li>
                </ul>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500 font-mono">Status: Passenger not checked-in</span>
              <button
                onClick={() => handleJoin(selected.id)}
                disabled={joining}
                className="px-6 py-3 bg-[var(--accent-green)] text-black font-extrabold rounded-xl hover:opacity-90 transition disabled:opacity-50 flex items-center gap-2"
              >
                {joining ? 'Booking Pass...' : 'Book Boarding Pass'}
              </button>
            </div>
          </div>
        </div>
      );
    }

    const steps = [
      { title: 'Identity', desc: 'Secure profile photo & roll number' },
      { title: 'Liveness', desc: 'Webcam gesture challenge' },
      { title: 'Diagnostics', desc: 'Latency, warm-up & monitors checks' },
      { title: 'Boarding Pass', desc: 'Secure session pass issued' }
    ];

    return (
      <div className="min-h-screen bg-black p-4 md:p-6 text-white flex flex-col items-center justify-center">
        {/* Progress Stepper Header */}
        <LobbyStepper currentStep={lobbyStep} steps={steps} />

        {/* Dynamic Checkpoint wizard */}
        <div className="w-full flex justify-center items-center">
          {/* Checkpoint 1: Identity Profile Capture */}
          {lobbyStep === 1 && (
            <div className="w-full max-w-xl bg-zinc-900 border border-white/10 rounded-2xl p-6 shadow-xl flex flex-col items-center">
              <div className="text-center mb-6">
                <h2 className="text-xl font-bold tracking-tight text-white flex items-center justify-center gap-2">
                  <svg className="w-6 h-6 text-[var(--accent-blue)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Checkpoint 1: Identity & Credentials
                </h2>
                <p className="text-xs text-gray-400 mt-1">Capture your baseline verification photo and input your identification roll number.</p>
              </div>

              {/* Webcam profile setup */}
              <div className="w-full mb-6 flex flex-col items-center">
                {capturedPhoto ? (
                  <div className="relative w-64 h-48 border border-white/10 rounded-xl overflow-hidden shadow-lg bg-black">
                    <img src={capturedPhoto} alt="Baseline capture" className="w-full h-full object-cover scale-x-[-1]" />
                    <button
                      onClick={() => {
                        setCapturedPhoto(null);
                        startPhotoCamera();
                      }}
                      className="absolute bottom-2 right-2 px-3 py-1 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-lg transition"
                    >
                      Retake
                    </button>
                  </div>
                ) : (
                  <div className="relative w-64 h-48 border border-white/10 rounded-xl overflow-hidden shadow-lg bg-black flex flex-col items-center justify-center">
                    {photoStream ? (
                      <>
                        <video
                          ref={photoVideoRef}
                          autoPlay
                          playsInline
                          muted
                          className="w-full h-full object-cover scale-x-[-1]"
                        />
                        <button
                          onClick={capturePhoto}
                          className="absolute bottom-2 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold rounded-lg shadow-md transition"
                        >
                          Capture Profile
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={startPhotoCamera}
                        className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold rounded-lg shadow transition"
                      >
                        Enable Camera Stream
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Roll Number Input */}
              <div className="w-full max-w-sm mb-6">
                <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Candidate Roll Number / ID</label>
                <input
                  type="text"
                  value={rollNumber}
                  onChange={(e) => setRollNumber(e.target.value)}
                  placeholder="e.g. ROLL2026_094"
                  className="w-full bg-black border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500 transition font-mono"
                />
              </div>

              <div className="w-full flex justify-between mt-4">
                <button
                  onClick={closeLobby}
                  className="px-4 py-2 border border-white/10 text-gray-400 font-semibold rounded-lg hover:bg-white/5 transition"
                >
                  Exit Gate
                </button>
                <button
                  disabled={!capturedPhoto || !rollNumber.trim()}
                  onClick={() => setLobbyStep(2)}
                  className="px-5 py-2 bg-[var(--accent-green)] text-black font-extrabold rounded-lg hover:opacity-90 transition disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Confirm & Continue
                </button>
              </div>
            </div>
          )}

          {/* Checkpoint 2: Liveness Biometric Challenge */}
          {lobbyStep === 2 && (
            <LivenessCheck
              onPrev={() => {
                stopPhotoStream();
                setLobbyStep(1);
              }}
              onComplete={(result) => {
                setLivenessResult(result);
                setLobbyStep(3);
              }}
            />
          )}

          {/* Checkpoint 3: Hardware Diagnostics & Environment Checks */}
          {lobbyStep === 3 && (
            submittingLobby ? (
              <div className="w-full max-w-xl bg-zinc-900 border border-white/10 rounded-2xl p-8 flex flex-col items-center justify-center shadow-xl">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent-green)] mb-4"></div>
                <p className="text-sm font-semibold tracking-tight text-white">Authorizing Gate Clearance...</p>
                <p className="text-xs text-gray-400 mt-1">Encrypting device baseline signatures & signing boarding pass</p>
              </div>
            ) : (
              <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-6">
                <NetworkDiagnostics
                  contestId={selected.id}
                  onPrev={() => setLobbyStep(2)}
                  onComplete={(metrics) => {
                    setNetworkMetrics(metrics);
                    if (envDetails) {
                      submitDiagnostics(metrics, envDetails);
                    }
                  }}
                />
                <EnvironmentIntegrityCheck
                  contestId={selected.id}
                  integrityTier={selected.integrityTier || 'standard'}
                  onPrev={() => setLobbyStep(2)}
                  onComplete={(details) => {
                    setEnvDetails(details);
                    if (networkMetrics) {
                      submitDiagnostics(networkMetrics, details);
                    }
                  }}
                />
              </div>
            )
          )}

          {/* Checkpoint 4: Issue Boarding Pass Ticket */}
          {lobbyStep === 4 && (
            <BoardingPass
              studentName={user?.name || user?.email || 'Candidate'}
              contestTitle={selected.title}
              problemsCount={selected._count?.problems || 0}
              durationMins={selected.duration}
              qrCodeUrl={qrCodeDataUrl}
              reportHash={diagnosticsHash}
              isUpcoming={new Date(selected.startTime).getTime() > Date.now()}
              countdownString={lobbyCountdown}
              onEnterSandbox={() => setShowSandbox(true)}
              onEnterContest={() => {
                setActiveContest(selected);
                closeLobby();
              }}
            />
          )}
        </div>
      </div>
    );
  };

  // New Custom States for Sidebar, Zen Mode, Timers, Alerting
  const { user } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'problems' | 'submissions'>('problems');
  const [bookmarkedProblems, setBookmarkedProblems] = useState<Set<string>>(new Set());
  const [problemTimers, setProblemTimers] = useState<Record<string, number>>({});
  const [zenMode, setZenMode] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [leaderboardPeek, setLeaderboardPeek] = useState<LeaderboardEntry[]>([]);
  const [attemptedProblems, setAttemptedProblems] = useState<Set<string>>(new Set());
  const [activeProblemSubmissions, setActiveProblemSubmissions] = useState<any[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [playgroundKey, setPlaygroundKey] = useState(0);
  const [contestRemainingSeconds, setContestRemainingSeconds] = useState<number | null>(null);
  const [alertDismissed, setAlertDismissed] = useState<Record<string, boolean>>({});

  const formatRemainingTime = (seconds: number | null) => {
    if (seconds === null) return '--h : --m : --s';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2, '0')}h : ${String(m).padStart(2, '0')}m : ${String(s).padStart(2, '0')}s`;
  };

  const { setSidebarHidden } = useSidebar();

  useEffect(() => {
    setSidebarHidden(!!activeContest || !!selected);
    return () => setSidebarHidden(false);
  }, [activeContest, selected, setSidebarHidden]);



  // Exam Lab state
  const [examCategories, setExamCategories] = useState<ExamCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<ExamCategory | null>(null);
  const [examQuestions, setExamQuestions] = useState<ExamQuestion[]>([]);
  const [examAnswers, setExamAnswers] = useState<Record<number, string>>({});
  const [examEvaluating, setExamEvaluating] = useState(false);
  const [examResult, setExamResult] = useState<{ score: number; total: number; evaluatedAnswers: any[] } | null>(null);
  const [examAttempts, setExamAttempts] = useState<ExamAttempt[]>([]);
  const [examView, setExamView] = useState<'categories' | 'exam' | 'result' | 'history'>('categories');
  const [examLoading, setExamLoading] = useState(false);

  // Live contests (Codeforces + Internal) state
  type LivePlatformFilter = 'all' | 'codeforces' | 'internal';
  const [liveContests, setLiveContests] = useState<any[]>([]);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveFilter, setLiveFilter] = useState<LivePlatformFilter>('all');
  const [liveAutoRefresh, setLiveAutoRefresh] = useState(true);

  const loadExamCategories = async () => {
    setExamLoading(true);
    try {
      const data = await api.getExamCategories();
      setExamCategories(data.categories || []);
    } catch (err) { console.error('Operation failed:', err); } finally { setExamLoading(false); }
  };

  const loadExamAttempts = async () => {
    try {
      const data = await api.getExamAttempts();
      setExamAttempts(data.attempts || []);
    } catch (err) { console.error('Operation failed:', err); }
  };

  const loadLiveContests = useCallback(async () => {
    setLiveLoading(true);
    try {
      const data = await api.getLiveUpcomingContests();
      setLiveContests(data.contests || []);
    } catch (err) {
      console.error('Failed to load live contests:', err);
      setLiveContests([]);
    } finally {
      setLiveLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'live-contests') {
      loadLiveContests();
    }
  }, [tab, loadLiveContests]);

  useEffect(() => {
    if (tab !== 'live-contests' || !liveAutoRefresh) return;
    const id = setInterval(loadLiveContests, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [tab, liveAutoRefresh, loadLiveContests]);

  const startExam = async (category: ExamCategory) => {
    setSelectedCategory(category);
    setExamResult(null);
    setExamAnswers({});
    setExamView('exam');
    try {
      const data = await api.getExamQuestions(category.id);
      setExamQuestions(data.questions || []);
    } catch (err) { console.error('Operation failed:', err); }
  };

  const handleExamAnswer = (questionId: number, answer: string) => {
    setExamAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  const handleExamSubmit = async () => {
    if (!selectedCategory) return;
    setExamEvaluating(true);
    try {
      const answers = Object.entries(examAnswers).map(([questionId, answer]) => ({
        questionId: Number(questionId),
        answer,
      }));
      const data = await api.evaluateExam({ categoryId: selectedCategory.id, answers });
      setExamResult(data);
      setExamView('result');
      await api.saveExamAttempt({
        categoryId: selectedCategory.id,
        answers: examAnswers,
        score: data.score,
        total: data.total,
      });
      await loadExamAttempts();
    } catch (err) { console.error('Operation failed:', err); } finally { setExamEvaluating(false); }
  };

  useEffect(() => {
    if (tab === 'exam') {
      loadExamCategories();
      loadExamAttempts();
    }
  }, [tab]);

  const examScorePercent = examResult ? Math.round((examResult.score / examResult.total) * 100) : 0;

  const [searchQuery, setSearchQuery] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState<DifficultyFilter>('all');
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const loadContests = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [contestsData, myData] = await Promise.all([
        api.getManagerContests(),
        api.getMyParticipations().catch(() => ({ participations: [] }))
      ]);
      setContests(contestsData.contests || []);
      setParticipations(myData.participations || []);
      try { sessionStorage.setItem('contests:list', JSON.stringify(contestsData.contests || [])); } catch (err) { console.error('Operation failed:', err); }
    } catch (err: unknown) {
      setError(err instanceof Error ? (axios.isAxiosError(err) ? err.response?.data?.error || err.message : err.message) : 'Failed to load contests');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadContests(); }, [loadContests]);

  // SEB Dynamic URL verification handler on page load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const contestIdParam = params.get('contestId');
    const sessionTokenParam = params.get('sessionToken');

    if (contestIdParam && sessionTokenParam) {
      const verifyAndEnter = async () => {
        setLoading(true);
        setError('');
        try {
          const res = await api.verifySeb(contestIdParam, sessionTokenParam);
          if (res.verified && res.activeSessionToken) {
            sessionStorage.setItem(`activeSessionToken_${contestIdParam}`, res.activeSessionToken);
            
            // Get full contest details and enter secure environment
            const detailData = await api.getManagerContest(contestIdParam);
            setSelected(detailData.contest);
            setSelected(prev => prev ? { ...prev, isJoined: detailData.isJoined, isActive: detailData.isActive } : null);
            setParticipantDetails(detailData.participant || null);
            setActiveContest({
              ...detailData.contest,
              isJoined: detailData.isJoined,
              isActive: detailData.isActive
            });
            
            notify.toast.success("Safe Exam Browser validation successful!");
          } else {
            setError(res.error || "Failed to verify Safe Exam Browser signature.");
          }
        } catch (err: any) {
          setError(err.response?.data?.error || "This operation must be performed inside Safe Exam Browser.");
        } finally {
          setLoading(false);
          // Clean parameters from URL address bar
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      };
      verifyAndEnter();
    }
  }, [notify]);

  // Load solved problems and score from sessionStorage when contest changes
  useEffect(() => {
    if (activeContest) {
      const savedSolved = sessionStorage.getItem(`solvedProblems_${activeContest.id}`);
      if (savedSolved) {
        try {
          const ids = JSON.parse(savedSolved) as string[];
          setSolvedProblems(new Set(ids));
        } catch { /* ignore */ }
      }
      const savedScore = sessionStorage.getItem(`contestScore_${activeContest.id}`);
      if (savedScore) {
        setContestScore(parseInt(savedScore, 10) || 0);
      }
    } else {
      setSolvedProblems(new Set());
      setContestScore(0);
    }
  }, [activeContest]);

  // Load local state when contest starts
  useEffect(() => {
    if (activeContest) {
      // Bookmarks
      const savedBookmarked = localStorage.getItem(`bookmarked_${activeContest.id}`);
      if (savedBookmarked) {
        try {
          setBookmarkedProblems(new Set(JSON.parse(savedBookmarked)));
        } catch (err) { console.error('Operation failed:', err); }
      } else {
        setBookmarkedProblems(new Set());
      }

      // Timers
      const savedTimers = localStorage.getItem(`timers_${activeContest.id}`);
      if (savedTimers) {
        try {
          setProblemTimers(JSON.parse(savedTimers));
        } catch (err) { console.error('Operation failed:', err); }
      } else {
        setProblemTimers({});
      }

      // Fetch user attempts to populate attemptedProblems (WA status)
      const fetchUserAttempts = async () => {
        try {
          const res = await api.get('/submissions');
          const subs = res.submissions || [];
          const attempts = new Set<string>();
          subs.forEach((sub: any) => {
            if (sub.status !== 'passed') {
              attempts.add(sub.problemId);
            }
          });
          setAttemptedProblems(attempts);
        } catch (e) {
          console.error(e);
        }
      };
      fetchUserAttempts();
    }
  }, [activeContest]);

  // Sync solvedProblems, score, and new attempts periodically with Playground session storage updates
  useEffect(() => {
    if (!activeContest || !solvingProblem) return;
    const syncInterval = setInterval(() => {
      // Sync solved problems
      const savedSolved = sessionStorage.getItem(`solvedProblems_${activeContest.id}`);
      if (savedSolved) {
        try {
          const ids = JSON.parse(savedSolved) as string[];
          setSolvedProblems(prev => {
            if (prev.size !== ids.length) {
              return new Set(ids);
            }
            return prev;
          });
        } catch (err) { console.error('Operation failed:', err); }
      }

      // Sync score
      const savedScore = sessionStorage.getItem(`contestScore_${activeContest.id}`);
      if (savedScore) {
        const score = parseInt(savedScore, 10) || 0;
        setContestScore(score);
      }
    }, 1000);

    return () => clearInterval(syncInterval);
  }, [activeContest, solvingProblem]);

  // Detect contest problem from URL params (direct nav or back button)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pid = params.get('problem');
    const cid = params.get('contestId');
    if (pid && cid && activeContest && activeContest.id === cid) {
      const cp = activeContest.problems?.find(p => p.problem.id === pid);
      if (cp) {
        setSolvingProblem({ id: pid, type: cp.problem.problemType || 'code' });
      }
    }
  }, [activeContest]);

  const fetchMyLogs = async (contestId: string) => {
    try {
      const res = await api.getMyContestLogs(contestId);
      setMyContestLogs(res.logs || []);
      setLogsModalOpen(true);
    } catch (err) {
      notify.toast.error("Failed to load your proctoring logs.");
    }
  };

  const openDetail = async (id: string) => {
    setDetailLoading(true); setLeaderboard([]);
    try {
      const [detailData, lbData] = await Promise.all([
        api.getManagerContest(id),
        api.getContestLeaderboard(id),
      ]);
      setSelected(detailData.contest);
      setSelected(prev => prev ? { ...prev, isJoined: detailData.isJoined, isActive: detailData.isActive } : null);
      setParticipantDetails(detailData.participant || null);
      setLeaderboard(lbData.leaderboard || []);
    } catch (err) { console.error(err); }
    finally { setDetailLoading(false); }
  };

  const handleJoin = async (contestId: string) => {
    setJoining(true);
    try {
      const res = await api.joinManagerContest(contestId);
      if (res.participant?.activeSessionToken) {
        sessionStorage.setItem(`activeSessionToken_${contestId}`, res.participant.activeSessionToken);
      }
      setParticipantDetails(res.participant || null);
      if (selected) setSelected({ ...selected, isJoined: true });
    } catch (err: unknown) {
      notify.toast.error(err instanceof Error ? (axios.isAxiosError(err) ? err.response?.data?.error || err.message : err.message) : 'Failed to join');
    } finally { setJoining(false); }
  };

  const getTimeStatusForContest = useCallback((contest: any, currentNow: number): TabKey => {
    const start = new Date(contest.startTime).getTime();
    const end = new Date(contest.endTime).getTime();
    if (currentNow < start) return "upcoming";
    if (currentNow >= start && currentNow <= end) return "active";
    return "ended";
  }, []);

  const displayContests = useMemo(() => {
    if (tab === 'my') return [];
    return contests
      .filter((c) => {
        if (tab !== 'active' && tab !== 'upcoming' && tab !== 'ended') return true;
        return getTimeStatusForContest(c, now) === tab;
      })
      .filter((c) =>
        searchQuery.trim()
          ? c.title.toLowerCase().includes(searchQuery.trim().toLowerCase())
          : true
      )
      .filter((c) =>
        difficultyFilter === 'all' ? true : c.difficulty === difficultyFilter
      );
  }, [contests, tab, searchQuery, difficultyFilter, now, getTimeStatusForContest]);

  const tabCounts = useMemo(() => {
    return contests.reduce(
      (acc, c) => {
        const st = getTimeStatusForContest(c, now);
        if (acc[st] !== undefined) acc[st]++;
        return acc;
      },
      { active: 0, upcoming: 0, ended: 0 } as Record<TabKey, number>
    );
  }, [contests, now, getTimeStatusForContest]);

  const telemetryStats = useMemo(() => {
    const total = contests.length;
    const live = tabCounts.active;
    const joined = participations.length;
    const submissions = participations.reduce((acc, p) => acc + (p.solvedCount || 0), 0);
    return { total, live, joined, submissions };
  }, [contests, tabCounts, participations]);

  const toggleProblemBookmark = (probId: string) => {
    setBookmarkedProblems(prev => {
      const next = new Set(prev);
      if (next.has(probId)) {
        next.delete(probId);
      } else {
        next.add(probId);
      }
      if (activeContest) {
        localStorage.setItem(`bookmarked_${activeContest.id}`, JSON.stringify(Array.from(next)));
      }
      return next;
    });
  };

  const formatMiniTimer = (seconds: number) => {
    if (!seconds) return '0s';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  // Mini timer tick
  useEffect(() => {
    if (!activeContest || !solvingProblem || zenMode) return;
    const interval = setInterval(() => {
      setProblemTimers(prev => {
        const next = { ...prev, [solvingProblem.id]: (prev[solvingProblem.id] || 0) + 1 };
        localStorage.setItem(`timers_${activeContest.id}`, JSON.stringify(next));
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [activeContest, solvingProblem, zenMode]);

  // Submissions fetcher
  const fetchActiveProblemSubmissions = async (probId: string) => {
    setSubmissionsLoading(true);
    try {
      const res = await api.get(`/submissions?problemId=${probId}`);
      setActiveProblemSubmissions(res.submissions || []);
    } catch (e) {
      console.error(e);
    } finally {
      setSubmissionsLoading(false);
    }
  };

  useEffect(() => {
    if (solvingProblem?.id && (sidebarTab === 'submissions' || isSidebarOpen)) {
      fetchActiveProblemSubmissions(solvingProblem.id);
    }
  }, [solvingProblem?.id, sidebarTab, isSidebarOpen]);

  const handleLoadSubmissionCode = async (sub: any) => {
    if (!solvingProblem || !sub.code) return;
    if (await notify.confirm('Load submission code?', { description: "Your current unsaved changes will be overwritten." })) {
      const key = `code_playground_${solvingProblem.id}_${sub.language || 'python'}`;
      localStorage.setItem(key, sub.code);
      setPlaygroundKey(prev => prev + 1); // remount
      setIsSidebarOpen(false); // close sidebar
    }
  };

  // Live leaderboard peek polling
  useEffect(() => {
    if (!activeContest) return;
    const loadLeaderboard = async () => {
      try {
        const res = await api.getContestLeaderboard(activeContest.id);
        setLeaderboardPeek(res.leaderboard || []);
      } catch (e) {
        console.error(e);
      }
    };
    loadLeaderboard();
    const interval = setInterval(loadLeaderboard, 30000);
    return () => clearInterval(interval);
  }, [activeContest]);

  // Keyboard shortcut listener
  useEffect(() => {
    if (!activeContest || !solvingProblem) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isTyping = activeEl && (
        activeEl.tagName === 'INPUT' ||
        activeEl.tagName === 'TEXTAREA' ||
        activeEl.closest('.monaco-editor') !== null ||
        activeEl.closest('.cm-editor') !== null ||
        (activeEl as HTMLElement).isContentEditable
      );

      if (!isTyping) {
        if (e.key === '?') {
          e.preventDefault();
          setShowShortcuts(prev => !prev);
        } else if (e.key.toLowerCase() === 'h') {
          e.preventDefault();
          setIsSidebarOpen(prev => !prev);
        } else if (e.key.toLowerCase() === 'z') {
          e.preventDefault();
          setZenMode(prev => !prev);
        } else if (e.key === '[' || e.key === 'ArrowLeft') {
          e.preventDefault();
          const problems = activeContest.problems || [];
          const idx = problems.findIndex(p => p.problem.id === solvingProblem.id);
          if (idx > 0) {
            const prevProb = problems[idx - 1].problem;
            const params = new URLSearchParams(window.location.search);
            params.set('problem', prevProb.id);
            params.set('contestId', activeContest.id);
            window.history.pushState({}, '', `${window.location.pathname}?${params.toString()}`);
            setSolvingProblem({ id: prevProb.id, type: prevProb.problemType || 'code' });
          }
        } else if (e.key === ']' || e.key === 'ArrowRight') {
          e.preventDefault();
          const problems = activeContest.problems || [];
          const idx = problems.findIndex(p => p.problem.id === solvingProblem.id);
          if (idx < problems.length - 1) {
            const nextProb = problems[idx + 1].problem;
            const params = new URLSearchParams(window.location.search);
            params.set('problem', nextProb.id);
            params.set('contestId', activeContest.id);
            window.history.pushState({}, '', `${window.location.pathname}?${params.toString()}`);
            setSolvingProblem({ id: nextProb.id, type: nextProb.problemType || 'code' });
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeContest, solvingProblem, activeContest?.problems]);

  // Ticker for contest end and alerts
  useEffect(() => {
    if (!activeContest) {
      setContestRemainingSeconds(null);
      setAlertDismissed({});
      return;
    }

    const updateTime = async () => {
      const diff = new Date(activeContest.endTime).getTime() - Date.now();
      const seconds = Math.max(0, Math.floor(diff / 1000));
      setContestRemainingSeconds(seconds);

      if (seconds <= 0) {
        clearInterval(timeOutInterval);
        const expiredId = activeContest.id;
        setActiveContest(null);
        setSolvingProblem(null);
        if (document.fullscreenElement) document.exitFullscreen().catch(() => { });
        await notify.alert("Time's Up!", {
          description: "Your contest has been submitted automatically."
        });
        navigate(`/contests/${expiredId}/report`);
      }
    };

    updateTime();
    const timeOutInterval = setInterval(updateTime, 1000);
    return () => clearInterval(timeOutInterval);
  }, [activeContest]);

  // Esc key handler
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setZenMode(false);
        setShowShortcuts(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  if (activeContest) {
    const isRunningInSeb = navigator.userAgent.toLowerCase().includes('seb') || navigator.userAgent.toLowerCase().includes('safeexambrowser');
    const isLinuxOrChromeOs = /Linux|CrOS/i.test(navigator.userAgent || navigator.platform || "");

    const handleDownloadSebConfig = async () => {
      try {
        const blob = await api.downloadSebConfig(activeContest.id);
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `${activeContest.title.replace(/\s+/g, '_')}_config.seb`);
        document.body.appendChild(link);
        link.click();
        link.parentNode?.removeChild(link);
        notify.toast.success("SEB configuration downloaded! Please open it to launch the test.");
      } catch (err) {
        notify.toast.error("Failed to download Safe Exam Browser configuration.");
      }
    };

    const handleOneClickLaunch = async () => {
      try {
        const { sessionToken } = await api.getSebToken(activeContest.id);
        const frontendUrl = window.location.origin;
        const sebUrl = `${frontendUrl.replace(/^https?:/, window.location.protocol === 'https:' ? 'sebs:' : 'seb:')}/contests?contestId=${activeContest.id}&sessionToken=${sessionToken}`;
        window.location.href = sebUrl;
      } catch (err) {
        notify.toast.error("Failed to generate launch token. Please try again.");
      }
    };

    if (activeContest.requireSeb && !isRunningInSeb && !isLinuxOrChromeOs) {
      return (
        <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
          <div className="w-full max-w-2xl bg-zinc-900 border border-white/10 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
            {/* Ambient Background Glow */}
            <div className="absolute -top-40 -right-40 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-red-500/5 rounded-full blur-3xl pointer-events-none" />

            <div className="flex justify-between items-start mb-6 border-b border-white/5 pb-6">
              <div>
                <span className="px-3 py-1 bg-amber-500/10 text-[var(--accent-yellow)] text-xs font-bold rounded-lg border border-amber-500/20 uppercase tracking-widest">
                  🔒 SECURE ENVIRONMENT REQUIRED
                </span>
                <h1 className="text-3xl font-black mt-3 text-white tracking-tight">
                  Launch Safe Exam Browser<span className="text-[var(--accent-yellow)]">.</span>
                </h1>
                <p className="text-gray-400 text-sm mt-2">
                  To take <span className="text-white font-bold">{activeContest.title}</span>, you must use Safe Exam Browser to prevent unauthorized actions and cheat aids.
                </p>
              </div>
              <button 
                onClick={() => {
                  setActiveContest(null);
                  setSolvingProblem(null);
                  window.history.pushState({}, '', window.location.pathname);
                }} 
                className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl transition text-gray-400 hover:text-white"
                title="Go back to contests list"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6 mb-8 text-sm">
              <div className="bg-zinc-950 border border-white/5 rounded-2xl p-5 space-y-4">
                <h3 className="font-extrabold text-white flex items-center gap-2">
                  <span className="text-amber-400">⚡</span>
                  Quick Start Instructions
                </h3>
                
                <div className="space-y-4 font-medium text-gray-300">
                  <div className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-white/5 text-xs text-white font-bold flex items-center justify-center shrink-0">1</span>
                    <p className="text-xs">
                      Make sure <span className="text-white font-bold">Safe Exam Browser (SEB)</span> is installed on your computer. If not, download it for:{" "}
                      <a href="https://safeexambrowser.org/download_en.html" target="_blank" rel="noopener noreferrer" className="text-[var(--accent-blue)] hover:underline font-bold">Windows / macOS ↗</a>
                    </p>
                  </div>
                  
                  <div className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-white/5 text-xs text-white font-bold flex items-center justify-center shrink-0">2</span>
                    <p className="text-xs">
                      Use the button below to trigger launch or download the custom secure configuration file.
                    </p>
                  </div>
                </div>
              </div>

              {/* 1-Click Launch Option */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  onClick={handleOneClickLaunch}
                  className="px-6 py-4 bg-amber-500 text-black font-extrabold rounded-2xl hover:bg-amber-400 transition shadow-lg shadow-amber-500/10 flex flex-col items-center justify-center text-center gap-1 group"
                >
                  <span className="text-sm">🚀 1-Click Launch</span>
                  <span className="text-[10px] text-black/70 font-medium group-hover:text-black transition">Recommended for installed SEB client</span>
                </button>

                <button
                  onClick={handleDownloadSebConfig}
                  className="px-6 py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-extrabold rounded-2xl transition flex flex-col items-center justify-center text-center gap-1 group"
                >
                  <span className="text-sm">📥 Download SEB Config</span>
                  <span className="text-[10px] text-gray-400 font-medium group-hover:text-gray-200 transition">Alternative setup (.seb file)</span>
                </button>
              </div>
            </div>

            <div className="flex justify-between items-center text-[10px] text-gray-500 font-mono border-t border-white/5 pt-4">
              <span>Detected Platform: {navigator.platform}</span>
              <span>Quit Passcode: Configured by examiner</span>
            </div>
          </div>
        </div>
      );
    }

    const handleLeave = async () => {
      if (await notify.confirm('Leave contest?', { description: 'Are you sure you want to leave the contest?' })) {
        setActiveContest(null);
        setSolvingProblem(null);
        window.history.pushState({}, '', window.location.pathname);
        if (document.fullscreenElement) document.exitFullscreen().catch(e => console.error(e));
      }
    };

    const handleFinishContest = async () => {
      const ok = await notify.confirm('Final Submit Contest?', {
        description: 'Are you sure you want to finish and submit the contest? You will not be able to change your answers after submitting.'
      });
      if (!ok) return;

      try {
        await api.finalizeContest(activeContest.id);
        notify.toast.success("Contest submitted successfully!");
        const finishedId = activeContest.id;
        setActiveContest(null);
        setSolvingProblem(null);
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        }
        navigate(`/contests/${finishedId}/report`);
      } catch (err) {
        notify.toast.error("Failed to finalize contest. Please try again.");
      }
    };

    const handleBackToProblems = () => {
      window.history.pushState({}, '', window.location.pathname);
      setSolvingProblem(null);
    };

    const securityFlags = {
      requireFullscreen: activeContest.requireFullscreen ?? false,
      preventTabSwitch: activeContest.preventTabSwitch ?? false,
      disableCopyPaste: activeContest.disableCopyPaste ?? false,
      enableProctoring: activeContest.enableProctoring ?? false,
      allowMultipleMonitors: activeContest.allowMultipleMonitors ?? false,
      pasteMode: activeContest.pasteMode ?? 'LOG_ONLY' as const,
      faceCheckEnabled: activeContest.faceCheckEnabled ?? false,
      voiceCheckEnabled: activeContest.voiceCheckEnabled ?? false,
      snapshotIntervalSeconds: activeContest.snapshotIntervalSeconds ?? 45,
      maxWarnings: activeContest.maxWarnings ?? 3
    };
    const handleSelectProblem = (prob: any) => {
      if (solvedProblems.has(prob.id)) {
        notify.toast.info(`Problem Locked: Problem "${prob.title}" has been successfully solved and locked!`);
        return;
      }
      const params = new URLSearchParams(window.location.search);
      params.set('problem', prob.id);
      params.set('contestId', activeContest.id);
      window.history.pushState({}, '', `${window.location.pathname}?${params.toString()}`);
      setSolvingProblem({ id: prob.id, type: prob.problemType || 'code' });
    };

    // Solving view - renders playground inline to keep SecureContestWrapper mounted
    if (solvingProblem) {
      const PlaygroundComponent = solvingProblem.type === 'web-dev'
        ? WebPlaygroundPage
        : solvingProblem.type === 'sql'
          ? SqlPlaygroundPage
          : CodePlaygroundPage;

      const currentProbIndex = activeContest.problems?.findIndex(p => p.problem.id === solvingProblem.id) ?? -1;
      const currentProbDetail = activeContest.problems?.[currentProbIndex];
      const currentProbTitle = currentProbDetail?.problem.title || '';

      const isCurrentBookmarked = bookmarkedProblems.has(solvingProblem.id);

      return (
        <SecureContestWrapper contestId={activeContest.id} flags={securityFlags}>
          <div className="flex flex-col h-screen bg-black text-white relative font-sans select-none overflow-hidden">

            {/* Pulsing red banner at the top if remaining time <= 5 min */}
            {contestRemainingSeconds !== null && contestRemainingSeconds <= 300 && contestRemainingSeconds > 0 && (
              <div className="bg-red-900/85 border-b border-red-500 text-red-200 text-xs font-bold text-center py-1.5 px-4 animate-pulse z-30 shrink-0">
                ⚠️ WARNING: Less than 5 minutes remaining! Your work will be automatically submitted when the contest ends.
              </div>
            )}

            {/* 30-minute warning toast */}
            {contestRemainingSeconds !== null && contestRemainingSeconds <= 1800 && contestRemainingSeconds > 0 && !alertDismissed['30min'] && (
              <div className="fixed bottom-6 right-6 z-[60] bg-zinc-900 border border-yellow-500/50 shadow-2xl shadow-yellow-500/10 rounded-xl p-4 max-w-sm flex flex-col gap-2 animate-bounce">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-yellow-500/10 rounded-lg text-yellow-500 shrink-0">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-white">Time Alert</h4>
                    <p className="text-xs text-gray-400 mt-0.5">You have less than 30 minutes remaining in this contest. Please manage your time wisely.</p>
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-2">
                  <button
                    onClick={() => setAlertDismissed(prev => ({ ...prev, '30min': true }))}
                    className="px-3 py-1 bg-yellow-500/20 text-yellow-400 text-xs font-semibold rounded hover:bg-yellow-500/30 transition"
                  >
                    Acknowledge
                  </button>
                </div>
              </div>
            )}

            {/* Solving header bar - Hidden in Zen Mode */}
            {!zenMode && (
              <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-zinc-950 shrink-0 select-none z-30">
                <div className="flex items-center gap-3">
                  {/* Hamburger Button */}
                  <button
                    onClick={() => setIsSidebarOpen(true)}
                    className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition animate-fade-in"
                    title="Toggle contest drawer (H)"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  </button>

                  {/* Title & Problem Breadcrumb */}
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-400 font-medium truncate max-w-[120px] md:max-w-none">
                      {activeContest.title}
                    </span>
                    <span className="text-gray-600">/</span>
                    <span className="text-white font-bold flex items-center gap-1.5">
                      {currentProbTitle}
                      {isCurrentBookmarked && <span title="Bookmarked">🔖</span>}
                    </span>
                    <button 
                      onClick={() => toggleProblemBookmark(solvingProblem.id)}
                      className={`text-xs ml-1 transition ${
                        isCurrentBookmarked ? 'text-yellow-400' : 'text-gray-500 hover:text-gray-300'
                      }`}
                      title={isCurrentBookmarked ? 'Unbookmark problem' : 'Bookmark problem'}
                    >
                      {isCurrentBookmarked ? '★' : '☆'}
                    </button>
                  </div>
                </div>

                {/* Center / Right controls */}
                <div className="flex items-center gap-4 text-sm">
                  {/* Per-problem timer */}
                  <div className="flex items-center gap-1.5 bg-white/5 px-2.5 py-1 rounded-md border border-white/5 font-medium text-xs text-gray-300" title="Time spent on this problem">
                    <span>⏱</span>
                    <span className="font-mono">{formatMiniTimer(problemTimers[solvingProblem.id] || 0)}</span>
                  </div>

                  {/* Contest Timer */}
                  <div className="flex items-center gap-2 bg-zinc-900 px-3 py-1 rounded-lg border border-white/10">
                    <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Remaining</span>
                    <span className="text-[var(--accent-yellow)] font-mono font-bold">
                      {formatRemainingTime(contestRemainingSeconds)}
                    </span>
                  </div>

                  {/* Zen Mode Button */}
                  <button
                    onClick={() => setZenMode(true)}
                    className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition"
                    title="Enter Focus / Zen Mode (Z)"
                  >
                    <span className="text-xs px-1 font-semibold">Zen</span>
                  </button>

                  {/* Shortcuts Button */}
                  <button
                    onClick={() => setShowShortcuts(true)}
                    className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition"
                    title="Keyboard Shortcuts (?)"
                  >
                    <span className="font-bold font-mono text-xs px-1">?</span>
                  </button>

                  <button onClick={handleFinishContest}
                    className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-black text-xs font-extrabold rounded-lg transition shadow-lg shadow-emerald-500/10"
                  >
                    Finish Contest
                  </button>

                  <button onClick={handleLeave}
                    className="px-3 py-1.5 bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 text-xs font-bold rounded-lg transition"
                    title="Exit the window temporarily without submitting"
                  >
                    Leave
                  </button>
                </div>
              </div>
            )}

            {/* Problem Heatmap Strip - Hidden in Zen Mode */}
            {!zenMode && activeContest.problems && activeContest.problems.length > 0 && (
              <div className="flex bg-zinc-950 border-b border-white/10 p-1 gap-1 select-none z-20 shrink-0">
                {activeContest.problems.map((cp, idx) => {
                  const isSolved = solvedProblems.has(cp.problem.id);
                  const isAttempted = attemptedProblems.has(cp.problem.id) && !isSolved;
                  const isCurrent = solvingProblem.id === cp.problem.id;
                  const hasBookmark = bookmarkedProblems.has(cp.problem.id);

                  let statusBg = 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400';
                  let statusBorder = 'border-zinc-700';
                  if (isSolved) {
                    statusBg = 'bg-green-600/30 hover:bg-green-600/40 text-green-400';
                    statusBorder = 'border-green-500/40';
                  } else if (isAttempted) {
                    statusBg = 'bg-yellow-600/30 hover:bg-yellow-600/40 text-yellow-400';
                    statusBorder = 'border-yellow-500/40';
                  }

                  return (
                    <button
                      key={cp.problem.id}
                      onClick={() => handleSelectProblem(cp.problem)}
                      className={`flex-1 flex items-center justify-center py-1.5 text-xs font-bold rounded border transition-all ${statusBg} ${statusBorder} ${isCurrent
                          ? 'ring-1 ring-white/60 scale-[1.01] bg-white/10 font-black'
                          : ''
                        }`}
                      title={`${String.fromCharCode(65 + idx)}. ${cp.problem.title} (${cp.problem.difficulty})`}
                    >
                      <span>{String.fromCharCode(65 + idx)}</span>
                      {hasBookmark && <span className="ml-1 text-[10px]">🔖</span>}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Floating Zen Mode Exit Button - Visible only in Zen Mode */}
            {zenMode && (
              <div className="absolute top-4 right-4 z-50 flex items-center gap-2 bg-black/80 hover:bg-black border border-white/20 p-2 rounded-lg transition group opacity-40 hover:opacity-100">
                <span className="text-[10px] text-gray-400 font-mono">Focus Mode Active</span>
                <button
                  onClick={() => setZenMode(false)}
                  className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs font-bold rounded hover:bg-red-500/30 transition"
                >
                  Exit Zen (Esc)
                </button>
              </div>
            )}

            {/* Side Drawer Component */}
            {/* Sidebar Drawer Backdrop */}
            {isSidebarOpen && !zenMode && (
              <div
                className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 transition-opacity duration-300"
                onClick={() => setIsSidebarOpen(false)}
              />
            )}

            {/* Sidebar Drawer */}
            {!zenMode && (
              <div className={`fixed top-0 left-0 h-full w-96 bg-zinc-950 border-r border-white/10 z-50 transform transition-transform duration-300 flex flex-col ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
                }`}>
                {/* Drawer Header */}
                <div className="p-4 border-b border-white/10 flex justify-between items-center bg-zinc-900 shrink-0">
                  <div>
                    <h3 className="text-sm font-bold text-white tracking-wide">Contest Navigation</h3>
                    <p className="text-[10px] text-gray-400 truncate max-w-[240px]">{activeContest.title}</p>
                  </div>
                  <button
                    onClick={() => setIsSidebarOpen(false)}
                    className="p-1 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Drawer Tabs selection */}
                <div className="flex border-b border-white/10 px-4 bg-zinc-900 shrink-0">
                  <button
                    onClick={() => setSidebarTab('problems')}
                    className={`flex-1 py-2.5 text-center text-xs font-semibold border-b-2 transition ${sidebarTab === 'problems'
                        ? 'border-[var(--accent-green)] text-white'
                        : 'border-transparent text-gray-400 hover:text-white'
                      }`}
                  >
                    Problems
                  </button>
                  <button
                    onClick={() => setSidebarTab('submissions')}
                    className={`flex-1 py-2.5 text-center text-xs font-semibold border-b-2 transition ${sidebarTab === 'submissions'
                        ? 'border-[var(--accent-green)] text-white'
                        : 'border-transparent text-gray-400 hover:text-white'
                      }`}
                  >
                    Submissions
                  </button>
                </div>

                {/* Drawer Body content */}
                {sidebarTab === 'problems' ? (
                  <>
                    {/* Progress Summary */}
                    {(() => {
                      const totalProblems = activeContest.problems?.length || 0;
                      const solvedCount = solvedProblems.size;
                      const attemptedCount = new Set([...Array.from(solvedProblems), ...Array.from(attemptedProblems)]).size;
                      const progressPercent = totalProblems > 0 ? (solvedCount / totalProblems) * 100 : 0;

                      return (
                        <div className="p-4 border-b border-white/5 bg-white/[0.01] shrink-0">
                          <div className="flex justify-between items-center text-xs text-gray-400 mb-1.5">
                            <span>Solved Status</span>
                            <span className="font-semibold text-white">{solvedCount} / {totalProblems} Solved</span>
                          </div>
                          <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full bg-[var(--accent-green)] rounded-full transition-all duration-300" style={{ width: `${progressPercent}%` }} />
                          </div>
                          <div className="text-[10px] text-gray-500 mt-1 flex justify-between">
                            <span>{attemptedCount} / {totalProblems} Attempted</span>
                            <span>Student: {user?.name || 'Candidate'}</span>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Scrollable list */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-2">
                      {activeContest.problems?.map((cp, idx) => {
                        const isSolved = solvedProblems.has(cp.problem.id);
                        const isAttempted = attemptedProblems.has(cp.problem.id) && !isSolved;
                        const isCurrent = solvingProblem.id === cp.problem.id;
                        const hasBookmark = bookmarkedProblems.has(cp.problem.id);
                        const elapsed = problemTimers[cp.problem.id] || 0;

                        return (
                          <div
                            key={cp.problem.id}
                            onClick={() => {
                              handleSelectProblem(cp.problem);
                              setIsSidebarOpen(false);
                            }}
                            className={`group p-3 rounded-lg border transition cursor-pointer flex items-center justify-between ${isCurrent
                                ? 'bg-zinc-900 border-[var(--accent-green)] shadow-[0_0_10px_rgba(34,197,94,0.15)]'
                                : 'bg-white/[0.02] border-white/10 hover:border-white/20 hover:bg-white/[0.04]'
                              }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0 ${isSolved
                                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                  : isAttempted
                                    ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                                    : 'bg-white/10 text-white'
                                }`}>
                                {isSolved ? '✓' : String.fromCharCode(65 + idx)}
                              </span>
                              <div className="min-w-0">
                                <div className="text-xs font-bold truncate text-white group-hover:text-[var(--accent-green)] transition">
                                  {cp.problem.title}
                                </div>
                                <div className="flex items-center gap-2 text-[10px] text-gray-500 mt-0.5">
                                  <span className={`font-semibold ${DIFFICULTY_COLORS[cp.problem.difficulty]?.split(' ')[0] || 'text-gray-400'}`}>
                                    {cp.problem.difficulty}
                                  </span>
                                  <span>•</span>
                                  <span>{cp.points} pts</span>
                                  {elapsed > 0 && (
                                    <>
                                      <span>•</span>
                                      <span className="font-mono text-gray-400">⏱ {formatMiniTimer(elapsed)}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                              <button 
                                onClick={() => toggleProblemBookmark(cp.problem.id)}
                                className={`p-1 rounded text-gray-500 hover:text-yellow-400 hover:bg-white/5 transition ${
                                  hasBookmark ? 'text-yellow-400' : ''
                                }`}
                                title={hasBookmark ? 'Remove bookmark' : 'Bookmark problem'}
                              >
                                {hasBookmark ? '★' : '☆'}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Live Leaderboard Peek */}
                    <div className="p-4 border-t border-white/10 bg-black/40 flex flex-col gap-2 shrink-0">
                      <div className="flex items-center justify-between text-xs font-bold text-gray-400 uppercase tracking-wider">
                        <span className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                          Live Leaderboard Peek
                        </span>
                        <button
                          onClick={async () => {
                            try {
                              const res = await api.getContestLeaderboard(activeContest.id);
                              setLeaderboardPeek(res.leaderboard || []);
                            } catch(e) { console.error('Operation failed:', e); }
                          }}
                          className="text-[10px] text-[var(--accent-blue)] hover:underline capitalize font-normal normal-case"
                        >
                          Refresh
                        </button>
                      </div>

                      {leaderboardPeek.length === 0 ? (
                        <p className="text-[11px] text-gray-500 text-center py-2">No leaderboard data</p>
                      ) : (
                        <div className="space-y-1 max-h-[140px] overflow-y-auto">
                          {leaderboardPeek.slice(0, 5).map(entry => {
                            const isCurrentUser = entry.user.id === user?.id || entry.user.email === user?.email;
                            return (
                              <div
                                key={entry.rank}
                                className={`flex items-center justify-between text-xs py-1 px-2 rounded ${isCurrentUser
                                    ? 'bg-amber-500/10 border border-amber-500/30 text-amber-300 font-semibold'
                                    : 'bg-white/[0.01] hover:bg-white/[0.03] text-gray-300'
                                  }`}
                              >
                                <span className="truncate max-w-[140px]">
                                  #{entry.rank} {entry.user.fullName}
                                </span>
                                <span className="font-mono text-[10px]">
                                  {entry.solvedCount} slv • {entry.score} pts
                                </span>
                              </div>
                            );
                          })}

                          {/* If user not in top 5, peek their rank below a separator */}
                          {(() => {
                            const userIdx = leaderboardPeek.findIndex(entry => entry.user.id === user?.id || entry.user.email === user?.email);
                            if (userIdx > 4) {
                              const entry = leaderboardPeek[userIdx];
                              return (
                                <>
                                  <div className="border-t border-white/5 my-1" />
                                  <div className="flex items-center justify-between text-xs py-1 px-2 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 font-semibold">
                                    <span className="truncate max-w-[140px]">
                                      #{entry.rank} {entry.user.fullName}
                                    </span>
                                    <span className="font-mono text-[10px]">
                                      {entry.solvedCount} slv • {entry.score} pts
                                    </span>
                                  </div>
                                </>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      )}

                      {/* Goto Summary Page button */}
                      <button
                        onClick={handleBackToProblems}
                        className="mt-2 w-full py-1.5 bg-zinc-900 hover:bg-zinc-800 text-xs font-semibold rounded text-center transition text-gray-300 hover:text-white border border-white/10"
                      >
                        View Contest Summary Page
                      </button>
                    </div>
                  </>
                ) : (
                  /* Submissions Tab Content */
                  <div className="flex-1 overflow-y-auto p-4 flex flex-col">
                    <div className="mb-3">
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                        Submissions for {currentProbTitle}
                      </h4>
                    </div>
                    {submissionsLoading ? (
                      <div className="flex-1 flex items-center justify-center py-10">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--accent-green)]" />
                      </div>
                    ) : activeProblemSubmissions.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
                        <p className="text-xs text-gray-500">No submissions found for this problem.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {activeProblemSubmissions.map((sub, i) => {
                          const isPassed = sub.status === 'passed' || sub.status === 'Accepted' || sub.status === 'AC';
                          const statusLabel = sub.status === 'passed' ? 'AC' : sub.status || 'WA';
                          const statusColor = isPassed
                            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                            : 'bg-red-500/20 text-red-400 border border-red-500/30';

                          return (
                            <div
                              key={sub.id || i}
                              onClick={() => handleLoadSubmissionCode(sub)}
                              className="p-3 bg-white/[0.02] border border-white/10 hover:border-white/20 hover:bg-white/[0.04] rounded-lg transition cursor-pointer flex flex-col gap-1.5"
                            >
                              <div className="flex items-center justify-between">
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${statusColor}`}>
                                  {statusLabel}
                                </span>
                                <span className="text-[10px] text-gray-500">
                                  {sub.language || 'code'}
                                </span>
                              </div>
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-gray-400">Score: {sub.score ?? 0}</span>
                                <span className="text-gray-500 text-[10px]">
                                  {new Date(sub.createdAt || sub.submittedAt).toLocaleTimeString()}
                                </span>
                              </div>
                              <div className="text-[10px] text-[var(--accent-blue)] mt-1 text-right">
                                Click to load code into editor ↗
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Keyboard Shortcuts Modal */}
            {showShortcuts && (
              <div
                className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
                onClick={() => setShowShortcuts(false)}
              >
                <div
                  className="bg-zinc-900 border border-white/10 rounded-2xl p-6 w-full max-w-md flex flex-col gap-4 text-white shadow-2xl"
                  onClick={e => e.stopPropagation()}
                >
                  <div className="flex justify-between items-center border-b border-white/10 pb-3">
                    <h3 className="text-lg font-bold">Contest Keyboard Shortcuts</h3>
                    <button
                      onClick={() => setShowShortcuts(false)}
                      className="text-gray-400 hover:text-white transition"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <div className="space-y-3.5 my-2">
                    {[
                      { key: '?', desc: 'Toggle Shortcuts Overlay' },
                      { key: 'H', desc: 'Toggle Left Sidebar Drawer' },
                      { key: 'Z', desc: 'Toggle Zen / Focus Mode' },
                      { key: '[', desc: 'Navigate to Previous Problem' },
                      { key: ']', desc: 'Navigate to Next Problem' },
                      { key: 'Esc', desc: 'Close Modal / Exit Zen Mode' }
                    ].map(s => (
                      <div key={s.key} className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">{s.desc}</span>
                        <kbd className="px-2.5 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs font-mono font-bold text-white shadow">
                          {s.key}
                        </kbd>
                      </div>
                    ))}
                  </div>

                  <div className="text-[11px] text-gray-500 text-center mt-2 border-t border-white/5 pt-3">
                    Shortcuts are disabled while typing inside input fields or code editor.
                  </div>
                </div>
              </div>
            )}

            {/* Playground fills remaining space */}
            <div className="flex-1 min-h-0 bg-zinc-950">
              <PlaygroundComponent key={playgroundKey} embeddedInContest={true} />
            </div>
          </div>
        </SecureContestWrapper>
      );
    }

    // Problem list view
    const totalProblems = activeContest.problems?.length || 0;
    const solvedCount = solvedProblems.size;

    return (
      <SecureContestWrapper contestId={activeContest.id} flags={securityFlags}>
        <div className="min-h-screen bg-black p-4 md:p-6 text-white">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-4">
              <div>
                <h1 className="text-2xl font-bold">{activeContest.title}</h1>
                <p className="text-gray-400 text-sm flex gap-4 mt-2">
                  <Countdown target={activeContest.endTime} />
                  <span>Secure Environment Active</span>
                </p>
              </div>
              <div className="flex gap-3">
                <button onClick={handleFinishContest}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-black font-extrabold rounded-lg transition shadow-lg shadow-emerald-500/10"
                >
                  Finish & Submit
                </button>
                <button onClick={handleLeave}
                  className="px-4 py-2 bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 font-bold rounded-lg transition"
                >
                  Leave
                </button>
              </div>
            </div>

            {/* Progress bar & Score */}
            <div className="flex items-center gap-4 mb-6 p-3 rounded-xl bg-white/5 border border-white/10">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-400">Progress:</span>
                <span className="font-bold text-white">{solvedCount}</span>
                <span className="text-gray-500">/{totalProblems}</span>
                <span className="text-gray-400">solved</span>
              </div>
              <div className="flex-1 max-w-xs h-2.5 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full transition-all duration-500"
                  style={{ width: `${totalProblems > 0 ? (solvedCount / totalProblems) * 100 : 0}%` }}
                />
              </div>
              {contestScore > 0 && (
                <span className="text-sm font-bold text-amber-400 ml-auto">
                  🏆 Score: {contestScore}
                </span>
              )}
            </div>

            <div className="space-y-8">
              {(() => {
                const rounds: Record<string, typeof activeContest.problems> = {};
                activeContest.problems?.forEach(cp => {
                  const type = cp.problem.problemType || 'code';
                  if (!rounds[type]) rounds[type] = [];
                  rounds[type].push(cp);
                });

                const typeLabels: Record<string, string> = {
                  'code': 'Coding Round',
                  'web-dev': 'Web Development Round',
                  'sql': 'SQL Round',
                };

                return Object.entries(rounds).map(([type, problems], roundIdx) => (
                  <div key={type} className="space-y-4">
                    <h3 className="text-xl font-bold text-gray-300 border-b border-white/10 pb-2">
                      Round {roundIdx + 1}: {typeLabels[type] || 'Coding Round'}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {problems.map((cp, i) => {
                        const isSolved = solvedProblems.has(cp.problem.id);
                        return (
                          <div key={cp.problem.id} className={`p-4 rounded-xl border transition flex flex-col justify-between ${isSolved
                              ? 'bg-green-500/5 border-green-500/30'
                              : 'bg-white/5 border-white/10 hover:border-[var(--accent-green)]'
                            }`}>
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-3">
                                  <span className={`w-8 h-8 rounded-full font-bold flex items-center justify-center ${isSolved
                                      ? 'bg-green-500/20 text-green-400'
                                      : 'bg-white/10 text-white'
                                    }`}>
                                    {isSolved ? (
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                      </svg>
                                    ) : (
                                      String.fromCharCode(65 + i)
                                    )}
                                  </span>
                                  <span className="font-medium text-lg">{cp.problem.title}</span>
                                </div>
                                <span className={`text-xs px-2 py-1 rounded font-medium ${DIFFICULTY_COLORS[cp.problem.difficulty] || 'text-gray-400'}`}>{cp.problem.difficulty}</span>
                              </div>
                            </div>
                            <div className="flex justify-between items-center mt-6">
                              <span className="text-sm text-gray-400">{cp.points} Points</span>
                              {isSolved ? (
                                <span className="px-4 py-1.5 bg-green-500/20 text-green-400 text-sm font-bold rounded flex items-center gap-1.5">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  </svg>
                                  Solved
                                </span>
                              ) : (
                                <button
                                  onClick={() => {
                                    const params = new URLSearchParams(window.location.search);
                                    params.set('problem', cp.problem.id);
                                    params.set('contestId', activeContest.id);
                                    window.history.pushState({}, '', `${window.location.pathname}?${params.toString()}`);
                                    setSolvingProblem({ id: cp.problem.id, type: cp.problem.problemType || 'code' });
                                  }}
                                  className="px-4 py-1.5 bg-[var(--accent-green)] text-black text-sm font-bold rounded hover:opacity-90 transition"
                                >
                                  Solve Problem
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ));
              })()}
              {!activeContest.problems?.length && <p className="text-gray-500">No problems available.</p>}
            </div>
          </div>
        </div>
      </SecureContestWrapper>
    );
  }

  if (selected && getTimeStatus(selected!).label !== 'Ended') {
    if (showSandbox) {
      return (
        <div className="min-h-screen bg-black p-6 text-white flex items-center justify-center">
          <ScratchpadRunner
            contestTitle={selected.title}
            onBack={() => setShowSandbox(false)}
          />
        </div>
      );
    }
    return renderLobbyView();
  }

  return (
    <div className="min-h-screen bg-console-bg0 p-4 md:p-6 text-white font-body selection:bg-status-live selection:text-black">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Telemetry Strip */}
        <div className="flex flex-wrap items-center justify-between gap-y-2 border-b border-console-border pb-3 font-mono text-xs text-white/70">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <span>TOTAL <strong className="text-white ml-1">{telemetryStats.total}</strong></span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-status-live animate-pulse" />
              LIVE <strong className="text-status-live ml-1">{telemetryStats.live}</strong>
            </span>
            <span>JOINED <strong className="text-status-personal ml-1">{telemetryStats.joined}</strong></span>
            <span>SUBMISSIONS <strong className="text-white ml-1">{telemetryStats.submissions}</strong></span>
          </div>
          <div className="text-[11px] text-white/40 font-mono hidden md:block">
            SYSTEM STATUS: <span className="text-emerald-400">● SECURE & ONLINE</span>
          </div>
        </div>

        {/* Console Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-white tracking-tight flex items-center gap-2">
              Contest Launch Console
              <span className="h-2 w-2 rounded-full bg-status-live animate-pulse" />
            </h1>
            <p className="text-white/50 font-mono text-xs mt-1">Participate in proctored coding assessments & competitive programming labs</p>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="flex flex-wrap gap-1 rounded-xl border border-console-border bg-console-panel p-1.5">
          {([
            { k: 'active', l: 'Active' },
            { k: 'upcoming', l: 'Upcoming' },
            { k: 'ended', l: 'Ended' },
            { k: 'my', l: 'My Contests' },
            { k: 'multi-platform', l: 'Multi-Platform' },
            { k: 'live-contests', l: 'Live Contests' },
            { k: 'exam', l: 'Exam Lab' }
          ] as { k: Tab; l: string }[]).map(t => {
            const selected = tab === t.k;
            const isStandard = t.k === 'active' || t.k === 'upcoming' || t.k === 'ended';
            const dotColor = t.k === 'active' ? 'bg-status-live' : t.k === 'upcoming' ? 'bg-status-upcoming' : 'bg-status-ended';

            return (
              <button
                key={t.k}
                type="button"
                onClick={() => setTab(t.k)}
                className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 font-mono text-xs font-semibold transition-all ${
                  selected
                    ? "bg-white/10 text-white shadow border border-white/15"
                    : "text-white/50 hover:text-white/80 hover:bg-white/5"
                }`}
              >
                {isStandard && (
                  <span className={`h-1.5 w-1.5 rounded-full ${dotColor} ${t.k === "active" ? "animate-pulse" : ""}`} />
                )}
                {t.l}
                {isStandard && (
                  <span className="text-white/40">({tabCounts[t.k as TabKey] || 0})</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search & Difficulty Filter Bar (for active, upcoming, ended) */}
        {(tab === 'active' || tab === 'upcoming' || tab === 'ended') && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-console-panel p-2.5 rounded-xl border border-console-border">
            <div className="relative flex-1 max-w-sm">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-white/40 font-mono text-xs">
                🔍
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="search_contests --title"
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-console-border bg-black/40 font-mono text-xs text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none transition"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {(['all', 'Easy', 'Medium', 'Hard'] as const).map((level) => (
                <DifficultyPill
                  key={level}
                  level={level}
                  selected={difficultyFilter === level}
                  onClick={() => setDifficultyFilter(level)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Loading Skeleton */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-console-panel border border-console-border rounded-xl animate-pulse" />
            ))}
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="text-center py-16 bg-console-panel border border-red-500/20 rounded-xl">
            <p className="text-red-400 font-mono text-sm mb-4">{error}</p>
            <button type="button" onClick={loadContests} className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-mono rounded-lg text-xs transition border border-white/10">Retry Connection</button>
          </div>
        )}

        {/* My Participations Tab */}
        {!loading && !error && tab === 'my' && (
          <>
            {participations.length === 0 ? (
              <div className="text-center py-20 bg-console-panel border border-console-border rounded-xl font-mono text-xs text-white/40">
                You haven't joined any contests yet.
              </div>
            ) : (
              <div className="space-y-3">
                {participations.map(p => {
                  const statusKey = getTimeStatusForContest(p.contest, now);
                  return (
                    <LaunchConsoleCard
                      key={p.contest.id}
                      contest={p.contest}
                      status={statusKey}
                      now={now}
                      matchPart={p}
                      onOpen={() => openDetail(p.contest.id)}
                      onViewReport={(e) => {
                        e.stopPropagation();
                        navigate(`/contests/${p.contest.id}/report`);
                      }}
                    />
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Main Contest List (Active / Upcoming / Ended) */}
        {!loading && !error && (tab === 'active' || tab === 'upcoming' || tab === 'ended') && (
          <>
            {displayContests.length === 0 ? (
              <EmptyState
                variant="contests"
                title={`No ${tab} contests found`}
                body={searchQuery ? `No contests matched "${searchQuery}". Try clearing filters.` : `There are currently no ${tab} contests in this directory.`}
                onAction={() => { setTab('active'); setDifficultyFilter('all'); }}
                actionLabel="View All Contests"
              />
            ) : (
              <div className="space-y-3">
                {displayContests.map((c: any) => {
                  const matchPart = participations.find(p => p.contest?.id === c.id);
                  const statusKey = getTimeStatusForContest(c, now);

                  return (
                    <LaunchConsoleCard
                      key={c.id}
                      contest={c}
                      status={statusKey}
                      now={now}
                      matchPart={matchPart}
                      onOpen={() => navigate(`/contests/${c.id}/overview`)}
                      onViewReport={(e) => {
                        e.stopPropagation();
                        navigate(`/contests/${c.id}/report`);
                      }}
                    />
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Live Contests Tab (Codeforces + Internal) */}
        {tab === 'live-contests' && (
          <div>
            {/* Controls bar */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex gap-1 bg-white/5 rounded-lg p-1">
                {(['all', 'codeforces', 'internal'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setLiveFilter(f)}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
                      liveFilter === f
                        ? 'bg-[var(--accent-green)] text-black'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {f === 'all' ? 'All' : f === 'codeforces' ? 'Codeforces' : 'Internal'}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={liveAutoRefresh}
                    onChange={(e) => setLiveAutoRefresh(e.target.checked)}
                    className="rounded border-gray-600 bg-transparent accent-green-500"
                  />
                  Auto-refresh (5 min)
                </label>
                <button
                  onClick={loadLiveContests}
                  className="px-3 py-1.5 rounded-md text-xs font-medium bg-white/10 text-gray-300 hover:text-white transition"
                >
                  Refresh Now
                </button>
              </div>
            </div>

            {liveLoading && liveContests.length === 0 ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 bg-white/5 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : (
              (() => {
                const filtered =
                  liveFilter === 'all'
                    ? liveContests
                    : liveContests.filter((c: any) => c.platform === liveFilter);

                if (filtered.length === 0) {
                  return (
                    <div className="text-center py-20">
                      <p className="text-gray-500">No upcoming contests found</p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-3">
                    {filtered.map((contest: any) => (
                      <LiveContestCard key={contest.id} contest={contest} />
                    ))}
                  </div>
                );
              })()
            )}
          </div>
        )}

        {/* Exam Lab Tab */}
        {tab === 'exam' && (
          <div>
            {examView === 'history' && (
              <div className="flex items-center gap-2 mb-6">
                <button onClick={() => setExamView('categories')}
                  className="px-3 py-1.5 rounded-md text-xs font-medium bg-white/10 text-gray-300 hover:text-white transition"
                >&larr; Back to Categories</button>
              </div>
            )}
            {examView === 'categories' && (
              <>
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm">Practice exams by category</p>
                  </div>
                  <button onClick={() => setExamView('history')}
                    className="px-3 py-1.5 rounded-md text-xs font-medium bg-white/10 text-gray-300 hover:text-white transition"
                  >View History</button>
                </div>
                {examLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent-yellow)]" />
                  </div>
                ) : examCategories.length === 0 ? (
                  <div className="text-center py-12 bg-[var(--bg-card)] border border-white/5 rounded-xl">
                    <p className="text-gray-500">No exam categories available</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {examCategories.map(cat => (
                      <div key={cat.id}
                        className="bg-[var(--bg-card)] border border-white/5 rounded-xl p-5 hover:border-white/20 transition"
                      >
                        <div className="flex items-center gap-2 mb-3">
                          <span className="px-2 py-0.5 bg-[var(--accent-yellow)]/20 text-[var(--accent-yellow)] text-xs rounded font-medium">{cat.name}</span>
                        </div>
                        <p className="text-sm text-gray-400 mb-4 line-clamp-2">
                          {cat.description || 'Practice exam'}
                        </p>
                        <button onClick={() => startExam(cat)}
                          className="w-full px-4 py-2 bg-[var(--accent-yellow)]/10 text-[var(--accent-yellow)] font-medium rounded-lg text-sm hover:bg-[var(--accent-yellow)]/20 transition"
                        >Start Exam</button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
            {examView === 'exam' && selectedCategory && (
              <div className="bg-[var(--bg-card)] border border-white/5 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-6">
                  <span className="px-2 py-0.5 bg-[var(--accent-yellow)]/20 text-[var(--accent-yellow)] text-xs rounded font-medium">{selectedCategory.name}</span>
                  <span className="text-sm text-gray-500">{examQuestions.length} questions</span>
                  <button onClick={() => setExamView('categories')}
                    className="ml-auto text-xs text-gray-400 hover:text-white transition"
                  >Back</button>
                </div>
                <div className="space-y-4">
                  {examQuestions.map((q, idx) => (
                    <div key={q.id} className="p-4 bg-black/30 border border-white/5 rounded-lg">
                      <div className="flex gap-2 text-sm font-medium text-white mb-3">
                        <span className="shrink-0">{idx + 1}.</span>
                        <div className="flex-1 overflow-x-auto prose prose-invert max-w-none prose-p:my-0 prose-pre:my-2 prose-img:rounded-md prose-img:border prose-img:border-white/10">
                          <MarkdownRenderer content={q.question} />
                        </div>
                      </div>
                      {q.type === 'multiple' && q.options && q.options.length > 0 ? (
                        <div className="space-y-2">
                          {q.options.map((opt, oi) => (
                            <label key={oi}
                              className={`flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition ${examAnswers[q.id] === opt ? 'border-[var(--accent-yellow)] bg-[var(--accent-yellow)]/5' : 'border-white/10 hover:border-white/20'}`}
                            >
                              <input type="radio" name={`q-${q.id}`} value={opt}
                                checked={examAnswers[q.id] === opt}
                                onChange={(e) => handleExamAnswer(q.id, e.target.value)}
                                className="text-[var(--accent-yellow)] focus:ring-[var(--accent-yellow)]"
                              />
                              <span className="text-sm text-gray-300">{opt}</span>
                            </label>
                          ))}
                        </div>
                      ) : (
                        <input
                          placeholder="Type your answer..."
                          value={examAnswers[q.id] || ''}
                          onChange={(e) => handleExamAnswer(q.id, e.target.value)}
                          className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--accent-yellow)]"
                        />
                      )}
                    </div>
                  ))}
                </div>
                <button onClick={handleExamSubmit} disabled={examEvaluating || Object.keys(examAnswers).length === 0}
                  className="mt-6 w-full px-4 py-2.5 bg-[var(--accent-yellow)] text-black font-bold rounded-lg text-sm hover:bg-yellow-400 transition disabled:opacity-50"
                >{examEvaluating ? 'Evaluating...' : 'Submit Answers'}</button>
              </div>
            )}
            {examView === 'result' && examResult && (
              <div className="bg-[var(--bg-card)] border border-white/5 rounded-xl p-6">
                <h3 className="text-lg font-bold text-white mb-4">Results</h3>
                <div className="flex items-center gap-3 mb-4">
                  <span className={`px-3 py-1 rounded-lg text-sm font-bold ${
                    examScorePercent >= 70 ? 'bg-green-500/20 text-green-400' : examScorePercent >= 40 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`
                  }>{examResult.score}/{examResult.total} ({examScorePercent}%)</span>
                </div>
                <div className="w-full h-2 bg-white/10 rounded-full mb-6 overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${
                    examScorePercent >= 70 ? 'bg-green-500' : examScorePercent >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`
                  } style={{ width: `${examScorePercent}%` }} />
                </div>
                <div className="space-y-3">
                  {examResult.evaluatedAnswers.map((ea: any) => (
                    <div key={ea.questionId} className="flex items-start gap-3 p-3 bg-black/30 rounded-lg border border-white/5">
                      <span className={`mt-0.5 shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                        ea.correct ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`
                      }>{ea.correct ? '✓' : '✗'}</span>
                      <div className="flex-1">
                        <div className="text-sm text-gray-300 prose prose-invert max-w-none prose-p:my-0 prose-pre:my-1 prose-img:max-h-40 prose-img:rounded">
                          <MarkdownRenderer content={ea.question} />
                        </div>
                        {!ea.correct && ea.correctAnswer && (
                          <p className="text-xs text-gray-500 mt-1">Correct answer: <code className="text-[var(--accent-yellow)]">{ea.correctAnswer}</code></p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-3 mt-6">
                  <button onClick={() => setExamView('categories')}
                    className="px-4 py-2 bg-[var(--accent-yellow)]/10 text-[var(--accent-yellow)] font-medium rounded-lg text-sm hover:bg-[var(--accent-yellow)]/20 transition"
                  >Back to Categories</button>
                  <button onClick={() => setExamView('history')}
                    className="px-4 py-2 bg-white/10 text-gray-300 font-medium rounded-lg text-sm hover:bg-white/20 transition"
                  >View History</button>
                </div>
              </div>
            )}
            {examView === 'history' && (
              <>
                {examAttempts.length === 0 ? (
                  <div className="text-center py-12 bg-[var(--bg-card)] border border-white/5 rounded-xl">
                    <p className="text-gray-500">No exam attempts yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {examAttempts.map(a => {
                      const pct = a.score && a.total ? Math.round((a.score / a.total) * 100) : 0;
                      return (
                        <div key={a.id} className="bg-[var(--bg-card)] border border-white/5 rounded-xl p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="px-2 py-0.5 bg-[var(--accent-yellow)]/20 text-[var(--accent-yellow)] text-xs rounded font-medium">{a.category.name}</span>
                            <span className={`px-2 py-0.5 text-xs rounded font-medium ${
                              pct >= 70 ? 'bg-green-500/20 text-green-400' : pct >= 40 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`
                            }>{a.score}/{a.total} ({pct}%)</span>
                          </div>
                          <p className="text-xs text-gray-500">
                            {a.completedAt ? new Date(a.completedAt).toLocaleString() : new Date(a.createdAt).toLocaleString()}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Detail Modal */}
        {selected && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setSelected(null)}>
            <div className="bg-[var(--bg-card)] border border-white/10 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="p-6 border-b border-white/10">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h2 className="text-xl font-bold text-white">{selected.title}</h2>
                    {selected.description && <p className="text-gray-400 text-sm mt-1">{selected.description}</p>}
                  </div>
                  <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-white p-1">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                  <span>Starts: {new Date(selected.startTime).toLocaleString()}</span>
                  <span>Ends: {new Date(selected.endTime).toLocaleString()}</span>
                  <span>Duration: {selected.duration} min</span>
                  <span>Difficulty: {selected.difficulty}</span>
                  <span>{selected._count?.participants || 0} participants</span>
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${getTimeStatus(selected).color}`}>{getTimeStatus(selected).label}</span>
                </div>
                {selected.isActive && !selected.isJoined && (
                  <button onClick={() => handleJoin(selected.id)} disabled={joining}
                    className="mt-4 px-5 py-2 bg-[var(--accent-green)] text-black font-bold rounded-lg text-sm hover:opacity-90 transition disabled:opacity-50"
                  >{joining ? 'Joining...' : 'Join Contest'}</button>
                )}
                {selected.isJoined && (
                  <div className="mt-4 space-y-4">
                    <div className="flex items-center gap-4">
                      <span className="inline-block px-3 py-1.5 bg-green-500/20 text-green-400 text-sm rounded-lg font-medium">You've joined this contest</span>
                      {selected.isActive && !participantDetails?.isTerminated && participantDetails?.status !== 'COMPLETED' && (
                        <button
                          onClick={() => setActiveContest(selected)}
                          className="px-5 py-2 bg-[var(--accent-green)] text-black font-bold rounded-lg text-sm hover:opacity-90 transition shadow-[0_0_15px_rgba(34,197,94,0.3)]"
                        >
                          Enter Secure Environment
                        </button>
                      )}
                    </div>

                    {participantDetails && (
                      <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02] space-y-4">
                        <h4 className="text-sm font-extrabold text-white flex items-center gap-2">
                          <span>📊 Post-Contest Performance Summary</span>
                          {participantDetails.isTerminated ? (
                            <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-[10px] uppercase font-bold rounded">Suspended / Blocked</span>
                          ) : participantDetails.status === 'COMPLETED' ? (
                            <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-[10px] uppercase font-bold rounded">Completed / Submitted</span>
                          ) : (
                            <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-[10px] uppercase font-bold rounded">Active / In Progress</span>
                          )}
                        </h4>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                          <div className="p-3 bg-white/5 border border-white/5 rounded-lg text-center">
                            <div className="text-[10px] text-gray-400 uppercase tracking-wider">Final Standing</div>
                            <div className="text-lg font-black text-[var(--accent-yellow)]">
                              {(() => {
                                const myEntry = leaderboard.find(e => e.user.id === user?.id || e.user.email === user?.email);
                                return myEntry ? `#${myEntry.rank}` : 'N/A';
                              })()}
                            </div>
                          </div>
                          <div className="p-3 bg-white/5 border border-white/5 rounded-lg text-center">
                            <div className="text-[10px] text-gray-400 uppercase tracking-wider">Total Score</div>
                            <div className="text-lg font-black text-white">{participantDetails.score ?? 0} pts</div>
                          </div>
                          <div className="p-3 bg-white/5 border border-white/5 rounded-lg text-center">
                            <div className="text-[10px] text-gray-400 uppercase tracking-wider">Solved Problems</div>
                            <div className="text-lg font-black text-white">{participantDetails.solvedCount ?? 0} solved</div>
                          </div>
                          <div className="p-3 bg-white/5 border border-white/5 rounded-lg text-center">
                            <div className="text-[10px] text-gray-400 uppercase tracking-wider">Warnings Count</div>
                            <div className={`text-lg font-black ${participantDetails.warnings > 0 ? 'text-red-400' : 'text-gray-400'}`}>
                              {participantDetails.warnings ?? 0} / {selected.maxWarnings || 3}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => fetchMyLogs(selected.id)}
                            className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white font-bold rounded-lg text-xs transition"
                          >
                            View Proctoring Log Timeline
                          </button>
                          {(participantDetails.status === 'COMPLETED' || participantDetails.isTerminated) && (
                            <button
                              onClick={() => {
                                setSelected(null);
                                navigate(`/contests/${selected.id}/report`);
                              }}
                              className="px-4 py-2 bg-[var(--accent-green)] hover:opacity-90 text-black font-extrabold rounded-lg text-xs transition shadow-[0_0_15px_rgba(34,197,94,0.3)]"
                            >
                              View Official Performance Report
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {detailLoading ? (
                <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent-green)]" /></div>
              ) : (
                <div className="p-6 space-y-6">
                  {/* Problems */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Problems</h3>
                    {selected.problems?.length > 0 ? (
                      <div className="space-y-2">
                        {selected.problems.map((cp, i) => (
                          <div key={cp.problem.id}
                            className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/10"
                          >
                            <div className="flex items-center gap-3">
                              <span className="w-6 h-6 rounded-full bg-white/10 text-xs font-bold text-white flex items-center justify-center">{String.fromCharCode(65 + i)}</span>
                              <span className="text-white text-sm font-medium">{cp.problem.title}</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${DIFFICULTY_COLORS[cp.problem.difficulty] || 'text-gray-400'}`}>{cp.problem.difficulty}</span>
                            </div>
                            <span className="text-xs text-gray-500">{cp.points} pts</span>
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-gray-600 text-sm">No problems assigned yet.</p>}
                  </div>

                  {/* Leaderboard */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Leaderboard</h3>
                    {leaderboard.length > 0 ? (
                      <div className="space-y-1">
                        {leaderboard.slice(0, 10).map(entry => (
                          <div key={entry.rank} className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/[0.02] text-sm">
                            <div className="flex items-center gap-3">
                              <span className={`w-6 text-center font-bold ${entry.rank <= 3 ? 'text-[var(--accent-yellow)]' : 'text-gray-500'}`}>#{entry.rank}</span>
                              <span className="text-white">{entry.user.fullName}</span>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              <span>{entry.solvedCount} solved</span>
                              <span className="text-white font-medium">{entry.score} pts</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-gray-600 text-sm">No submissions yet.</p>}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {logsModalOpen && myContestLogs !== null && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[100] backdrop-blur-sm animate-fade-in">
            <div className="bg-zinc-950 border border-white/10 rounded-2xl p-6 max-w-xl w-full flex flex-col max-h-[80vh] shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4 flex-shrink-0">
                <div>
                  <h3 className="font-extrabold text-lg text-white">Your Proctoring Violations Log</h3>
                  <p className="text-xs text-zinc-400 mt-0.5">Contest: <span className="text-[var(--accent-green)] font-bold">{selected?.title}</span></p>
                </div>
                <button
                  onClick={() => setLogsModalOpen(false)}
                  className="text-gray-400 hover:text-white p-1 hover:bg-white/10 rounded-lg transition"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 min-h-0 pr-1 select-text">
                {myContestLogs.length === 0 ? (
                  <p className="text-zinc-500 text-sm italic text-center py-6">You have no proctoring violations logged in this contest.</p>
                ) : (
                  myContestLogs.map((log: any) => (
                    <div key={log.id} className="p-3 bg-white/5 border border-white/5 rounded-xl flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-red-400 font-mono">{log.eventType}</span>
                        <span className="text-[10px] text-zinc-500 font-mono">{new Date(log.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="text-xs text-zinc-300 font-mono mt-1 break-words">{log.description}</p>
                    </div>
                  ))
                )}
              </div>

              <div className="border-t border-white/10 pt-4 mt-4 flex justify-end flex-shrink-0">
                <button
                  onClick={() => setLogsModalOpen(false)}
                  className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white font-bold rounded-lg text-xs transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ContestsPage;

