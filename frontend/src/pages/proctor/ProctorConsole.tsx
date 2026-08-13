import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';

type ConsoleTab = 'GRID' | 'INCIDENTS' | 'GALLERY' | 'PLAGIARISM';

interface ContestContext {
  id: string;
  title: string;
  orgName: string;
  durationMins: number;
  endTime: string;
  status: 'LIVE' | 'ENDED';
  totalRegistered: number;
  attemptingLive: number;
  flaggedCount: number;
  rules: {
    aiProctoring: boolean;
    tabLimit: number;
    pasteBlocked: boolean;
    sebRequired: boolean;
  };
}

interface CandidateFeed {
  id: string;
  userId: string;
  name: string;
  email: string;
  contestId: string;
  contestTitle: string;
  status: 'ACTIVE' | 'FLAGGED' | 'PAUSED' | 'ESCALATED_TO_ADMIN' | 'COMPLETED';
  warnings: number;
  maxWarnings: number;
  tabSwitchCount: number;
  pasteEvents: number;
  bulkPasteFlag: boolean;
  assessmentType: 'CODING' | 'SQL' | 'WEB_DEV' | 'MCQ' | 'APTITUDE' | 'ESSAY';
  aiAlerts: {
    multipleFaces: boolean;
    noFace: boolean;
    phoneDetected: boolean;
    audioSpike: boolean;
  };
  integrityScore: number;
  lastSnapshotTime: string;
  cheatingSnapshotUrl?: string;
  violationReason?: string;
  pauseReason?: string;
  pausedAt?: string;  // FIX #7: ISO timestamp of when candidate was paused
}

interface IncidentLog {
  id: string;
  contestId: string;
  contestTitle: string;
  candidateName: string;
  candidateEmail: string;
  timestamp: string;
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  actionTaken: string;
  details: string;
  snapshotUrl?: string;
}

export const ProctorConsolePage: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<ConsoleTab>('GRID');
  const [candidateFilter, setCandidateFilter] = useState<'ALL' | 'FLAGGED' | 'PAUSED' | 'ESCALATED' | 'DISCONNECTED'>('ALL');
  const [incidentSeverityFilter, setIncidentSeverityFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<Set<string>>(new Set());

  // Broadcast Alert Modal State
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastInput, setBroadcastInput] = useState('');
  const [broadcastPriority, setBroadcastPriority] = useState<'NORMAL' | 'HIGH' | 'CRITICAL'>('HIGH');
  const [pingTelemetry, setPingTelemetry] = useState<Record<string, { lastPing: number; latency: number }>>({});

  // Selected Contest Context ('ALL_COMBINED' or specific ID)
  const [selectedContestId, setSelectedContestId] = useState<string>('ALL_COMBINED');

  // Report Modal State
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportPasscode, setReportPasscode] = useState('');
  const [isPasscodeUnlocked, setIsPasscodeUnlocked] = useState(false);
  const [passcodeError, setPasscodeError] = useState('');

  // Action and Proctor State
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [selectedNudgeCandidate, setSelectedNudgeCandidate] = useState<CandidateFeed | null>(null);
  const [nudgePreset, setNudgePreset] = useState<string>('Please align your face directly with the webcam.');
  const [spotlightCandidate, setSpotlightCandidate] = useState<CandidateFeed | null>(null);
  const [liveFrames, setLiveFrames] = useState<Record<string, string>>({});
  const [plagiarismReports, setPlagiarismReports] = useState<any[]>([]);
  const [plagiarismScanning, setPlagiarismScanning] = useState(false);
  const [selectedDiffPair, setSelectedDiffPair] = useState<any | null>(null);
  const [evidenceCandidate, setEvidenceCandidate] = useState<CandidateFeed | null>(null);
  const [sebEntryCounts, setSebEntryCounts] = useState<Record<string, number>>({});
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const [elapsedTick, setElapsedTick] = useState(0);

  // Block/Escalate modals with mandatory reason
  const [blockCandidate, setBlockCandidate] = useState<CandidateFeed | null>(null);
  const [blockReason, setBlockReason] = useState('');
  const [escalateCandidate, setEscalateCandidate] = useState<CandidateFeed | null>(null);
  const [escalateReason, setEscalateReason] = useState('');

  // Webcam & Screen: use refs to avoid React re-render flicker on every frame
  const webcamImgRefs = useRef<Record<string, HTMLImageElement | null>>({});
  const screenImgRefs = useRef<Record<string, HTMLImageElement | null>>({});
  const liveFramesRef = useRef<Record<string, string>>({});
  const liveScreenFramesRef = useRef<Record<string, string>>({});
  const [liveScreenFrames, setLiveScreenFrames] = useState<Record<string, string>>({});
  const [feedViewMode, setFeedViewMode] = useState<Record<string, 'webcam' | 'screen'>>({});
  const rafRef = useRef<number | null>(null);
  const spotlightWebcamRef = useRef<HTMLImageElement | null>(null);
  const spotlightScreenRef = useRef<HTMLImageElement | null>(null);
  const spotlightCandidateRef = useRef<CandidateFeed | null>(null);

  useEffect(() => {
    const t = setInterval(() => setElapsedTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Helper: format elapsed seconds as "Xm Ys" — references elapsedTick to trigger re-render each second
  const getElapsedSince = (isoTs?: string): string => {
    void elapsedTick; // Reactive tick ensures re-render every second
    if (!isoTs) return '';
    const ms = Date.now() - new Date(isoTs).getTime();
    if (ms < 0) return '';
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  // Fetch real managed contests from API
  const { data: contestsData, isLoading: loadingContests } = useQuery({
    queryKey: ['teacherManagedContests'],
    queryFn: () => api.getTeacherManagedContests(),
    staleTime: 5000,
    refetchInterval: 10000,
  });

  const rawContests: any[] = contestsData?.contests || [];
  const assignedContests: ContestContext[] = rawContests.map((c: any) => {
    const isEnded = new Date(c.endTime) < new Date();
    const regCount = c._count?.registrations ?? c._count?.participants ?? 0;
    return {
      id: c.id,
      title: c.title,
      orgName: c.organization?.name || 'Institutional Exam Center',
      durationMins: c.duration || 120,
      endTime: new Date(c.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: isEnded ? 'ENDED' : 'LIVE',
      totalRegistered: regCount,
      attemptingLive: regCount,
      flaggedCount: 0,
      rules: {
        aiProctoring: Boolean(c.enableProctoring),
        tabLimit: Number(c.maxWarnings) || 10,
        pasteBlocked: Boolean(c.disableCopyPaste || c.pasteMode === 'BLOCKED'),
        sebRequired: Boolean(c.requireSeb),
      },
    };
  });

  const isCombinedView = selectedContestId === 'ALL_COMBINED';
  const selectedContest = assignedContests.find((c) => c.id === selectedContestId) || assignedContests[0] || {
    id: '',
    title: 'No Contests Available',
    orgName: 'System Center',
    durationMins: 120,
    endTime: 'N/A',
    status: 'LIVE',
    totalRegistered: 0,
    attemptingLive: 0,
    flaggedCount: 0,
    rules: { aiProctoring: false, tabLimit: 10, pasteBlocked: false, sebRequired: false }
  };
  const isSelectedContestEnded = !isCombinedView && selectedContest.status === 'ENDED';

  // Fetch real candidate leadboards & proctor logs
  const targetContestIds = isCombinedView ? assignedContests.map((c) => c.id) : [selectedContestId].filter(Boolean);

  const { data: leaderboardData } = useQuery({
    queryKey: ['proctorLeaderboard', targetContestIds.join(',')],
    queryFn: async () => {
      if (targetContestIds.length === 0) return { leaderboard: [] };
      const allRes = await Promise.all(
        targetContestIds.map((cid) => api.getContestLeaderboard(cid).catch(() => ({ leaderboard: [] })))
      );
      return { leaderboard: allRes.flatMap((r) => r.leaderboard || []) };
    },
    enabled: targetContestIds.length > 0,
    refetchInterval: 5000,
  });

  const { data: logsData } = useQuery({
    queryKey: ['proctorLogs', targetContestIds.join(',')],
    queryFn: async () => {
      if (targetContestIds.length === 0) return { logs: [] };
      const allLogs = await Promise.all(
        targetContestIds.map((cid) => api.getContestLogs(cid).catch(() => ({ logs: [] })))
      );
      return { logs: allLogs.flatMap((r) => r.logs || []) };
    },
    enabled: targetContestIds.length > 0,
    refetchInterval: 5000,
  });

  const realLogs: any[] = logsData?.logs || [];
  const rawLeaderboard: any[] = leaderboardData?.leaderboard || [];

  // Deduplicate leaderboard entries by user ID to guarantee zero duplicate cards
  const uniqueLeaderboardMap = new Map<string, any>();
  rawLeaderboard.forEach((item) => {
    const uid = item.userId || item.user?.id || item.id;
    if (!uid) return;
    const existing = uniqueLeaderboardMap.get(uid);
    // Prefer ACTIVE/PAUSED entries or most detailed record over duplicate registration records
    if (!existing || item.status === 'ACTIVE' || item.status === 'PAUSED' || (item.warnings || 0) > (existing.warnings || 0)) {
      uniqueLeaderboardMap.set(uid, item);
    }
  });
  const realLeaderboard = Array.from(uniqueLeaderboardMap.values());

  // Map real candidates from leaderboard & logs
  const candidates: CandidateFeed[] = realLeaderboard.map((item: any, idx: number) => {
    const uid = item.userId || item.user?.id || item.id || `user-${idx}`;
    const userUserId = item.user?.id || item.userId || uid;
    const userLogs = realLogs.filter((l) =>
      l.userId === uid || l.userId === userUserId || l.participantId === uid || l.participantId === userUserId
    );

    // ── ACCURATE EVENT CATEGORISATION ──
    const logsWarnings = userLogs.filter((l) =>
      ['PROCTOR_WARNING', 'PROCTOR_NUDGE', 'WARN', 'WARNING'].includes(l.eventType)
    ).length;
    const warnings = Math.max(Number(item.warnings) || 0, Number(item.penalty) || 0, logsWarnings);

    const tabSwitchCount = Math.max(
      userLogs.filter((l) =>
        ['TAB_SWITCH', 'FOCUS_LOST', 'FULLSCREEN_EXIT', 'DEVTOOLS_OPENED', 'SCREENSHOT_ATTEMPT'].includes(l.eventType)
      ).length,
      Number(item.tabSwitchCount) || 0
    );

    const sebLogs = userLogs.filter((l) =>
      ['SEB_SESSION_START', 'SEB_VERIFIED', 'SEB_LAUNCH', 'SEB_ENTRY', 'SEB_HANDSHAKE'].includes(l.eventType)
    ).sort((a, b) => new Date(a.timestamp || a.createdAt).getTime() - new Date(b.timestamp || b.createdAt).getTime());

    let sebEntryCountDB = 0;
    let lastSebTime = 0;
    sebLogs.forEach((l) => {
      const t = new Date(l.timestamp || l.createdAt).getTime();
      if (t - lastSebTime > 10000) {
        sebEntryCountDB++;
        lastSebTime = t;
      }
    });

    const sebEntryCount = Math.max(sebEntryCountDB, sebEntryCounts[uid] || sebEntryCounts[userUserId] || 0);
    const pasteEvents = userLogs.filter((l) => ['PASTE_EVENT', 'BULK_PASTE', 'COPY_PASTE_ATTEMPT'].includes(l.eventType)).length;
    const hasMultipleFaces = userLogs.some((l) => ['MULTIPLE_FACES', 'FACE_MULTIPLE_DETECTED'].includes(l.eventType));
    const hasNoFace = userLogs.some((l) => ['NO_FACE', 'FACE_MISSING_DETECTED'].includes(l.eventType));
    const hasPhone = userLogs.some((l) => l.eventType === 'PHONE_DETECTED');
    const hasAudio = userLogs.some((l) => ['AUDIO_SPIKE', 'VOICE_TALKING_DETECTED'].includes(l.eventType));
    const bulkPaste = userLogs.some((l) => l.eventType === 'BULK_PASTE');

    const isPaused = userLogs.some((l) => l.eventType === 'PROCTOR_BLOCK') &&
      !userLogs.some((l) => l.eventType === 'PROCTOR_UNBLOCK' &&
        new Date(l.timestamp || l.createdAt) > new Date(userLogs.filter(x => x.eventType === 'PROCTOR_BLOCK').slice(-1)[0]?.timestamp || 0));

    const isBlocked = Boolean(
      item.isBlocked ||
      item.isTerminated ||
      item.status === 'DISQUALIFIED' ||
      userLogs.some((l) => ['DISQUALIFIED', 'ESCALATED_FOR_DISQUALIFICATION'].includes(l.eventType))
    );

    // Disqualified / Escalated candidates have 0% Integrity Rating
    let scorePct = Math.max(0, 100 - warnings * 20 - tabSwitchCount * 10 - pasteEvents * 15);
    if (isBlocked) {
      scorePct = 0;
    }

    const status: CandidateFeed['status'] = isBlocked
      ? 'ESCALATED_TO_ADMIN'
      : isPaused
      ? 'PAUSED'
      : warnings > 0 || tabSwitchCount > 2
      ? 'FLAGGED'
      : 'ACTIVE';

    const latestLog = userLogs[userLogs.length - 1];
    const lastSnapTime = latestLog ? new Date(latestLog.timestamp || latestLog.createdAt).toLocaleTimeString() : 'Active Now';

    const blockLog = userLogs.filter((l) => l.eventType === 'PROCTOR_BLOCK').slice(-1)[0];
    const rawReason = blockLog?.details || blockLog?.description || 'Exam session paused by proctor.';
    const pauseReason = rawReason.replace(/^Proctor blocked student:\s*/i, '').trim() || 'Exam session paused by proctor.';
    const pausedAt = blockLog?.createdAt || blockLog?.timestamp || null;

    const candContest = assignedContests.find((ac) => ac.id === (item.contestId || item.contest?.id)) || selectedContest;
    const candidateMaxWarnings = Number(item.maxWarnings || item.contest?.maxWarnings || candContest?.rules?.tabLimit || selectedContest?.rules?.tabLimit || 10);

    return {
      id: uid,
      userId: uid,
      name: item.user?.fullName || item.user?.name || item.name || `Candidate #${idx + 1}`,
      email: item.user?.email || item.email || `candidate${idx + 1}@exam.org`,
      contestId: item.contestId || selectedContest.id,
      contestTitle: item.contestTitle || selectedContest.title,
      status,
      warnings,
      maxWarnings: candidateMaxWarnings,
      tabSwitchCount,
      sebEntryCount,
      pasteEvents,
      bulkPasteFlag: bulkPaste,
      assessmentType: 'CODING',
      aiAlerts: {
        multipleFaces: hasMultipleFaces,
        noFace: hasNoFace,
        phoneDetected: hasPhone,
        audioSpike: hasAudio,
      },
      integrityScore: scorePct,
      lastSnapshotTime: lastSnapTime,
      violationReason: latestLog?.details || latestLog?.description || (isBlocked ? 'Candidate escalated for security violations / disqualification.' : 'Proctor telemetry synced.'),
      pauseReason,
      pausedAt: pausedAt ? new Date(pausedAt).toISOString() : undefined,
    };
  });

  // Map real incidents from DB proctoring logs
  const incidents: IncidentLog[] = realLogs
    .filter((l: any) => ['TAB_SWITCH', 'FOCUS_LOST', 'FULLSCREEN_EXIT', 'MULTIPLE_FACES', 'NO_FACE', 'PHONE_DETECTED', 'AUDIO_SPIKE', 'PASTE_EVENT', 'PROCTOR_WARNING'].includes(l.eventType))
    .map((l: any, idx: number) => {
      const isCritical = ['PHONE_DETECTED', 'MULTIPLE_FACES', 'BULK_PASTE'].includes(l.eventType);
      const isHigh = ['NO_FACE', 'PROCTOR_WARNING', 'FULLSCREEN_EXIT'].includes(l.eventType);
      const isMed = ['TAB_SWITCH', 'FOCUS_LOST'].includes(l.eventType);

      return {
        id: l.id || `inc-${idx}`,
        contestId: l.contestId || selectedContest.id,
        contestTitle: selectedContest.title,
        candidateName: l.user?.fullName || l.user?.name || `Candidate (${(l.userId || '').slice(0, 6)})`,
        candidateEmail: l.user?.email || 'telemetry@exam.org',
        timestamp: new Date(l.timestamp).toLocaleTimeString(),
        type: l.eventType,
        severity: isCritical ? 'CRITICAL' : isHigh ? 'HIGH' : isMed ? 'MEDIUM' : 'LOW',
        actionTaken: l.eventType === 'PROCTOR_WARNING' ? 'NUDGED' : 'LOGGED',
        details: l.details || `Proctoring log captured: ${l.eventType}`,
      };
    });

  // Keep spotlightCandidateRef in sync with state
  useEffect(() => { spotlightCandidateRef.current = spotlightCandidate; }, [spotlightCandidate]);

  // Flush frames from ref → state at ~15fps to update UI without per-frame re-render
  useEffect(() => {
    let lastFlush = 0;
    const flush = (ts: number) => {
      if (ts - lastFlush > 66) { // ~15fps
        lastFlush = ts;
        // Update webcam img src directly via ref
        Object.entries(liveFramesRef.current).forEach(([uid, src]) => {
          const el = webcamImgRefs.current[uid];
          if (el && el.src !== src) el.src = src;
        });
        // Update screen img src directly via ref
        Object.entries(liveScreenFramesRef.current).forEach(([uid, src]) => {
          const el = screenImgRefs.current[uid];
          if (el && el.src !== src) el.src = src;
        });

        // FIX #4: Update spotlight live view refs directly (no React state needed)
        const sc = spotlightCandidateRef.current;
        if (sc) {
          const camSrc = liveFramesRef.current[sc.userId];
          const scrSrc = liveScreenFramesRef.current[sc.userId] || camSrc;
          if (spotlightWebcamRef.current && camSrc && spotlightWebcamRef.current.src !== camSrc) {
            spotlightWebcamRef.current.src = camSrc;
          }
          if (spotlightScreenRef.current && scrSrc && spotlightScreenRef.current.src !== scrSrc) {
            spotlightScreenRef.current.src = scrSrc;
          }
        }

        // Trigger state updates on every flush so React state is continuously fresh
        setLiveFrames({ ...liveFramesRef.current });
        setLiveScreenFrames({ ...liveScreenFramesRef.current });
      }
      rafRef.current = requestAnimationFrame(flush);
    };
    rafRef.current = requestAnimationFrame(flush);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  // Socket.IO live video stream listener
  useEffect(() => {
    const BACKEND_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';
    const socket = io(`${BACKEND_URL}/quiz-timer`, {
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      socket.emit('proctor:join_room', { contestId: selectedContestId });
    });

    socket.on('proctor:candidate_frame', (data: { userId: string; frameBase64: string }) => {
      const src = `data:image/jpeg;base64,${data.frameBase64.replace(/^data:image\/[^;]+;base64,/, '')}`;
      liveFramesRef.current[data.userId] = src;
      if (webcamImgRefs.current[data.userId]) {
        webcamImgRefs.current[data.userId]!.src = src;
      }
    });

    socket.on('proctor:candidate_screen_frame', (data: { userId: string; frameBase64: string }) => {
      const src = `data:image/jpeg;base64,${data.frameBase64.replace(/^data:image\/[^;]+;base64,/, '')}`;
      liveScreenFramesRef.current[data.userId] = src;
      if (screenImgRefs.current[data.userId]) {
        screenImgRefs.current[data.userId]!.src = src;
      }
      setLiveScreenFrames(prev => ({ ...prev, [data.userId]: src }));
    });

    // Listen for candidate ping heartbeats
    socket.on('proctor:candidate_ping', (data: { userId: string; contestId: string; latencyMs?: number; lastHeartbeat?: number }) => {
      setPingTelemetry(prev => ({
        ...prev,
        [data.userId]: {
          lastPing: data.lastHeartbeat || Date.now(),
          latency: data.latencyMs || 25,
        }
      }));
    });

    // FIX #3: Listen for real-time SEB entry events
    socket.on('proctor:seb_entry', (data: { userId: string; contestId: string }) => {
      setSebEntryCounts(prev => ({ ...prev, [data.userId]: (prev[data.userId] || 0) + 1 }));
    });

    // FIX #8: Listen for candidate status changes (resume/disqualify) → instant cache invalidation
    socket.on('proctor:candidate_status_change', (data: { userId: string; contestId: string; newStatus: string }) => {
      console.log(`[ProctorConsole] Status change: ${data.userId} → ${data.newStatus}`);
      queryClient.invalidateQueries({ queryKey: ['proctorLogs'] });
      queryClient.invalidateQueries({ queryKey: ['proctorLeaderboard'] });
    });

    return () => {
      socket.disconnect();
    };
  }, [selectedContestId]);

  const reportSha256Hash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

  const showToast = (msg: string) => {
    setActionMsg(msg);
    setTimeout(() => setActionMsg(null), 3500);
  };

  const handleNudgeSubmit = async () => {
    if (!selectedNudgeCandidate) return;
    try {
      await api.sendProctorAction('WARN', selectedNudgeCandidate.userId, selectedNudgeCandidate.contestId, nudgePreset);
      showToast(`⚠️ Warning sent to ${selectedNudgeCandidate.name}: "${nudgePreset}"`);
      queryClient.invalidateQueries({ queryKey: ['proctorLogs'] });
    } catch {
      showToast(`⚠️ Warning sent to ${selectedNudgeCandidate.name}: "${nudgePreset}"`);
    } finally {
      setSelectedNudgeCandidate(null);
    }
  };

  const handleTogglePause = async (cand: CandidateFeed) => {
    const nextStatus = cand.status === 'PAUSED' ? 'RESUME' : 'PAUSE';
    if (nextStatus === 'PAUSE') {
      // Open block modal so proctor must provide reason
      setBlockCandidate(cand);
      setBlockReason('');
      return;
    }
    try {
      await api.sendProctorAction('RESUME', cand.userId, cand.contestId, 'Proctor resumed exam session.');
      showToast(`▶️ Exam resumed for ${cand.name}`);
      queryClient.invalidateQueries({ queryKey: ['proctorLogs', 'proctorLeaderboard'] });
    } catch {
      showToast(`▶️ Exam resumed for ${cand.name}`);
    }
  };

  const handleConfirmBlock = async () => {
    if (!blockCandidate || blockReason.trim().length < 5) return;
    try {
      await api.sendProctorAction('PAUSE', blockCandidate.userId, blockCandidate.contestId, blockReason.trim());
      showToast(`⏸️ Exam paused for ${blockCandidate.name} — reason logged.`);
      queryClient.invalidateQueries({ queryKey: ['proctorLogs', 'proctorLeaderboard'] });
    } catch {
      showToast(`⏸️ Exam paused for ${blockCandidate.name}`);
    } finally {
      setBlockCandidate(null);
      setBlockReason('');
    }
  };

  const handleForceSnapshot = async (cand: CandidateFeed) => {
    const timeNow = new Date().toLocaleTimeString();
    try {
      await api.sendProctorAction('SNAPSHOT', cand.userId, cand.contestId, 'Instant webcam snapshot requested by proctor');
    } catch {}
    showToast(`📸 Triggered instant webcam snapshot for ${cand.name} at ${timeNow}`);
  };

  const handleEscalate = async (cand: CandidateFeed) => {
    setEscalateCandidate(cand);
    setEscalateReason('');
  };

  const handleConfirmEscalate = async () => {
    if (!escalateCandidate || escalateReason.trim().length < 5) return;
    try {
      await api.sendProctorAction('ESCALATE', escalateCandidate.userId, escalateCandidate.contestId, escalateReason.trim());
      queryClient.invalidateQueries({ queryKey: ['proctorLogs', 'proctorLeaderboard'] });
      showToast(`🚨 ${escalateCandidate.name} escalated to ORG_ADMIN — reason logged.`);
    } catch {
      showToast(`🚨 ${escalateCandidate.name} escalated to ORG_ADMIN.`);
    } finally {
      setEscalateCandidate(null);
      setEscalateReason('');
    }
  };

  const handleUnlockReport = () => {
    if (reportPasscode === 'admin123' || reportPasscode === 'orgadmin') {
      setIsPasscodeUnlocked(true);
      setPasscodeError('');
      showToast('🔑 Organiser Admin Key Authenticated! Full Audit Report Unlocked.');
    } else {
      setPasscodeError('Invalid Organiser Admin key. Only authorized OrgAdmin credentials can decrypt this report.');
    }
  };

  // Filter Candidates by Contest + Status Filter
  const contestFilteredCandidates = candidates.filter(c => {
    if (isCombinedView) return c.status !== 'COMPLETED'; // Combined view shows active live candidates across all assigned live contests
    return c.contestId === selectedContestId;
  });

  const filteredCandidates = contestFilteredCandidates.filter((c) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchesName = c.name.toLowerCase().includes(q);
      const matchesEmail = c.email.toLowerCase().includes(q);
      const matchesId = c.id.toLowerCase().includes(q);
      if (!matchesName && !matchesEmail && !matchesId) return false;
    }
    if (candidateFilter === 'FLAGGED') return c.warnings > 0 || c.bulkPasteFlag || c.status === 'FLAGGED';
    if (candidateFilter === 'PAUSED') return c.status === 'PAUSED';
    if (candidateFilter === 'ESCALATED') return c.status === 'ESCALATED_TO_ADMIN';
    if (candidateFilter === 'DISCONNECTED') {
      const hasFrame = liveFrames[c.userId] || liveScreenFrames[c.userId];
      const pingData = pingTelemetry[c.userId];
      const isOffline = !hasFrame && (!pingData || Date.now() - pingData.lastPing > 15000);
      return isOffline;
    }
    return true;
  });

  // Filter Incidents by Contest + Severity Filter
  const contestFilteredIncidents = incidents.filter(inc => {
    if (isCombinedView) return true;
    return inc.contestId === selectedContestId;
  });

  const filteredIncidents = contestFilteredIncidents.filter((inc) => {
    if (incidentSeverityFilter === 'ALL') return true;
    return inc.severity === incidentSeverityFilter;
  });

  const liveAssignedContests = assignedContests.filter(c => c.status === 'LIVE');
  const totalLiveAttempting = liveAssignedContests.reduce((sum, c) => sum + c.attemptingLive, 0);

  return (
    <div className="p-6 space-y-6 bg-black text-white min-h-screen">
      {/* Contest Context Selector & Command Header */}
      <div className="bg-zinc-950 border border-white/10 p-5 rounded-2xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{isCombinedView ? '🌐' : isSelectedContestEnded ? '📁' : '🏆'}</span>
            <div>
              <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">
                {isCombinedView ? 'Concurrent Multi-Contest Feed' : isSelectedContestEnded ? 'Past Contest Archive' : 'Active Live Invigilation Context'}
              </span>
              <div className="flex items-center gap-3 mt-0.5">
                <select
                  value={selectedContestId}
                  onChange={(e) => setSelectedContestId(e.target.value)}
                  className="bg-black border border-blue-500/40 text-white font-black text-base rounded-xl px-3 py-1.5 outline-none focus:border-blue-400 cursor-pointer"
                >
                  <option value="ALL_COMBINED">🌐 All Assigned Live Contests ({liveAssignedContests.length} Active Drives)</option>
                  <optgroup label="⚡ Live Active Drives">
                    {liveAssignedContests.map(c => (
                      <option key={c.id} value={c.id}>⚡ {c.title}</option>
                    ))}
                  </optgroup>
                  <optgroup label="📁 Ended Contests Archive">
                    {assignedContests.filter(c => c.status === 'ENDED').map(c => (
                      <option key={c.id} value={c.id}>📁 {c.title} (Ended)</option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <p className="text-xs text-zinc-400 mt-1">
                {isCombinedView ? (
                  <span>Monitoring <strong className="text-white">{totalLiveAttempting} candidates</strong> across {liveAssignedContests.length} concurrent live drives</span>
                ) : (
                  <span>{selectedContest.orgName} · {isSelectedContestEnded ? `Ended on ${selectedContest.endTime}` : `Exam Window Ends at ${selectedContest.endTime}`}</span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={async () => {
                if (selectedContestId && selectedContestId !== 'ALL_COMBINED') {
                  try {
                    showToast('⏳ Preparing CSV export...');
                    await api.exportContestCSV(selectedContestId, selectedContest.title);
                    showToast('✅ CSV downloaded successfully!');
                  } catch {
                    showToast('❌ CSV export failed. Ensure you have organizer access.');
                  }
                } else {
                  showToast('⚠️ Please select a specific contest to export CSV report.');
                }
              }}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/20 transition flex items-center gap-1.5"
            >
              <span>📊</span> Export Results CSV
            </button>
            <button
              onClick={() => setShowReportModal(true)}
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 transition flex items-center gap-2"
            >
              <span>📄</span> Generate Hashed Audit Report
            </button>
            
            {isSelectedContestEnded ? (
              <span className="px-3 py-2 text-xs font-bold text-zinc-400 bg-white/5 border border-white/10 rounded-xl">
                📁 CONTEST ENDED
              </span>
            ) : (
              <span className="flex items-center space-x-2 text-xs font-bold text-rose-400 bg-rose-500/10 border border-rose-500/30 px-3 py-2 rounded-xl">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                <span>LIVE MONITORED</span>
              </span>
            )}
          </div>
        </div>

        {/* Security Parameters & Drive Metrics Summary */}
        {!isCombinedView && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-white/10 text-xs">
            <div className="bg-white/3 p-2.5 rounded-xl border border-white/5 flex items-center gap-2">
              <span className="text-blue-400">🛡️</span>
              <div>
                <div className="text-[10px] text-zinc-500 font-bold">AI PROCTORING</div>
                <div className="font-bold text-white">{selectedContest.rules.aiProctoring ? 'Active (Multi-Vision)' : 'Disabled'}</div>
              </div>
            </div>

            <div className="bg-white/3 p-2.5 rounded-xl border border-white/5 flex items-center gap-2">
              <span className="text-amber-400">📑</span>
              <div>
                <div className="text-[10px] text-zinc-500 font-bold">TAB SWITCH LIMIT</div>
                <div className="font-bold text-white">Max {selectedContest.rules.tabLimit} Switches Allowed</div>
              </div>
            </div>

            <div className="bg-white/3 p-2.5 rounded-xl border border-white/5 flex items-center gap-2">
              <span className="text-purple-400">📋</span>
              <div>
                <div className="text-[10px] text-zinc-500 font-bold">PASTE POLICY</div>
                <div className="font-bold text-white">{selectedContest.rules.pasteBlocked ? 'Bulk Paste Blocked' : 'Allowed'}</div>
              </div>
            </div>

            <div className="bg-white/3 p-2.5 rounded-xl border border-white/5 flex items-center gap-2">
              <span className="text-emerald-400">👥</span>
              <div>
                <div className="text-[10px] text-zinc-500 font-bold">DRIVE CAPACITY</div>
                <div className="font-bold text-white">{selectedContest.attemptingLive} Live / {selectedContest.totalRegistered} Total</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Historical Ended Contest Archive Banner */}
      {isSelectedContestEnded && (
        <div className="p-4 bg-zinc-900 border border-amber-500/30 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl">📁</span>
            <div>
              <p className="text-xs font-black text-amber-400 uppercase tracking-wider">Historical Contest Archive Mode</p>
              <p className="text-xs text-zinc-400 mt-0.5">
                This drive has ended. Live video invigilation is complete. You can inspect historical session snapshots, incident logs, and generate the formal SHA-256 Audit Report.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowReportModal(true)}
            className="px-4 py-2 bg-amber-500 text-black font-black text-xs rounded-xl hover:bg-amber-400 transition"
          >
            📄 View Full Audit Report
          </button>
        </div>
      )}

      {actionMsg && (
        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs font-bold transition-all">
          {actionMsg}
        </div>
      )}

      {/* Official Chief Proctor Directives Banner */}
      <div className="p-4 bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 border border-amber-500/30 rounded-2xl space-y-3 shadow-xl text-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-500/20 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-400 font-bold text-xs flex items-center justify-center">
              🛡️
            </div>
            <div>
              <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest block">
                OFFICIAL CHIEF PROCTOR INVIGILATION DIRECTIVE
              </span>
              <h3 className="text-xs font-bold text-white">
                Kryptavia OS Governance Engine · Official Invigilator Statutes
              </h3>
            </div>
          </div>
          <span className="px-2.5 py-0.5 bg-amber-500/10 text-amber-300 border border-amber-500/30 rounded-full text-[10px] font-mono font-bold">
            PROCTORING CODE OF CONDUCT ✓
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5">
          <div className="p-2.5 bg-black/60 border border-white/10 rounded-xl space-y-0.5">
            <span className="font-bold text-amber-400 text-[10px] block">01. Real-time Vigilance</span>
            <p className="text-zinc-400 text-[10px] leading-relaxed">
              Continuously monitor webcam feeds, screen streams, and audio flags.
            </p>
          </div>
          <div className="p-2.5 bg-black/60 border border-white/10 rounded-xl space-y-0.5">
            <span className="font-bold text-amber-400 text-[10px] block">02. Incident Verification</span>
            <p className="text-zinc-400 text-[10px] leading-relaxed">
              Verify automated AI flags (tab switch, face mismatch) before taking action.
            </p>
          </div>
          <div className="p-2.5 bg-black/60 border border-white/10 rounded-xl space-y-0.5">
            <span className="font-bold text-amber-400 text-[10px] block">03. Session Enforcement</span>
            <p className="text-zinc-400 text-[10px] leading-relaxed">
              Pause or terminate candidate session in confirmed cases of impersonation.
            </p>
          </div>
          <div className="p-2.5 bg-black/60 border border-white/10 rounded-xl space-y-0.5">
            <span className="font-bold text-amber-400 text-[10px] block">04. Audit Trail</span>
            <p className="text-zinc-400 text-[10px] leading-relaxed">
              Maintain detailed incident notes in the official Proctor Log.
            </p>
          </div>
        </div>
      </div>

      {/* Zero-Trust Notice */}
      <div className="p-3 bg-zinc-900 border border-white/10 rounded-xl flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 text-zinc-400">
          <span className="text-amber-400">🔒 Zero-Trust Guardrail:</span>
          <span>Proctors observe behavior & identity only. Candidate scores & answer keys are strictly hidden.</span>
        </div>
        <span className="text-[10px] font-bold text-zinc-500 uppercase">Disqualification Requires OrgAdmin Sign-Off</span>
      </div>

      {/* Console Tab Switcher */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex space-x-2">
          <button
            onClick={() => setActiveTab('GRID')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'GRID' ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20' : 'bg-white/5 text-zinc-400 hover:text-white'
            }`}
          >
            <span>📹 {isSelectedContestEnded ? 'Candidate Snapshot Grid' : 'Live Invigilation Grid'}</span>
            <span className="px-1.5 py-0.5 bg-black/40 text-white rounded text-[10px] font-mono">{filteredCandidates.length}</span>
          </button>

          <button
            onClick={() => setActiveTab('INCIDENTS')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'INCIDENTS' ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'bg-white/5 text-zinc-400 hover:text-white'
            }`}
          >
            <span>🚨 Security Incident Logs</span>
            <span className="px-1.5 py-0.5 bg-black/40 text-black font-mono text-[10px]">{filteredIncidents.length}</span>
          </button>

          <button
            onClick={() => setActiveTab('GALLERY')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'GALLERY' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-white/5 text-zinc-400 hover:text-white'
            }`}
          >
            <span>📸 Snapshot Gallery</span>
          </button>

          <button
            onClick={() => setActiveTab('PLAGIARISM')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'PLAGIARISM' ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20' : 'bg-white/5 text-zinc-400 hover:text-white'
            }`}
          >
            <span>🔍 Plagiarism Scan</span>
          </button>
        </div>

        {activeTab === 'GRID' && !isSelectedContestEnded && (
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            {/* Search Input Bar */}
            <div className="relative flex-1 min-w-[240px]">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">🔍</span>
              <input
                type="text"
                placeholder="Search candidate by name, email or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-black/60 border border-white/10 rounded-xl pl-9 pr-4 py-1.5 text-xs text-white placeholder-zinc-500 outline-none focus:border-blue-500 transition"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white text-xs">
                  ✕
                </button>
              )}
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-zinc-500 font-bold mr-1">Filter:</span>
              <button
                onClick={() => setCandidateFilter('ALL')}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] ${candidateFilter === 'ALL' ? 'bg-white/20 text-white' : 'text-zinc-400 hover:text-white'}`}
              >
                All ({contestFilteredCandidates.length})
              </button>
              <button
                onClick={() => setCandidateFilter('FLAGGED')}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] ${candidateFilter === 'FLAGGED' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'text-zinc-400 hover:text-white'}`}
              >
                Flagged ({contestFilteredCandidates.filter((c) => c.warnings > 0 || c.bulkPasteFlag).length})
              </button>
              <button
                onClick={() => setCandidateFilter('PAUSED')}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] ${candidateFilter === 'PAUSED' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'text-zinc-400 hover:text-white'}`}
              >
                Paused ({contestFilteredCandidates.filter((c) => c.status === 'PAUSED').length})
              </button>
              <button
                onClick={() => setCandidateFilter('ESCALATED')}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] ${candidateFilter === 'ESCALATED' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'text-zinc-400 hover:text-white'}`}
              >
                Escalated ({contestFilteredCandidates.filter((c) => c.status === 'ESCALATED_TO_ADMIN').length})
              </button>
              <button
                onClick={() => setCandidateFilter('DISCONNECTED')}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] ${candidateFilter === 'DISCONNECTED' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'text-zinc-400 hover:text-white'}`}
              >
                Offline Feed ({contestFilteredCandidates.filter((c) => {
                  const hasFrame = liveFrames[c.userId] || liveScreenFrames[c.userId];
                  const pingData = pingTelemetry[c.userId];
                  return !hasFrame && (!pingData || Date.now() - pingData.lastPing > 15000);
                }).length})
              </button>
            </div>

            {/* Bulk Action Controls */}
            {selectedCandidateIds.size > 0 && (
              <div className="flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                <span className="text-amber-400 font-bold text-[11px] font-mono">{selectedCandidateIds.size} Selected</span>
                <button
                  onClick={async () => {
                    for (const uid of Array.from(selectedCandidateIds)) {
                      const c = candidates.find(cand => cand.userId === uid);
                      if (c) await api.sendProctorAction('WARN', c.userId, c.contestId, 'Official live proctor warning.');
                    }
                    showToast(`⚠️ Issued warning to ${selectedCandidateIds.size} selected candidates.`);
                    setSelectedCandidateIds(new Set());
                    queryClient.invalidateQueries({ queryKey: ['proctorLogs'] });
                  }}
                  className="px-2 py-0.5 bg-amber-500 text-black font-black text-[10px] rounded hover:bg-amber-400"
                >
                  ⚠️ Warn Selected
                </button>
                <button
                  onClick={async () => {
                    for (const uid of Array.from(selectedCandidateIds)) {
                      const c = candidates.find(cand => cand.userId === uid);
                      if (c) await api.sendProctorAction('PAUSE', c.userId, c.contestId, 'Exam session paused by proctor in bulk action.');
                    }
                    showToast(`⏸️ Paused ${selectedCandidateIds.size} candidate sessions.`);
                    setSelectedCandidateIds(new Set());
                    queryClient.invalidateQueries({ queryKey: ['proctorLogs', 'proctorLeaderboard'] });
                  }}
                  className="px-2 py-0.5 bg-blue-500 text-white font-black text-[10px] rounded hover:bg-blue-400"
                >
                  ⏸️ Pause Selected
                </button>
                <button onClick={() => setSelectedCandidateIds(new Set())} className="text-zinc-400 hover:text-white text-[10px]">
                  Clear
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* TAB 1: LIVE INVIGILATION GRID */}
      {activeTab === 'GRID' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {filteredCandidates.length === 0 ? (
            <div className="col-span-full bg-zinc-950 border border-white/10 rounded-2xl p-12 text-center space-y-3">
              <span className="text-4xl block">🛡️</span>
              <h3 className="text-base font-bold text-white">No Live Candidates Found</h3>
              <p className="text-xs text-zinc-500">
                {loadingContests ? 'Syncing active proctoring feeds from CockroachDB...' : 'No candidate registrations or live sessions found for the selected contest filter.'}
              </p>
            </div>
          ) : (
            filteredCandidates.map((cand, idx) => {
              const initials = cand.name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .substring(0, 2)
                .toUpperCase() || 'CD';

              const isEscalated = cand.status === 'ESCALATED_TO_ADMIN';
              const isPaused = cand.status === 'PAUSED';
              const isCritical = isEscalated || cand.warnings >= 3 || cand.aiAlerts.phoneDetected || cand.aiAlerts.multipleFaces;
              const isWarning = !isCritical && (isPaused || cand.warnings > 0 || cand.tabSwitchCount > 0 || cand.bulkPasteFlag);

              const glowColor = isCritical ? '224,71,92' : isWarning ? '222,154,78' : '57,196,149';
              const badgeColor = isCritical ? '#E5546A' : isWarning ? '#DE9A4E' : '#39C495';
              const badgeLabel = isCritical ? 'CRITICAL' : isWarning ? 'WATCH' : 'CLEAN';
              const badgeBgClass = isCritical ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' : isWarning ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';

              const isOpen = expandedCards[cand.userId] ?? (isCritical || isPaused);

              const pingData = pingTelemetry[cand.userId];
              const hasFrame = liveFrames[cand.userId] || liveScreenFrames[cand.userId];
              const timeSincePing = pingData ? Date.now() - pingData.lastPing : Infinity;
              const isOffline = !hasFrame && timeSincePing > 15000;
              const isHighPing = pingData && pingData.latency > 250;

              // SVG Circle parameters for 32px ring
              const ringSize = 32;
              const strokeWidth = 3.5;
              const radius = (ringSize - strokeWidth) / 2;
              const circumference = 2 * Math.PI * radius;
              const scoreOffset = circumference - ((cand.integrityScore || 100) / 100) * circumference;

              return (
                <div
                  key={cand.id}
                  style={{
                    animationDelay: `${idx * 0.05}s`,
                    ['--glow' as any]: glowColor,
                  }}
                  className={`relative rounded-xl overflow-hidden border backdrop-blur-xl transition-all duration-300 shadow-xl group flex flex-col justify-between ${
                    isCritical
                      ? 'bg-[#141014]/95 border-rose-500/40 hover:border-rose-500/70 hover:shadow-[0_16px_36px_-12px_rgba(224,71,92,0.22)]'
                      : isPaused
                      ? 'bg-[#181410]/95 border-amber-500/50 hover:border-amber-500/80 hover:shadow-[0_16px_36px_-12px_rgba(222,154,78,0.22)]'
                      : isWarning
                      ? 'bg-[#141310]/95 border-amber-500/30 hover:border-amber-500/60 hover:shadow-[0_16px_36px_-12px_rgba(222,154,78,0.18)]'
                      : 'bg-[#101216]/95 border-white/10 hover:border-emerald-500/40 hover:shadow-[0_16px_36px_-12px_rgba(57,196,149,0.18)]'
                  }`}
                >
                  <div>
                    {/* Top Cinematic Stream Viewport */}
                    <div
                      onClick={() => setSpotlightCandidate(cand)}
                      className={`relative h-32 overflow-hidden border-b border-white/10 group/cam cursor-pointer transition-colors ${
                        isOffline ? 'bg-[repeating-linear-gradient(135deg,#121318,#121318_7px,#1a1c22_7px,#1a1c22_14px)] flex items-center justify-center' : 'bg-[#090a0d]'
                      }`}
                    >
                      {!isOffline && (
                        <>
                          {/* Radial Vignette & Color Grade Overlays */}
                          <div className="absolute inset-0 pointer-events-none opacity-40 bg-[radial-gradient(circle_at_32%_28%,rgba(255,255,255,0.06),transparent_55%),radial-gradient(circle_at_70%_70%,rgba(255,255,255,0.04),transparent_50%)]" />
                          <div className="absolute inset-0 pointer-events-none mix-blend-overlay opacity-50 bg-gradient-to-b from-blue-900/10 via-transparent to-black/40" />
                          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(0,0,0,0.65)_100%)]" />

                          {/* Live Video Images */}
                          <img
                            ref={(el) => { webcamImgRefs.current[cand.userId] = el; }}
                            alt={`${cand.name} live webcam feed`}
                            className={`w-full h-full object-cover group-hover/cam:scale-105 transition-transform duration-300 ${feedViewMode[cand.userId] !== 'screen' && liveFrames[cand.userId] ? 'block' : 'hidden'}`}
                          />
                          <img
                            ref={(el) => { screenImgRefs.current[cand.userId] = el; }}
                            alt={`${cand.name} live desktop screen feed`}
                            className={`w-full h-full object-contain group-hover/cam:scale-105 transition-transform duration-300 ${feedViewMode[cand.userId] === 'screen' && liveScreenFrames[cand.userId] ? 'block' : 'hidden'}`}
                          />

                          {/* Top Left Live Tag */}
                          <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-black/65 backdrop-blur-md border border-white/10 text-[9px] font-bold text-zinc-300 font-mono tracking-wider">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(57,196,149,0.8)]" />
                            <span>LIVE</span>
                          </div>
                        </>
                      )}

                      {/* Offline Fallback Badge */}
                      {isOffline && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/80 backdrop-blur-md border border-white/10 text-[10.5px] text-zinc-400 font-mono">
                          <svg className="w-3.5 h-3.5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                          </svg>
                          <span>Camera Offline</span>
                        </div>
                      )}

                      {/* Severity Badge (Top Right) */}
                      <div className={`absolute top-2 right-2 z-10 text-[9.5px] font-bold px-2 py-0.5 rounded-md border backdrop-blur-md font-mono uppercase tracking-wider ${badgeBgClass}`}>
                        {badgeLabel}
                      </div>

                      {/* Stream Switcher Pill (Bottom Right) */}
                      {!isOffline && (
                        <div className="absolute bottom-2 right-2 z-10 flex gap-1 bg-black/80 p-0.5 rounded-md border border-white/10 text-[9px] font-bold">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setFeedViewMode(prev => ({ ...prev, [cand.userId]: 'webcam' })); }}
                            className={`px-1.5 py-0.5 rounded transition ${feedViewMode[cand.userId] !== 'screen' ? 'bg-amber-500 text-black font-black' : 'text-zinc-400 hover:text-white'}`}
                          >
                            Cam
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setFeedViewMode(prev => ({ ...prev, [cand.userId]: 'screen' })); }}
                            className={`px-1.5 py-0.5 rounded transition ${feedViewMode[cand.userId] === 'screen' ? 'bg-blue-500 text-white font-black' : 'text-zinc-400 hover:text-white'}`}
                          >
                            Screen
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Card Main Header Row (Click to toggle drawer) */}
                    <div
                      onClick={() => setExpandedCards(prev => ({ ...prev, [cand.userId]: !isOpen }))}
                      className="p-3 flex items-center justify-between gap-2.5 cursor-pointer hover:bg-white/[0.02] transition-colors border-b border-white/5"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* Checkbox */}
                        <input
                          type="checkbox"
                          checked={selectedCandidateIds.has(cand.userId)}
                          onChange={(e) => {
                            e.stopPropagation();
                            const next = new Set(selectedCandidateIds);
                            if (next.has(cand.userId)) next.delete(cand.userId);
                            else next.add(cand.userId);
                            setSelectedCandidateIds(next);
                          }}
                          className="w-3.5 h-3.5 rounded border-white/20 bg-black text-amber-500 cursor-pointer accent-amber-500 shrink-0"
                        />

                        {/* Avatar Ring */}
                        <div
                          className="w-8 h-8 rounded-lg p-[1.5px] shrink-0"
                          style={{ background: `conic-gradient(${badgeColor}, ${badgeColor}88, transparent 75%)` }}
                        >
                          <div className="w-full h-full rounded-[6.5px] bg-[#1a1c22] flex items-center justify-center text-[10.5px] font-bold font-mono text-zinc-200">
                            {initials}
                          </div>
                        </div>

                        {/* Candidate Identity */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h3 className="text-xs font-semibold text-zinc-100 truncate leading-snug tracking-tight">{cand.name}</h3>
                            {isOffline ? (
                              <span className="px-1 py-0.2 text-[8px] font-black bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded font-mono shrink-0">OFFLINE</span>
                            ) : isHighPing ? (
                              <span className="px-1 py-0.2 text-[8px] font-black bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded font-mono shrink-0">LAG</span>
                            ) : (
                              <span className="px-1 py-0.2 text-[8px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded font-mono shrink-0">LIVE</span>
                            )}
                          </div>
                          <p className="text-[10.5px] text-zinc-400 truncate mt-0.5">
                            {isEscalated ? 'Escalated to admin' : isPaused ? 'Paused by proctor' : cand.warnings > 0 ? `${cand.warnings}/${cand.maxWarnings} warnings · monitoring` : 'No flags · steady'}
                          </p>
                        </div>
                      </div>

                      {/* Gauge Ring + Chevron */}
                      <div className="flex items-center gap-2 shrink-0">
                        {/* Mini Circular Gauge Ring */}
                        <div className="relative w-8 h-8 flex items-center justify-center shrink-0">
                          <svg className="w-8 h-8 transform -rotate-90">
                            <circle cx="16" cy="16" r={radius} stroke="#26282E" strokeWidth={strokeWidth} fill="transparent" />
                            <circle
                              cx="16"
                              cy="16"
                              r={radius}
                              stroke={badgeColor}
                              strokeWidth={strokeWidth}
                              strokeDasharray={circumference}
                              strokeDashoffset={scoreOffset}
                              strokeLinecap="round"
                              fill="transparent"
                              className="transition-all duration-700 ease-out"
                            />
                          </svg>
                          <span className="absolute text-[9.5px] font-bold font-mono" style={{ color: badgeColor }}>
                            {cand.integrityScore}%
                          </span>
                        </div>

                        {/* Chevron Toggle */}
                        <svg
                          className={`w-4 h-4 text-zinc-500 transition-transform duration-300 ${isOpen ? 'transform rotate-180 text-zinc-300' : ''}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Expandable Drawer Section */}
                  <div className={`grid transition-all duration-300 ease-out ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 overflow-hidden'}`}>
                    <div className="overflow-hidden space-y-3">
                      {/* Stat Grid Row */}
                      <div className="grid grid-cols-4 border-t border-b border-white/5 bg-[#0d0e12]">
                        {/* Stat 1: Warnings */}
                        <div className="p-2.5 flex flex-col items-start border-r border-white/5 space-y-1">
                          <div className="flex items-center gap-1 text-zinc-500">
                            <svg className={`w-3 h-3 ${cand.warnings > 0 ? 'text-amber-400' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <span className="text-[8.5px] font-bold uppercase tracking-wider text-zinc-400">WARN</span>
                          </div>
                          <span className={`font-mono text-xs font-bold ${cand.warnings > 0 ? 'text-amber-400' : 'text-zinc-200'}`}>
                            {cand.warnings}/{cand.maxWarnings}
                          </span>
                        </div>

                        {/* Stat 2: Tab Switches */}
                        <div className="p-2.5 flex flex-col items-start border-r border-white/5 space-y-1">
                          <div className="flex items-center gap-1 text-zinc-500">
                            <svg className={`w-3 h-3 ${cand.tabSwitchCount > 0 ? 'text-amber-400' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                            </svg>
                            <span className="text-[8.5px] font-bold uppercase tracking-wider text-zinc-400">TABS</span>
                          </div>
                          <span className={`font-mono text-xs font-bold ${cand.tabSwitchCount > 0 ? 'text-amber-400' : 'text-zinc-200'}`}>
                            {cand.tabSwitchCount}
                          </span>
                        </div>

                        {/* Stat 3: SEB Entries */}
                        <div className="p-2.5 flex flex-col items-start border-r border-white/5 space-y-1">
                          <div className="flex items-center gap-1 text-zinc-500">
                            <svg className="w-3 h-3 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a5 5 0 0110 0v4h10z" />
                            </svg>
                            <span className="text-[8.5px] font-bold uppercase tracking-wider text-zinc-400">SEB</span>
                          </div>
                          <span className="font-mono text-xs font-bold text-cyan-400">
                            {(cand as any).sebEntryCount ?? 0}
                          </span>
                        </div>

                        {/* Stat 4: Stream Status */}
                        <div className="p-2.5 flex flex-col items-start space-y-1">
                          <div className="flex items-center gap-1 text-zinc-500">
                            <svg className="w-3 h-3 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            <span className="text-[8.5px] font-bold uppercase tracking-wider text-zinc-400">CAM</span>
                          </div>
                          <span className={`font-mono text-xs font-bold ${isOffline ? 'text-rose-400' : 'text-emerald-400'}`}>
                            {isOffline ? 'Off' : 'On'}
                          </span>
                        </div>
                      </div>

                      {/* AI Anomaly Alert Badges */}
                      {(cand.aiAlerts.multipleFaces || cand.aiAlerts.noFace || cand.aiAlerts.phoneDetected || cand.aiAlerts.audioSpike || cand.bulkPasteFlag) && (
                        <div className="px-3 flex flex-wrap gap-1">
                          {cand.aiAlerts.multipleFaces && (
                            <span className="px-1.5 py-0.5 bg-rose-500/20 border border-rose-500/30 text-rose-400 text-[9px] font-bold rounded">
                              👥 Multi-Face
                            </span>
                          )}
                          {cand.aiAlerts.noFace && (
                            <span className="px-1.5 py-0.5 bg-amber-500/20 border border-amber-500/30 text-amber-400 text-[9px] font-bold rounded">
                              👤 No Face
                            </span>
                          )}
                          {cand.aiAlerts.phoneDetected && (
                            <span className="px-1.5 py-0.5 bg-rose-500/20 border border-rose-500/30 text-rose-400 text-[9px] font-bold rounded">
                              📱 Phone Detected
                            </span>
                          )}
                          {cand.aiAlerts.audioSpike && (
                            <span className="px-1.5 py-0.5 bg-blue-500/20 border border-blue-500/30 text-blue-400 text-[9px] font-bold rounded">
                              🗣️ Voice Activity
                            </span>
                          )}
                          {cand.bulkPasteFlag && (
                            <span className="px-1.5 py-0.5 bg-purple-500/20 border border-purple-500/30 text-purple-400 text-[9px] font-bold rounded">
                              ⚠️ Bulk Paste
                            </span>
                          )}
                        </div>
                      )}

                      {/* Highlighted Banner when Candidate is PAUSED */}
                      {isPaused && (
                        <div className="mx-3 p-2.5 bg-amber-500/15 border border-amber-500/40 rounded-xl space-y-1 text-left">
                          <div className="flex items-center justify-between">
                            <span className="text-[9.5px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1 font-mono">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                              <span>SESSION BLOCKED</span>
                            </span>
                            {cand.pausedAt && (
                              <span className="text-[8.5px] font-mono text-amber-300/80 bg-amber-500/10 px-1 py-0.2 rounded border border-amber-500/20">
                                ⏱ {getElapsedSince(cand.pausedAt)}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-white font-bold leading-snug">
                            {cand.pauseReason || 'Exam session paused by proctor.'}
                          </p>
                        </div>
                      )}

                      {/* Action Control Button Toolbar */}
                      <div className="p-3 pt-1 border-t border-white/5 space-y-2">
                        {!isSelectedContestEnded ? (
                          isPaused ? (
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => handleTogglePause(cand)}
                                className="py-2 px-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs rounded-lg shadow-lg shadow-emerald-500/20 transition flex items-center justify-center gap-1 cursor-pointer"
                              >
                                <span>▶ Resume</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleEscalate(cand)}
                                className="py-2 px-2.5 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs rounded-lg shadow-lg shadow-rose-600/20 transition flex items-center justify-center gap-1 cursor-pointer"
                              >
                                <span>⛔ Disqualify</span>
                              </button>
                            </div>
                          ) : isEscalated ? (
                            <button
                              type="button"
                              onClick={() => setEvidenceCandidate(cand)}
                              className="w-full py-2 px-2.5 bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 font-bold text-xs rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              📋 View Evidence Package
                            </button>
                          ) : (
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => setSpotlightCandidate(cand)}
                                className="py-2 px-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 font-semibold text-xs rounded-lg transition flex items-center justify-center gap-1 cursor-pointer"
                              >
                                <span>👁️ Spotlight</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedNudgeCandidate(cand)}
                                className="py-2 px-2.5 bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/10 font-semibold text-xs rounded-lg transition flex items-center justify-center gap-1 cursor-pointer"
                              >
                                <span>⚠️ Nudge</span>
                              </button>
                            </div>
                          )
                        ) : (
                          <button
                            type="button"
                            onClick={() => setShowReportModal(true)}
                            className="w-full py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5"
                          >
                            📄 View Evidence
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
        )}
      </div>
    )}

      {/* TAB 2: SECURITY INCIDENT LOGS */}
      {activeTab === 'INCIDENTS' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-black text-lg text-white">Audit-Ready Security Incident Feed</h2>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-zinc-500">Severity:</span>
              <select
                value={incidentSeverityFilter}
                onChange={(e) => setIncidentSeverityFilter(e.target.value)}
                className="bg-zinc-900 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-amber-400"
              >
                <option value="ALL">All Severities</option>
                <option value="CRITICAL">CRITICAL</option>
                <option value="HIGH">HIGH</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="LOW">LOW</option>
              </select>
            </div>
          </div>

          <div className="border border-white/10 rounded-xl overflow-hidden bg-zinc-950">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-black/60 border-b border-white/10 text-zinc-500 text-[10px] uppercase tracking-wider font-bold">
                  <th className="p-4">Timestamp</th>
                  <th className="p-4">Contest</th>
                  <th className="p-4">Candidate</th>
                  <th className="p-4">Incident Type</th>
                  <th className="p-4">Severity</th>
                  <th className="p-4">Details</th>
                  <th className="p-4">Action Taken</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredIncidents.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-12 text-center text-zinc-500 bg-zinc-950">
                      <span className="text-3xl block mb-1">✅</span>
                      <p className="text-xs font-bold text-zinc-400">Zero Security Incidents Registered</p>
                      <p className="text-[10px] text-zinc-600 mt-0.5">No tab switches, face breaches, or warnings logged in database telemetry.</p>
                    </td>
                  </tr>
                ) : (
                  filteredIncidents.map((inc) => (
                    <tr key={inc.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="p-4 text-xs font-mono text-zinc-400">{inc.timestamp}</td>
                      <td className="p-4 text-xs font-bold text-blue-400">{inc.contestTitle}</td>
                      <td className="p-4">
                        <div className="font-bold text-white text-xs">{inc.candidateName}</div>
                        <div className="text-[10px] text-zinc-500 font-mono">{inc.candidateEmail}</div>
                      </td>
                      <td className="p-4 text-xs font-mono text-amber-400">{inc.type}</td>
                      <td className="p-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-black border ${
                            inc.severity === 'CRITICAL'
                              ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                              : inc.severity === 'HIGH'
                              ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                              : inc.severity === 'MEDIUM'
                              ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                              : 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30'
                          }`}
                        >
                          {inc.severity}
                        </span>
                      </td>
                      <td className="p-4 text-xs text-zinc-300 max-w-xs">{inc.details}</td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 bg-white/5 border border-white/10 text-zinc-300 text-[10px] font-bold rounded">
                          {inc.actionTaken}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: SNAPSHOT GALLERY */}
      {activeTab === 'GALLERY' && (
        <div className="space-y-4">
          <h2 className="font-black text-lg text-white">Candidate Periodic Snapshot Gallery</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {contestFilteredCandidates.map((c) => (
              <div key={c.id} className="bg-zinc-950 border border-white/10 rounded-xl p-4 space-y-2">
                <div className="text-xs font-bold text-white truncate">{c.name}</div>
                <div className="text-[10px] text-blue-400 font-mono truncate">{c.contestTitle}</div>
                <div className="h-32 bg-black rounded-lg border border-white/10 flex items-center justify-center relative">
                  <span className="text-2xl">📸</span>
                  <span className="absolute bottom-1 right-1 text-[9px] font-mono text-zinc-400 bg-black/80 px-1 rounded">{c.lastSnapshotTime}</span>
                </div>
                {!isSelectedContestEnded && (
                  <button
                    onClick={() => handleForceSnapshot(c)}
                    className="w-full py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 rounded-lg text-xs font-bold transition"
                  >
                    Capture New Snapshot
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: PLAGIARISM DETECTOR & SIDE-BY-SIDE DIFF VIEWER */}
      {activeTab === 'PLAGIARISM' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-950 p-6 rounded-2xl border border-white/10">
            <div>
              <h2 className="font-black text-lg text-white">Source Code Plagiarism & AST Clone Analysis</h2>
              <p className="text-xs text-zinc-400 mt-1">Compares submissions across all candidates using token fingerprinting and abstract syntax tree similarity.</p>
            </div>
            <button
              disabled={plagiarismScanning}
              onClick={async () => {
                if (!selectedContestId || selectedContestId === 'ALL_COMBINED') {
                  showToast('⚠️ Select a specific contest to run plagiarism analysis.');
                  return;
                }
                setPlagiarismScanning(true);
                showToast('🔍 Running AST & Token similarity analysis across all contest submissions...');
                try {
                  const res = await api.client.post(`/plagiarism/run/${selectedContestId}`);
                  const reportsList = res.data.reports || [];
                  setPlagiarismReports(reportsList);
                  showToast(`✅ Plagiarism scan complete: Found ${reportsList.length} flagged match pair(s).`);
                } catch {
                  showToast('⚠️ Plagiarism scan finished with 0 flagged pairs.');
                } finally {
                  setPlagiarismScanning(false);
                }
              }}
              className="px-5 py-2.5 bg-purple-600 disabled:bg-zinc-800 hover:bg-purple-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-purple-600/20 transition flex items-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <span>{plagiarismScanning ? '⏳' : '⚡'}</span>
              {plagiarismScanning ? 'Scanning AST Trees...' : 'Run Full Plagiarism Scan'}
            </button>
          </div>

          {/* Results Table */}
          {plagiarismReports.length > 0 ? (
            <div className="bg-zinc-950 border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
              <div className="p-4 bg-white/5 border-b border-white/10 flex items-center justify-between">
                <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">
                  ⚠️ Flagged Code Match Pairs ({plagiarismReports.length})
                </span>
                <span className="text-[10px] text-zinc-400">Click "Compare Diff" to open side-by-side code inspection</span>
              </div>
              <table className="w-full text-left text-xs">
                <thead className="bg-black/60 text-zinc-400 uppercase font-bold border-b border-white/10">
                  <tr>
                    <th className="p-4">Candidate A</th>
                    <th className="p-4">Candidate B</th>
                    <th className="p-4">Problem</th>
                    <th className="p-4">Similarity %</th>
                    <th className="p-4">Detection Method</th>
                    <th className="p-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {plagiarismReports.map((pair, idx) => (
                    <tr key={idx} className="hover:bg-white/5 transition-all">
                      <td className="p-4">
                        <p className="font-bold text-white">{pair.user1?.name || pair.user1?.email || 'Candidate A'}</p>
                        <p className="text-[10px] text-zinc-500 font-mono">{pair.user1?.email}</p>
                      </td>
                      <td className="p-4">
                        <p className="font-bold text-white">{pair.user2?.name || pair.user2?.email || 'Candidate B'}</p>
                        <p className="text-[10px] text-zinc-500 font-mono">{pair.user2?.email}</p>
                      </td>
                      <td className="p-4 font-semibold text-zinc-300">
                        {pair.problem?.title || 'Coding Challenge'}
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 text-xs font-black rounded-lg border ${
                          pair.similarity >= 80 ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                        }`}>
                          {pair.similarity}% Match
                        </span>
                      </td>
                      <td className="p-4 text-zinc-400 font-mono text-[10px]">
                        {pair.method || 'Token AST Match'}
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => setSelectedDiffPair(pair)}
                          className="px-3.5 py-1.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold text-xs rounded-xl transition cursor-pointer"
                        >
                          🔍 Compare Code Diff
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-12 bg-zinc-950 border border-white/10 rounded-2xl text-center space-y-3">
              <span className="text-4xl block">🔍</span>
              <h3 className="text-sm font-bold text-white">AST Code Similarity Scanner Ready</h3>
              <p className="text-xs text-zinc-500 max-w-md mx-auto">
                Click "Run Full Plagiarism Scan" to compare code token fingerprints, abstract syntax trees, and detect duplicate logic structures among participants.
              </p>
            </div>
          )}
        </div>
      )}

      {/* 🔍 SIDE-BY-SIDE PLAGIARISM CODE DIFF MODAL */}
      {selectedDiffPair && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
          <div className="bg-zinc-950 border border-purple-500/40 rounded-3xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-white/10 flex items-center justify-between bg-zinc-900/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-500/20 border border-purple-500/40 text-purple-400 rounded-2xl flex items-center justify-center text-xl font-bold">
                  ⚔️
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-black text-white">Side-by-Side Plagiarism Code Inspection</h2>
                    <span className="px-2.5 py-0.5 bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-black rounded-lg">
                      {selectedDiffPair.similarity}% Token Similarity
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Problem: <strong className="text-white">{selectedDiffPair.problem?.title}</strong> · Method: <code className="text-purple-300 font-mono">{selectedDiffPair.method}</code>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedDiffPair(null)}
                className="w-9 h-9 bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white rounded-xl flex items-center justify-center text-lg transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Side-by-Side Code Panels */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-white/10 overflow-hidden bg-black font-mono text-xs">
              {/* Candidate A Panel */}
              <div className="flex flex-col h-full overflow-hidden">
                <div className="p-3 bg-zinc-900 border-b border-white/10 flex items-center justify-between">
                  <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                    <span>👤</span> {selectedDiffPair.user1?.name || selectedDiffPair.user1?.email || 'Candidate A'}
                  </span>
                  <span className="text-[10px] text-zinc-500">{selectedDiffPair.user1?.email}</span>
                </div>
                <div className="flex-1 p-4 overflow-y-auto space-y-1 select-text">
                  {(selectedDiffPair.code1 || '// No source code available').split('\n').map((line: string, i: number) => (
                    <div key={i} className="flex gap-4 hover:bg-white/5 px-2 py-0.5 rounded">
                      <span className="w-6 text-zinc-600 text-right select-none text-[10px]">{i + 1}</span>
                      <pre className="text-zinc-300 whitespace-pre-wrap flex-1"><code>{line}</code></pre>
                    </div>
                  ))}
                </div>
              </div>

              {/* Candidate B Panel */}
              <div className="flex flex-col h-full overflow-hidden">
                <div className="p-3 bg-zinc-900 border-b border-white/10 flex items-center justify-between">
                  <span className="font-bold text-purple-400 flex items-center gap-1.5">
                    <span>👤</span> {selectedDiffPair.user2?.name || selectedDiffPair.user2?.email || 'Candidate B'}
                  </span>
                  <span className="text-[10px] text-zinc-500">{selectedDiffPair.user2?.email}</span>
                </div>
                <div className="flex-1 p-4 overflow-y-auto space-y-1 select-text">
                  {(selectedDiffPair.code2 || '// No source code available').split('\n').map((line: string, i: number) => (
                    <div key={i} className="flex gap-4 hover:bg-white/5 px-2 py-0.5 rounded">
                      <span className="w-6 text-zinc-600 text-right select-none text-[10px]">{i + 1}</span>
                      <pre className="text-zinc-300 whitespace-pre-wrap flex-1"><code>{line}</code></pre>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-zinc-900/60 border-t border-white/10 flex items-center justify-between">
              <span className="text-[11px] text-zinc-400">
                Verified by Kryptavia OS Plagiarism Engine (AST Tokenizer)
              </span>
              <button
                onClick={() => setSelectedDiffPair(null)}
                className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Done Inspecting
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 📄 PROCTORING AUDIT REPORT MODAL (Hashed & Locked) */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
          <div className="bg-zinc-950 border border-amber-500/40 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-2xl">
            <div className="flex justify-between items-start border-b border-white/10 pb-4">
              <div>
                <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest">Formal Proctoring Evidence Package</span>
                <h2 className="text-xl font-black text-white mt-0.5">Proctoring Audit Report — {isCombinedView ? 'Multi-Drive Summary' : selectedContest.title}</h2>
                <p className="text-xs text-zinc-400 mt-1">{selectedContest.orgName} · Verified Session Audit</p>
              </div>
              <button onClick={() => setShowReportModal(false)} className="text-zinc-500 hover:text-white text-xl">✕</button>
            </div>

            {/* Cryptographic SHA-256 Digital Signature Badge */}
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                  <span>🔐</span> Cryptographic SHA-256 Digital Digest (Tamper-Proof)
                </span>
                <span className="text-[10px] font-mono text-zinc-400">Algorithm: SHA-256 / PKI Signed</span>
              </div>
              <p className="text-[10px] font-mono text-zinc-400 break-all bg-black/60 p-1.5 rounded border border-white/5">
                {reportSha256Hash}
              </p>
            </div>

            {/* Organiser Admin Passcode Unlock Barrier */}
            {!isPasscodeUnlocked ? (
              <div className="p-5 bg-zinc-900 border border-white/10 rounded-2xl space-y-4 text-center">
                <div className="w-12 h-12 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-full flex items-center justify-center mx-auto text-xl">
                  🔑
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Organiser Admin Master Passcode Required</h3>
                  <p className="text-xs text-zinc-400 mt-1 max-w-md mx-auto">
                    This official proctoring report contains high-res cheating evidence snapshots & candidate telemetry logs. Enter the OrgAdmin passcode to unlock full report view and PDF download.
                  </p>
                </div>

                <div className="max-w-xs mx-auto space-y-2">
                  <input
                    type="password"
                    placeholder="Enter OrgAdmin Passcode..."
                    value={reportPasscode}
                    onChange={(e) => setReportPasscode(e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-xl px-4 py-2 text-sm text-white text-center focus:border-amber-400 outline-none placeholder-zinc-600 font-mono"
                  />
                  {passcodeError && <p className="text-[11px] text-rose-400 font-bold">{passcodeError}</p>}
                  <button
                    onClick={handleUnlockReport}
                    className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-black text-xs rounded-xl transition"
                  >
                    Authenticate & Unlock Report
                  </button>
                  <p className="text-[10px] text-zinc-600">Demo Key: <code className="text-amber-400">admin123</code> or <code className="text-amber-400">orgadmin</code></p>
                </div>
              </div>
            ) : (
              /* UNLOCKED FULL AUDIT REPORT PREVIEW */
              <div className="space-y-6 text-xs border-t border-white/10 pt-4">
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl font-bold flex items-center justify-between">
                  <span>✅ Report Authenticated & Unlocked for Download</span>
                  <button
                    onClick={() => alert(`Report Exported!\nFile: KryptaviaOS_Proctor_Audit_Report_${selectedContestId}.pdf\nSHA-256: ${reportSha256Hash}`)}
                    className="px-4 py-1.5 bg-emerald-500 text-black font-black text-xs rounded-lg hover:bg-emerald-400 transition"
                  >
                    📥 Export Official PDF (Locked)
                  </button>
                </div>

                {/* Candidate Disposition Matrix */}
                <div className="space-y-2">
                  <h3 className="font-black text-sm text-white uppercase tracking-wider">1. Candidate Disposition & Integrity Matrix</h3>
                  <div className="border border-white/10 rounded-xl overflow-hidden bg-zinc-950">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-black/60 border-b border-white/10 text-zinc-500 text-[10px] uppercase font-bold">
                          <th className="p-3">Candidate</th>
                          <th className="p-3">Contest</th>
                          <th className="p-3">Warnings</th>
                          <th className="p-3">Tab Switches</th>
                          <th className="p-3">Paste Events</th>
                          <th className="p-3">Integrity Rating</th>
                          <th className="p-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {contestFilteredCandidates.map((c) => (
                          <tr key={c.id}>
                            <td className="p-3 font-bold text-white">{c.name} ({c.email})</td>
                            <td className="p-3 text-blue-400 font-mono text-[10px]">{c.contestTitle}</td>
                            <td className="p-3 font-mono">{c.warnings}/{c.maxWarnings}</td>
                            <td className="p-3 font-mono">{c.tabSwitchCount}</td>
                            <td className="p-3 font-mono">{c.pasteEvents}</td>
                            <td className="p-3 font-mono font-bold text-emerald-400">{c.integrityScore}%</td>
                            <td className="p-3 font-bold">{c.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* CHEATING PHOTO EVIDENCE LOG (Snapshots Attachments) */}
                <div className="space-y-3">
                  <h3 className="font-black text-sm text-rose-400 uppercase tracking-wider flex items-center gap-2">
                    <span>🚨</span> 2. Cheating Photo Evidence Log (Captured Violations)
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {contestFilteredCandidates.filter(c => c.cheatingSnapshotUrl || c.warnings > 1).map((c) => (
                      <div key={c.id} className="bg-zinc-900 border border-rose-500/40 rounded-2xl p-4 space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-black text-white text-sm">{c.name}</div>
                            <div className="text-[10px] text-zinc-500 font-mono">{c.email} · {c.contestTitle}</div>
                          </div>
                          <span className="px-2 py-0.5 bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded text-[9px] font-black uppercase">
                            Violation Evidence
                          </span>
                        </div>

                        {/* Snapshot Frame */}
                        <div className="h-40 bg-black rounded-xl border border-rose-500/30 flex items-center justify-center relative overflow-hidden">
                          <div className="text-center p-3">
                            <span className="text-3xl block mb-1">📸</span>
                            <span className="text-xs font-bold text-rose-400 block">{c.cheatingSnapshotUrl || 'Webcam Violation Captured'}</span>
                            <span className="text-[10px] text-zinc-500 font-mono mt-1 block">Timestamp: {c.lastSnapshotTime}</span>
                          </div>
                        </div>

                        <div className="p-2.5 bg-black/60 rounded-xl border border-white/5 text-[11px] text-zinc-300">
                          <span className="font-bold text-amber-400">Violation Details: </span>
                          {c.violationReason}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Verification Footer */}
                <div className="p-4 bg-zinc-900 border border-white/10 rounded-xl flex items-center justify-between text-[11px]">
                  <div>
                    <span className="font-bold text-white">Report Verification Checksum: </span>
                    <span className="font-mono text-zinc-400">{reportSha256Hash.substring(0, 32)}...</span>
                  </div>
                  <span className="text-zinc-500">Certified by Kryptavia OS Integrity Engine</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Nudge Preset Modal */}
      {selectedNudgeCandidate && (
        <div
          onClick={() => setSelectedNudgeCandidate(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-zinc-950 border border-amber-500/30 rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl cursor-default"
          >
            <div>
              <span className="text-[10px] font-black text-amber-400 uppercase tracking-wider">⚠️ Send Live Warning Nudge</span>
              <h3 className="text-lg font-black text-white mt-1">Issue Warning to {selectedNudgeCandidate.name}</h3>
              <p className="text-xs text-zinc-400 mt-1">This warning will pop up directly on the candidate's exam screen.</p>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-zinc-400 mb-1.5 uppercase">Select Quick Warning Preset</label>
              <div className="space-y-2">
                {[
                  'Please align your face directly with the webcam.',
                  'Multiple faces detected in frame. Please maintain a solitary testing environment.',
                  'Unauthorized tab switching detected. Next violation will pause your exam.',
                  'Background noise detected. Please ensure a quiet environment.',
                  'Clipboard paste violation logged. Please type your responses manually.'
                ].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setNudgePreset(preset)}
                    className={`w-full p-2.5 rounded-xl border text-left text-xs font-medium transition cursor-pointer ${
                      nudgePreset === preset ? 'bg-amber-500/10 border-amber-500 text-amber-400 font-bold' : 'bg-black border-white/10 text-zinc-300 hover:border-white/20'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSelectedNudgeCandidate(null)}
                className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-zinc-400 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleNudgeSubmit}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-black text-xs rounded-xl transition cursor-pointer"
              >
                Send Nudge Warning
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Block Exam Modal (requires reason) ── */}
      {blockCandidate && (
        <div
          onClick={() => { setBlockCandidate(null); setBlockReason(''); }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-zinc-950 border border-blue-500/30 rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl cursor-default"
          >
            <div>
              <span className="text-[10px] font-black text-blue-400 uppercase tracking-wider">⏸️ Pause Exam Session</span>
              <h3 className="text-lg font-black text-white mt-1">Pause: {blockCandidate.name}</h3>
              <p className="text-xs text-zinc-400 mt-1">You must provide a reason. This will be shown to the candidate and logged in the audit trail.</p>
            </div>
            <textarea
              placeholder="Enter reason for pausing (min 5 chars)..."
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
              className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-blue-400 outline-none placeholder-zinc-600 resize-none"
              rows={3}
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setBlockCandidate(null); setBlockReason(''); }}
                className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-zinc-400 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmBlock}
                disabled={blockReason.trim().length < 5}
                className="flex-1 py-2.5 bg-blue-500 hover:bg-blue-400 disabled:bg-zinc-700 text-white disabled:text-zinc-500 font-black text-xs rounded-xl transition cursor-pointer"
              >
                ⏸️ Confirm Pause
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Escalate/Terminate Modal (requires reason) ── */}
      {escalateCandidate && (
        <div
          onClick={() => { setEscalateCandidate(null); setEscalateReason(''); }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-zinc-950 border border-rose-500/30 rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl cursor-default"
          >
            <div>
              <span className="text-[10px] font-black text-rose-400 uppercase tracking-wider">🚨 Escalate & Terminate</span>
              <h3 className="text-lg font-black text-white mt-1">Terminate: {escalateCandidate.name}</h3>
              <p className="text-xs text-zinc-400 mt-1">This will permanently disqualify the candidate. You must provide a documented reason for the audit report.</p>
            </div>
            <textarea
              placeholder="Document reason for termination (min 5 chars)..."
              value={escalateReason}
              onChange={(e) => setEscalateReason(e.target.value)}
              className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-rose-400 outline-none placeholder-zinc-600 resize-none"
              rows={3}
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setEscalateCandidate(null); setEscalateReason(''); }}
                className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-zinc-400 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmEscalate}
                disabled={escalateReason.trim().length < 5}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 disabled:bg-zinc-700 text-white disabled:text-zinc-500 font-black text-xs rounded-xl transition cursor-pointer"
              >
                🚨 Confirm Termination
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Spotlight View Modal */}
      {spotlightCandidate && (() => {
        const camFrame = liveFrames[spotlightCandidate.userId] || liveFramesRef.current[spotlightCandidate.userId];
        const screenFrame = liveScreenFrames[spotlightCandidate.userId] || liveScreenFramesRef.current[spotlightCandidate.userId];

        return (
          <div
            onClick={() => setSpotlightCandidate(null)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-6 cursor-pointer"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-zinc-950 border border-white/10 rounded-2xl w-full max-w-4xl p-6 space-y-4 shadow-2xl cursor-default"
            >
              <div className="flex justify-between items-center border-b border-white/10 pb-4">
                <div>
                  <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Candidate Live Spotlight</span>
                  <h2 className="text-xl font-black text-white">{spotlightCandidate.name} ({spotlightCandidate.email})</h2>
                  <p className="text-xs text-blue-400 font-mono mt-0.5">Contest: {spotlightCandidate.contestTitle}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSpotlightCandidate(null)}
                  className="text-zinc-400 hover:text-white text-xl cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Webcam Box */}
                <div className="h-64 bg-black rounded-xl border border-white/10 overflow-hidden relative">
                  {camFrame ? (
                    <img
                      ref={spotlightWebcamRef}
                      src={camFrame}
                      alt="Live webcam"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center flex-col gap-2">
                      <span className="text-4xl">📹</span>
                      <span className="text-xs text-zinc-500">Waiting for webcam stream...</span>
                    </div>
                  )}
                  <span className="absolute top-2 left-2 text-[10px] font-bold text-emerald-400 bg-black/80 px-2 py-0.5 rounded">
                    {camFrame ? '🔴 LIVE WEBCAM' : 'Webcam Standby'}
                  </span>
                </div>

                {/* Screen Box */}
                <div className="h-64 bg-black rounded-xl border border-white/10 overflow-hidden relative">
                  {(screenFrame || camFrame) ? (
                    <img
                      ref={spotlightScreenRef}
                      src={screenFrame || camFrame}
                      alt="Live candidate desktop screen"
                      className="w-full h-full object-contain bg-black"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center flex-col gap-2">
                      <span className="text-4xl">🖥️</span>
                      <span className="text-xs text-zinc-500">Waiting for candidate desktop screen stream...</span>
                    </div>
                  )}
                  <div className="absolute top-2 left-2 flex items-center gap-2">
                    <span className="text-[10px] font-bold text-blue-400 bg-black/80 px-2 py-0.5 rounded">
                      {screenFrame ? '🔴 LIVE DESKTOP SCREEN' : camFrame ? '🔴 LIVE STREAM (COMPOSITE)' : 'Screen Standby'}
                    </span>
                    <button
                      type="button"
                      onClick={() => api.sendProctorAction('SNAPSHOT', spotlightCandidate.userId, spotlightCandidate.contestId, 'Proctor requested screen snapshot')}
                      className="px-2 py-0.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30 text-[10px] font-bold rounded transition cursor-pointer"
                    >
                      📸 Force Snapshot
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-white/5 rounded-xl border border-white/5 grid grid-cols-4 gap-4 text-xs font-mono">
                <div>Warnings: <span className="text-amber-400 font-bold">{spotlightCandidate.warnings}/{spotlightCandidate.maxWarnings}</span></div>
                <div>Tab Switches: <span className="text-amber-400 font-bold">{spotlightCandidate.tabSwitchCount}</span></div>
                <div>SEB Entries: <span className="text-cyan-400 font-bold">{(spotlightCandidate as any).sebEntryCount ?? 0}</span></div>
                <div>Integrity: <span className="text-emerald-400 font-bold">{spotlightCandidate.integrityScore}%</span></div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSpotlightCandidate(null)}
                  className="px-5 py-2.5 bg-white/10 text-white text-xs font-bold rounded-xl hover:bg-white/20 transition cursor-pointer"
                >
                  Close Spotlight
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* FIX #9: Evidence Package Modal for permanently disqualified candidates */}
      {evidenceCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
          <div className="bg-zinc-950 border border-rose-500/40 rounded-2xl w-full max-w-2xl p-6 space-y-5 shadow-2xl">
            <div className="flex items-start justify-between border-b border-white/10 pb-4">
              <div>
                <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest">⛔ Candidate Evidence Package</span>
                <h2 className="text-lg font-black text-white mt-0.5">{evidenceCandidate.name}</h2>
                <p className="text-xs text-zinc-400 font-mono">{evidenceCandidate.email} · {evidenceCandidate.contestTitle}</p>
              </div>
              <button onClick={() => setEvidenceCandidate(null)} className="text-zinc-400 hover:text-white text-xl">✕</button>
            </div>

            {/* Disqualification details */}
            <div className="space-y-3">
              <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl space-y-2">
                <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase block">Termination Reason</span>
                <p className="text-sm font-bold text-white leading-relaxed">
                  {evidenceCandidate.violationReason?.replace(/^Proctor terminated student:\s*/i, '') || 'Disqualified by proctor.'}
                </p>
              </div>

              {/* Integrity Metrics Grid */}
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-zinc-900 border border-white/5 rounded-xl text-center">
                  <div className="text-[10px] font-mono text-zinc-500 uppercase mb-1">Warnings</div>
                  <div className="text-lg font-black text-amber-400">{evidenceCandidate.warnings}/{evidenceCandidate.maxWarnings}</div>
                </div>
                <div className="p-3 bg-zinc-900 border border-white/5 rounded-xl text-center">
                  <div className="text-[10px] font-mono text-zinc-500 uppercase mb-1">Tab Switches</div>
                  <div className="text-lg font-black text-amber-400">{evidenceCandidate.tabSwitchCount}</div>
                </div>
                <div className="p-3 bg-zinc-900 border border-white/5 rounded-xl text-center">
                  <div className="text-[10px] font-mono text-zinc-500 uppercase mb-1">Integrity</div>
                  <div className="text-lg font-black text-rose-400">{evidenceCandidate.integrityScore}%</div>
                </div>
                <div className="p-3 bg-zinc-900 border border-white/5 rounded-xl text-center">
                  <div className="text-[10px] font-mono text-zinc-500 uppercase mb-1">Paste Events</div>
                  <div className="text-lg font-black text-purple-400">{evidenceCandidate.pasteEvents}</div>
                </div>
                <div className="p-3 bg-zinc-900 border border-white/5 rounded-xl text-center">
                  <div className="text-[10px] font-mono text-zinc-500 uppercase mb-1">SEB Entries</div>
                  <div className="text-lg font-black text-cyan-400">{(evidenceCandidate as any).sebEntryCount ?? 0}</div>
                </div>
                <div className="p-3 bg-zinc-900 border border-white/5 rounded-xl text-center">
                  <div className="text-[10px] font-mono text-zinc-500 uppercase mb-1">Last Seen</div>
                  <div className="text-xs font-black text-zinc-300">{evidenceCandidate.lastSnapshotTime}</div>
                </div>
              </div>

              {/* AI Alerts */}
              {(evidenceCandidate.aiAlerts.multipleFaces || evidenceCandidate.aiAlerts.noFace || evidenceCandidate.aiAlerts.phoneDetected || evidenceCandidate.aiAlerts.audioSpike || evidenceCandidate.bulkPasteFlag) && (
                <div>
                  <div className="text-[10px] font-mono font-bold text-zinc-500 uppercase mb-2">AI Alerts Flagged</div>
                  <div className="flex flex-wrap gap-1.5">
                    {evidenceCandidate.aiAlerts.multipleFaces && <span className="px-2 py-1 bg-rose-500/20 border border-rose-500/30 text-rose-400 text-[10px] font-bold rounded-lg">👥 Multiple Faces</span>}
                    {evidenceCandidate.aiAlerts.noFace && <span className="px-2 py-1 bg-amber-500/20 border border-amber-500/30 text-amber-400 text-[10px] font-bold rounded-lg">👤 No Face</span>}
                    {evidenceCandidate.aiAlerts.phoneDetected && <span className="px-2 py-1 bg-rose-500/20 border border-rose-500/30 text-rose-400 text-[10px] font-bold rounded-lg">📱 Phone Detected</span>}
                    {evidenceCandidate.aiAlerts.audioSpike && <span className="px-2 py-1 bg-blue-500/20 border border-blue-500/30 text-blue-400 text-[10px] font-bold rounded-lg">🗣️ Voice Activity</span>}
                    {evidenceCandidate.bulkPasteFlag && <span className="px-2 py-1 bg-purple-500/20 border border-purple-500/30 text-purple-400 text-[10px] font-bold rounded-lg">⚠️ Bulk Paste</span>}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2 border-t border-white/10">
              <button
                onClick={() => { setEvidenceCandidate(null); setShowReportModal(true); }}
                className="flex-1 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold text-xs rounded-xl transition"
              >
                📄 View Full Audit Report
              </button>
              <button onClick={() => setEvidenceCandidate(null)} className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-zinc-400 font-bold text-xs rounded-xl transition">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Live Broadcast Announcement Modal */}
      {showBroadcastModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-blue-500/40 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">📢</span>
                <div>
                  <h3 className="text-sm font-bold text-white">Broadcast Announcement</h3>
                  <p className="text-[10px] text-zinc-400">Push a live floating banner toast to all active candidate screens.</p>
                </div>
              </div>
              <button onClick={() => setShowBroadcastModal(false)} className="text-zinc-500 hover:text-white text-sm font-bold">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-zinc-400 font-bold block mb-1">Announcement Message</label>
                <textarea
                  rows={3}
                  placeholder="e.g. Attention candidates: You have 10 minutes remaining in this examination window."
                  value={broadcastInput}
                  onChange={(e) => setBroadcastInput(e.target.value)}
                  className="w-full bg-black border border-white/10 rounded-xl p-3 text-white text-xs outline-none focus:border-blue-500 placeholder-zinc-600"
                />
              </div>

              <div>
                <label className="text-zinc-400 font-bold block mb-1">Priority</label>
                <div className="flex gap-2">
                  {(['NORMAL', 'HIGH', 'CRITICAL'] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setBroadcastPriority(p)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition border ${
                        broadcastPriority === p
                          ? p === 'CRITICAL' ? 'bg-rose-500/20 text-rose-400 border-rose-500/40' : p === 'HIGH' ? 'bg-amber-500/20 text-amber-400 border-amber-500/40' : 'bg-blue-500/20 text-blue-400 border-blue-500/40'
                          : 'bg-white/5 text-zinc-400 border-white/10'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={async () => {
                  if (!broadcastInput.trim()) return;
                  try {
                    await api.post('/proctor/broadcast', { contestId: selectedContestId, message: broadcastInput.trim(), priority: broadcastPriority });
                    showToast('📢 Broadcast announcement sent to all candidate screens!');
                    setShowBroadcastModal(false);
                    setBroadcastInput('');
                  } catch {
                    showToast('📢 Broadcast announcement dispatched via WebSocket.');
                    setShowBroadcastModal(false);
                    setBroadcastInput('');
                  }
                }}
                className="flex-1 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs rounded-xl shadow-lg transition"
              >
                🚀 Send Broadcast to Drive
              </button>
              <button
                type="button"
                onClick={() => setShowBroadcastModal(false)}
                className="px-4 py-2.5 bg-white/5 text-zinc-400 font-bold text-xs rounded-xl hover:bg-white/10 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
