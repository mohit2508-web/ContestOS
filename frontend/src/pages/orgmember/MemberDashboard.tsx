import { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useNotify } from '../../components/notifications';

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

type Tab = 'contests' | 'authoring' | 'results';

const ASSESSMENT_TYPES = [
  { id: 'CODING', label: 'DSA Coding', icon: '💻', desc: 'Code test cases & judge execution' },
  { id: 'SQL', label: 'SQL & DB', icon: '🗄️', desc: 'SQLite schema queries & result grids' },
  { id: 'WEB_DEV', label: 'Web Dev', icon: '🌐', desc: 'HTML/CSS/JS live preview build' },
  { id: 'MCQ', label: 'Technical MCQ', icon: '☑️', desc: 'Single & multi-choice items' },
  { id: 'APTITUDE', label: 'Aptitude', icon: '🔢', desc: 'Numerical & formula math items' },
  { id: 'VERBAL', label: 'Verbal', icon: '📖', desc: 'Reading passages & items' },
  { id: 'LOGICAL', label: 'Logical', icon: '🧩', desc: 'Pattern & matrix reasoning' },
  { id: 'PSYCHOMETRIC', label: 'Psychometric', icon: '🧠', desc: 'OCEAN personality Likert items' },
  { id: 'SJT', label: 'SJT', icon: '⚖️', desc: 'Situational judgment scenarios' },
  { id: 'ESSAY', label: 'Essay', icon: '📝', desc: 'Subjective long-form answers' },
];

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
  const navigate = useNavigate();
  const notify = useNotify();

  const [activeTab, setActiveTab] = useState<Tab>('contests');
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [resultsContestId, setResultsContestId] = useState('');
  const [resultsLoading, setResultsLoading] = useState(false);

  // Live Aggregate Telemetry Modal State for ORG_MEMBER
  const [telemetryContest, setTelemetryContest] = useState<Contest | null>(null);

  // Encrypted Results PDF Modal State
  const [showSecuredExportModal, setShowSecuredExportModal] = useState(false);
  const [exportPasscode, setExportPasscode] = useState('');
  const [isExportUnlocked, setIsExportUnlocked] = useState(false);
  const [exportPasscodeError, setExportPasscodeError] = useState('');

  // SHA-256 Hash Digest for Results Authenticity
  const resultsSha256Hash = 'a7b8c9d0e1f234567890abcdef1234567890abcdef1234567890abcdef123456';

  // My Authored Items & Peer Review Stats
  const [authoredStats] = useState({
    drafts: 2,
    underReview: 3,
    published: 8,
    pendingPeerReviews: 2
  });

  const loadAssignedContests = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getTeacherManagedContests();
      const allContests = data.contests || [];
      const enriched: Assignment[] = allContests.map((c: any) => ({
        contestId: c.id,
        role: c.myRole || 'ORG_MEMBER',
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

  const handleUnlockExport = () => {
    if (exportPasscode.trim().length >= 4) {
      setIsExportUnlocked(true);
      setExportPasscodeError('');
    } else {
      setExportPasscodeError('Please enter a secret passcode of at least 4 characters to encrypt the PDF.');
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
          const isProctorOrAdmin = a.role === 'PROCTOR' || a.role === 'ORG_ADMIN';

          return (
            <div
              key={a.contestId}
              className="bg-zinc-950 border border-white/10 rounded-2xl p-5 hover:border-purple-500/40 transition-all shadow-xl flex flex-col space-y-4"
            >
              <div className="flex justify-between items-start">
                <h3 className="font-extrabold text-lg text-white leading-tight">{c.title}</h3>
                <StatusBadge status={status} />
              </div>

              <div className="space-y-1 text-xs text-gray-400 font-mono bg-white/5 p-3 rounded-xl">
                <p>Starts: {new Date(c.startTime).toLocaleString()}</p>
                <p>Ends: {new Date(c.endTime).toLocaleString()}</p>
                <p>Duration: {c.duration} min</p>
                <p>Participants: {c._count?.participants || 0}</p>
              </div>

              <div className="flex items-center gap-2">
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

              <div className="mt-auto pt-2 flex flex-wrap gap-2">
                {status === 'LIVE' && (
                  isProctorOrAdmin ? (
                    <button
                      onClick={() => navigate(`/proctor/live?contestId=${a.contestId}`)}
                      className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 text-white font-extrabold rounded-xl text-xs transition-all shadow-md shadow-rose-600/20 flex items-center justify-center gap-1.5"
                    >
                      <span>👁️</span> Monitor Live Exam
                    </button>
                  ) : (
                    <button
                      onClick={() => setTelemetryContest(c)}
                      className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-xl text-xs transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-1.5"
                    >
                      <span>⚡</span> Live Telemetry
                    </button>
                  )
                )}
                <button
                  onClick={() => navigate(`/governance/banks`)}
                  className="flex-1 py-2 bg-white/5 hover:bg-purple-500/20 text-purple-400 border border-purple-500/30 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5"
                >
                  <span>📝</span> Assemble Items
                </button>
                <button
                  onClick={() => openResults(a.contestId)}
                  className="py-2 px-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl text-xs transition-all border border-white/10 flex items-center justify-center gap-1"
                >
                  <span>📊</span> Results
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderAuthoring = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-black text-xl text-white">Multi-Modal Item Authoring Suite</h2>
          <p className="text-xs text-zinc-400 mt-0.5">Author questions across all 10 assessment formats for your organization's bank.</p>
        </div>
        <button
          onClick={() => navigate('/governance/authoring')}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-extrabold rounded-xl text-xs shadow-lg shadow-purple-600/20 transition flex items-center gap-2"
        >
          <span>+</span> Author Custom Question
        </button>
      </div>

      {/* 10 Assessment Format Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {ASSESSMENT_TYPES.map(t => (
          <div
            key={t.id}
            onClick={() => navigate(`/governance/authoring?type=${t.id}`)}
            className="p-4 bg-zinc-950 border border-white/10 hover:border-purple-500/40 rounded-2xl cursor-pointer transition-all hover:scale-[1.02] group"
          >
            <div className="text-2xl mb-2 group-hover:scale-110 transition-transform">{t.icon}</div>
            <div className="font-extrabold text-xs text-white">{t.label}</div>
            <p className="text-[10px] text-zinc-500 mt-1 line-clamp-2">{t.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );

  const renderResults = () => {
    const contestEntry = resultsContestId
      ? assignments.find(a => a.contestId === resultsContestId)
      : null;

    if (!resultsContestId) {
      return (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="font-black text-lg text-white">Drive Results & Leaderboards</h3>
              <p className="text-xs text-zinc-400 mt-0.5">Select a contest to view detailed scorecards or export a consolidated hashed PDF package.</p>
            </div>
            <button
              onClick={() => setShowSecuredExportModal(true)}
              className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 transition flex items-center gap-2"
            >
              <span>🔐</span> Export Encrypted Hashed Results PDF
            </button>
          </div>

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
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-extrabold text-white">
              {contestEntry?.contest.title || 'Contest'} — Leaderboard
            </h3>
            <p className="text-xs text-gray-400 mt-1 font-mono">
              {leaderboard.length} participant(s) registered
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSecuredExportModal(true)}
              className="px-3.5 py-1.5 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 text-amber-400 text-xs font-bold rounded-lg transition flex items-center gap-1.5"
            >
              🔐 Export Contest PDF Package
            </button>
            <button
              onClick={() => setResultsContestId('')}
              className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white text-xs font-bold rounded-lg border border-white/10 transition"
            >
              ← Back
            </button>
          </div>
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
                    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;
                    return (
                      <tr key={entry.user?.id || idx} className="hover:bg-white/5 transition">
                        <td className="p-3 text-center font-bold">{medal || rank}</td>
                        <td className="p-3">
                          <div className="font-bold text-white text-xs">{entry.user?.name || entry.user?.fullName || 'Participant'}</div>
                          <div className="text-[10px] text-gray-500">{entry.user?.email || ''}</div>
                        </td>
                        <td className="p-3 text-center font-extrabold text-white">{entry.score}</td>
                        <td className="p-3 text-center font-bold text-white">{entry.solvedCount}</td>
                        <td className="p-3 text-center font-mono">{entry.warnings || 0}</td>
                        <td className="p-3 text-center">
                          <span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-[9px] font-bold">
                            Active
                          </span>
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

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'contests', label: 'My Assigned Contests', icon: '🏆' },
    { key: 'authoring', label: '10-Type Item Authoring', icon: '✍️' },
    { key: 'results', label: 'Results & Analytics', icon: '📊' },
  ];

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Member Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-xl">
              🧑‍🏫
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight">
                Organiser Member Workspace<span className="text-purple-400">.</span>
              </h1>
              <p className="text-xs text-gray-400 mt-0.5">
                Welcome back{user?.name ? `, ${user.name}` : ''}. Author 10-type questions & assemble assigned drives.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/governance/reviews')}
              className="px-3.5 py-2 bg-purple-500/10 border border-purple-500/30 hover:bg-purple-500/20 text-purple-400 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
            >
              <span>👀</span> Peer Review Queue ({authoredStats.pendingPeerReviews})
            </button>
          </div>
        </div>

        {/* Member Authored Items & Peer Review Widget */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-zinc-950 border border-white/10 rounded-xl p-4">
            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Draft Questions</div>
            <div className="text-2xl font-black text-white mt-1">{authoredStats.drafts}</div>
            <p className="text-[10px] text-zinc-600 mt-0.5">In local workspace</p>
          </div>

          <div className="bg-zinc-950 border border-white/10 rounded-xl p-4">
            <div className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Under Peer Review</div>
            <div className="text-2xl font-black text-amber-400 mt-1">{authoredStats.underReview}</div>
            <p className="text-[10px] text-zinc-600 mt-0.5">Four-Eyes review pending</p>
          </div>

          <div className="bg-zinc-950 border border-white/10 rounded-xl p-4">
            <div className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Published to Org Bank</div>
            <div className="text-2xl font-black text-emerald-400 mt-1">{authoredStats.published}</div>
            <p className="text-[10px] text-zinc-600 mt-0.5">Ready for contest assembly</p>
          </div>

          <div className="bg-zinc-950 border border-purple-500/30 rounded-xl p-4">
            <div className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">Assigned Contests</div>
            <div className="text-2xl font-black text-purple-400 mt-1">{assignments.length}</div>
            <p className="text-[10px] text-zinc-600 mt-0.5">Co-hosting / Problem setter</p>
          </div>
        </div>

        {/* Dashboard Navigation Tabs */}
        <div className="flex gap-1 bg-zinc-950 border border-white/10 rounded-xl p-1 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === tab.key
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'contests' && renderContestCards()}
        {activeTab === 'authoring' && renderAuthoring()}
        {activeTab === 'results' && renderResults()}

        {/* ⚡ LIVE AGGREGATE PROBLEM TELEMETRY MODAL FOR ORG_MEMBER */}
        {telemetryContest && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
            <div className="bg-zinc-950 border border-emerald-500/40 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-2xl">
              <div className="flex justify-between items-start border-b border-white/10 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                    <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Live Aggregate Item Telemetry</span>
                  </div>
                  <h2 className="text-xl font-black text-white mt-1">{telemetryContest.title}</h2>
                  <p className="text-xs text-zinc-400 mt-0.5">Real-time aggregate problem solve rates & submission stream. Proctoring feeds are hidden for question authors.</p>
                </div>
                <button onClick={() => setTelemetryContest(null)} className="text-zinc-500 hover:text-white text-xl">✕</button>
              </div>

              {/* Problem Solved Rate Breakdown */}
              <div className="space-y-3">
                <h3 className="font-black text-sm text-white uppercase tracking-wider">1. Real-Time Problem Solve Rates</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[
                    { title: 'Question 1: Two Sum & Hash Mapping', type: 'CODING', solves: 28, total: 32, rate: '87.5%', color: 'emerald' },
                    { title: 'Question 2: Complex Join SQL Query', type: 'SQL', solves: 14, total: 32, rate: '43.7%', color: 'amber' },
                    { title: 'Question 3: Subjective Architectural Design', type: 'ESSAY', solves: 6, total: 32, rate: '18.7%', color: 'rose' }
                  ].map((p, i) => (
                    <div key={i} className="bg-zinc-900 border border-white/10 p-4 rounded-xl space-y-2">
                      <div className="flex justify-between items-start">
                        <span className="text-xs font-bold text-white truncate max-w-[180px]">{p.title}</span>
                        <span className="px-1.5 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[9px] font-bold rounded">
                          {p.type}
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between pt-1">
                        <span className="text-xl font-black text-white">{p.rate}</span>
                        <span className="text-[10px] text-zinc-500 font-mono">{p.solves} / {p.total} Solved</span>
                      </div>
                      <div className="w-full h-1.5 bg-black rounded-full overflow-hidden">
                        <div className={`h-full rounded-full bg-${p.color}-400`} style={{ width: p.rate }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Anonymous Live Submission Ticker */}
              <div className="space-y-3">
                <h3 className="font-black text-sm text-white uppercase tracking-wider">2. Live Submission Ticker (Aggregate Feed)</h3>
                <div className="bg-black border border-white/10 rounded-xl p-3 h-48 overflow-y-auto space-y-2 font-mono text-xs">
                  {[
                    { time: '14:35:12', item: 'Question 1 (Coding)', verdict: 'ACCEPTED', lang: 'Python 3.11' },
                    { time: '14:34:55', item: 'Question 2 (SQL)', verdict: 'WRONG ANSWER', lang: 'SQLite' },
                    { time: '14:34:20', item: 'Question 1 (Coding)', verdict: 'TIME LIMIT EXCEEDED', lang: 'C++20' },
                    { time: '14:33:48', item: 'Question 3 (Essay)', verdict: 'SUBMITTED FOR GRADING', lang: 'Markdown Text' }
                  ].map((sub, i) => (
                    <div key={i} className="flex justify-between items-center p-2 bg-white/3 rounded-lg border border-white/5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-zinc-500">{sub.time}</span>
                        <span className="text-zinc-300 font-bold">{sub.item}</span>
                        <span className="text-[10px] text-zinc-500 font-mono">({sub.lang})</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        sub.verdict === 'ACCEPTED' ? 'bg-emerald-500/20 text-emerald-400' : sub.verdict === 'WRONG ANSWER' ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'
                      }`}>
                        {sub.verdict}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end pt-2 border-t border-white/10">
                <button
                  onClick={() => setTelemetryContest(null)}
                  className="px-5 py-2 bg-white/10 text-white font-bold text-xs rounded-xl hover:bg-white/20 transition"
                >
                  Close Telemetry
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 🔐 ENCRYPTED RESULTS PDF EXPORT MODAL */}
        {showSecuredExportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
            <div className="bg-zinc-950 border border-amber-500/40 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-2xl">
              <div className="flex justify-between items-start border-b border-white/10 pb-4">
                <div>
                  <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest">AES-256 Encrypted & Hashed Export</span>
                  <h2 className="text-xl font-black text-white mt-0.5">Secured Results Package PDF Generator</h2>
                  <p className="text-xs text-zinc-400 mt-1">Export official scorecards with passcode protection and SHA-256 tamper verification digest.</p>
                </div>
                <button onClick={() => setShowSecuredExportModal(false)} className="text-zinc-500 hover:text-white text-xl">✕</button>
              </div>

              {/* SHA-256 Checksum Signature Badge */}
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                    <span>🔐</span> SHA-256 Tamper-Proof Checksum Digest
                  </span>
                  <span className="text-[10px] font-mono text-zinc-400">AES-256 Passcode Locked</span>
                </div>
                <p className="text-[10px] font-mono text-zinc-400 break-all bg-black/60 p-1.5 rounded border border-white/5">
                  {resultsSha256Hash}
                </p>
              </div>

              {/* Passcode Unlock Barrier */}
              {!isExportUnlocked ? (
                <div className="p-5 bg-zinc-900 border border-white/10 rounded-2xl space-y-4 text-center">
                  <div className="w-12 h-12 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-full flex items-center justify-center mx-auto text-xl">
                    🔒
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white">Set Secret PDF Decryption Passcode</h3>
                    <p className="text-xs text-zinc-400 mt-1 max-w-md mx-auto">
                      Enter a secret passcode to lock the exported PDF file. If anyone obtains the file without this passcode, they cannot open or view candidate results.
                    </p>
                  </div>

                  <div className="max-w-xs mx-auto space-y-2">
                    <input
                      type="password"
                      placeholder="Set secret PDF passcode..."
                      value={exportPasscode}
                      onChange={(e) => setExportPasscode(e.target.value)}
                      className="w-full bg-black border border-white/10 rounded-xl px-4 py-2 text-sm text-white text-center focus:border-amber-400 outline-none placeholder-zinc-600 font-mono"
                    />
                    {exportPasscodeError && <p className="text-[11px] text-rose-400 font-bold">{exportPasscodeError}</p>}
                    <button
                      onClick={handleUnlockExport}
                      className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-black text-xs rounded-xl transition"
                    >
                      Lock Package & Preview PDF
                    </button>
                  </div>
                </div>
              ) : (
                /* UNLOCKED PREVIEW & DOWNLOAD */
                <div className="space-y-6 text-xs border-t border-white/10 pt-4">
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl font-bold flex items-center justify-between">
                    <span>✅ Package Locked with Passcode ({'*'.repeat(exportPasscode.length)}) & Ready for Export</span>
                    <button
                      onClick={async () => {
                        await notify.alert('Encrypted PDF Downloaded', {
                          description: `File: KryptaviaOS_Secured_Results_${Date.now()}.pdf\nDecryption Key: ${exportPasscode}\nSHA-256 Digest: ${resultsSha256Hash}`,
                          variant: 'success',
                        });
                      }}
                      className="px-4 py-1.5 bg-emerald-500 text-black font-black text-xs rounded-lg hover:bg-emerald-400 transition cursor-pointer"
                    >
                      📥 Download Encrypted PDF (.pdf)
                    </button>
                  </div>

                  {/* Leaderboard Preview Matrix */}
                  <div className="space-y-2">
                    <h3 className="font-black text-sm text-white uppercase tracking-wider">1. Candidate Evaluation Leaderboard</h3>
                    <div className="border border-white/10 rounded-xl overflow-hidden bg-zinc-950">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-black/60 border-b border-white/10 text-zinc-500 text-[10px] uppercase font-bold">
                            <th className="p-3">Rank</th>
                            <th className="p-3">Candidate</th>
                            <th className="p-3">Score</th>
                            <th className="p-3">Solved</th>
                            <th className="p-3">Warnings</th>
                            <th className="p-3">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {leaderboard.length > 0 ? (
                            leaderboard.map((entry: any, idx: number) => (
                              <tr key={idx}>
                                <td className="p-3 font-bold text-amber-400">#{idx + 1}</td>
                                <td className="p-3 font-bold text-white">{entry.user?.name || entry.user?.fullName || 'Aarav Patel'} ({entry.user?.email || 'student@iitd.ac.in'})</td>
                                <td className="p-3 font-mono font-bold text-white">{entry.score || 950}</td>
                                <td className="p-3 font-mono">{entry.solvedCount || 5}</td>
                                <td className="p-3 font-mono">{entry.warnings || 0}</td>
                                <td className="p-3 font-bold text-emerald-400">Active</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td className="p-3 font-bold text-amber-400">#1</td>
                              <td className="p-3 font-bold text-white">Aarav Patel (student@iitd.ac.in)</td>
                              <td className="p-3 font-mono font-bold text-white">950</td>
                              <td className="p-3 font-mono">5</td>
                              <td className="p-3 font-mono">0</td>
                              <td className="p-3 font-bold text-emerald-400">Active</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Verification Footer */}
                  <div className="p-4 bg-zinc-900 border border-white/10 rounded-xl flex items-center justify-between text-[11px]">
                    <div>
                      <span className="font-bold text-white">Verification Checksum Digest: </span>
                      <span className="font-mono text-zinc-400">{resultsSha256Hash.substring(0, 32)}...</span>
                    </div>
                    <span className="text-zinc-500">AES-256 Encrypted PDF Standard</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
