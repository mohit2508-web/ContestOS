import { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useNotify } from '../../components/notifications';

interface EvaluatorStats {
  assignedContests: number;
  totalSubmissions: number;
  gradedSubmissions: number;
  pendingSubmissions: number;
}

interface Submission {
  id: string;
  anonymousId: string;
  problemTitle: string;
  difficulty: string;
  language: string;
  code: string;
  submittedAt: string;
  status: 'PENDING' | 'GRADED';
  score?: number;
  comments?: string;
  contestTitle: string;
  contestId: string;
}

export function EvaluatorDashboard() {
  const { user } = useAuth();
  const notify = useNotify();

  const [stats, setStats] = useState<EvaluatorStats>({
    assignedContests: 0,
    totalSubmissions: 0,
    gradedSubmissions: 0,
    pendingSubmissions: 0,
  });

  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [filterContest, setFilterContest] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  const [expandedCode, setExpandedCode] = useState<Record<string, boolean>>({});
  const [gradeScores, setGradeScores] = useState<Record<string, number>>({});
  const [gradeComments, setGradeComments] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<Record<string, boolean>>({});

  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingSubmissions, setLoadingSubmissions] = useState(true);
  const [activeTab, setActiveTab] = useState<'queue' | 'history'>('queue');

  const [history, setHistory] = useState<Submission[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [assignedContestsList, setAssignedContestsList] = useState<{ id: string; title: string }[]>([]);

  const loadStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const data = await api.getEvaluatorStats();
      setStats(data.stats || { assignedContests: 0, totalSubmissions: 0, gradedSubmissions: 0, pendingSubmissions: 0 });
    } catch (err) {
      console.error('Failed to load evaluator stats:', err);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  const loadSubmissions = useCallback(async (page: number, contestId?: string, status?: string) => {
    setLoadingSubmissions(true);
    try {
      const data = await api.getAssignedSubmissions(
        contestId === 'all' ? undefined : contestId,
        page
      );
      let filtered = data.submissions || [];
      if (status && status !== 'all') {
        filtered = filtered.filter((s: Submission) => s.status === status);
      }
      setSubmissions(filtered);
      setTotalPages(data.totalPages || 1);
      setAssignedContestsList(data.contests || []);
    } catch (err) {
      console.error('Failed to load submissions:', err);
    } finally {
      setLoadingSubmissions(false);
    }
  }, []);

  const loadHistory = useCallback(async (page: number) => {
    setLoadingHistory(true);
    try {
      const data = await api.getAssignedSubmissions(undefined, page);
      const graded = (data.submissions || []).filter((s: Submission) => s.status === 'GRADED');
      setHistory(graded);
      setHistoryTotalPages(data.totalPages || 1);
    } catch (err) {
      console.error('Failed to load grading history:', err);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    if (activeTab === 'queue') {
      loadSubmissions(currentPage, filterContest, filterStatus);
    } else {
      loadHistory(historyPage);
    }
  }, [activeTab, currentPage, historyPage, filterContest, filterStatus, loadSubmissions, loadHistory]);

  const handleGrade = async (submissionId: string) => {
    const score = gradeScores[submissionId];
    const comments = gradeComments[submissionId] || '';

    if (score === undefined || score < 0 || score > 100) {
      notify.toast.error('Score must be between 0 and 100');
      return;
    }

    setSubmitting(prev => ({ ...prev, [submissionId]: true }));
    try {
      await api.gradeSubmission(submissionId, score, comments);
      notify.toast.success('Grade submitted successfully');
      loadSubmissions(currentPage, filterContest, filterStatus);
      loadStats();
    } catch (err: any) {
      notify.toast.error(err.response?.data?.error || 'Failed to submit grade');
    } finally {
      setSubmitting(prev => ({ ...prev, [submissionId]: false }));
    }
  };

  const toggleCode = (id: string) => {
    setExpandedCode(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    if (score >= 40) return 'text-orange-400';
    return 'text-red-400';
  };

  const getDifficultyBadge = (diff: string) => {
    switch (diff) {
      case 'Easy':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'Medium':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'Hard':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      default:
        return 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'GRADED':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      default:
        return 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30';
    }
  };

  const progressPercent = stats.totalSubmissions > 0
    ? Math.round((stats.gradedSubmissions / stats.totalSubmissions) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
              <span className="text-cyan-400 text-lg font-bold">E</span>
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight">
                Evaluator Dashboard
              </h1>
              <p className="text-zinc-400 text-sm mt-0.5">
                Blind evaluation · Submissions are anonymous
              </p>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-zinc-950 border border-white/10 rounded-xl p-5">
            <div className="text-zinc-500 text-xs font-semibold uppercase tracking-wider mb-2">
              Assigned Contests
            </div>
            {loadingStats ? (
              <div className="animate-pulse bg-white/5 h-8 w-16 rounded" />
            ) : (
              <div className="text-3xl font-black text-cyan-400">
                {stats.assignedContests}
              </div>
            )}
          </div>

          <div className="bg-zinc-950 border border-white/10 rounded-xl p-5">
            <div className="text-zinc-500 text-xs font-semibold uppercase tracking-wider mb-2">
              Total Submissions
            </div>
            {loadingStats ? (
              <div className="animate-pulse bg-white/5 h-8 w-16 rounded" />
            ) : (
              <div className="text-3xl font-black text-white">
                {stats.totalSubmissions}
              </div>
            )}
          </div>

          <div className="bg-zinc-950 border border-white/10 rounded-xl p-5">
            <div className="text-zinc-500 text-xs font-semibold uppercase tracking-wider mb-2">
              Graded
            </div>
            {loadingStats ? (
              <div className="animate-pulse bg-white/5 h-8 w-16 rounded" />
            ) : (
              <div className="text-3xl font-black text-green-400">
                {stats.gradedSubmissions}
              </div>
            )}
          </div>

          <div className="bg-zinc-950 border border-white/10 rounded-xl p-5">
            <div className="text-zinc-500 text-xs font-semibold uppercase tracking-wider mb-2">
              Pending
            </div>
            {loadingStats ? (
              <div className="animate-pulse bg-white/5 h-8 w-16 rounded" />
            ) : (
              <div className="text-3xl font-black text-yellow-400">
                {stats.pendingSubmissions}
              </div>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="bg-zinc-950 border border-white/10 rounded-xl p-5 mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-zinc-500 text-xs font-semibold uppercase tracking-wider">
              Evaluation Progress
            </span>
            <span className="text-cyan-400 text-sm font-bold">
              {progressPercent}%
            </span>
          </div>
          <div className="w-full bg-zinc-800 rounded-full h-3">
            <div
              className="bg-gradient-to-r from-cyan-500 to-cyan-400 h-3 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-zinc-500">
            <span>{stats.gradedSubmissions} graded</span>
            <span>{stats.pendingSubmissions} remaining</span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1 mb-6 bg-zinc-950 border border-white/10 rounded-xl p-1 w-fit">
          <button
            onClick={() => setActiveTab('queue')}
            className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${
              activeTab === 'queue'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            Submission Queue
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${
              activeTab === 'history'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            Graded History
          </button>
        </div>

        {/* Filters (Queue tab only) */}
        {activeTab === 'queue' && (
          <div className="flex flex-wrap gap-3 mb-6">
            <select
              value={filterContest}
              onChange={(e) => {
                setFilterContest(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-zinc-950 border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:border-cyan-500 outline-none"
            >
              <option value="all">All Contests</option>
              {assignedContestsList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>

            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-zinc-950 border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:border-cyan-500 outline-none"
            >
              <option value="all">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="GRADED">Graded</option>
            </select>
          </div>
        )}

        {/* Loading Spinner */}
        {(loadingSubmissions || loadingHistory) && (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400" />
          </div>
        )}

        {/* Empty State */}
        {!loadingSubmissions && !loadingHistory && (
          <>
            {activeTab === 'queue' && submissions.length === 0 && (
              <div className="text-center py-20 bg-zinc-950 border border-white/10 rounded-xl">
                <div className="text-zinc-600 text-4xl mb-4">📋</div>
                <p className="text-zinc-400 font-medium">
                  No submissions to evaluate. Check back later.
                </p>
              </div>
            )}

            {activeTab === 'history' && history.length === 0 && (
              <div className="text-center py-20 bg-zinc-950 border border-white/10 rounded-xl">
                <div className="text-zinc-600 text-4xl mb-4">📝</div>
                <p className="text-zinc-400 font-medium">
                  No graded submissions yet.
                </p>
              </div>
            )}
          </>
        )}

        {/* Submission Queue */}
        {activeTab === 'queue' && !loadingSubmissions && submissions.length > 0 && (
          <div className="space-y-4">
            {submissions.map((sub) => (
              <div
                key={sub.id}
                className="bg-zinc-950 border border-white/10 rounded-xl overflow-hidden"
              >
                {/* Submission Header */}
                <div className="p-5 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-cyan-400 font-mono text-sm font-bold">
                      Submission #{sub.anonymousId}
                    </span>
                    <span className="text-zinc-700">·</span>
                    <span className="text-white text-sm font-medium">
                      {sub.problemTitle}
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded border font-bold ${getDifficultyBadge(
                        sub.difficulty
                      )}`}
                    >
                      {sub.difficulty}
                    </span>
                    <span className="text-zinc-600 text-xs font-mono">
                      {sub.language}
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded border font-bold ${getStatusBadge(
                        sub.status
                      )}`}
                    >
                      {sub.status}
                    </span>
                  </div>
                  <div className="text-zinc-500 text-xs">
                    {new Date(sub.submittedAt).toLocaleString()}
                  </div>
                </div>

                {/* Code Preview Toggle */}
                <div className="px-5 pb-3">
                  <button
                    onClick={() => toggleCode(sub.id)}
                    className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1 transition"
                  >
                    <span className={`transition-transform ${expandedCode[sub.id] ? 'rotate-90' : ''}`}>
                      ▶
                    </span>
                    {expandedCode[sub.id] ? 'Hide Code' : 'Preview Code'}
                  </button>
                </div>

                {/* Code Block */}
                {expandedCode[sub.id] && (
                  <div className="mx-5 mb-5 bg-black border border-white/10 rounded-lg p-4 font-mono text-xs overflow-x-auto max-h-80 overflow-y-auto custom-scrollbar">
                    <pre className="text-zinc-300 whitespace-pre-wrap break-words">
                      {sub.code || '// No code submitted'}
                    </pre>
                  </div>
                )}

                {/* Grading Section */}
                {sub.status === 'PENDING' && (
                  <div className="border-t border-white/10 p-5 space-y-4">
                    <div className="flex flex-wrap items-end gap-4">
                      {/* Score Input */}
                      <div className="flex-1 min-w-[200px]">
                        <label className="block text-xs text-zinc-500 font-semibold uppercase tracking-wider mb-2">
                          Score (0–100)
                        </label>
                        <div className="flex items-center gap-3">
                          <input
                            type="range"
                            min="0"
                            max="100"
                            step="1"
                            value={gradeScores[sub.id] ?? 50}
                            onChange={(e) =>
                              setGradeScores((prev) => ({
                                ...prev,
                                [sub.id]: parseInt(e.target.value),
                              }))
                            }
                            className="flex-1 h-2 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-cyan-500"
                          />
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={gradeScores[sub.id] ?? ''}
                            onChange={(e) =>
                              setGradeScores((prev) => ({
                                ...prev,
                                [sub.id]: parseInt(e.target.value) || 0,
                              }))
                            }
                            className="w-20 bg-black border border-white/10 rounded-lg px-3 py-2 text-center text-white text-sm font-mono focus:border-cyan-500 outline-none"
                            placeholder="0"
                          />
                        </div>
                        {/* Score visual indicator */}
                        <div className="flex justify-between mt-2 text-[10px] text-zinc-600">
                          <span>0</span>
                          <span
                            className={`font-bold ${
                              (gradeScores[sub.id] ?? 50) >= 80
                                ? 'text-green-400'
                                : (gradeScores[sub.id] ?? 50) >= 60
                                ? 'text-yellow-400'
                                : (gradeScores[sub.id] ?? 50) >= 40
                                ? 'text-orange-400'
                                : 'text-red-400'
                            }`}
                          >
                            {gradeScores[sub.id] ?? 50}
                          </span>
                          <span>100</span>
                        </div>
                      </div>

                      {/* Submit Button */}
                      <button
                        onClick={() => handleGrade(sub.id)}
                        disabled={submitting[sub.id] || gradeScores[sub.id] === undefined}
                        className="px-6 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-lg text-sm transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 shrink-0"
                      >
                        {submitting[sub.id] ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black" />
                            Submitting...
                          </>
                        ) : (
                          'Submit Grade'
                        )}
                      </button>
                    </div>

                    {/* Comments */}
                    <div>
                      <label className="block text-xs text-zinc-500 font-semibold uppercase tracking-wider mb-2">
                        Comments
                      </label>
                      <textarea
                        value={gradeComments[sub.id] || ''}
                        onChange={(e) =>
                          setGradeComments((prev) => ({
                            ...prev,
                            [sub.id]: e.target.value,
                          }))
                        }
                        placeholder="Add feedback for the participant..."
                        className="w-full bg-black border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder-zinc-600 focus:border-cyan-500 outline-none resize-none h-20"
                      />
                    </div>
                  </div>
                )}

                {/* Already Graded */}
                {sub.status === 'GRADED' && sub.score !== undefined && (
                  <div className="border-t border-white/10 p-5 flex items-center gap-4">
                    <span className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">
                      Score:
                    </span>
                    <span className={`text-lg font-black ${getScoreColor(sub.score)}`}>
                      {sub.score}/100
                    </span>
                    {sub.comments && (
                      <span className="text-xs text-zinc-500 ml-2 truncate max-w-md">
                        "{sub.comments}"
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Pagination - Queue */}
        {activeTab === 'queue' && totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 bg-zinc-950 border border-white/10 rounded-lg text-sm text-zinc-400 hover:text-white hover:border-white/20 transition disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ← Prev
            </button>
            <span className="text-sm text-zinc-500 font-mono px-3">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 bg-zinc-950 border border-white/10 rounded-lg text-sm text-zinc-400 hover:text-white hover:border-white/20 transition disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          </div>
        )}

        {/* Graded History */}
        {activeTab === 'history' && !loadingHistory && history.length > 0 && (
          <div className="space-y-4">
            {history.map((sub) => (
              <div
                key={sub.id}
                className="bg-zinc-950 border border-white/10 rounded-xl p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-cyan-400 font-mono text-sm font-bold">
                      Submission #{sub.anonymousId}
                    </span>
                    <span className="text-zinc-700">·</span>
                    <span className="text-white text-sm font-medium">
                      {sub.problemTitle}
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded border font-bold ${getDifficultyBadge(
                        sub.difficulty
                      )}`}
                    >
                      {sub.difficulty}
                    </span>
                    <span className="text-zinc-600 text-xs font-mono">
                      {sub.language}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded border font-bold bg-green-500/20 text-green-400 border-green-500/30">
                      GRADED
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`text-xl font-black ${getScoreColor(sub.score ?? 0)}`}>
                      {sub.score}/100
                    </span>
                    <span className="text-zinc-500 text-xs">
                      {new Date(sub.submittedAt).toLocaleString()}
                    </span>
                  </div>
                </div>

                {sub.comments && (
                  <div className="mt-3 bg-black border border-white/10 rounded-lg px-4 py-3 text-sm text-zinc-400 italic">
                    "{sub.comments}"
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Pagination - History */}
        {activeTab === 'history' && historyTotalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <button
              onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
              disabled={historyPage === 1}
              className="px-4 py-2 bg-zinc-950 border border-white/10 rounded-lg text-sm text-zinc-400 hover:text-white hover:border-white/20 transition disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ← Prev
            </button>
            <span className="text-sm text-zinc-500 font-mono px-3">
              {historyPage} / {historyTotalPages}
            </span>
            <button
              onClick={() => setHistoryPage((p) => Math.min(historyTotalPages, p + 1))}
              disabled={historyPage === historyTotalPages}
              className="px-4 py-2 bg-zinc-950 border border-white/10 rounded-lg text-sm text-zinc-400 hover:text-white hover:border-white/20 transition disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
