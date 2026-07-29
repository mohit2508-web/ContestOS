import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

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
  _count: { participants: number; problems: number };
}

interface Assignment {
  contestId: string;
  role: string;
  contest: Contest;
}

interface Participant {
  user: { id: string; fullName: string; name?: string; email: string };
  score: number;
  solvedCount: number;
  warnings?: number;
  isTerminated?: boolean;
}

interface SecurityLog {
  id: string;
  userId: string;
  eventType: string;
  description: string;
  createdAt: string;
  user?: { fullName: string; name?: string; email: string };
}

type Tab = 'contests' | 'command' | 'results';

function getContestStatus(contest: Contest): 'LIVE' | 'UPCOMING' | 'ENDED' {
  const now = Date.now();
  const start = new Date(contest.startTime).getTime();
  const end = new Date(contest.endTime).getTime();
  if (now >= start && now <= end) return 'LIVE';
  if (now < start) return 'UPCOMING';
  return 'ENDED';
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'LIVE') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-green-500/15 text-green-400 border border-green-500/30">
        <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
        Live
      </span>
    );
  }
  if (status === 'UPCOMING') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30">
        Upcoming
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-zinc-700/50 text-zinc-400 border border-zinc-600/30">
      Ended
    </span>
  );
}

function RoleBadge({ role }: { role: string }) {
  const label = role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return (
    <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-purple-500/15 text-purple-400 border border-purple-500/30">
      {label}
    </span>
  );
}

export function MemberDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('contests');
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedContest, setSelectedContest] = useState<Contest | null>(null);
  const [selectedRole, setSelectedRole] = useState('');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [logs, setLogs] = useState<SecurityLog[]>([]);
  const [monitorLoading, setMonitorLoading] = useState(false);

  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [resultsContestId, setResultsContestId] = useState('');
  const [resultsLoading, setResultsLoading] = useState(false);

  const logsEndRef = useRef<HTMLDivElement>(null);

  const loadAssignedContests = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getTeacherManagedContests();
      const allContests = data.contests || [];
      const enriched: Assignment[] = allContests.map((c: any) => ({
        contestId: c.id,
        role: c.myRole || 'PROCTOR',
        contest: c,
      }));
      setAssignments(enriched);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load assigned contests');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAssignedContests();
  }, [loadAssignedContests]);

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const openCommandCenter = async (assignment: Assignment) => {
    setSelectedContest(assignment.contest);
    setSelectedRole(assignment.role);
    setActiveTab('command');
    setMonitorLoading(true);
    try {
      const [lbRes, logRes] = await Promise.all([
        api.getContestLeaderboard(assignment.contestId),
        api.getContestLogs(assignment.contestId),
      ]);
      setParticipants(lbRes.leaderboard || []);
      setLogs(logRes.logs || []);
    } catch {
      console.error('Failed to load command center data');
    } finally {
      setMonitorLoading(false);
    }
  };

  const openResults = async (contestId: string) => {
    setResultsContestId(contestId);
    setActiveTab('results');
    setResultsLoading(true);
    try {
      const res = await api.getContestLeaderboard(contestId);
      setLeaderboard(res.leaderboard || []);
    } catch {
      setLeaderboard([]);
    } finally {
      setResultsLoading(false);
    }
  };

  const refreshMonitor = async () => {
    if (!selectedContest) return;
    try {
      const lbRes = await api.getContestLeaderboard(selectedContest.id);
      setParticipants(lbRes.leaderboard || []);
      const logRes = await api.getContestLogs(selectedContest.id);
      setLogs(logRes.logs || []);
    } catch {
      console.error('Refresh failed');
    }
  };

  const proctorAction = async (action: string, userId?: string, extra?: Record<string, any>) => {
    if (!selectedContest) return;
    try {
      await api.client.post(`/contests/manager/${selectedContest.id}/proctor-action`, {
        action,
        userId,
        ...extra,
      });
      await refreshMonitor();
    } catch (err: any) {
      console.error('Proctor action failed:', err.message);
    }
  };

  const nudgeUser = (userId: string) => proctorAction('nudge', userId);
  const forceFullscreen = (userId: string) => proctorAction('force_fullscreen', userId);
  const extendTime = (userId: string) => {
    const mins = prompt('Extend time by (minutes):');
    if (mins && !isNaN(Number(mins))) {
      proctorAction('extend_time', userId, { minutes: Number(mins) });
    }
  };
  const forceSubmit = (userId: string) => {
    if (window.confirm('Force submit this participant\'s attempt?')) {
      proctorAction('force_submit', userId);
    }
  };

  const renderContestCards = () => {
    if (loading) {
      return (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400" />
        </div>
      );
    }

    if (error) {
      return <div className="text-red-400 text-center py-20">{error}</div>;
    }

    if (assignments.length === 0) {
      return (
        <div className="text-center py-20 bg-zinc-950 rounded-xl border border-white/10">
          <div className="text-4xl mb-4 opacity-50">📋</div>
          <p className="text-gray-400 font-medium text-sm">No contests assigned yet. Contact your admin to get assigned.</p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {assignments.map(a => {
          const status = getContestStatus(a.contest);
          const c = a.contest;
          return (
            <div
              key={a.contestId}
              className="bg-zinc-950 border border-white/10 rounded-2xl p-5 hover:border-purple-500/40 transition-all shadow-xl flex flex-col"
            >
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-extrabold text-lg text-white leading-tight">{c.title}</h3>
                <StatusBadge status={status} />
              </div>

              <div className="space-y-1 mb-3 text-sm text-gray-400 font-mono">
                <p>Starts: {new Date(c.startTime).toLocaleString()}</p>
                <p>Ends: {new Date(c.endTime).toLocaleString()}</p>
                <p>Duration: {c.duration} min</p>
                <p>Participants: {c._count?.participants || 0}</p>
              </div>

              <div className="flex items-center gap-2 mb-4">
                <RoleBadge role={a.role} />
                {c.enableProctoring && (
                  <span className="text-[10px] px-2 py-0.5 bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded font-bold">
                    Proctored
                  </span>
                )}
                {c.requireSeb && (
                  <span className="text-[10px] px-2 py-0.5 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded font-bold">
                    SEB
                  </span>
                )}
              </div>

              <div className="mt-auto flex flex-wrap gap-2">
                {status === 'LIVE' && (
                  <button
                    onClick={() => openCommandCenter(a)}
                    className="flex-1 py-2 bg-purple-600 hover:bg-purple-500 text-white font-extrabold rounded-xl text-xs transition-all shadow-md shadow-purple-600/20 flex items-center justify-center gap-1.5"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    Monitor
                  </button>
                )}
                <button
                  onClick={() => openResults(a.contestId)}
                  className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl text-xs transition-all border border-white/10 flex items-center justify-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Results
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderCommandCenter = () => {
    if (!selectedContest) {
      return (
        <div className="text-center py-20 bg-zinc-950 rounded-xl border border-white/10">
          <p className="text-gray-400 text-sm">Select a live contest from My Assigned Contests to open the command center.</p>
        </div>
      );
    }

    const isLive = getContestStatus(selectedContest) === 'LIVE';

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-950 border border-white/10 rounded-2xl p-5">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-extrabold text-white">{selectedContest.title}</h2>
              <StatusBadge status={getContestStatus(selectedContest)} />
            </div>
            <p className="text-xs text-gray-400 mt-1 font-mono">
              Role: <span className="text-purple-400 font-bold">{selectedRole.replace(/_/g, ' ').toUpperCase()}</span>
              &nbsp;|&nbsp;{participants.length} participant(s)
            </p>
          </div>
          <button
            onClick={refreshMonitor}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl text-xs border border-white/10 transition flex items-center gap-1.5 self-start"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>

        {monitorLoading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-gray-400 uppercase tracking-wider">
                  Participants ({participants.length})
                </h3>
                {!isLive && (
                  <span className="text-[10px] text-yellow-400 font-bold">
                    Contest is not live — proctor actions disabled
                  </span>
                )}
              </div>

              {participants.length === 0 ? (
                <div className="text-center py-12 bg-zinc-950 border border-white/10 rounded-xl">
                  <p className="text-gray-500 text-sm">No participants registered yet.</p>
                </div>
              ) : (
                <div className="border border-white/10 rounded-xl overflow-hidden bg-zinc-950">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs font-mono border-collapse">
                      <thead>
                        <tr className="bg-black/40 border-b border-white/10 text-gray-400 uppercase text-[9px] tracking-wider font-bold">
                          <th className="p-3">Participant</th>
                          <th className="p-3 text-center">Score</th>
                          <th className="p-3 text-center">Solved</th>
                          <th className="p-3 text-center">Warnings</th>
                          <th className="p-3 text-center">Status</th>
                          <th className="p-3 text-right">Proctor Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {participants.map(p => {
                          const isDisq = p.isTerminated || (p.warnings || 0) >= (selectedContest._count?.participants ? 3 : 3);
                          return (
                            <tr key={p.user.id} className={`hover:bg-white/5 transition ${isDisq ? 'bg-red-500/5' : ''}`}>
                              <td className="p-3">
                                <div className="font-bold text-white text-xs">{p.user?.name || p.user?.fullName || 'Participant'}</div>
                                <div className="text-[10px] text-gray-500">{p.user.email}</div>
                              </td>
                              <td className="p-3 font-bold text-center text-white">{p.score}</td>
                              <td className="p-3 font-bold text-center text-white">{p.solvedCount}</td>
                              <td className="p-3 text-center">
                                <span className={p.warnings && p.warnings > 0 ? 'text-yellow-400 font-bold' : 'text-zinc-500'}>
                                  {p.warnings || 0}
                                </span>
                              </td>
                              <td className="p-3 text-center">
                                {p.isTerminated ? (
                                  <span className="px-2 py-0.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded text-[9px] font-extrabold uppercase">
                                    Disqualified
                                  </span>
                                ) : (p.warnings || 0) > 0 ? (
                                  <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded text-[9px] font-extrabold uppercase animate-pulse">
                                    Warning
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 bg-green-500/20 text-green-400 border border-green-500/30 rounded text-[9px] font-extrabold uppercase">
                                    Active
                                  </span>
                                )}
                              </td>
                              <td className="p-3 text-right">
                                <div className="flex justify-end gap-1">
                                  <button
                                    onClick={() => nudgeUser(p.user.id)}
                                    disabled={!isLive}
                                    title="Nudge"
                                    className="p-1.5 bg-white/5 hover:bg-yellow-500/20 text-yellow-400 rounded transition disabled:opacity-30 disabled:cursor-not-allowed border border-white/5"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => forceFullscreen(p.user.id)}
                                    disabled={!isLive}
                                    title="Force Fullscreen"
                                    className="p-1.5 bg-white/5 hover:bg-blue-500/20 text-blue-400 rounded transition disabled:opacity-30 disabled:cursor-not-allowed border border-white/5"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => extendTime(p.user.id)}
                                    disabled={!isLive}
                                    title="Extend Time"
                                    className="p-1.5 bg-white/5 hover:bg-purple-500/20 text-purple-400 rounded transition disabled:opacity-30 disabled:cursor-not-allowed border border-white/5"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => forceSubmit(p.user.id)}
                                    disabled={!isLive}
                                    title="Force Submit"
                                    className="p-1.5 bg-white/5 hover:bg-red-500/20 text-red-400 rounded transition disabled:opacity-30 disabled:cursor-not-allowed border border-white/5"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                    </svg>
                                  </button>
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

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-gray-400 uppercase tracking-wider">Security Feed</h3>
                {isLive && <span className="w-2 h-2 bg-red-500 rounded-full animate-ping" />}
              </div>

              <div className="border border-white/10 bg-zinc-950 rounded-xl p-4 h-[500px] overflow-y-auto flex flex-col gap-2 custom-scrollbar">
                {logs.length === 0 ? (
                  <p className="text-gray-500 text-xs italic text-center py-20 font-mono">
                    No security events recorded yet.
                  </p>
                ) : (
                  logs.map(log => {
                    const isBreach =
                      log.eventType.startsWith('SEB_') ||
                      log.eventType === 'warnings_exceeded' ||
                      log.eventType === 'TAB_SWITCH' ||
                      log.eventType === 'FULLSCREEN_EXIT' ||
                      log.eventType === 'SCREENSHOT_ATTEMPT';
                    const isGood =
                      log.eventType === 'SEB_SESSION_START' ||
                      log.eventType === 'warnings_reset' ||
                      log.eventType === 'contest_resumed';

                    return (
                      <div
                        key={log.id}
                        className={`p-2.5 rounded-lg border text-[11px] font-mono leading-relaxed transition ${
                          isBreach
                            ? 'border-red-500/20 bg-red-500/5 text-red-300'
                            : isGood
                              ? 'border-green-500/20 bg-green-500/5 text-green-300'
                              : 'border-white/5 bg-white/[0.02] text-zinc-300'
                        }`}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-black uppercase tracking-wider">{log.eventType}</span>
                          <span className="text-[9px] text-zinc-500">
                            {new Date(log.createdAt).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="break-words font-sans text-zinc-400">
                          <span className="font-bold text-white font-mono mr-1.5">
                            {log.user?.name || log.user?.fullName || 'System'}:
                          </span>
                          {log.description}
                        </p>
                      </div>
                    );
                  })
                )}
                <div ref={logsEndRef} />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderResults = () => {
    const contestEntry = resultsContestId
      ? assignments.find(a => a.contestId === resultsContestId)
      : null;

    if (!resultsContestId) {
      return (
        <div className="space-y-6">
          <h3 className="font-bold text-sm text-gray-400 uppercase tracking-wider">Select a Contest for Results</h3>
          {assignments.length === 0 ? (
            <div className="text-center py-16 bg-zinc-950 rounded-xl border border-white/10">
              <p className="text-gray-500 text-sm">No contests assigned.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {assignments.map(a => (
                <button
                  key={a.contestId}
                  onClick={() => openResults(a.contestId)}
                  className="text-left bg-zinc-950 border border-white/10 rounded-xl p-4 hover:border-purple-500/40 transition-all"
                >
                  <div className="font-extrabold text-white text-sm">{a.contest.title}</div>
                  <div className="text-xs text-gray-400 mt-1 font-mono">
                    {new Date(a.contest.startTime).toLocaleDateString()} | {a.contest._count?.participants || 0} participants
                  </div>
                  <div className="mt-2">
                    <StatusBadge status={getContestStatus(a.contest)} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-extrabold text-white">
              {contestEntry?.contest.title || 'Contest'} — Leaderboard
            </h3>
            <p className="text-xs text-gray-400 mt-1 font-mono">
              {leaderboard.length} participant(s)
            </p>
          </div>
          <button
            onClick={() => setResultsContestId('')}
            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white text-xs font-bold rounded-lg border border-white/10 transition"
          >
            ← Back
          </button>
        </div>

        {resultsLoading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400" />
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="text-center py-16 bg-zinc-950 rounded-xl border border-white/10">
            <p className="text-gray-500 text-sm">No leaderboard data available for this contest.</p>
          </div>
        ) : (
          <div className="border border-white/10 rounded-xl overflow-hidden bg-zinc-950">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono border-collapse">
                <thead>
                  <tr className="bg-black/40 border-b border-white/10 text-gray-400 uppercase text-[9px] tracking-wider font-bold">
                    <th className="p-3 w-16 text-center">#</th>
                    <th className="p-3">Participant</th>
                    <th className="p-3 text-center">Score</th>
                    <th className="p-3 text-center">Solved</th>
                    <th className="p-3 text-center">Warnings</th>
                    <th className="p-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {leaderboard.map((entry: any, idx: number) => {
                    const rank = idx + 1;
                    const medal =
                      rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;
                    return (
                      <tr key={entry.user?.id || idx} className="hover:bg-white/5 transition">
                        <td className="p-3 text-center">
                          {medal ? (
                            <span className="text-lg">{medal}</span>
                          ) : (
                            <span className="text-gray-500 font-bold">{rank}</span>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="font-bold text-white text-xs">{entry.user?.name || entry.user?.fullName || 'Participant'}</div>
                          <div className="text-[10px] text-gray-500">{entry.user?.email || ''}</div>
                        </td>
                        <td className="p-3 text-center font-extrabold text-white">{entry.score}</td>
                        <td className="p-3 text-center font-bold text-white">{entry.solvedCount}</td>
                        <td className="p-3 text-center">
                          <span className={entry.warnings > 0 ? 'text-yellow-400 font-bold' : 'text-zinc-500'}>
                            {entry.warnings || 0}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          {entry.isTerminated ? (
                            <span className="px-2 py-0.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded text-[9px] font-extrabold uppercase">
                              Disqualified
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-green-500/20 text-green-400 border border-green-500/30 rounded text-[9px] font-extrabold uppercase">
                              Active
                            </span>
                          )}
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
    );
  };

  const tabs: { key: Tab; label: string; icon: JSX.Element }[] = [
    {
      key: 'contests',
      label: 'My Assigned Contests',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
    },
    {
      key: 'command',
      label: 'Live Command Center',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      ),
    },
    {
      key: 'results',
      label: 'Results',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight">
                Member Dashboard<span className="text-purple-400">.</span>
              </h1>
              <p className="text-gray-400 mt-1">
                Welcome back{user?.name ? `, ${user.name}` : ''}. Manage your assigned contests.
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-1 mb-8 bg-zinc-950 border border-white/10 rounded-xl p-1 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${
                activeTab === tab.key
                  ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'contests' && renderContestCards()}
        {activeTab === 'command' && renderCommandCenter()}
        {activeTab === 'results' && renderResults()}
      </div>
    </div>
  );
}
