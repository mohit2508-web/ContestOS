import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface ContestOSContest {
  id: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  duration: number;
  difficulty: string;
  isPublic: boolean;
  requireSeb: boolean;
  requireFullscreen: boolean;
  preventTabSwitch: boolean;
  enableProctoring: boolean;
  maxWarnings: number;
  organization?: {
    name: string;
    logoUrl?: string;
  };
  _count?: {
    problems: number;
    participants: number;
  };
}

export function ContestBoardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = (user?.role || 'STUDENT').toUpperCase();
  const isStudent = role === 'STUDENT';

  const [contests, setContests] = useState<ContestOSContest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'live' | 'upcoming' | 'ended'>('all');
  const [search, setSearch] = useState('');

  // Secret Code Join State
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [secretCode, setSecretCode] = useState('');
  const [joiningCode, setJoiningCode] = useState(false);
  const [codeError, setCodeError] = useState('');
  const [codeSuccess, setCodeSuccess] = useState('');

  useEffect(() => {
    loadContests();
  }, []);

  const loadContests = async () => {
    setLoading(true);
    try {
      const data = await api.get('/contests');
      setContests(data.contests || []);
    } catch (err) {
      console.error('Failed to load contests:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinByCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!secretCode.trim()) {
      setCodeError('Please enter a valid secret code.');
      return;
    }

    setCodeError('');
    setCodeSuccess('');
    setJoiningCode(true);

    try {
      const res = await api.joinContestByCode(secretCode.trim());
      if (res.success && res.contestId) {
        setCodeSuccess(`Registered! Entering ${res.contestTitle || 'Contest'}...`);
        setTimeout(() => {
          setShowCodeModal(false);
          navigate(`/contests/${res.contestId}`);
        }, 800);
      } else {
        setCodeError(res.error || 'Invalid secret code provided by host.');
      }
    } catch {
      setCodeError('Failed to verify secret code. Please try again.');
    } finally {
      setJoiningCode(false);
    }
  };

  const getStatus = (start: string, end: string) => {
    const now = new Date().getTime();
    const startTime = new Date(start).getTime();
    const endTime = new Date(end).getTime();

    if (now < startTime) return 'upcoming';
    if (now >= startTime && now <= endTime) return 'live';
    return 'ended';
  };

  const filteredContests = contests.filter((c) => {
    const status = getStatus(c.startTime, c.endTime);
    if (filter === 'live' && status !== 'live') return false;
    if (filter === 'upcoming' && status !== 'upcoming') return false;
    if (filter === 'ended' && status !== 'ended') return false;
    if (search && !c.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-black text-white p-6 md:p-10 selection:bg-amber-500/20">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header Hero */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-zinc-900 via-zinc-950 to-black border border-white/10 p-8 shadow-2xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold mb-3">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                ContestOS Proctored Assessment Engine
              </div>
              <h1 className="text-3xl md:text-5xl font-black tracking-tight mb-2">
                Coding <span className="bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 bg-clip-text text-transparent">Contests & Exams</span>
              </h1>
              <p className="text-gray-400 text-sm md:text-base max-w-xl">
                {isStudent
                  ? 'Join company & institutional coding contests using your Secret Access Code or browse public exams.'
                  : 'Manage institutional coding contests, proctored midterm exams, and speed programming challenges.'}
              </p>
            </div>

            {/* Secret Code Join Button for Students */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <button
                onClick={() => {
                  setSecretCode('');
                  setCodeError('');
                  setCodeSuccess('');
                  setShowCodeModal(true);
                }}
                className="w-full sm:w-auto px-6 py-4 bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-black rounded-2xl transition shadow-xl shadow-amber-500/20 text-sm whitespace-nowrap cursor-pointer flex items-center justify-center gap-2"
              >
                <span>🔑</span> Join with Secret Code
              </button>

              {!isStudent && (
                <button
                  onClick={() => navigate('/admin/contests')}
                  className="w-full sm:w-auto px-6 py-4 bg-white/10 hover:bg-white/15 border border-white/10 text-white font-bold rounded-2xl transition text-sm whitespace-nowrap cursor-pointer"
                >
                  + Host Contest
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Quick Secret Code Bar Banner */}
        <div className="bg-zinc-900/60 border border-amber-500/20 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-xl shrink-0">
              🎟️
            </div>
            <div>
              <p className="text-sm font-black text-white">Have a Secret Contest Code?</p>
              <p className="text-xs text-gray-400">Enter the passcode provided by your company, university, or contest host.</p>
            </div>
          </div>
          <button
            onClick={() => setShowCodeModal(true)}
            className="w-full sm:w-auto px-5 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 font-extrabold text-xs rounded-xl transition cursor-pointer"
          >
            Enter Secret Code →
          </button>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 w-full sm:w-auto">
            {(['all', 'live', 'upcoming', 'ended'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold capitalize transition cursor-pointer ${
                  filter === status
                    ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20'
                    : 'bg-zinc-900 border border-white/10 text-gray-400 hover:text-white'
                }`}
              >
                {status}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-72">
            <input
              type="text"
              placeholder="Search contests..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-400 transition"
            />
          </div>
        </div>

        {/* Contest Cards Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2].map((i) => (
              <div key={i} className="h-48 bg-zinc-900/40 border border-white/5 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : filteredContests.length === 0 ? (
          <div className="bg-zinc-900/30 border border-white/5 rounded-3xl p-12 text-center space-y-3">
            <span className="text-4xl block">🏆</span>
            <h3 className="text-lg font-bold text-white">No Contests Found</h3>
            <p className="text-xs text-gray-400">Try adjusting your filters or join a private contest using a Secret Code above.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredContests.map((contest) => {
              const status = getStatus(contest.startTime, contest.endTime);
              const isLive = status === 'live';
              const isUpcoming = status === 'upcoming';

              return (
                <motion.div
                  key={contest.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-zinc-950 border border-white/10 rounded-3xl p-6 flex flex-col justify-between hover:border-amber-500/30 transition-all shadow-xl group"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        {isLive && (
                          <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase rounded-lg flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                            LIVE
                          </span>
                        )}
                        {isUpcoming && (
                          <span className="px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-black uppercase rounded-lg">
                            UPCOMING
                          </span>
                        )}
                        {status === 'ended' && (
                          <span className="px-3 py-1 bg-gray-500/10 border border-gray-500/20 text-gray-400 text-[10px] font-black uppercase rounded-lg">
                            ENDED
                          </span>
                        )}
                        {contest.requireSeb && (
                          <span className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold rounded-lg">
                            🔒 SEB
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-500 font-mono font-bold">{contest.difficulty}</span>
                    </div>

                    <div>
                      <h3 className="text-xl font-black text-white group-hover:text-amber-400 transition tracking-tight">
                        {contest.title}
                      </h3>
                      <p className="text-xs text-gray-400 line-clamp-2 mt-1 leading-relaxed">
                        {contest.description || 'Institutional speed coding assessment.'}
                      </p>
                    </div>

                    <div className="grid grid-cols-3 gap-2 bg-black/40 border border-white/5 rounded-xl p-3 text-center text-xs">
                      <div>
                        <span className="text-[9px] text-gray-500 uppercase tracking-widest block font-mono">Duration</span>
                        <span className="font-extrabold text-white">{contest.duration} min</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-gray-500 uppercase tracking-widest block font-mono">Problems</span>
                        <span className="font-extrabold text-white">{contest._count?.problems ?? 0}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-gray-500 uppercase tracking-widest block font-mono">Participants</span>
                        <span className="font-extrabold text-white">{contest._count?.participants ?? 0}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between">
                    <span className="text-[10px] text-gray-500 font-mono">
                      Host: {contest.organization?.name || 'ContestOS Host'}
                    </span>

                    <button
                      onClick={() => navigate(`/contests/${contest.id}`)}
                      className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-yellow-400 text-black font-extrabold text-xs rounded-xl transition shadow-lg shadow-amber-500/10 cursor-pointer"
                    >
                      {isLive ? 'Enter Arena ⚡' : 'View Details →'}
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* ── Secret Code Modal ── */}
        <AnimatePresence>
          {showCodeModal && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-zinc-950 border border-white/10 rounded-3xl max-w-md w-full p-7 space-y-5 shadow-2xl relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-yellow-400" />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-xl">
                      🔑
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-white">Join Private Contest</h3>
                      <p className="text-xs text-gray-400">Enter the secret code provided by your host</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowCodeModal(false)}
                    className="text-gray-400 hover:text-white p-1"
                  >
                    ✕
                  </button>
                </div>

                {codeError && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-xs font-bold text-center">
                    {codeError}
                  </div>
                )}

                {codeSuccess && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3 rounded-xl text-xs font-bold text-center">
                    {codeSuccess}
                  </div>
                )}

                <form onSubmit={handleJoinByCodeSubmit} className="space-y-4">
                  <div>
                    <label className="block text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">
                      Secret Access Code / Passcode
                    </label>
                    <input
                      type="text"
                      value={secretCode}
                      onChange={(e) => setSecretCode(e.target.value.toUpperCase())}
                      placeholder="e.g. IITD2026, AMAZON99"
                      className="w-full bg-black/60 border border-white/10 text-amber-400 font-mono font-bold text-center text-lg px-4 py-3 rounded-xl focus:outline-none focus:border-amber-400 tracking-widest uppercase transition"
                      autoFocus
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={joiningCode}
                    className="w-full py-3.5 bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 text-black font-black text-sm rounded-xl hover:from-amber-400 hover:to-yellow-400 transition shadow-lg shadow-amber-500/20 cursor-pointer disabled:opacity-50"
                  >
                    {joiningCode ? 'Verifying Secret Code...' : 'Verify & Enter Arena ⚡'}
                  </button>
                </form>

                <p className="text-[10px] text-gray-500 text-center font-mono">
                  Don't have a code? Ask your exam instructor or company recruiter.
                </p>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default ContestBoardPage;
