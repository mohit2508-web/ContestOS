import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../../services/api';
import { useNavigate } from 'react-router-dom';
import { useNotify } from '../../components/notifications';
import { ContestAssemblyBuilder } from '../../components/teacher/ContestAssemblyBuilder';
import { EmptyState } from '../../components/common/EmptyState';
import { SOCRATIC_FALLBACK_PROBLEMS } from '../../data/socraticFallbackProblems';

interface Contest {
  id: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  duration: number;
  difficulty: string;
  isPublic: boolean;
  requireFullscreen: boolean;
  preventTabSwitch: boolean;
  disableCopyPaste: boolean;
  enableProctoring: boolean;
  requireSeb: boolean;
  allowMultipleMonitors: boolean;
  pasteMode: 'ALLOWED' | 'LOG_ONLY' | 'BLOCKED';
  faceCheckEnabled: boolean;
  voiceCheckEnabled: boolean;
  randomizeQuestionOrder: boolean;
  snapshotIntervalSeconds: number;
  maxWarnings: number;
  _count: { participants: number; problems: number };
}

interface Participant {
  user: { id: string; fullName: string; email: string };
  score: number;
  solvedCount: number;
  warnings?: number;
  isTerminated?: boolean;
}

export function ContestManagementPage() {
  const navigate = useNavigate();
  const notify = useNotify();
  const [contests, setContests] = useState<Contest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Modals state
  const [showCreate, setShowCreate] = useState(false);
  const [selectedContest, setSelectedContest] = useState<Contest | null>(null);
  
  // Create form state
  const [formData, setFormData] = useState({
    title: '', 
    description: '', 
    accessCode: '',
    startTime: '', 
    endTime: '', 
    duration: 120, 
    difficulty: 'Medium',
    isPublic: false, 
    requireFullscreen: true, 
    preventTabSwitch: true, 
    disableCopyPaste: true, 
    enableProctoring: false,
    requireSeb: false,
    allowMultipleMonitors: false,
    pasteMode: 'LOG_ONLY' as 'ALLOWED' | 'LOG_ONLY' | 'BLOCKED',
    faceCheckEnabled: false,
    voiceCheckEnabled: false,
    randomizeQuestionOrder: true,
    snapshotIntervalSeconds: 45,
    maxWarnings: 3,
    problemIds: [] as string[],
    // Scoring fields
    scoringMode: 'PARTIAL' as 'PARTIAL' | 'BINARY' | 'ACM' | 'DYNAMIC',
    negativeMarkingEnabled: false,
    negativeMarkingValue: 0.25,
    showLeaderboardDuringContest: true,
    freezeLeaderboardMins: 0,
  });
  // Per-problem custom marks map: { [problemId]: number }
  const [problemScores, setProblemScores] = useState<Record<string, number>>({});

  // Phase 2: Multi-Section Contest state
  const [enableSections, setEnableSections] = useState(false);
  const [sections, setSections] = useState<Array<{
    id: string;
    title: string;
    sectionType: 'QUIZ' | 'CODING' | 'WEB_DEV';
    duration: number;
    negativeMarkingEnabled: boolean;
    negativeMarkingValue: number;
    problemIds: string[];
    instructions?: string;
  }>>([
    {
      id: 'sec-1',
      title: 'Section A: Technical Aptitude & Logic',
      sectionType: 'QUIZ',
      duration: 30,
      negativeMarkingEnabled: true,
      negativeMarkingValue: 0.25,
      problemIds: [],
      instructions: 'Answer logic & quantitative questions.'
    },
    {
      id: 'sec-2',
      title: 'Section B: Hands-on Coding & DSA',
      sectionType: 'CODING',
      duration: 60,
      negativeMarkingEnabled: false,
      negativeMarkingValue: 0,
      problemIds: [],
      instructions: 'Solve algorithm & data structure problems.'
    }
  ]);

  const [creating, setCreating] = useState(false);

  // Monitor state
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [monitorLoading, setMonitorLoading] = useState(false);
  const [monitorTab, setMonitorTab] = useState<'participants' | 'snapshots' | 'lobby' | 'seb' | 'questions'>('participants');
  const [showSamplePreview, setShowSamplePreview] = useState(false);

  // --- Pre-Contest Lobby Telemetry States ---
  const [lobbyUsers, setLobbyUsers] = useState<Record<string, {
    userId: string;
    userName: string;
    status: string;
    checkpoint: number;
    diagnostics?: any;
    updatedAt: number;
  }>>({});
  
  const teacherWsRef = useRef<WebSocket | null>(null);

  // Connect to WebSocket room when selectedContest is opened for monitoring
  useEffect(() => {
    if (!selectedContest) {
      if (teacherWsRef.current) {
        teacherWsRef.current.close();
        teacherWsRef.current = null;
      }
      setLobbyUsers({});
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) return;

    const wsUrl = `ws://localhost:5000/ws/interview?token=${token}&sessionId=contest_lobby_${selectedContest.id}`;
    const ws = new WebSocket(wsUrl);
    teacherWsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'lobby_status') {
          // If a user broadcasted their check-in details, update telemetry mapping
          setLobbyUsers(prev => ({
            ...prev,
            [msg.userId]: {
              userId: msg.userId,
              userName: msg.userName,
              status: msg.status,
              checkpoint: msg.checkpoint,
              diagnostics: msg.diagnostics,
              updatedAt: Date.now()
            }
          }));
        }
      } catch (err) {
        console.warn('[Lobby Monitor WS parse failed]:', err);
      }
    };

    return () => {
      if (teacherWsRef.current) {
        teacherWsRef.current.close();
        teacherWsRef.current = null;
      }
    };
  }, [selectedContest]);

  const [contestLogs, setContestLogs] = useState<any[]>([]);
  const [contestLogsLoading, setContestLogsLoading] = useState(false);

  const loadContestLogs = useCallback(async (contestId: string) => {
    setContestLogsLoading(true);
    try {
      const res = await api.getContestLogs(contestId);
      setContestLogs(res.logs || []);
    } catch (err) {
      console.error('Failed to load contest logs:', err);
    } finally {
      setContestLogsLoading(false);
    }
  }, []);

  // Telemetry polling: refresh participants list and logs every 15s
  useEffect(() => {
    if (!selectedContest) return;

    const interval = setInterval(async () => {
      try {
        const lbData = await api.getContestLeaderboard(selectedContest.id);
        setParticipants(lbData.leaderboard || []);
        await loadContestLogs(selectedContest.id);
      } catch (err) {
        console.warn('Telemetry polling failed:', err);
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [selectedContest, loadContestLogs]);

  const grantGateWaiver = (studentId: string) => {
    if (teacherWsRef.current && teacherWsRef.current.readyState === WebSocket.OPEN) {
      teacherWsRef.current.send(JSON.stringify({
        type: 'lobby_status',
        bypassTargetId: studentId
      }));
      notify.toast.success('Security waiver broadcasted. Candidate will proceed shortly!');
    } else {
      notify.toast.error('WebSocket server disconnected. Cannot issue waiver.');
    }
  };

  const renderLobbyTelemetry = () => {
    const list = Object.values(lobbyUsers);
    if (list.length === 0) {
      return (
        <EmptyState
          variant="proctor"
          title="No candidates at boarding gate"
          body="Status changes and device diagnostics will stream here in real time as soon as candidates enter the assessment lobby."
        />
      );
    }

    return (
      <div className="space-y-4">
        <h3 className="font-bold text-sm text-gray-400 mb-2 uppercase tracking-wider">Boarding Gate Telemetry ({list.length} Candidate(s))</h3>
        <div className="grid grid-cols-1 gap-3">
          {list.map(u => {
            const hasVCam = u.diagnostics?.virtualCameraDetected;
            const screenCount = u.diagnostics?.monitors || 1;
            const isReady = u.status === 'Ready' || u.checkpoint === 4;
            const agentPaired = u.diagnostics?.agentPaired;
            const blockedApps = u.diagnostics?.blockedAppsFound || [];
            const rdpActive = u.diagnostics?.remoteSessionDetected;
            const failedCheck = blockedApps.length > 0 || rdpActive || screenCount > 1 || hasVCam;

            return (
              <div key={u.userId} className={`p-4 border rounded-xl bg-white/5 flex flex-col sm:flex-row sm:items-center sm:justify-between transition ${
                isReady 
                  ? 'border-[var(--accent-green)]/30' 
                  : failedCheck
                    ? 'border-red-500/40 bg-red-500/5' 
                    : 'border-white/10'
              }`}>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-white text-sm uppercase">{u.userName}</span>
                    <span className={`text-[10px] px-2 py-0.5 font-bold rounded ${
                      isReady 
                        ? 'bg-green-500/20 text-green-400' 
                        : failedCheck 
                          ? 'bg-red-500/20 text-red-400'
                          : 'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {isReady ? 'Boarding Pass Issued' : failedCheck ? 'Diagnostics Failure' : `Checkpoint ${u.checkpoint}/3`}
                    </span>
                    <span className={`text-[9px] px-1.5 py-0.5 font-semibold rounded ${
                      agentPaired
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                    }`}>
                      {agentPaired ? 'Verified Integrity' : 'Standard Integrity'}
                    </span>
                    {u.diagnostics?.integrityEvent?.eventType === 'keyboard_lock_unavailable' ? (
                      <span className="text-[9px] px-1.5 py-0.5 font-semibold rounded bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
                        Standard Detection Mode
                      </span>
                    ) : (
                      <span className="text-[9px] px-1.5 py-0.5 font-semibold rounded bg-green-500/10 text-green-400 border border-green-500/20">
                        🛡️ Enhanced Lockdown Active
                      </span>
                    )}
                  </div>

                  {/* Device Specs and Diagnostics details */}
                  {u.diagnostics ? (
                    <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 font-mono text-[10px] text-gray-400">
                      <div>Ping RTT: <span className="font-bold text-white">{u.diagnostics.ping || 'N/A'} ms</span></div>
                      <div>Download: <span className="font-bold text-white">{u.diagnostics.download || 'N/A'} Mbps</span></div>
                      <div className={screenCount > 1 ? 'text-red-400 font-bold' : ''}>Displays: <span className="font-bold text-white">{screenCount}</span></div>
                      <div className={hasVCam ? 'text-red-400 font-bold' : ''}>V-Camera: <span className="font-bold text-white">{hasVCam ? 'DETECTED' : 'No'}</span></div>
                    </div>
                  ) : (
                    <div className="text-[10px] text-gray-500 italic mt-1">Awaiting diagnostics metrics...</div>
                  )}

                  {/* Blocklist Apps and RDP Alerts */}
                  {u.diagnostics && (blockedApps.length > 0 || rdpActive) && (
                    <div className="mt-2 text-[10px] font-mono text-red-400 font-bold flex gap-3">
                      {rdpActive && <span>⚠️ ACTIVE REMOTE SESSION DETECTED (RDP)</span>}
                      {blockedApps.length > 0 && <span>⚠️ PROHIBITED APPS RUNNING: {blockedApps.join(', ')}</span>}
                    </div>
                  )}

                  {/* Real-Time Integrity Violation Events */}
                  {u.diagnostics?.integrityEvent && (
                    <div className="mt-2 text-[10px] font-mono text-amber-500 font-bold flex gap-2">
                      <span>⚠️ LIVE VIOLATION:</span>
                      <span>{u.diagnostics.integrityEvent.eventType} - {JSON.stringify(u.diagnostics.integrityEvent.detail)}</span>
                    </div>
                  )}
                </div>

                <div className="mt-3 sm:mt-0 flex gap-2">
                  <button 
                    disabled={isReady}
                    onClick={() => grantGateWaiver(u.userId)}
                    className="px-3.5 py-1.5 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white text-xs font-bold rounded-lg shadow-sm transition disabled:opacity-30"
                  >
                    Issue Gate Waiver
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderSebMonitor = () => {
    const isContestEnded = new Date(selectedContest!.endTime).getTime() < Date.now();

    // Export CSV function
    const exportSebReport = () => {
      const headers = ['Candidate Name', 'Email', 'Score', 'Solved Problems', 'Warnings', 'SEB Launch Count', 'Status'];
      const rows = participants.map(p => {
        const recordedLaunches = contestLogs.filter(
          (log) =>
            log.userId === p.user.id &&
            (log.eventType === 'SEB_SESSION_START' || log.eventType === 'CONTEST_ENTERED')
        ).length;
        const hasAttemptData =
          (p.score || 0) > 0 || (p.solvedCount || 0) > 0 || (p.warnings || 0) > 0 || !!p.isTerminated;
        const launchCount = Math.max(recordedLaunches, hasAttemptData ? 1 : 0);
        const status = p.isTerminated 
          ? 'DISQUALIFIED (MANUAL)' 
          : (p.warnings || 0) >= (selectedContest?.maxWarnings || 3)
            ? 'DISQUALIFIED (AUTO)'
            : launchCount === 0
              ? 'DID NOT LAUNCH'
              : 'COMPLETED';
        return [
          p.user.fullName,
          p.user.email,
          p.score,
          p.solvedCount,
          p.warnings || 0,
          launchCount,
          status
        ];
      });

      const csvContent = "data:text/csv;charset=utf-8," 
        + [headers.join(','), ...rows.map(e => e.map(val => `"${val}"`).join(","))].join("\n");
      
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `Contest_${selectedContest?.id}_Security_Report.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    const displayParticipants = participants;
    const displayLogs = contestLogs;

    return (
      <div className="space-y-6">
        {/* Post-Contest Finalization Summary Panel */}
        {isContestEnded && (
          <div className="p-5 bg-zinc-900 border border-amber-500/20 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl">📊</span>
                <h4 className="font-extrabold text-white text-base">Contest Session Concluded</h4>
                <span className="px-2 py-0.5 text-[9px] font-black bg-zinc-800 text-zinc-400 rounded uppercase tracking-wider">Historical Audit</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                The contest has concluded. All active participant answers have been final-submitted. Use the controls below to review violations and download reports.
              </p>
            </div>
            <button 
              onClick={exportSebReport}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-extrabold rounded-lg text-xs transition shadow-md shadow-amber-500/10 flex items-center gap-2 shrink-0 self-start md:self-auto"
            >
              <span>📥</span>
              Export Security Report (.CSV)
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-sm">
          {/* Left Column: Candidates SEB Table */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-sm text-gray-400 uppercase tracking-wider">
                Candidate SEB &amp; Integrity Log ({displayParticipants.length})
              </h3>
              <button 
                onClick={() => openMonitor(selectedContest!)}
                className="text-xs text-[var(--accent-blue)] hover:underline flex items-center gap-1"
              >
                <span>🔄</span> Refresh
              </button>
            </div>

            {displayParticipants.length === 0 ? (
              <div className="text-center py-10 bg-white/5 border border-white/10 rounded-xl space-y-2">
                <span className="text-2xl block">🔒</span>
                <p className="text-gray-300 font-bold text-sm">Awaiting Candidate Registration</p>
                <p className="text-gray-500 text-xs max-w-sm mx-auto">No candidates have registered for this exam yet. Telemetry will record live as soon as students enter the contest.</p>
              </div>
            ) : (
              <div className="border border-white/10 rounded-xl overflow-hidden bg-white/5">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono select-text border-collapse">
                    <thead>
                      <tr className="bg-black/40 border-b border-white/10 text-gray-400 uppercase text-[9px] tracking-wider font-bold">
                        <th className="p-3">Candidate</th>
                        <th className="p-3 text-center">SEB Launches</th>
                        <th className="p-3">Warnings</th>
                        <th className="p-3 text-center">Status</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {displayParticipants.map(p => {
                        const userSebLogs = displayLogs
                          .filter((log) => log.userId === p.user.id && (log.eventType === 'SEB_SESSION_START' || log.eventType === 'CONTEST_ENTERED'))
                          .sort((a, b) => new Date(a.createdAt || a.timestamp).getTime() - new Date(b.createdAt || b.timestamp).getTime());

                        let launchSessions = 0;
                        let lastLaunchTime = 0;
                        userSebLogs.forEach(l => {
                          const t = new Date(l.createdAt || l.timestamp).getTime();
                          if (t - lastLaunchTime > 2 * 60 * 1000) {
                            launchSessions++;
                            lastLaunchTime = t;
                          }
                        });

                        const hasAttemptData =
                          (p.score || 0) > 0 ||
                          (p.solvedCount || 0) > 0 ||
                          (p.warnings || 0) > 0 ||
                          !!p.isTerminated;
                        const launchCount = Math.max(launchSessions, hasAttemptData ? 1 : 0);

                        const isDisqualified = p.isTerminated || (p.warnings || 0) >= (selectedContest?.maxWarnings || 3);
                        const isSuspected = (p.warnings || 0) > 0 && !isDisqualified;

                        return (
                          <tr key={p.user.id} className={`hover:bg-white/5 transition-colors ${
                            isDisqualified 
                              ? 'bg-red-500/5' 
                              : isSuspected 
                                ? 'bg-amber-500/5' 
                                : ''
                          }`}>
                            <td className="p-3">
                              <div className="font-bold text-white text-xs">{p.user.fullName}</div>
                              <div className="text-[10px] text-gray-500">{p.user.email}</div>
                            </td>
                            <td className="p-3 font-bold text-center">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                launchCount > 1 
                                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' 
                                  : launchCount === 1
                                    ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                                    : 'bg-zinc-800 text-zinc-500'
                              }`}>
                                {launchCount} time(s)
                              </span>
                            </td>
                            <td className="p-3 font-bold">
                              <span className={`${p.warnings && p.warnings > 0 ? 'text-amber-400' : 'text-zinc-500'}`}>
                                {p.warnings || 0} / {selectedContest?.maxWarnings || 3}
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              {isDisqualified ? (
                                <span className="px-2 py-0.5 bg-red-500/25 text-red-400 border border-red-500/40 rounded text-[9px] font-extrabold uppercase tracking-wider">
                                  Disqualified
                                </span>
                              ) : isSuspected ? (
                                <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 border border-amber-500/35 rounded text-[9px] font-extrabold uppercase tracking-wider animate-pulse">
                                  Suspected
                                </span>
                              ) : launchCount > 0 ? (
                                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded text-[9px] font-extrabold uppercase tracking-wider">
                                  Secured
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 bg-zinc-800 text-zinc-500 rounded text-[9px] font-bold uppercase tracking-wider">
                                  Not in SEB
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-right">
                              <div className="flex justify-end gap-1.5 font-sans">
                                <button 
                                  onClick={() => viewStudentLogs(p.user.id, p.user.fullName)}
                                  className="px-2 py-1 bg-white/5 hover:bg-white/10 text-white rounded text-[10px] font-bold transition"
                                  title="View audit logs"
                                >
                                  Logs
                                </button>
                                {((p.warnings && p.warnings > 0) || p.isTerminated) && (
                                  <button 
                                    onClick={() => handleResetWarnings(p.user.id, p.user.fullName)}
                                    className="px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded text-[10px] font-bold transition border border-amber-500/20"
                                    title="Reset Warnings to 0"
                                  >
                                    Reset
                                  </button>
                                )}
                                {p.isTerminated ? (
                                  <button 
                                    onClick={() => unblockStudent(p.user.id)}
                                    className="px-2 py-1 bg-green-500/10 hover:bg-green-500/20 text-green-400 rounded text-[10px] font-bold transition border border-green-500/20"
                                    title="Revoke disqualification"
                                  >
                                    Revoke
                                  </button>
                                ) : (
                                  <button 
                                    onClick={() => blockStudent(p.user.id)}
                                    className="px-2 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded text-[10px] font-bold transition border border-red-500/20"
                                    title="Force disqualify candidate"
                                  >
                                    Disqualify
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Live Flagged Security Event Feed */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-sm text-gray-400 uppercase tracking-wider">Live Security Event Feed</h3>
              <span className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
            </div>

            <div className="border border-white/10 bg-black/30 rounded-xl p-4 h-[400px] overflow-y-auto custom-scrollbar flex flex-col gap-2">
              {contestLogsLoading && contestLogs.length === 0 ? (
                <div className="flex justify-center items-center h-full">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[var(--accent-green)]"></div>
                </div>
              ) : contestLogs.length === 0 ? (
                <p className="text-gray-500 text-xs italic text-center py-20 font-mono">No security logs recorded for this contest.</p>
              ) : (
                contestLogs
                  .filter((log: any, index: number, arr: any[]) => {
                    if (index === 0) return true;
                    const prev = arr[index - 1];
                    if (
                      log.userId === prev.userId &&
                      log.eventType === prev.eventType &&
                      (log.eventType === 'SEB_SESSION_START' || log.eventType === 'CONTEST_ENTERED')
                    ) {
                      const timeDiff = Math.abs(new Date(log.createdAt || log.timestamp).getTime() - new Date(prev.createdAt || prev.timestamp).getTime());
                      if (timeDiff < 60000) return false;
                    }
                    return true;
                  })
                  .map((log: any) => {
                  const isBreach = log.eventType.startsWith('SEB_') || log.eventType === 'warnings_exceeded' || log.eventType === 'TAB_SWITCH' || log.eventType === 'SCREENSHOT_ATTEMPT';
                  const isSuccess = log.eventType === 'SEB_SESSION_START' || log.eventType === 'warnings_reset' || log.eventType === 'contest_resumed';
                  
                  return (
                    <div 
                      key={log.id} 
                      className={`p-2.5 rounded-lg border text-[11px] font-mono leading-relaxed transition ${
                        isBreach 
                          ? 'border-red-500/20 bg-red-500/5 text-red-300' 
                          : isSuccess 
                            ? 'border-green-500/20 bg-green-500/5 text-green-300'
                            : 'border-white/5 bg-white/2 text-zinc-300'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-black uppercase tracking-wider">{log.eventType}</span>
                        <span className="text-[9px] text-zinc-500">{new Date(log.createdAt).toLocaleTimeString()}</span>
                      </div>
                      <p className="break-words font-sans text-zinc-400">
                        <span className="font-bold text-white font-mono mr-1.5">{log.user?.fullName || 'System'}:</span>
                        {log.description}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Mapped problems state
  const [mappedProblems, setMappedProblems] = useState<any[]>([]);
  const [mappedProblemsLoading, setMappedProblemsLoading] = useState(false);
  const [addingProblemId, setAddingProblemId] = useState('');
  const [selectedBankProblemId, setSelectedBankProblemId] = useState('');
  const [attachPoints, setAttachPoints] = useState(100);

  const loadMappedProblems = useCallback(async (contestId: string) => {
    setMappedProblemsLoading(true);
    try {
      const res = await api.getContestProblems(contestId);
      setMappedProblems(res.problems || []);
    } catch (err) {
      console.error('Failed to load mapped problems:', err);
    } finally {
      setMappedProblemsLoading(false);
    }
  }, []);

  const handleAttachProblemToCurrentContest = async () => {
    if (!selectedContest || !selectedBankProblemId) return;
    setAddingProblemId(selectedBankProblemId);
    try {
      await api.attachContestProblem(selectedContest.id, { problemId: selectedBankProblemId, points: attachPoints });
      notify.toast.success('Question attached to contest!');
      loadMappedProblems(selectedContest.id);
      loadContests();
      setSelectedBankProblemId('');
    } catch (err: any) {
      notify.toast.error(err?.response?.data?.error || 'Failed to attach problem');
    } finally {
      setAddingProblemId('');
    }
  };

  const handleRemoveMappedProblem = async (problemId: string) => {
    if (!selectedContest) return;
    if (!confirm('Are you sure you want to remove this question from the contest?')) return;
    try {
      await api.removeContestProblem(selectedContest.id, problemId);
      notify.toast.success('Question unmapped from contest!');
      loadMappedProblems(selectedContest.id);
      loadContests();
    } catch (err) {
      notify.toast.error('Failed to unmap question');
    }
  };

  const renderMappedQuestions = () => {
    const unmappedBankProblems = problemBank.filter(
      (bp) => !mappedProblems.some((mp) => mp.problemId === bp.id)
    );

    return (
      <div className="space-y-8">
        {/* Contest Assembly Engine for this Contest */}
        <ContestAssemblyBuilder />

        {/* Quick Attach Header Bar */}
        <div className="p-4 bg-white/5 border border-white/10 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-white text-sm">Mapped Contest Questions ({mappedProblems.length})</h3>
            <p className="text-xs text-gray-400 mt-0.5">Attach questions directly from your Question Bank or manage current question order &amp; points.</p>
          </div>

          <div className="flex items-center space-x-2 w-full md:w-auto">
            <select
              value={selectedBankProblemId}
              onChange={(e) => setSelectedBankProblemId(e.target.value)}
              className="bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-400 flex-1 md:w-64"
            >
              <option value="">Select question from bank...</option>
              {unmappedBankProblems.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} ({p.difficulty || 'Medium'} • {p.category || 'General'})
                </option>
              ))}
            </select>

            <div className="flex items-center gap-1 bg-black/60 border border-amber-500/30 rounded-xl px-2.5 py-1.5 shrink-0" title="Custom Marks / Points for this question in contest">
              <span className="text-[11px] text-amber-400 font-bold">Pts:</span>
              <input
                type="number"
                min="1"
                max="1000"
                value={attachPoints}
                onChange={(e) => setAttachPoints(Math.max(1, parseInt(e.target.value) || 100))}
                className="w-14 bg-transparent text-xs text-amber-300 font-extrabold focus:outline-none text-center"
              />
            </div>

            <button
              onClick={handleAttachProblemToCurrentContest}
              disabled={!selectedBankProblemId || Boolean(addingProblemId)}
              className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-extrabold text-xs rounded-xl shadow-md shadow-emerald-500/20 transition-all disabled:opacity-40 shrink-0"
            >
              {addingProblemId ? 'Adding...' : '+ Attach Question'}
            </button>

            <button
              type="button"
              onClick={() => window.location.href = '/problems/new'}
              className="px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs rounded-xl shadow-md shadow-purple-600/20 transition-all shrink-0 flex items-center gap-1"
            >
              <span>✨</span> + Create New Question
            </button>
          </div>
        </div>

        {/* Mapped Questions List Table */}
        {mappedProblemsLoading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-emerald-400"></div>
          </div>
        ) : mappedProblems.length === 0 ? (
          <EmptyState
            variant="questionBank"
            title="No questions mapped yet"
            body="Select questions from the dropdown above or author questions in your Question Bank to attach them to this contest drive."
            onAction={() => window.location.href = '/problems/new'}
            actionLabel="Author Question"
          />
        ) : (
          <div className="border border-white/10 rounded-2xl overflow-hidden bg-white/5">
            <table className="w-full text-left text-xs font-mono select-text border-collapse">
              <thead>
                <tr className="bg-black/40 border-b border-white/10 text-gray-400 uppercase text-[9px] tracking-wider font-bold">
                  <th className="p-3">Order</th>
                  <th className="p-3">Question Title</th>
                  <th className="p-3">Category</th>
                  <th className="p-3 text-center">Difficulty</th>
                  <th className="p-3 text-center">Points (Marks)</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {mappedProblems.map((cp: any, idx: number) => {
                  const prob = cp.problem || {};
                  return (
                    <tr key={cp.id || idx} className="hover:bg-white/5 transition-colors">
                      <td className="p-3 font-bold text-emerald-400">#{cp.order || idx + 1}</td>
                      <td className="p-3 font-bold text-white font-sans text-sm flex items-center gap-2">
                        <span>{prob.title || 'Untitled Problem'}</span>
                        <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded text-[9px] font-black uppercase font-mono">
                          {prob.problemType || 'code'}
                        </span>
                      </td>
                      <td className="p-3 text-gray-400">{prob.category || 'Algorithms'}</td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          prob.difficulty === 'Easy' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                          prob.difficulty === 'Medium' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                          'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        }`}>
                          {prob.difficulty || 'Medium'}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <input
                            type="number"
                            min="1"
                            max="1000"
                            defaultValue={cp.points || 100}
                            onBlur={async (e) => {
                              const newPoints = Math.max(1, parseInt(e.target.value) || 100);
                              if (newPoints !== cp.points) {
                                try {
                                  await api.reorderContestProblems(selectedContest!.id, [
                                    { problemId: cp.problemId, points: newPoints, order: cp.order }
                                  ]);
                                  notify.toast.success(`Updated points for "${prob.title}" to ${newPoints} pts!`);
                                  loadMappedProblems(selectedContest!.id);
                                } catch {
                                  notify.toast.error('Failed to update problem points');
                                }
                              }
                            }}
                            className="w-16 bg-black/60 border border-amber-500/30 text-amber-300 font-extrabold text-xs text-center py-1 rounded-lg focus:outline-none focus:border-amber-400 transition"
                          />
                          <span className="text-[10px] text-gray-400 font-bold">pts</span>
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => handleRemoveMappedProblem(cp.problemId)}
                          className="px-3 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg text-xs font-bold transition border border-rose-500/20"
                        >
                          Unmap
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  // Flagged snapshots state
  const [flaggedSnapshots, setFlaggedSnapshots] = useState<any[]>([]);
  const [snapshotsLoading, setSnapshotsLoading] = useState(false);

  // Invite state
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [inviting, setInviting] = useState(false);
  const [selectedUserLogs, setSelectedUserLogs] = useState<any[] | null>(null);
  const [logStudentName, setLogStudentName] = useState('');

  // Problem bank state
  const [problemBank, setProblemBank] = useState<any[]>([]);
  const [problemFilterType, setProblemFilterType] = useState('all');
  const [problemFilterCategory, setProblemFilterCategory] = useState('all');

  const loadContests = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getTeacherManagedContests();
      setContests(data.contests || []);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load contests');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadClasses = async () => {
    try {
      const data = await api.getAllClasses();
      setClasses(data.classes || []);
    } catch (err) {
      console.error('Failed to load classes', err);
    }
  };

  const loadProblems = async () => {
    try {
      const data = await api.getProblems();
      const fetched = data.problems || [];
      const combined = [...SOCRATIC_FALLBACK_PROBLEMS, ...fetched.filter((p: any) => !SOCRATIC_FALLBACK_PROBLEMS.some(fb => fb.id === p.id))];
      setProblemBank(combined);
    } catch (err) {
      setProblemBank(SOCRATIC_FALLBACK_PROBLEMS);
    }
  };

  useEffect(() => {
    loadContests();
    loadClasses();
    loadProblems();
  }, [loadContests]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await api.createManagerContest({
        ...formData,
        problemScores,
        sections: enableSections ? sections : [],
      });
      setShowCreate(false);
      loadContests();
      setProblemScores({});
      setEnableSections(false);
      setFormData({
        title: '', 
        description: '', 
        accessCode: '',
        startTime: '', 
        endTime: '', 
        duration: 120, 
        difficulty: 'Medium',
        isPublic: false, 
        requireFullscreen: true, 
        preventTabSwitch: true, 
        disableCopyPaste: true, 
        enableProctoring: false,
        requireSeb: false,
        allowMultipleMonitors: false,
        pasteMode: 'LOG_ONLY',
        faceCheckEnabled: false,
        voiceCheckEnabled: false,
        randomizeQuestionOrder: true,
        snapshotIntervalSeconds: 45,
        maxWarnings: 3,
        problemIds: [],
        scoringMode: 'PARTIAL',
        negativeMarkingEnabled: false,
        negativeMarkingValue: 0.25,
        showLeaderboardDuringContest: true,
        freezeLeaderboardMins: 0,
      });
    } catch (err: any) {
      notify.toast.error(err.response?.data?.error || 'Failed to create contest');
    } finally {
      setCreating(false);
    }
  };

  const loadFlaggedSnapshots = async (contestId: string) => {
    setSnapshotsLoading(true);
    try {
      const data = await api.getFlaggedSnapshots(contestId);
      setFlaggedSnapshots(data.snapshots || []);
    } catch (err) {
      console.error('Failed to load flagged snapshots', err);
    } finally {
      setSnapshotsLoading(false);
    }
  };

  const openMonitor = async (contest: Contest) => {
    setSelectedContest(contest);
    setMonitorTab('participants');
    setShowSamplePreview(false);
    setMonitorLoading(true);
    try {
      const [lbData] = await Promise.all([
        api.getContestLeaderboard(contest.id),
        loadContestLogs(contest.id),
        loadMappedProblems(contest.id),
      ]);
      setParticipants(lbData.leaderboard || []);
    } catch (err) {
      console.error(err);
    } finally {
      setMonitorLoading(false);
    }
  };

  const handleInviteClass = async () => {
    if (!selectedClassId || !selectedContest) return;
    setInviting(true);
    try {
      const classData = await api.getClassStudents(selectedClassId, { limit: 1000 });
      const students = classData.students || [];
      const userIds = students.map((s: any) => s.student.userId).filter(Boolean);
      
      if (userIds.length > 0) {
        await api.bulkAddContestParticipants(selectedContest.id, userIds);
        notify.toast.success(`Successfully invited ${userIds.length} students!`);
        openMonitor(selectedContest); // reload monitor
      } else {
        notify.toast.warning('No registered users found in this class.');
      }
    } catch (err: any) {
      notify.toast.error(err.response?.data?.error || 'Failed to invite class');
    } finally {
      setInviting(false);
    }
  };

  const blockStudent = async (userId: string) => {
    if (!selectedContest) return;
    try {
      await api.blockContestParticipant(selectedContest.id, userId, 'Manual proctor disqualification');
      notify.toast.success("Student blocked successfully.");
      openMonitor(selectedContest);
    } catch (err: any) {
      notify.toast.error("Failed to block student");
    }
  };

  const unblockStudent = async (userId: string) => {
    if (!selectedContest) return;
    try {
      await api.unblockContestParticipant(selectedContest.id, userId, 'Manual proctor unblock');
      notify.toast.success("Student unblocked successfully.");
      openMonitor(selectedContest);
    } catch (err: any) {
      notify.toast.error("Failed to unblock student");
    }
  };

  const handleResetWarnings = async (userId: string, fullName: string) => {
    if (!selectedContest) return;
    try {
      await api.client.post(`/contests/manager/${selectedContest.id}/proctor-action`, {
        action: 'reset_warnings',
        userId,
        reason: 'Manual waiver by instructor',
      });
      notify.toast.success(`Warnings reset successfully for ${fullName}.`);
      openMonitor(selectedContest);
    } catch (err: any) {
      notify.toast.error("Failed to reset warnings");
    }
  };

  const viewStudentLogs = async (userId: string, fullName: string) => {
    if (!selectedContest) return;
    try {
      const res = await api.getParticipantLogs(selectedContest.id, userId);
      setSelectedUserLogs(res.logs || []);
      setLogStudentName(fullName);
    } catch (err) {
      notify.toast.error("Failed to load participant logs");
    }
  };

  const handleReviewSnapshot = async (contestId: string, snapshotId: string) => {
    try {
      await api.reviewProctoringSnapshot(contestId, snapshotId);
      notify.toast.success('Snapshot resolved and marked as reviewed.');
      loadFlaggedSnapshots(contestId);
    } catch (err) {
      notify.toast.error('Failed to resolve snapshot.');
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto text-white">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Contest Management<span className="text-[var(--accent-green)]">.</span></h1>
          <p className="text-gray-400 mt-1">Create and monitor secure exams and contests.</p>
        </div>
        <button 
          onClick={() => setShowCreate(true)}
          className="px-5 py-2.5 bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 text-black font-black rounded-xl shadow-lg shadow-emerald-500/20 transition-all transform active:scale-95 flex items-center gap-2"
        >
          <span>+</span> Create Contest
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400"></div></div>
      ) : error ? (
        <div className="text-red-400 text-center py-20">{error}</div>
      ) : contests.length === 0 ? (
        <EmptyState
          variant="contest"
          onAction={() => setShowCreate(true)}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {contests.map(c => {
            const scoringMode = (c as any).scoringMode || 'PARTIAL';
            const negMarking = (c as any).negativeMarkingEnabled;
            const problemCount = c._count?.problems || 0;
            return (
              <div key={c.id} className="bg-zinc-900 border border-white/10 rounded-2xl p-5 hover:border-emerald-400/50 transition-all shadow-xl group">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-extrabold text-lg text-white leading-tight flex-1 pr-2">{c.title}</h3>
                  <span className={`shrink-0 px-2.5 py-0.5 text-xs font-bold rounded-lg ${c.isPublic ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'}`}>
                    {c.isPublic ? 'Public' : 'Private'}
                  </span>
                </div>

                {/* Stats row */}
                <div className="flex items-center gap-3 mb-3 text-xs">
                  <span className={`px-2 py-0.5 rounded font-black border text-[10px] ${
                    scoringMode === 'PARTIAL' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' :
                    scoringMode === 'BINARY'  ? 'bg-blue-500/15 text-blue-400 border-blue-500/30' :
                    scoringMode === 'ACM'     ? 'bg-purple-500/15 text-purple-400 border-purple-500/30' :
                    'bg-rose-500/15 text-rose-400 border-rose-500/30'
                  }`}>{
                    scoringMode === 'PARTIAL' ? '📊 Partial' :
                    scoringMode === 'BINARY' ? '🎯 Binary' :
                    scoringMode === 'ACM' ? '⏱️ ACM' : '📉 Dynamic'
                  }</span>
                  {negMarking && <span className="text-[10px] px-2 py-0.5 bg-red-500/15 text-red-400 border border-red-500/30 rounded font-bold">–Neg</span>}
                  <span className="text-gray-500 text-[10px] ml-auto">{problemCount} Q{problemCount !== 1 ? 's' : ''}</span>
                </div>

                <div className="space-y-1 mb-4 text-xs text-gray-400 font-mono">
                  <p>Starts: {new Date(c.startTime).toLocaleString()}</p>
                  <p>Ends: {new Date(c.endTime).toLocaleString()}</p>
                  <div className="flex gap-3">
                    <span>⏳ {c.duration} mins</span>
                    <span>👥 {(c._count as any)?.registrations ?? (c._count as any)?.participants ?? 0} joined</span>
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-2 mb-4">
                  {c.requireFullscreen && <span className="text-[10px] px-2 py-1 bg-white/10 rounded-md text-gray-200 font-semibold border border-white/10">Fullscreen</span>}
                  {c.preventTabSwitch && <span className="text-[10px] px-2 py-1 bg-white/10 rounded-md text-gray-200 font-semibold border border-white/10">No Tabs</span>}
                  {c.disableCopyPaste && <span className="text-[10px] px-2 py-1 bg-white/10 rounded-md text-gray-200 font-semibold border border-white/10">No Copy</span>}
                  {c.enableProctoring && <span className="text-[10px] px-2 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-md font-bold">Proctored</span>}
                  {c.requireSeb && <span className="text-[10px] px-2 py-1 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-md font-bold">🔒 SEB</span>}
                </div>

                <button 
                  onClick={() => openMonitor(c)}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold rounded-xl transition-all shadow-md shadow-indigo-600/30 flex items-center justify-center gap-2"
                >
                  <span>📊</span> Monitor &amp; Manage
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE MODAL */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="bg-[var(--bg-card)] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-white/10 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold">Create Contest</h2>
                <p className="text-xs text-gray-500 mt-0.5">Configure scoring, marks, security & proctoring in one place</p>
              </div>
              <button onClick={() => setShowCreate(false)} className="text-gray-500 hover:text-white p-1 rounded-lg hover:bg-white/10 transition">✕</button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-6">
              {/* ── Basic Info ── */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-400 mb-1">Title</label>
                  <input required type="text" className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 focus:border-[var(--accent-green)] outline-none" 
                    value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-400 mb-1">Description</label>
                  <textarea className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 focus:border-[var(--accent-green)] outline-none h-20" 
                    value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Start Time</label>
                  <input required type="datetime-local" className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 focus:border-[var(--accent-green)] outline-none [color-scheme:dark]" 
                    value={formData.startTime} onChange={e => {
                      const newStart = e.target.value;
                      let newDur = formData.duration;
                      if (newStart && formData.endTime) {
                        const diff = new Date(formData.endTime).getTime() - new Date(newStart).getTime();
                        if (diff > 0) newDur = Math.round(diff / (1000 * 60));
                      }
                      setFormData({...formData, startTime: newStart, duration: newDur});
                    }} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">End Time</label>
                  <input required type="datetime-local" className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 focus:border-[var(--accent-green)] outline-none [color-scheme:dark]" 
                    value={formData.endTime} onChange={e => {
                      const newEnd = e.target.value;
                      let newDur = formData.duration;
                      if (formData.startTime && newEnd) {
                        const diff = new Date(newEnd).getTime() - new Date(formData.startTime).getTime();
                        if (diff > 0) newDur = Math.round(diff / (1000 * 60));
                      }
                      setFormData({...formData, endTime: newEnd, duration: newDur});
                    }} />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-400">Duration (mins)</label>
                    {formData.startTime && formData.endTime && (
                      <span className="text-[10px] text-emerald-400 font-mono">
                        Auto: {Math.round((new Date(formData.endTime).getTime() - new Date(formData.startTime).getTime()) / (1000 * 60))}m
                      </span>
                    )}
                  </div>
                  <input required type="number" min="1" className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 focus:border-[var(--accent-green)] outline-none" 
                    value={formData.duration} onChange={e => setFormData({...formData, duration: parseInt(e.target.value) || 120})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Visibility</label>
                  <select className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 focus:border-[var(--accent-green)] outline-none" 
                    value={formData.isPublic ? 'public' : 'private'} onChange={e => setFormData({...formData, isPublic: e.target.value === 'public'})}>
                    <option value="private">Private (Invite Only)</option>
                    <option value="public">Public (Anyone can join)</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-amber-400 mb-1 flex items-center gap-1.5">
                    <span>🔑</span> Exam Access Code (Optional Gate)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. KRYPT-CAPG (leave blank for no code)"
                    maxLength={25}
                    className="w-full bg-black border border-amber-500/30 rounded-lg px-4 py-2 text-sm text-amber-300 font-mono font-bold tracking-wider focus:border-amber-400 outline-none uppercase placeholder-zinc-600"
                    value={formData.accessCode}
                    onChange={e => setFormData({...formData, accessCode: e.target.value.toUpperCase()})}
                  />
                  <p className="text-[11px] text-gray-500 mt-1">If set, candidates must enter this code in the AccessCodeGate modal to enter the exam.</p>
                </div>
              </div>

              {/* ── SCORING RULES ── */}
              <div className="bg-gradient-to-br from-amber-500/5 to-orange-500/5 border border-amber-500/20 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">⚡</span>
                  <h3 className="text-base font-extrabold text-amber-300 tracking-tight">Scoring Rules</h3>
                  <span className="text-[10px] px-2 py-0.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded font-bold">NEW</span>
                </div>

                {/* Scoring Mode Cards */}
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">Scoring Mode</label>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { value: 'PARTIAL', icon: '📊', label: 'Partial Credit', desc: '% testcases × marks', color: 'emerald' },
                      { value: 'BINARY',  icon: '🎯', label: 'Binary',         desc: 'All-or-nothing per problem', color: 'blue' },
                      { value: 'ACM',     icon: '⏱️', label: 'ACM Style',      desc: 'Binary + time penalty', color: 'purple' },
                      { value: 'DYNAMIC', icon: '📉', label: 'Dynamic Decay',  desc: 'Marks reduce as time passes', color: 'rose' },
                    ] as const).map(mode => (
                      <button
                        key={mode.value}
                        type="button"
                        onClick={() => setFormData({...formData, scoringMode: mode.value})}
                        className={`flex items-start gap-2.5 p-3 rounded-xl border text-left transition-all ${
                          formData.scoringMode === mode.value
                            ? mode.color === 'emerald' ? 'bg-emerald-500/15 border-emerald-500/40 ring-1 ring-emerald-500/30'
                            : mode.color === 'blue' ? 'bg-blue-500/15 border-blue-500/40 ring-1 ring-blue-500/30'
                            : mode.color === 'purple' ? 'bg-purple-500/15 border-purple-500/40 ring-1 ring-purple-500/30'
                            : 'bg-rose-500/15 border-rose-500/40 ring-1 ring-rose-500/30'
                            : 'bg-white/5 border-white/10 hover:border-white/20'
                        }`}
                      >
                        <span className="text-base mt-0.5">{mode.icon}</span>
                        <div className="flex-1">
                          <div className={`text-xs font-extrabold ${formData.scoringMode === mode.value ? 'text-white' : 'text-gray-300'}`}>{mode.label}</div>
                          <div className="text-[10px] text-gray-500 mt-0.5">{mode.desc}</div>
                        </div>
                        {formData.scoringMode === mode.value && (
                          <div className="w-4 h-4 rounded-full bg-white/90 flex items-center justify-center shrink-0 mt-0.5">
                            <div className="w-2 h-2 rounded-full bg-black" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                  {formData.scoringMode === 'ACM' && (
                    <div className="mt-2 p-2.5 bg-purple-500/10 border border-purple-500/20 rounded-lg text-[11px] text-purple-300">
                      ℹ️ Each wrong submission adds a <strong>20-min penalty</strong>. Ranked by problems solved, then total time.
                    </div>
                  )}
                  {formData.scoringMode === 'DYNAMIC' && (
                    <div className="mt-2 p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-lg text-[11px] text-rose-300">
                      ℹ️ Max marks decrease as contest time passes. Earlier correct submissions earn more.
                    </div>
                  )}
                </div>

                {/* Negative Marking Toggle */}
                <div className="flex items-center gap-4 pt-3 border-t border-white/10">
                  <label className="flex items-center gap-3 cursor-pointer flex-1">
                    <div
                      onClick={() => setFormData({...formData, negativeMarkingEnabled: !formData.negativeMarkingEnabled})}
                      className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${formData.negativeMarkingEnabled ? 'bg-red-500' : 'bg-white/20'}`}
                    >
                      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${formData.negativeMarkingEnabled ? 'left-5' : 'left-0.5'}`} />
                    </div>
                    <div>
                      <div className="font-semibold text-sm text-white flex items-center gap-2">
                        Negative Marking
                        {formData.negativeMarkingEnabled && <span className="text-[10px] px-1.5 py-0.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded font-bold">ACTIVE</span>}
                      </div>
                      <div className="text-[11px] text-gray-500">Deduct marks for every wrong attempt</div>
                    </div>
                  </label>
                  {formData.negativeMarkingEnabled && (
                    <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-1.5 shrink-0">
                      <span className="text-xs text-red-400 font-bold">–</span>
                      <input
                        type="number"
                        min="0.25" max="100" step="0.25"
                        className="w-16 bg-transparent text-red-300 font-extrabold text-sm focus:outline-none text-center"
                        value={formData.negativeMarkingValue}
                        onChange={e => setFormData({...formData, negativeMarkingValue: parseFloat(e.target.value) || 0.25})}
                      />
                      <span className="text-xs text-red-400 font-bold">marks</span>
                    </div>
                  )}
                </div>

                {/* Leaderboard Controls */}
                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/10">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={formData.showLeaderboardDuringContest} onChange={e => setFormData({...formData, showLeaderboardDuringContest: e.target.checked})} className="w-4 h-4 accent-emerald-400" />
                    <div>
                      <div className="text-xs font-semibold text-white">Show Live Leaderboard</div>
                      <div className="text-[10px] text-gray-500">Visible to candidates during contest</div>
                    </div>
                  </label>
                  <div>
                    <div className="text-xs font-semibold text-white mb-1">Freeze Leaderboard (mins before end)</div>
                    <input type="number" min="0" max="60" className="w-full bg-black/60 border border-white/10 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-amber-400" 
                      value={formData.freezeLeaderboardMins} onChange={e => setFormData({...formData, freezeLeaderboardMins: parseInt(e.target.value) || 0})} />
                    <div className="text-[9px] text-gray-600 mt-0.5">Set 0 to never freeze (ICPC style: set 60)</div>
                  </div>
                </div>
              </div>

              {/* ── PHASE 2: CONTEST SECTIONS ENGINE ── */}
              <div className="bg-gradient-to-br from-indigo-500/5 to-purple-500/5 border border-indigo-500/20 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">📚</span>
                    <div>
                      <h3 className="text-base font-extrabold text-indigo-300 tracking-tight flex items-center gap-2">
                        Exam Sections Engine
                        <span className="text-[10px] px-2 py-0.5 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded font-bold">PHASE 2</span>
                      </h3>
                      <p className="text-[11px] text-gray-400">Divide assessment into timed sections (like HackerEarth, Mettl & TCS iON)</p>
                    </div>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl hover:border-indigo-400/50 transition">
                    <input
                      type="checkbox"
                      checked={enableSections}
                      onChange={e => setEnableSections(e.target.checked)}
                      className="w-4 h-4 accent-indigo-400 cursor-pointer"
                    />
                    <span className="text-xs font-extrabold text-white">Enable Multi-Section Format</span>
                  </label>
                </div>

                {enableSections && (
                  <div className="space-y-4 pt-1">
                    <div className="flex items-center justify-between text-xs font-semibold text-gray-400">
                      <span>Configured Sections ({sections.length})</span>
                      <button
                        type="button"
                        onClick={() => {
                          const nextNum = sections.length + 1;
                          setSections([
                            ...sections,
                            {
                              id: `sec-${Date.now()}`,
                              title: `Section ${String.fromCharCode(64 + nextNum)}: Specialty Domain`,
                              sectionType: 'CODING',
                              duration: 30,
                              negativeMarkingEnabled: false,
                              negativeMarkingValue: 0.25,
                              problemIds: [],
                              instructions: 'Complete section problems.'
                            }
                          ]);
                        }}
                        className="px-3 py-1 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 rounded-lg text-xs font-bold transition flex items-center gap-1"
                      >
                        <span>+</span> Add Section
                      </button>
                    </div>

                    <div className="space-y-3">
                      {sections.map((sec, sIdx) => (
                        <div key={sec.id} className="bg-black/60 border border-white/10 rounded-xl p-4 space-y-3 relative group hover:border-indigo-500/30 transition">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 flex-1">
                              <span className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-black flex items-center justify-center border border-indigo-500/30 shrink-0">
                                {sIdx + 1}
                              </span>
                              <input
                                type="text"
                                value={sec.title}
                                onChange={e => {
                                  const updated = [...sections];
                                  updated[sIdx].title = e.target.value;
                                  setSections(updated);
                                }}
                                placeholder="Section Title (e.g., Section A: Quant & Verbal)"
                                className="w-full bg-black border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white font-bold focus:outline-none focus:border-indigo-400"
                              />
                            </div>

                            {sections.length > 1 && (
                              <button
                                type="button"
                                onClick={() => setSections(sections.filter(s => s.id !== sec.id))}
                                className="text-gray-500 hover:text-red-400 text-xs font-bold px-2 py-1 hover:bg-red-500/10 rounded transition"
                                title="Remove Section"
                              >
                                Delete
                              </button>
                            )}
                          </div>

                          <div className="grid grid-cols-3 gap-3 text-xs">
                            <div>
                              <label className="block text-[10px] font-semibold text-gray-400 mb-1">Section Type</label>
                              <select
                                value={sec.sectionType}
                                onChange={e => {
                                  const updated = [...sections];
                                  updated[sIdx].sectionType = e.target.value as any;
                                  setSections(updated);
                                }}
                                className="w-full bg-black border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-400"
                              >
                                <option value="QUIZ">General Quiz / Aptitude</option>
                                <option value="CODING">Coding / Algorithm</option>
                                <option value="VIBE_CODE">🤖 AI-Assisted Socratic Coding</option>
                                <option value="DEBUGGING">🐞 Code Debugging / Bug Fixes</option>
                                <option value="WEB_DEV">Web Dev / SQL</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-gray-400 mb-1">Section Timer (Mins)</label>
                              <input
                                type="number"
                                min="0" max="300"
                                value={sec.duration}
                                onChange={e => {
                                  const updated = [...sections];
                                  updated[sIdx].duration = parseInt(e.target.value) || 0;
                                  setSections(updated);
                                }}
                                placeholder="0 = Inherit Contest"
                                className="w-full bg-black border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-400"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-gray-400 mb-1">Negative Marking</label>
                              <div className="flex items-center gap-2 bg-black border border-white/10 rounded-lg px-2 py-1">
                                <input
                                  type="checkbox"
                                  checked={sec.negativeMarkingEnabled}
                                  onChange={e => {
                                    const updated = [...sections];
                                    updated[sIdx].negativeMarkingEnabled = e.target.checked;
                                    setSections(updated);
                                  }}
                                  className="w-3.5 h-3.5 accent-red-400"
                                />
                                {sec.negativeMarkingEnabled ? (
                                  <input
                                    type="number"
                                    min="0.1" max="10" step="0.25"
                                    value={sec.negativeMarkingValue}
                                    onChange={e => {
                                      const updated = [...sections];
                                      updated[sIdx].negativeMarkingValue = parseFloat(e.target.value) || 0.25;
                                      setSections(updated);
                                    }}
                                    className="w-12 bg-transparent text-red-400 font-extrabold text-xs text-center focus:outline-none"
                                  />
                                ) : (
                                  <span className="text-[10px] text-gray-500">Off</span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Problem selector for this section */}
                          {formData.problemIds.length > 0 && (
                            <div className="pt-2 border-t border-white/5">
                              <label className="block text-[10px] font-semibold text-gray-400 mb-1">
                                Questions in this section ({sec.problemIds.length} of {formData.problemIds.length} selected)
                              </label>
                              <div className="flex flex-wrap gap-1.5">
                                {formData.problemIds.map(pId => {
                                  const prob = problemBank.find(p => p.id === pId);
                                  const isAssigned = sec.problemIds.includes(pId);
                                  return (
                                    <button
                                      key={pId}
                                      type="button"
                                      onClick={() => {
                                        const updated = [...sections];
                                        if (isAssigned) {
                                          updated[sIdx].problemIds = updated[sIdx].problemIds.filter(id => id !== pId);
                                        } else {
                                          updated[sIdx].problemIds = [...updated[sIdx].problemIds, pId];
                                        }
                                        setSections(updated);
                                      }}
                                      className={`px-2 py-0.5 rounded text-[10px] font-bold border transition ${
                                        isAssigned
                                          ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                                          : 'bg-white/5 text-gray-500 border-white/5 hover:text-gray-300'
                                      }`}
                                    >
                                      {isAssigned ? '✓ ' : '+ '}{prob?.title || pId}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* ── QUESTIONS & MARKS ── */}
              <div>
                <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold">Questions & Marks</h3>
                    {formData.problemIds.length > 0 && (
                      <span className="text-xs px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded font-bold">
                        {formData.problemIds.length} selected · {formData.problemIds.reduce((sum, id) => sum + (problemScores[id] ?? 100), 0)} total marks
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <select className="bg-black border border-white/10 rounded-lg px-2 py-1 outline-none focus:border-[var(--accent-green)] text-xs text-white"
                      value={problemFilterType} onChange={e => setProblemFilterType(e.target.value)}>
                      <option value="all">All Types</option>
                      <option value="code">Coding</option>
                      <option value="vibe-code">AI-Assisted (Vibe-Code)</option>
                      <option value="debugging">Debugging</option>
                      <option value="web-dev">Web Dev</option>
                      <option value="sql">SQL</option>
                    </select>
                    <select className="bg-black border border-white/10 rounded-lg px-2 py-1 outline-none focus:border-[var(--accent-green)] text-xs text-white"
                      value={problemFilterCategory} onChange={e => setProblemFilterCategory(e.target.value)}>
                      <option value="all">All Categories</option>
                      {Array.from(new Set(problemBank.map(p => p.category || 'General'))).map(c => (
                        <option key={c} value={c as string}>{c as string}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Problems table with per-problem marks input */}
                <div className="border border-white/10 rounded-xl overflow-y-auto max-h-64 bg-black select-none">
                  {problemBank.length === 0 ? (
                    <p className="text-gray-500 text-sm italic p-4">No problems found in the bank.</p>
                  ) : (() => {
                    const filteredProblems = problemBank.filter(p => {
                      const typeMatch = problemFilterType === 'all' || (p.problemType || 'code') === problemFilterType;
                      const catMatch = problemFilterCategory === 'all' || (p.category || 'General') === problemFilterCategory;
                      return typeMatch && catMatch;
                    });
                    if (filteredProblems.length === 0) return <p className="text-gray-500 text-sm italic p-4">No problems match the current filters.</p>;
                    return (
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-zinc-900 border-b border-white/10 text-gray-400 uppercase text-[9px] tracking-wider z-10">
                          <tr>
                            <th className="p-3 text-left w-8"></th>
                            <th className="p-3 text-left">Question Title</th>
                            <th className="p-3 text-center whitespace-nowrap">Type</th>
                            <th className="p-3 text-center whitespace-nowrap">Difficulty</th>
                            <th className="p-3 text-center w-32 whitespace-nowrap">Custom Marks</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {filteredProblems.map(prob => {
                            const isChecked = formData.problemIds.includes(prob.id);
                            const marks = problemScores[prob.id] ?? 100;
                            const pType = (prob.problemType || 'code').toUpperCase();
                            const displayType = pType === 'WEB-DEV' ? 'WEB DEV' : pType;

                            const toggleSelect = () => {
                              const newIds = !isChecked 
                                ? [...formData.problemIds, prob.id] 
                                : formData.problemIds.filter(id => id !== prob.id);
                              setFormData({...formData, problemIds: newIds});
                              if (!isChecked && problemScores[prob.id] === undefined) {
                                setProblemScores(prev => ({...prev, [prob.id]: 100}));
                              }
                            };

                            return (
                              <tr 
                                key={prob.id} 
                                onClick={toggleSelect}
                                className={`transition-colors cursor-pointer ${isChecked ? 'bg-emerald-500/10' : 'hover:bg-white/5'}`}
                              >
                                <td className="p-3" onClick={e => e.stopPropagation()}>
                                  <input 
                                    type="checkbox" 
                                    checked={isChecked} 
                                    onChange={toggleSelect} 
                                    className="w-4 h-4 accent-emerald-400 cursor-pointer" 
                                  />
                                </td>
                                <td className="p-3">
                                  <div className="font-semibold text-white text-sm leading-snug">{prob.title}</div>
                                  <div className="text-[10px] text-gray-400 mt-0.5">{prob.category || 'General'}</div>
                                </td>
                                <td className="p-3 text-center whitespace-nowrap">
                                  <span className={`text-[9px] px-2 py-0.5 rounded-md font-black uppercase font-mono whitespace-nowrap inline-block ${
                                    pType.includes('WEB') ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' :
                                    pType.includes('SQL') ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' :
                                    'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  }`}>{displayType}</span>
                                </td>
                                <td className="p-3 text-center whitespace-nowrap">
                                  <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold whitespace-nowrap inline-block ${
                                    prob.difficulty === 'Easy' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                                    prob.difficulty === 'Medium' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                                    'bg-red-500/20 text-red-400 border border-red-500/30'
                                  }`}>{prob.difficulty}</span>
                                </td>
                                <td className="p-3" onClick={e => e.stopPropagation()}>
                                  <div className={`flex items-center justify-center gap-1 rounded-lg px-2.5 py-1 border transition-all ${
                                    isChecked ? 'bg-amber-500/15 border-amber-500/40 ring-1 ring-amber-500/20' : 'bg-white/5 border-white/10 opacity-30'
                                  }`}>
                                    <input
                                      type="number"
                                      min="1"
                                      max="1000"
                                      disabled={!isChecked}
                                      value={marks}
                                      onChange={e => {
                                        const v = Math.max(1, parseInt(e.target.value) || 1);
                                        setProblemScores(prev => ({...prev, [prob.id]: v}));
                                      }}
                                      className="w-16 bg-transparent text-amber-300 font-black text-sm focus:outline-none text-center disabled:text-gray-500"
                                    />
                                    <span className="text-[10px] text-amber-400 font-bold">pts</span>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    );
                  })()}
                </div>

                {/* Total Marks Summary Bar */}
                {formData.problemIds.length > 0 && (
                  <div className="mt-2 flex items-center justify-between p-3 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 rounded-xl">
                    <div className="flex items-center gap-4 text-xs font-bold">
                      <span className="text-gray-400">{formData.problemIds.length} Q{formData.problemIds.length > 1 ? 's' : ''}</span>
                      <span className="text-gray-600">·</span>
                      <span className="text-emerald-400">Total: {formData.problemIds.reduce((sum, id) => sum + (problemScores[id] ?? 100), 0)} Marks</span>
                      {formData.negativeMarkingEnabled && (
                        <><span className="text-gray-600">·</span><span className="text-red-400">Neg: –{formData.negativeMarkingValue} per wrong</span></>
                      )}
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold border ${
                      formData.scoringMode === 'PARTIAL' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                      formData.scoringMode === 'BINARY'  ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                      formData.scoringMode === 'ACM'     ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' :
                      'bg-rose-500/20 text-rose-400 border-rose-500/30'
                    }`}>{formData.scoringMode}</span>
                  </div>
                )}
              </div>

              {/* ── SECURITY SETTINGS ── */}
              <div>
                <h3 className="text-lg font-bold mb-3 border-b border-white/10 pb-2">Security Settings</h3>
                <div className="space-y-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={formData.requireFullscreen} onChange={e => setFormData({...formData, requireFullscreen: e.target.checked})} className="w-5 h-5 accent-[var(--accent-green)]" />
                    <div>
                      <div className="font-medium text-white">Require Fullscreen</div>
                      <div className="text-xs text-gray-400">Forces the browser into fullscreen mode during the exam.</div>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={formData.preventTabSwitch} onChange={e => setFormData({...formData, preventTabSwitch: e.target.checked})} className="w-5 h-5 accent-[var(--accent-green)]" />
                    <div>
                      <div className="font-medium text-white">Tab Switch / Blur Detection</div>
                      <div className="text-xs text-gray-400">Logs a warning if the student switches tabs or clicks outside the window.</div>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={formData.disableCopyPaste} onChange={e => setFormData({...formData, disableCopyPaste: e.target.checked})} className="w-5 h-5 accent-[var(--accent-green)]" />
                    <div>
                      <div className="font-medium text-white">Disable Copy/Paste & Right Click</div>
                      <div className="text-xs text-gray-400">Prevents copying from and right-clicking inside the test environment.</div>
                    </div>
                  </label>
                  <div className="grid grid-cols-2 gap-4 border-l-2 border-white/10 pl-4 py-1">
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 mb-1">Paste Mode</label>
                      <select 
                        className="w-full bg-black border border-white/10 rounded-lg px-2 py-1 outline-none text-xs" 
                        value={formData.pasteMode} 
                        onChange={e => setFormData({...formData, pasteMode: e.target.value as 'ALLOWED' | 'LOG_ONLY' | 'BLOCKED'})}
                      >
                        <option value="ALLOWED">Allowed</option>
                        <option value="LOG_ONLY">Log Copy/Paste Attempts</option>
                        <option value="BLOCKED">Strictly Blocked</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 mb-1">Max Warnings Allowed</label>
                      <input 
                        type="number" min="1" max="10" 
                        className="w-full bg-black border border-white/10 rounded-lg px-2 py-1 outline-none text-xs" 
                        value={formData.maxWarnings} 
                        onChange={e => setFormData({...formData, maxWarnings: parseInt(e.target.value) || 3})} 
                      />
                    </div>
                  </div>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={formData.allowMultipleMonitors} onChange={e => setFormData({...formData, allowMultipleMonitors: e.target.checked})} className="w-5 h-5 accent-[var(--accent-green)]" />
                    <div>
                      <div className="font-medium text-white">Allow Multiple Monitors</div>
                      <div className="text-xs text-gray-400">If unchecked, multi-monitor configuration checks are enforced.</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={formData.enableProctoring} onChange={e => setFormData({...formData, enableProctoring: e.target.checked})} className="w-5 h-5 accent-[var(--accent-green)]" />
                    <div>
                      <div className="font-medium text-[var(--accent-yellow)]">Enable Audio & Webcam Proctoring</div>
                      <div className="text-xs text-gray-400">Requires camera/microphone access and records proctoring snapshots.</div>
                    </div>
                  </label>

                  {formData.enableProctoring && (
                    <div className="border-l-2 border-[var(--accent-yellow)]/30 pl-4 py-2 space-y-3 bg-white/5 rounded-r-lg p-3">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" checked={formData.faceCheckEnabled} onChange={e => setFormData({...formData, faceCheckEnabled: e.target.checked})} className="w-4 h-4 accent-[var(--accent-yellow)]" />
                        <div>
                          <div className="font-medium text-sm text-white">Enable Webcam Face Check</div>
                          <div className="text-[10px] text-gray-400">Runs OpenCV Haar Cascades to check if exactly one face is present.</div>
                        </div>
                      </label>

                      <label className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" checked={formData.voiceCheckEnabled} onChange={e => setFormData({...formData, voiceCheckEnabled: e.target.checked})} className="w-4 h-4 accent-[var(--accent-yellow)]" />
                        <div>
                          <div className="font-medium text-sm text-white">Enable Microphone Voice Check</div>
                          <div className="text-[10px] text-gray-400">Web Audio API VAD alerts on student talking for more than 8 seconds.</div>
                        </div>
                      </label>

                      <div>
                        <label className="block text-[10px] font-semibold text-gray-400 mb-1">Snapshot Interval (seconds)</label>
                        <input 
                          type="number" min="15" max="300" 
                          className="bg-black border border-white/10 rounded-lg px-2 py-1 outline-none text-xs w-32" 
                          value={formData.snapshotIntervalSeconds} 
                          onChange={e => setFormData({...formData, snapshotIntervalSeconds: parseInt(e.target.value) || 45})} 
                        />
                      </div>
                    </div>
                  )}
                  {/* SEB Toggle */}
                  <label className="flex items-center gap-3 cursor-pointer p-3 bg-blue-500/5 border border-blue-500/20 rounded-xl">
                    <input type="checkbox" checked={formData.requireSeb} onChange={e => setFormData({...formData, requireSeb: e.target.checked})} className="w-5 h-5 accent-blue-500" />
                    <div className="flex-1">
                      <div className="font-medium text-blue-300 flex items-center gap-2">
                        🔒 Require Safe Exam Browser (SEB)
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">Students must launch the exam inside Safe Exam Browser. A .seb config file will be automatically generated and served to them.</div>
                    </div>
                  </label>

                </div>
              </div>

              <button disabled={creating} type="submit" className="w-full py-3.5 bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 text-black font-black text-base rounded-xl transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50">
                {creating ? 'Creating...' : 'Create Secure Contest'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MONITOR MODAL */}
      {selectedContest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto flex flex-col shadow-2xl">
            <div className="p-6 border-b border-white/10 flex justify-between items-center bg-black/40 sticky top-0 z-10">
              <div>
                <h2 className="text-2xl font-black text-white">{selectedContest.title} <span className="text-sm font-semibold text-emerald-400 ml-2">Live Monitor</span></h2>
                <div className="flex gap-4 text-xs text-gray-400 mt-1">
                  <span>{selectedContest.isPublic ? 'Public' : 'Private'}</span>
                  <span>|</span>
                  <span className={selectedContest.enableProctoring ? 'text-emerald-400 font-bold' : ''}>{selectedContest.enableProctoring ? 'Proctoring Active' : 'No Proctoring'}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowSamplePreview(!showSamplePreview)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-2 border ${
                    showSamplePreview
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-white/5 text-gray-400 hover:text-white border-white/10'
                  }`}
                >
                  <span>{showSamplePreview ? '🧪 Sample Preview Active' : '👁️ Preview Mock Data'}</span>
                </button>
                <button onClick={() => setSelectedContest(null)} className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-xl font-bold transition">Close</button>
              </div>
            </div>

            <div className="flex gap-4 border-b border-white/10 px-6 bg-black/20 overflow-x-auto">
              <button 
                onClick={() => setMonitorTab('participants')}
                className={`py-3 text-sm font-extrabold border-b-2 transition ${monitorTab === 'participants' ? 'border-emerald-400 text-emerald-400' : 'border-transparent text-gray-400 hover:text-white'}`}
              >
                Active Participants
              </button>
              <button 
                onClick={() => setMonitorTab('lobby')}
                className={`py-3 text-sm font-extrabold border-b-2 transition ${monitorTab === 'lobby' ? 'border-emerald-400 text-emerald-400' : 'border-transparent text-gray-400 hover:text-white'}`}
              >
                Pre-Contest Lobby Telemetry
              </button>
              {selectedContest.enableProctoring && (
                <button 
                  onClick={() => {
                    setMonitorTab('snapshots');
                    loadFlaggedSnapshots(selectedContest.id);
                  }}
                  className={`py-3 text-sm font-extrabold border-b-2 transition ${monitorTab === 'snapshots' ? 'border-emerald-400 text-emerald-400' : 'border-transparent text-gray-400 hover:text-white'}`}
                >
                  Flagged Proctoring Snapshots
                </button>
              )}
              <button 
                onClick={() => {
                  setMonitorTab('seb');
                  loadContestLogs(selectedContest.id);
                }}
                className={`py-3 text-sm font-extrabold border-b-2 transition ${monitorTab === 'seb' ? 'border-emerald-400 text-emerald-400' : 'border-transparent text-gray-400 hover:text-white'}`}
              >
                🔒 SEB &amp; Integrity Monitor
              </button>
            </div>

            <div className="p-6 flex-1 min-h-0">
              {monitorTab === 'participants' ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left Column: Invite */}
                  {!selectedContest.isPublic && (
                    <div className="lg:col-span-1 bg-white/5 border border-white/10 rounded-xl p-5 h-fit">
                      <h3 className="font-bold mb-4">Invite Participants</h3>
                      <p className="text-xs text-gray-400 mb-4">Select a class to bulk-add all its students to this private contest.</p>
                      <select 
                        className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 mb-4 outline-none focus:border-[var(--accent-green)] text-sm"
                        value={selectedClassId} onChange={e => setSelectedClassId(e.target.value)}
                      >
                        <option value="">-- Select Class --</option>
                        {classes.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                      <button 
                        onClick={handleInviteClass} disabled={inviting || !selectedClassId}
                        className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold rounded-xl transition shadow-md shadow-emerald-500/20 disabled:opacity-50"
                      >
                        {inviting ? 'Inviting...' : 'Invite Class Students'}
                      </button>
                    </div>
                  )}

                  {/* Right Column: Participants List */}
                  <div className={selectedContest.isPublic ? 'lg:col-span-3' : 'lg:col-span-2'}>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-white">Participants ({participants.length})</h3>
                      <button onClick={() => openMonitor(selectedContest)} className="text-xs text-blue-400 font-bold hover:underline">🔄 Refresh</button>
                    </div>
                    
                    {monitorLoading ? (
                      <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-400"></div></div>
                    ) : participants.length === 0 ? (
                      <p className="text-gray-500 text-sm italic">No participants have joined yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {participants.map((p, _i) => (
                          <div key={p.user.id} className={`flex items-center justify-between p-3 rounded-lg border ${p.isTerminated ? 'border-red-500/50 bg-red-500/10' : (p.warnings || 0) > 0 ? 'border-yellow-500/50 bg-yellow-500/10' : 'border-white/10 bg-white/5'}`}>
                            <div>
                              <div className="font-bold text-sm flex items-center gap-2">
                                {p.user.fullName}
                                {p.isTerminated && <span className="text-[10px] px-1.5 py-0.5 bg-red-500 text-white rounded font-bold uppercase tracking-wider">Terminated</span>}
                              </div>
                              <div className="text-xs text-gray-400">{p.user.email}</div>
                            </div>
                            <div className="flex items-center gap-6">
                              <div className="text-center">
                                <div className="text-xs text-gray-500">Score</div>
                                <div className="font-bold">{p.score}</div>
                              </div>
                              <div className="text-center">
                                <div className="text-xs text-gray-500">Warnings</div>
                                <div className={`font-bold ${p.warnings && p.warnings > 0 ? 'text-yellow-400' : 'text-gray-400'}`}>{p.warnings || 0}/{selectedContest.maxWarnings || 3}</div>
                              </div>
                              <button 
                                onClick={() => navigate(`/teacher/contests/${selectedContest.id}/attempts/${p.user.id}/report`)} 
                                className="p-2 text-emerald-400 hover:bg-emerald-500/20 rounded-lg transition"
                                title="View Performance Report Audit"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                                </svg>
                              </button>
                              <button 
                                onClick={() => viewStudentLogs(p.user.id, p.user.fullName)} 
                                className="p-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition"
                                title="View Proctoring Logs"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                              </button>
                              {((p.warnings && p.warnings > 0) || p.isTerminated) && (
                                <button 
                                  onClick={() => handleResetWarnings(p.user.id, p.user.fullName)} 
                                  className="p-2 text-amber-400 hover:bg-amber-500/20 rounded-lg transition"
                                  title="Reset Warnings to 0"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 6H16" />
                                  </svg>
                                </button>
                              )}
                              {p.isTerminated ? (
                                <button onClick={() => unblockStudent(p.user.id)} className="p-2 text-green-400 hover:bg-green-500/20 rounded-lg transition" title="Unblock Student">
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                  </svg>
                                </button>
                              ) : (
                                <button onClick={() => blockStudent(p.user.id)} className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition" title="Block Student">
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : monitorTab === 'lobby' ? (
                renderLobbyTelemetry()
              ) : monitorTab === 'seb' ? (
                renderSebMonitor()
              ) : monitorTab === 'questions' ? (
                renderMappedQuestions()
              ) : (
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold">Flagged Snapshots ({flaggedSnapshots.length})</h3>
                    <button onClick={() => loadFlaggedSnapshots(selectedContest.id)} className="text-xs text-[var(--accent-blue)] hover:underline">Refresh List</button>
                  </div>
                  
                  {snapshotsLoading ? (
                    <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--accent-green)]"></div></div>
                  ) : flaggedSnapshots.length === 0 ? (
                    <p className="text-gray-500 text-sm italic text-center py-10">No flagged snapshots found.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      {flaggedSnapshots.map(s => {
                        const baseUrl = api.client.defaults.baseURL?.replace('/api', '') || 'http://localhost:5000';
                        const imageUrl = `${baseUrl}/${s.storageKey}`;
                        return (
                          <div key={s.id} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden flex flex-col">
                            <div className="aspect-video w-full bg-black relative">
                              <img src={imageUrl} alt="Proctoring Snapshot" className="w-full h-full object-cover" />
                              <span className="absolute top-2 right-2 px-2 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded uppercase">
                                {s.faceCount === 0 ? 'No Face' : s.faceCount > 1 ? 'Multiple Faces' : 'Flagged'}
                              </span>
                            </div>
                            <div className="p-4 flex-1 flex flex-col justify-between">
                              <div className="space-y-1 mb-4">
                                <div className="font-bold text-sm text-white truncate">{s.studentName}</div>
                                <div className="text-xs text-gray-400 truncate">{s.studentEmail}</div>
                                <div className="text-[10px] text-gray-500">Captured: {new Date(s.capturedAt).toLocaleString()}</div>
                                <div className="text-xs text-gray-300">
                                  <span>Detected Faces: <strong className={s.faceCount !== 1 ? 'text-red-400' : 'text-green-400'}>{s.faceCount ?? 'N/A'}</strong></span>
                                </div>
                                <div className="text-xs text-gray-300">
                                  <span>Warnings: <strong className="text-yellow-400">{s.warnings}</strong></span>
                                  {s.isTerminated && <span className="ml-2 text-red-500 font-bold">(Terminated)</span>}
                                </div>
                              </div>
                              {s.flagged && (
                                <button 
                                  onClick={() => handleReviewSnapshot(selectedContest.id, s.id)}
                                  className="w-full py-2 bg-[var(--accent-green)] hover:opacity-90 text-black text-xs font-bold rounded-lg transition"
                                >
                                  Mark as Reviewed
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {selectedUserLogs !== null && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[100] backdrop-blur-sm animate-fade-in">
          <div className="bg-zinc-950 border border-white/10 rounded-2xl p-6 max-w-xl w-full flex flex-col max-h-[80vh] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4 flex-shrink-0">
              <div>
                <h3 className="font-extrabold text-lg text-white">Proctoring Activity Logs</h3>
                <p className="text-xs text-zinc-400 mt-0.5">Logs for candidate: <span className="text-[var(--accent-blue)] font-bold">{logStudentName}</span></p>
              </div>
              <button 
                onClick={() => setSelectedUserLogs(null)}
                className="text-gray-400 hover:text-white p-1 hover:bg-white/10 rounded-lg transition"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 min-h-0 pr-1 select-text">
              {selectedUserLogs.length === 0 ? (
                <p className="text-zinc-500 text-sm italic text-center py-6">No proctoring violations logged for this candidate.</p>
              ) : (
                selectedUserLogs
                  .filter((log: any, index: number, arr: any[]) => {
                    if (index === 0) return true;
                    const prev = arr[index - 1];
                    if (
                      log.eventType === prev.eventType &&
                      (log.eventType === 'SEB_SESSION_START' || log.eventType === 'CONTEST_ENTERED')
                    ) {
                      const logTime = new Date(log.timestamp || log.createdAt || log.created_at || Date.now()).getTime();
                      const prevTime = new Date(prev.timestamp || prev.createdAt || prev.created_at || Date.now()).getTime();
                      if (Math.abs(logTime - prevTime) < 60000) return false;
                    }
                    return true;
                  })
                  .map((log: any) => {
                    const logDateRaw = log.timestamp || log.createdAt || log.created_at;
                    const formattedDate = logDateRaw ? new Date(logDateRaw).toLocaleString() : 'Just now';
                    const isAppIntegrity = log.description && log.description.startsWith("App Integrity");
                    let detailObj: any = null;
                    let cleanDescription = log.details || log.description || 'Proctoring security log';
                    
                    if (typeof cleanDescription === 'object') {
                      cleanDescription = JSON.stringify(cleanDescription);
                    }

                    if (isAppIntegrity) {
                      try {
                        const jsonPart = log.description.substring(log.description.indexOf('{'));
                        detailObj = JSON.parse(jsonPart);
                        cleanDescription = log.description.substring(0, log.description.indexOf('{') - 3);
                      } catch (e) {
                        // fallback
                      }
                    }

                    const suspectedCause = detailObj?.suspectedCause || (log.eventType === 'space_switch_or_gesture' ? 'space_switch_or_gesture' : null);
                    const awayDurationMs = detailObj?.awayDurationMs;

                    return (
                      <div key={log.id} className="p-3 bg-white/5 border border-white/5 rounded-xl flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-bold uppercase tracking-wider font-mono ${
                            log.eventType === 'warnings_reset' 
                              ? 'text-green-400' 
                              : log.eventType === 'contest_resumed' 
                                ? 'text-blue-400' 
                                : 'text-red-400'
                          }`}>{log.eventType}</span>
                          <span className="text-[10px] text-zinc-500 font-mono">{formattedDate}</span>
                        </div>
                      <p className="text-xs text-zinc-300 font-mono mt-1 break-words">{cleanDescription}</p>
                      
                      {suspectedCause && (
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase tracking-wider">
                            ⚠️ Suspected Cause: Space-switch / Gesture Swipe
                          </span>
                        </div>
                      )}

                      {awayDurationMs !== undefined && (
                        <div className="mt-1 flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase tracking-wider">
                            ⏱️ Away Duration: {(awayDurationMs / 1000).toFixed(1)} seconds
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="border-t border-white/10 pt-4 mt-4 flex justify-end flex-shrink-0">
              <button 
                onClick={() => setSelectedUserLogs(null)}
                className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white font-bold rounded-lg text-xs transition"
              >
                Close Logs
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
