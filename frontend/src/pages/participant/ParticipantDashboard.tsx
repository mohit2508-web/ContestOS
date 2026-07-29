import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
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
  organization?: { name: string };
  _count?: { participants: number; problems: number };
}

interface Registration {
  id: string;
  contestId: string;
  contest: Contest;
  score: number;
  solvedCount: number;
  joinedAt: string;
  status: string;
}

interface ContestReport {
  submissions: Array<{
    id: string;
    problemTitle: string;
    status: string;
    score: number;
    language: string;
    createdAt: string;
    passed: boolean;
  }>;
  participant: {
    score: number;
    rank?: number;
    solvedCount: number;
    totalTimeTaken?: number;
    warnings: number;
    isTerminated: boolean;
  };
}

type Tab = 'browse' | 'registrations' | 'results' | 'submissions';

const DIFFICULTY_COLORS: Record<string, string> = {
  Easy: 'text-green-400 bg-green-500/10 border-green-500/20',
  Medium: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  Hard: 'text-red-400 bg-red-500/10 border-red-500/20',
};

function getStatus(start: string, end: string) {
  const now = Date.now();
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (now < s) return 'upcoming';
  if (now >= s && now <= e) return 'live';
  return 'ended';
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'live') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase rounded-lg">
        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
        LIVE
      </span>
    );
  }
  if (status === 'upcoming') {
    return (
      <span className="px-2.5 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-black uppercase rounded-lg">
        UPCOMING
      </span>
    );
  }
  return (
    <span className="px-2.5 py-1 bg-gray-500/10 border border-gray-500/20 text-gray-400 text-[10px] font-black uppercase rounded-lg">
      ENDED
    </span>
  );
}

function DifficultyBadge({ level }: { level: string }) {
  const color = DIFFICULTY_COLORS[level] || 'text-gray-400 bg-gray-500/10 border-gray-500/20';
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${color}`}>
      {level}
    </span>
  );
}

function ContestCard({
  contest,
  onJoin,
  onEnter,
  joining,
}: {
  contest: Contest;
  onJoin: (id: string) => void;
  onEnter: (id: string) => void;
  joining: string | null;
}) {
  const status = getStatus(contest.startTime, contest.endTime);
  const borderColor =
    status === 'live'
      ? 'border-emerald-500/40 hover:border-emerald-500/60'
      : status === 'upcoming'
      ? 'border-blue-500/30 hover:border-blue-500/50'
      : 'border-white/10 hover:border-white/20';

  return (
    <div
      className={`bg-zinc-950 border ${borderColor} rounded-2xl p-5 flex flex-col justify-between transition-all shadow-lg group`}
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <StatusBadge status={status} />
          <DifficultyBadge level={contest.difficulty} />
        </div>

        <div>
          <h3 className="text-base font-black text-white group-hover:text-emerald-400 transition tracking-tight">
            {contest.title}
          </h3>
          <p className="text-xs text-gray-500 line-clamp-2 mt-1 leading-relaxed">
            {contest.description || 'Coding assessment contest.'}
          </p>
        </div>

        {contest.organization && (
          <span className="text-[10px] text-gray-500 font-mono">
            {contest.organization.name}
          </span>
        )}

        <div className="text-[10px] text-gray-500 font-mono space-y-0.5">
          <div>
            Start: {new Date(contest.startTime).toLocaleString()}
          </div>
          <div>
            End: {new Date(contest.endTime).toLocaleString()}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 bg-black/40 border border-white/5 rounded-xl p-2.5 text-center text-[10px]">
          <div>
            <span className="text-[9px] text-gray-600 uppercase tracking-widest block font-mono">Duration</span>
            <span className="font-extrabold text-white">{contest.duration}m</span>
          </div>
          <div>
            <span className="text-[9px] text-gray-600 uppercase tracking-widest block font-mono">Problems</span>
            <span className="font-extrabold text-white">{contest._count?.problems ?? 0}</span>
          </div>
          <div>
            <span className="text-[9px] text-gray-600 uppercase tracking-widest block font-mono">Participants</span>
            <span className="font-extrabold text-white">{contest._count?.participants ?? 0}</span>
          </div>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-end">
        {status === 'ended' ? (
          <button
            onClick={() => onEnter(contest.id)}
            className="px-4 py-2 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white border border-white/10 text-xs font-bold rounded-lg transition"
          >
            View Results →
          </button>
        ) : status === 'live' ? (
          <button
            onClick={() => onEnter(contest.id)}
            className="px-4 py-2 bg-emerald-500 text-black font-extrabold text-xs rounded-lg hover:bg-emerald-400 transition shadow-md shadow-emerald-500/20"
          >
            Enter Contest ⚡
          </button>
        ) : (
          <button
            onClick={() => onJoin(contest.id)}
            disabled={joining === contest.id}
            className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 text-xs font-bold rounded-lg transition disabled:opacity-50"
          >
            {joining === contest.id ? 'Joining...' : 'Register →'}
          </button>
        )}
      </div>
    </div>
  );
}

function SecretCodeModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: (contestId: string) => void;
}) {
  const notify = useNotify();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [joining, setJoining] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setError('Please enter a valid code.');
      return;
    }
    setError('');
    setSuccess('');
    setJoining(true);
    try {
      const res = await api.joinContestByCode(code.trim());
      if (res.success && res.contestId) {
        setSuccess(`Registered! Entering ${res.contestTitle || 'contest'}...`);
        setTimeout(() => {
          onClose();
          onSuccess(res.contestId);
        }, 800);
      } else {
        setError(res.error || 'Invalid secret code.');
      }
    } catch {
      setError('Failed to verify code. Please try again.');
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
      <div className="bg-zinc-950 border border-white/10 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-green-400" />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-lg">
              🎟️
            </div>
            <div>
              <h3 className="text-lg font-black text-white">Join by Secret Code</h3>
              <p className="text-[11px] text-gray-400">Enter the code from your instructor</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-lg">
            ✕
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-xs font-bold text-center">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3 rounded-xl text-xs font-bold text-center">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="e.g. CONTEST2026"
            className="w-full bg-black/60 border border-white/10 text-emerald-400 font-mono font-bold text-center text-lg px-4 py-3 rounded-xl focus:outline-none focus:border-emerald-400 tracking-widest uppercase transition"
            autoFocus
            required
          />
          <button
            type="submit"
            disabled={joining}
            className="w-full py-3 bg-emerald-500 text-black font-black text-sm rounded-xl hover:bg-emerald-400 transition shadow-lg shadow-emerald-500/20 disabled:opacity-50"
          >
            {joining ? 'Verifying...' : 'Verify & Register'}
          </button>
        </form>
      </div>
    </div>
  );
}

export function ParticipantDashboard() {
  const navigate = useNavigate();
  const notify = useNotify();
  const { user } = useAuth();

  const [tab, setTab] = useState<Tab>('browse');
  const [contests, setContests] = useState<Contest[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [results, setResults] = useState<
    Array<{ contestId: string; contest: Contest; report: ContestReport }>
  >([]);
  const [submissions, setSubmissions] = useState<
    Array<{
      contestId: string;
      contestTitle: string;
      problemTitle: string;
      status: string;
      score: number;
      language: string;
      createdAt: string;
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [search, setSearch] = useState('');

  const loadContests = useCallback(async () => {
    try {
      const data = await api.getExternalContests();
      setContests(data.contests || []);
    } catch {
      setContests([]);
    }
  }, []);

  const loadRegistrations = useCallback(async () => {
    try {
      const data = await api.get('/contests/my-participations');
      setRegistrations(data.participations || []);
    } catch {
      setRegistrations([]);
    }
  }, []);

  const loadResults = useCallback(async () => {
    try {
      const data = await api.get('/contests/my-participations');
      const completed = (data.participations || []).filter(
        (p: Registration) => getStatus(p.contest.startTime, p.contest.endTime) === 'ended'
      );
      const withReports = await Promise.all(
        completed.map(async (reg: Registration) => {
          try {
            const report = await api.getMyContestReport(reg.contestId);
            return { contestId: reg.contestId, contest: reg.contest, report };
          } catch {
            return {
              contestId: reg.contestId,
              contest: reg.contest,
              report: {
                submissions: [],
                participant: { score: 0, solvedCount: 0, warnings: 0, isTerminated: false },
              },
            };
          }
        })
      );
      setResults(withReports);
    } catch {
      setResults([]);
    }
  }, []);

  const loadSubmissions = useCallback(async () => {
    try {
      const data = await api.get('/contests/my-participations');
      const allSubs: typeof submissions = [];
      const participations = data.participations || [];
      await Promise.all(
        participations.map(async (reg: Registration) => {
          try {
            const report = await api.getMyContestReport(reg.contestId);
            (report.submissions || []).forEach((sub: any) => {
              allSubs.push({
                contestId: reg.contestId,
                contestTitle: reg.contest.title,
                problemTitle: sub.problemTitle || sub.problem?.title || '—',
                status: sub.status,
                score: sub.score ?? 0,
                language: sub.language || '—',
                createdAt: sub.createdAt,
              });
            });
          } catch {
            /* skip */
          }
        })
      );
      allSubs.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setSubmissions(allSubs);
    } catch {
      setSubmissions([]);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([loadContests(), loadRegistrations()]);
      setLoading(false);
    };
    load();
  }, [loadContests, loadRegistrations]);

  useEffect(() => {
    if (tab === 'results') loadResults();
    if (tab === 'submissions') loadSubmissions();
  }, [tab, loadResults, loadSubmissions]);

  const handleJoin = async (contestId: string) => {
    setJoiningId(contestId);
    try {
      await api.joinManagerContest(contestId);
      notify.toast.success('Successfully registered!');
      await loadRegistrations();
    } catch (err: any) {
      notify.toast.error(
        err?.response?.data?.error || 'Failed to join contest.'
      );
    } finally {
      setJoiningId(null);
    }
  };

  const handleCodeSuccess = async (contestId: string) => {
    await loadRegistrations();
    navigate(`/contests/${contestId}`);
  };

  const registeredIds = new Set(registrations.map((r) => r.contestId));

  const filteredContests = contests.filter((c) => {
    if (search && !c.title.toLowerCase().includes(search.toLowerCase()))
      return false;
    return true;
  });

  const tabs: { key: Tab; label: string }[] = [
    { key: 'browse', label: 'Browse Contests' },
    { key: 'registrations', label: 'My Registrations' },
    { key: 'results', label: 'My Results' },
    { key: 'submissions', label: 'Submission History' },
  ];

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-zinc-900 via-zinc-950 to-black border border-white/10 p-6 md:p-8 shadow-2xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold mb-3">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Student Portal
              </div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight">
                Welcome,{' '}
                <span className="bg-gradient-to-r from-emerald-400 to-green-300 bg-clip-text text-transparent">
                  {user?.name || 'Student'}
                </span>
              </h1>
              <p className="text-gray-400 text-sm mt-1">
                Browse contests, track your performance, and view results.
              </p>
            </div>
            <button
              onClick={() => setShowCodeModal(true)}
              className="px-5 py-3 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-extrabold text-xs rounded-xl transition whitespace-nowrap"
            >
              🎟️ Join by Secret Code
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition ${
                tab === t.key
                  ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20'
                  : 'bg-zinc-900 border border-white/10 text-gray-400 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-52 bg-zinc-900/40 border border-white/5 rounded-2xl animate-pulse"
              />
            ))}
          </div>
        ) : (
          <>
            {/* Browse Contests */}
            {tab === 'browse' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <input
                    type="text"
                    placeholder="Search contests..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full sm:w-72 bg-zinc-900 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-400 transition"
                  />
                </div>

                {filteredContests.length === 0 ? (
                  <div className="bg-zinc-950 border border-white/10 rounded-2xl p-12 text-center space-y-3">
                    <span className="text-4xl block">🏆</span>
                    <h3 className="text-lg font-bold text-white">
                      No contests available yet
                    </h3>
                    <p className="text-xs text-gray-400">
                      Check back later or join a private contest using a Secret
                      Code.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {filteredContests.map((c) => (
                      <ContestCard
                        key={c.id}
                        contest={c}
                        onJoin={handleJoin}
                        onEnter={(id) => navigate(`/contests/${id}`)}
                        joining={joiningId}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* My Registrations */}
            {tab === 'registrations' && (
              <div className="space-y-3">
                {registrations.length === 0 ? (
                  <div className="bg-zinc-950 border border-white/10 rounded-2xl p-12 text-center space-y-3">
                    <span className="text-4xl block">📋</span>
                    <h3 className="text-lg font-bold text-white">
                      You haven't registered for any contests
                    </h3>
                    <p className="text-xs text-gray-400">
                      Browse available contests or use a Secret Code to join.
                    </p>
                    <button
                      onClick={() => setTab('browse')}
                      className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold rounded-lg hover:bg-emerald-500/20 transition"
                    >
                      Browse Contests →
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {registrations.map((reg) => {
                      const status = getStatus(
                        reg.contest.startTime,
                        reg.contest.endTime
                      );
                      return (
                        <div
                          key={reg.id}
                          className="bg-zinc-950 border border-white/10 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-emerald-500/20 transition"
                        >
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <StatusBadge status={status} />
                              <DifficultyBadge level={reg.contest.difficulty} />
                            </div>
                            <h4 className="font-bold text-sm text-white truncate">
                              {reg.contest.title}
                            </h4>
                            <div className="text-[10px] text-gray-500 font-mono">
                              Joined: {new Date(reg.joinedAt).toLocaleDateString()} · Score:{' '}
                              <span className="text-emerald-400 font-bold">
                                {reg.score}
                              </span>{' '}
                              · Solved:{' '}
                              <span className="text-white font-bold">
                                {reg.solvedCount}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => navigate(`/contests/${reg.contestId}`)}
                            className={`px-4 py-2 text-xs font-bold rounded-lg transition whitespace-nowrap ${
                              status === 'live'
                                ? 'bg-emerald-500 text-black hover:bg-emerald-400'
                                : status === 'upcoming'
                                ? 'bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20'
                                : 'bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10'
                            }`}
                          >
                            {status === 'live'
                              ? 'Enter Contest'
                              : status === 'upcoming'
                              ? 'View Details'
                              : 'View Results →'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* My Results */}
            {tab === 'results' && (
              <div className="space-y-3">
                {results.length === 0 ? (
                  <div className="bg-zinc-950 border border-white/10 rounded-2xl p-12 text-center space-y-3">
                    <span className="text-4xl block">📊</span>
                    <h3 className="text-lg font-bold text-white">
                      No completed contests yet
                    </h3>
                    <p className="text-xs text-gray-400">
                      Your results will appear here after you complete a contest.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {results.map((r) => {
                      const p = r.report.participant;
                      return (
                        <div
                          key={r.contestId}
                          className="bg-zinc-950 border border-white/10 rounded-xl p-5 hover:border-emerald-500/20 transition"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex-1 min-w-0 space-y-2">
                              <h4 className="font-bold text-sm text-white truncate">
                                {r.contest.title}
                              </h4>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div className="bg-black/40 border border-white/5 rounded-lg p-2 text-center">
                                  <span className="text-[9px] text-gray-600 uppercase tracking-widest block font-mono">
                                    Score
                                  </span>
                                  <span className="font-extrabold text-emerald-400 text-sm">
                                    {p.score}
                                  </span>
                                </div>
                                <div className="bg-black/40 border border-white/5 rounded-lg p-2 text-center">
                                  <span className="text-[9px] text-gray-600 uppercase tracking-widest block font-mono">
                                    Rank
                                  </span>
                                  <span className="font-extrabold text-white text-sm">
                                    {p.rank ?? '—'}
                                  </span>
                                </div>
                                <div className="bg-black/40 border border-white/5 rounded-lg p-2 text-center">
                                  <span className="text-[9px] text-gray-600 uppercase tracking-widest block font-mono">
                                    Solved
                                  </span>
                                  <span className="font-extrabold text-white text-sm">
                                    {p.solvedCount}
                                  </span>
                                </div>
                                <div className="bg-black/40 border border-white/5 rounded-lg p-2 text-center">
                                  <span className="text-[9px] text-gray-600 uppercase tracking-widest block font-mono">
                                    Time
                                  </span>
                                  <span className="font-extrabold text-white text-sm">
                                    {p.totalTimeTaken
                                      ? `${Math.floor(p.totalTimeTaken / 60)}m`
                                      : '—'}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                onClick={() =>
                                  navigate(`/contests/${r.contestId}`)
                                }
                                className="px-4 py-2 bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 text-xs font-bold rounded-lg transition"
                              >
                                Details
                              </button>
                              <button
                                onClick={() =>
                                  notify.toast.success(
                                    'Certificate download will be available soon.'
                                  )
                                }
                                className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 text-xs font-bold rounded-lg transition"
                              >
                                🎓 Certificate
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Submission History */}
            {tab === 'submissions' && (
              <div className="bg-zinc-950 border border-white/10 rounded-2xl overflow-hidden">
                {submissions.length === 0 ? (
                  <div className="p-12 text-center space-y-3">
                    <span className="text-4xl block">💻</span>
                    <h3 className="text-lg font-bold text-white">
                      No submissions yet
                    </h3>
                    <p className="text-xs text-gray-400">
                      Your submission history will appear here once you start
                      solving problems.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-white/10 text-gray-500 font-mono uppercase text-[10px] tracking-wider">
                          <th className="text-left p-3 px-4">Contest</th>
                          <th className="text-left p-3 px-4">Problem</th>
                          <th className="text-left p-3 px-4">Status</th>
                          <th className="text-left p-3 px-4">Score</th>
                          <th className="text-left p-3 px-4">Language</th>
                          <th className="text-left p-3 px-4">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {submissions.map((sub, i) => (
                          <tr
                            key={i}
                            className="border-b border-white/5 hover:bg-white/[0.02] transition"
                          >
                            <td className="p-3 px-4 text-gray-300 font-medium truncate max-w-[150px]">
                              {sub.contestTitle}
                            </td>
                            <td className="p-3 px-4 text-white font-bold truncate max-w-[150px]">
                              {sub.problemTitle}
                            </td>
                            <td className="p-3 px-4">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  sub.status === 'ACCEPTED' ||
                                  sub.status === 'passed'
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                    : 'bg-red-500/10 text-red-400 border border-red-500/20'
                                }`}
                              >
                                {sub.status}
                              </span>
                            </td>
                            <td className="p-3 px-4 font-mono font-bold text-white">
                              {sub.score}
                            </td>
                            <td className="p-3 px-4 text-gray-400 font-mono">
                              {sub.language}
                            </td>
                            <td className="p-3 px-4 text-gray-500 font-mono">
                              {new Date(sub.createdAt).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <SecretCodeModal
        open={showCodeModal}
        onClose={() => setShowCodeModal(false)}
        onSuccess={handleCodeSuccess}
      />
    </div>
  );
}

export default ParticipantDashboard;
