import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { useNotify } from '../../components/notifications';

interface ProblemDetail {
  problemId: string;
  problem: {
    id: string;
    title: string;
    description: string;
  };
}

interface Submission {
  id: string;
  problemId: string;
  language: string;
  code: string;
  status: string;
  points: number;
  submittedAt: string;
}

interface IntegrityEvent {
  id: string;
  eventType: string;
  detectedAt: string;
  detail: any;
}

interface AuditLog {
  id: string;
  actorId: string;
  action: string;
  before: any;
  after: any;
  createdAt: string;
}

interface ReportData {
  contest: {
    id: string;
    title: string;
    description?: string;
    duration: number;
    maxWarnings: number;
    startTime: string;
    endTime: string;
    problems: ProblemDetail[];
  };
  participant: {
    id: string;
    userId: string;
    score: number;
    solvedCount: number;
    warnings: number;
    isTerminated: boolean;
    joinedAt: string;
    status: string;
    autoSubmitted: boolean;
    autoSubmittedAt?: string;
    user: {
      fullName: string;
      email: string;
    };
    dispute?: {
      status: 'SUBMITTED' | 'UNDER_REVIEW' | 'ACCEPTED' | 'REJECTED';
      reason: string;
      resolution?: string;
      resolvedAt?: string;
    } | null;
  };
  submissions: Submission[];
  integrityEvents: IntegrityEvent[];
  auditTrail: AuditLog[];
  percentile: number;
}

export function ContestAttemptReport() {
  const notify = useNotify();
  const { id, userId } = useParams<{ id: string; userId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ReportData | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<string>('');
  
  // Action states
  const [resetReason, setResetReason] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resolutionComment, setResolutionComment] = useState('');
  const [disputeActionLoading, setDisputeActionLoading] = useState(false);
  const [plagLoading, setPlagLoading] = useState(false);
  const [plagReport, setPlagReport] = useState<any>(null);

  useEffect(() => {
    fetchReport();
    fetchPlagiarism();
  }, [id, userId]);

  const fetchReport = async () => {
    try {
      setLoading(true);
      const data = await api.getParticipantContestReport(id!, userId!);
      setReport(data);
      if (data.contest.problems && data.contest.problems.length > 0) {
        setActiveSubTab(data.contest.problems[0].problemId);
      }
      setError(null);
    } catch (err: any) {
      console.error('Failed to load report:', err);
      setError(err.response?.data?.error || 'Failed to load candidate attempt details.');
    } finally {
      setLoading(false);
    }
  };

  const fetchPlagiarism = async () => {
    try {
      setPlagLoading(true);
      const data = await api.getPlagiarismReport(id!, userId!);
      setPlagReport(data);
    } catch (err) {
      console.error('Failed to fetch plagiarism report:', err);
    } finally {
      setPlagLoading(false);
    }
  };

  const handleResetWarnings = async () => {
    if (!report) return;
    const ok = await notify.confirm("Reset Warnings?", {
      description: "Are you sure you want to reset warning count to 0 and re-enable this attempt?",
      confirmLabel: "Reset",
      variant: "warning"
    });
    if (!ok) return;
    try {
      setResetLoading(true);
      await api.resetContestWarnings(report.contest.id, report.participant.userId, resetReason);
      setResetReason('');
      await fetchReport();
    } catch (err: any) {
      notify.toast.error(err.response?.data?.error || 'Failed to reset warnings.');
    } finally {
      setResetLoading(false);
    }
  };

  const handleResolveDispute = async (action: 'ACCEPT' | 'REJECT') => {
    if (!report) return;
    try {
      setDisputeActionLoading(true);
      await api.resolveContestDispute(report.contest.id, report.participant.userId, {
        action,
        resolution: resolutionComment
      });
      setResolutionComment('');
      await fetchReport();
    } catch (err: any) {
      notify.toast.error(err.response?.data?.error || 'Failed to resolve dispute.');
    } finally {
      setDisputeActionLoading(false);
    }
  };

  const getEventSeverity = (type: string): { label: string; bg: string; text: string } => {
    const t = type.toLowerCase();
    if (t.includes('rdp') || t.includes('vm') || t.includes('terminated') || t.includes('kill')) {
      return { label: 'Critical', bg: 'bg-red-500/10 border-red-500/20', text: 'text-red-400' };
    }
    if (t.includes('switch') || t.includes('blur') || t.includes('screen')) {
      return { label: 'Warning', bg: 'bg-amber-500/10 border-amber-500/20', text: 'text-amber-400' };
    }
    return { label: 'Info', bg: 'bg-zinc-500/10 border-zinc-500/20', text: 'text-zinc-400' };
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[var(--accent-green)]" />
          <p className="text-sm text-gray-400">Loading attempt details...</p>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-white p-4">
        <div className="max-w-md w-full text-center space-y-4 bg-zinc-900 border border-white/10 rounded-2xl p-8">
          <svg className="w-12 h-12 text-red-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h2 className="text-xl font-bold">Error Loading Report</h2>
          <p className="text-sm text-gray-400">{error || 'Unable to access candidate report.'}</p>
          <button onClick={() => navigate(-1)} className="px-5 py-2 bg-zinc-800 hover:bg-zinc-700 font-semibold rounded-xl text-sm transition">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const activeProbSubmissions = report.submissions.filter(s => s.problemId === activeSubTab);
  const maxScore = report.contest.problems.length * 100;

  return (
    <div className="min-h-screen bg-zinc-950 text-white pb-16 font-sans">
      {/* Header section */}
      <div className="border-b border-white/10 bg-zinc-900/50 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-2 hover:bg-zinc-800 rounded-lg text-gray-400 hover:text-white transition">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <div>
              <h1 className="text-lg font-bold truncate max-w-md">{report.contest.title}</h1>
              <p className="text-xs text-gray-400">Instructor Attempt Evaluation</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a
              href={api.getContestReportDownloadUrl(report.contest.id, report.participant.userId)}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-sm font-semibold rounded-xl text-gray-300 hover:text-white transition flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Download PDF Audit
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 mt-8 space-y-6">
        {/* Banner metadata */}
        <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-2xl font-black text-white tracking-tight">{report.participant.user.fullName}</h2>
            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs md:text-sm text-gray-400">
              <span>Email: <strong className="text-white">{report.participant.user.email}</strong></span>
              <span>•</span>
              <span>Joined: <strong className="text-white">{new Date(report.participant.joinedAt).toLocaleString()}</strong></span>
              <span>•</span>
              {report.participant.autoSubmitted && (
                <span className="text-red-400">Auto-Submitted (Threshold violation)</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {report.participant.isTerminated ? (
              <span className="px-3 py-1.5 bg-red-500/20 text-red-400 text-xs uppercase font-extrabold rounded-xl border border-red-500/30">
                Terminated / Blocked
              </span>
            ) : report.participant.status === 'COMPLETED' ? (
              <span className="px-3 py-1.5 bg-green-500/20 text-[var(--accent-green)] text-xs uppercase font-extrabold rounded-xl border border-green-500/30">
                Attempt Finalized
              </span>
            ) : (
              <span className="px-3 py-1.5 bg-yellow-500/20 text-yellow-400 text-xs uppercase font-extrabold rounded-xl border border-yellow-500/30">
                In Sandbox Active
              </span>
            )}
          </div>
        </div>

        {/* Score & metrics grids */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* ScoreCircle */}
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 flex flex-col items-center text-center">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Total Score</h3>
            <div className="text-3xl font-black text-white">{report.participant.score} <span className="text-xs text-gray-500">/ {maxScore}</span></div>
            <p className="text-xs text-gray-500 mt-2">Rank percentile: {report.percentile}%</p>
          </div>

          {/* Solved */}
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 flex flex-col items-center text-center">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Problems Solved</h3>
            <div className="text-3xl font-black text-white">{report.participant.solvedCount} <span className="text-xs text-gray-500">/ {report.contest.problems.length}</span></div>
            <p className="text-xs text-gray-500 mt-2">Verified testcase passes</p>
          </div>

          {/* Plagiarism similarity */}
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 flex flex-col items-center text-center">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Similarity check</h3>
            <div className={`text-3xl font-black ${plagReport && plagReport.similarityScore > 50 ? 'text-red-400' : 'text-white'}`}>
              {plagLoading ? 'Checking...' : plagReport ? `${plagReport.similarityScore}%` : '0%'}
            </div>
            <p className="text-xs text-gray-500 mt-2">JPlag database search matches</p>
          </div>

          {/* Flags / warnings */}
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 flex flex-col items-center text-center">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Proctor warnings</h3>
            <div className="text-3xl font-black text-white">{report.participant.warnings} <span className="text-xs text-gray-500">/ {report.contest.maxWarnings}</span></div>
            <p className="text-xs text-gray-500 mt-2">Tab switches and window blurs</p>
          </div>
        </div>

        {/* Dispute appeal resolve actions & timeline audits */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Resolution form / actions */}
            {report.participant.dispute && (
              <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                  <span>⚖️ Appeal Dispute Request Resolution</span>
                </h3>
                <div className="p-4 bg-zinc-950 border border-white/5 rounded-xl space-y-3 mb-4">
                  <span className="block text-[10px] text-gray-500 uppercase tracking-wider">Appeal Status: <strong className="text-yellow-400">{report.participant.dispute.status}</strong></span>
                  <span className="block text-xs font-bold text-white mb-1">Student Statement:</span>
                  <p className="text-xs text-gray-300 whitespace-pre-wrap">{report.participant.dispute.reason}</p>
                </div>

                {report.participant.dispute.status === 'SUBMITTED' ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Resolution Comments</label>
                      <textarea
                        value={resolutionComment}
                        onChange={e => setResolutionComment(e.target.value)}
                        placeholder="State reason for accepting dispute (e.g. verified Wi-Fi drop) or declining dispute..."
                        className="w-full h-20 bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-green-500 resize-none transition"
                      />
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleResolveDispute('ACCEPT')}
                        disabled={disputeActionLoading}
                        className="flex-1 py-2 bg-[var(--accent-green)] hover:opacity-90 disabled:opacity-50 text-black font-extrabold text-xs rounded-xl transition"
                      >
                        Accept Appeal & Reset Warnings
                      </button>
                      <button
                        onClick={() => handleResolveDispute('REJECT')}
                        disabled={disputeActionLoading}
                        className="flex-1 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 font-extrabold text-xs rounded-xl border border-red-500/20 transition"
                      >
                        Decline Appeal / Lock Attempt
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-zinc-950 border border-white/5 rounded-xl text-xs text-gray-400">
                    Resolution note: <span className="text-white">{report.participant.dispute.resolution || 'No note added.'}</span>
                  </div>
                )}
              </div>
            )}

            {/* Warn override block */}
            {!report.participant.dispute && (
              <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                  <span>⚙️ Override Proctor Safeguards</span>
                </h3>
                <div className="space-y-4">
                  <p className="text-xs text-gray-400">
                    If this candidate was locked out due to accidental blurs or network drop blips, you can reset their warnings count to 0. This re-opens their Secure Environment attempt.
                  </p>
                  <div className="flex gap-3 items-end">
                    <div className="flex-1">
                      <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Reason / Note for Reset</label>
                      <input
                        type="text"
                        value={resetReason}
                        onChange={e => setResetReason(e.target.value)}
                        placeholder="Wi-Fi drop verified, hardware issue..."
                        className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-green-500 transition"
                      />
                    </div>
                    <button
                      onClick={handleResetWarnings}
                      disabled={resetLoading}
                      className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs rounded-xl border border-white/10 transition shrink-0"
                    >
                      {resetLoading ? 'Resetting...' : 'Reset Warning Count'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Submissions explorer */}
            <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                <span>📁 Submitted Solution Artifacts</span>
              </h3>
              <div className="flex border-b border-white/10 mb-4 overflow-x-auto">
                {report.contest.problems.map(prob => (
                  <button
                    key={prob.problemId}
                    onClick={() => setActiveSubTab(prob.problemId)}
                    className={`py-2 px-4 text-xs font-semibold border-b-2 whitespace-nowrap transition ${
                      activeSubTab === prob.problemId
                        ? 'border-[var(--accent-green)] text-white'
                        : 'border-transparent text-gray-400 hover:text-white'
                    }`}
                  >
                    {prob.problem.title}
                  </button>
                ))}
              </div>
              <div className="min-h-[300px] flex flex-col">
                {activeProbSubmissions.length > 0 ? (
                  <div className="flex-1 flex flex-col space-y-3">
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span>Language: <strong className="text-white">{activeProbSubmissions[0].language}</strong></span>
                      <span>Submitted: {new Date(activeProbSubmissions[0].submittedAt).toLocaleString()}</span>
                    </div>
                    <pre className="flex-1 bg-zinc-950 text-gray-300 font-mono text-xs p-4 rounded-xl border border-white/5 overflow-x-auto select-text">
                      <code>{activeProbSubmissions[0].code}</code>
                    </pre>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
                    <p className="text-xs text-gray-500">No submissions uploaded for this problem.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {/* Audit log history */}
            <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                <span>📜 Administrator Action Logs</span>
              </h3>
              {report.auditTrail.length === 0 ? (
                <p className="text-xs text-gray-500 py-6 text-center">No overrides performed yet.</p>
              ) : (
                <div className="space-y-3">
                  {report.auditTrail.map(log => (
                    <div key={log.id} className="p-3 border border-white/5 rounded-xl bg-zinc-950/40 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-[var(--accent-green)]">{log.action}</span>
                        <span className="text-[9px] text-gray-500">{new Date(log.createdAt).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-[10px] text-gray-400">Actor ID: {log.actorId.slice(0, 8)}</p>
                      {log.after && log.after.resolution && (
                        <p className="text-[10px] text-zinc-400 italic">"{log.after.resolution}"</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Proctor timeline logs */}
            <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                <span>🛡️ Proctor Log Timeline</span>
              </h3>
              {report.integrityEvents.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-6">No integrity incidents logged.</p>
              ) : (
                <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                  {report.integrityEvents.map(evt => {
                    const sev = getEventSeverity(evt.eventType);
                    return (
                      <div key={evt.id} className="p-3 border border-white/5 rounded-xl bg-zinc-950/40 flex flex-col gap-1 text-xs">
                        <div className="flex items-center justify-between">
                          <span className={`px-2 py-0.5 text-[10px] uppercase font-bold rounded-md border ${sev.bg} ${sev.text}`}>
                            {sev.label}
                          </span>
                          <span className="text-[10px] text-gray-500">{new Date(evt.detectedAt).toLocaleTimeString()}</span>
                        </div>
                        <span className="font-semibold text-white">{evt.eventType.replace(/_/g, ' ')}</span>
                        {evt.detail && (
                          <span className="text-gray-400 font-mono text-[10px] select-text">
                            {JSON.stringify(evt.detail)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
