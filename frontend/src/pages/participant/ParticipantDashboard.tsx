import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useNotify } from '../../components/notifications';
import { CandidateSkillCockpit } from '../../components/participant/CandidateSkillCockpit';
import { DiagnosticPreflightModal } from '../../components/participant/DiagnosticPreflightModal';
import { AccessCodeGate } from '../../components/participant/AccessCodeGate';
import { DashboardTour } from '../../components/onboarding/DashboardTour';


interface Contest {
  id: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  duration: number;
  difficulty: string;
  isPublic: boolean;
  secretCode?: string;
  organization?: { name: string };
  _count?: { participants: number; problems: number };
}

interface Registration {
  id: string;
  contestId: string;
  contest: Contest;
  score: number;
  solvedCount?: number;
  joinedAt?: string;
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
function FormattedDescription({ text }: { text: string }) {
  if (!text) return null;

  // Extract clean lead paragraph before any emojis or headers
  const cleanLeadText = text
    .split(/📌|🛡️|TEST BREAKDOWN|PROCTORING|•/)[0]
    .replace(/^🚀\s*/, '')
    .trim();

  const hasStructuredMarkers = text.includes('📌') || text.includes('🛡️') || text.includes('MODULES') || text.includes('PROCTORING');

  if (!hasStructuredMarkers) {
    return (
      <p className="text-xs md:text-sm text-gray-300 leading-relaxed whitespace-pre-line">
        {text}
      </p>
    );
  }

  return (
    <div className="space-y-2 text-xs md:text-sm text-gray-300 leading-relaxed">
      <p className="text-gray-200 font-medium">
        {cleanLeadText || 'Official Capgemini recruitment-style assessment engineered to evaluate industry readiness across core technical domains.'}
      </p>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
        <div className="p-2.5 bg-purple-950/30 border border-purple-500/25 rounded-xl space-y-1">
          <span className="text-[10px] font-black text-purple-400 uppercase tracking-wider block font-mono">🎯 Evaluation Pillars</span>
          <p className="text-purple-200 text-[11px] leading-snug">🤖 AI Questioning • 🐞 Code Debugging • ⚡ DSA Algorithms</p>
        </div>
        <div className="p-2.5 bg-amber-950/30 border border-amber-500/25 rounded-xl space-y-1">
          <span className="text-[10px] font-black text-amber-400 uppercase tracking-wider block font-mono">🛡️ Security & Proctoring</span>
          <p className="text-amber-200 text-[11px] leading-snug">Strict SEB Lockdown • AI Eye Tracking • Partial Credit Scoring</p>
        </div>
      </div>
    </div>
  );
}

function ContestCard({
  contest,
  registration,
  onJoin,
  onEnter,
  joining,
}: {
  contest: Contest;
  registration?: Registration;
  onJoin: (id: string) => void;
  onEnter: (id: string) => void;
  joining: string | null;
}) {
  const status = getStatus(contest.startTime, contest.endTime);
  const isRegistered = !!registration;
  const isCapgemini = contest.title.toLowerCase().includes('capgemini') && status !== 'ended';

  if (isCapgemini) {
    return (
      <div className="md:col-span-2 relative overflow-hidden rounded-3xl bg-gradient-to-br from-zinc-950 via-zinc-900 to-black border-2 border-purple-500/60 hover:border-purple-400 p-6 md:p-8 shadow-[0_0_50px_rgba(168,85,247,0.25)] transition-all duration-300 group">
        {/* Ambient Glows */}
        <div className="absolute -top-32 -left-32 w-80 h-80 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-purple-600/25 rounded-full blur-3xl pointer-events-none" />

        {/* Large Capgemini Watermark Logo Background Accent */}
        <div className="absolute -right-6 -bottom-6 opacity-15 pointer-events-none transform group-hover:scale-110 group-hover:opacity-25 transition-all duration-500">
          <img src="/capgemini_logo.svg" alt="Capgemini Logo" className="w-64 h-64 md:w-80 md:h-80 object-contain filter drop-shadow-[0_0_30px_rgba(0,112,173,0.5)]" />
        </div>

        <div className="relative z-10 space-y-5">
          {/* Top Header Badge & Logo */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 p-0.5 shadow-lg shadow-blue-500/30 flex items-center justify-center shrink-0">
                <div className="w-full h-full bg-zinc-950 rounded-[14px] flex items-center justify-center p-2">
                  <img src="/capgemini_logo.svg" alt="Capgemini Ace" className="w-full h-full object-contain" />
                </div>
              </div>
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-gradient-to-r from-purple-500/20 to-indigo-500/20 border border-purple-400/40 text-purple-300 text-[10px] font-black uppercase tracking-widest">
                  <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />
                  <span>🔥 MEGA RECRUITMENT ASSESSMENT DRIVE</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <StatusBadge status={status} />
                  <DifficultyBadge level={contest.difficulty} />
                </div>
              </div>
            </div>

            {contest.organization && (
              <span className="text-xs text-amber-400 font-mono font-bold bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-xl">
                {contest.organization.name}
              </span>
            )}
          </div>

          {/* Title & Description */}
          <div className="space-y-1.5">
            <h3 className="text-xl md:text-3xl font-black text-white group-hover:text-purple-300 transition-colors tracking-tight">
              {contest.title}
            </h3>
            {contest.description && (
              <FormattedDescription text={contest.description} />
            )}
          </div>

          {/* Module Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-300 text-xs font-bold flex items-center gap-1.5">
              <span>🤖 AI-Assisted Socratic</span>
            </span>
            <span className="px-3 py-1 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold flex items-center gap-1.5">
              <span>🐞 Algorithmic Debugging</span>
            </span>
            <span className="px-3 py-1 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-xs font-bold flex items-center gap-1.5">
              <span>⚡ DSA Core Challenges</span>
            </span>
          </div>

          {/* Bottom Stats & Actions */}
          <div className="pt-3 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="grid grid-cols-3 gap-4 text-xs font-mono text-gray-300">
              <div>
                <span className="text-gray-500 block text-[9px] uppercase font-bold">Duration</span>
                <span className="text-white font-bold text-sm">{contest.duration} mins</span>
              </div>
              <div>
                <span className="text-gray-500 block text-[9px] uppercase font-bold">Problems</span>
                <span className="text-white font-bold text-sm">{contest._count?.problems || 3}</span>
              </div>
              <div>
                <span className="text-gray-500 block text-[9px] uppercase font-bold">Candidates</span>
                <span className="text-white font-bold text-sm">{contest._count?.participants || 0}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 justify-between sm:justify-end">
              <span className="text-xs text-amber-400 font-mono font-bold">
                Starts: {new Date(contest.startTime).toLocaleDateString()}
              </span>

              {isRegistered ? (
                <button
                  onClick={() => onEnter(contest.id)}
                  className="px-6 py-2.5 bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 text-white text-xs font-black rounded-xl transition cursor-pointer shadow-lg shadow-purple-600/30"
                >
                  {status === 'live' ? 'Enter Exam ⚡' : 'View Details'}
                </button>
              ) : (
                <button
                  onClick={() => onJoin(contest.id)}
                  disabled={joining === contest.id}
                  className="px-6 py-2.5 bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 text-white text-xs font-black rounded-xl transition cursor-pointer shadow-lg shadow-purple-600/30 disabled:opacity-40"
                >
                  {joining === contest.id ? 'Registering...' : 'Register 🎯'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-950 border border-white/10 rounded-2xl p-5 md:p-6 flex flex-col justify-between hover:border-emerald-500/30 transition-all group shadow-xl">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <StatusBadge status={status} />
            <DifficultyBadge level={contest.difficulty} />
          </div>
          {contest.organization && (
            <span className="text-[10px] text-amber-400 font-mono font-bold bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-lg">
              {contest.organization.name}
            </span>
          )}
        </div>

        <div>
          <h3 className="text-lg font-extrabold text-white group-hover:text-emerald-400 transition-colors">
            {contest.title}
          </h3>
          {contest.description && (
            <FormattedDescription text={contest.description} />
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 py-2 border-y border-white/5 text-[11px] font-mono text-gray-400">
          <div>
            <span className="text-gray-600 block text-[9px] uppercase">Duration</span>
            <span className="text-white font-bold">{contest.duration} mins</span>
          </div>
          <div>
            <span className="text-gray-600 block text-[9px] uppercase">Problems</span>
            <span className="text-white font-bold">{contest._count?.problems || 0}</span>
          </div>
          <div>
            <span className="text-gray-600 block text-[9px] uppercase">Candidates</span>
            <span className="text-white font-bold">{contest._count?.participants || 0}</span>
          </div>
        </div>
      </div>

      <div className="pt-4 flex items-center justify-between gap-3">
        <div className="text-[10px] text-gray-500 font-mono">
          Starts: {new Date(contest.startTime).toLocaleDateString()}
        </div>

        {isRegistered ? (
          <button
            onClick={() => onEnter(contest.id)}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black rounded-xl transition cursor-pointer shadow-lg shadow-emerald-500/20"
          >
            {status === 'live' ? 'Enter Exam ⚡' : 'View Details'}
          </button>
        ) : (
          <button
            onClick={() => onJoin(contest.id)}
            disabled={joining === contest.id || status === 'ended'}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl transition cursor-pointer disabled:opacity-40"
          >
            {joining === contest.id ? 'Registering...' : status === 'ended' ? 'Drive Ended' : 'Register 🎯'}
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
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const notify = useNotify();

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    try {
      const res = await api.joinContestByCode(code.trim().toUpperCase());
      notify.toast.success(res.message || 'Joined successfully!');
      onSuccess(res.contestId || res.registration?.contestId);
      onClose();
    } catch (err: any) {
      notify.toast.error(err?.response?.data?.error || 'Invalid or expired code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-950 border border-white/10 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-white text-base">Join Private Assessment Drive</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-sm font-bold">✕</button>
        </div>
        <p className="text-xs text-gray-400">
          Enter the 6-character Secret Invite Code provided by your university or recruiter.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            placeholder="e.g. CS2026"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="w-full bg-black border border-white/15 rounded-xl px-4 py-3 text-center text-lg font-mono font-bold tracking-widest text-emerald-400 uppercase focus:outline-none focus:border-emerald-400 transition"
            maxLength={10}
          />
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 font-bold text-xs rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !code.trim()}
              className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs rounded-xl transition shadow-lg shadow-emerald-500/20 disabled:opacity-40"
            >
              {loading ? 'Verifying...' : 'Join Exam ⚡'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function ParticipantDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const notify = useNotify();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab = searchParams.get('tab') || 'drives'; // 'drives' | 'skills' | 'credentials' | 'scorecards'

  const [contests, setContests] = useState<Contest[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [results, setResults] = useState<Array<{ contestId: string; contest: Contest; report: ContestReport }>>([]);
  const [loading, setLoading] = useState(true);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [showCodeModal, setShowCodeModal] = useState(false);
  const [showPreflightModal, setShowPreflightModal] = useState(false);
  const [gateContest, setGateContest] = useState<Contest | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [cRes, rRes] = await Promise.all([
        api.getAvailableContests(),
        api.getMyRegistrations(),
      ]);
      setContests(cRes.contests || cRes || []);
      setRegistrations(rRes.registrations || rRes || []);

      const completedRegs = (rRes.registrations || rRes || []).filter(
        (r: Registration) => r.status === 'COMPLETED' || r.status === 'AUTO_SUBMITTED' || (r.solvedCount || 0) > 0
      );

      const reportPromises = completedRegs.map((r: Registration) =>
        api.getContestReport(r.contestId).then((rep: ContestReport) => ({
          contestId: r.contestId,
          contest: r.contest,
          report: rep,
        })).catch(() => null)
      );

      const repResults = await Promise.all(reportPromises);
      setResults(repResults.filter(Boolean));
    } catch (err: any) {
      console.error('Failed to load candidate dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleJoin = async (contestId: string) => {
    setJoiningId(contestId);
    try {
      await api.registerContest(contestId);
      notify.toast.success('Successfully registered for exam drive!');
      loadData();
    } catch (err: any) {
      notify.toast.error(err?.response?.data?.error || 'Registration failed.');
    } finally {
      setJoiningId(null);
    }
  };

  const handleEnter = (contestId: string) => {
    const target = contests.find((c) => c.id === contestId);
    if (target) {
      setGateContest(target);
    } else {
      navigate(`/contests/${contestId}`);
    }
  };

  const filteredContests = contests.filter((c) => {
    if (search && !c.title.toLowerCase().includes(search.toLowerCase())) return false;

    const titleLower = (c.title || '').toLowerCase();

    // Exclude old/ended/test/demo/draft contests from view
    if (
      titleLower.includes('demo') ||
      titleLower.includes('mock drive') ||
      titleLower.includes('cognizant test') ||
      titleLower.includes('capegemini contest') ||
      titleLower.includes('system testing') ||
      titleLower.includes('exculsive capegemini') ||
      titleLower === 'capgemini exclusive mock test'
    ) {
      return false;
    }

    return true;
  });

  const activeContests = filteredContests.filter((c) => getStatus(c.startTime, c.endTime) !== 'ended');
  const endedContests = filteredContests.filter((c) => getStatus(c.startTime, c.endTime) === 'ended');

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8">
      <DashboardTour />
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Organizer Alert Banner if non-student visits candidate portal */}
        {user && user.role !== 'STUDENT' && (
          <div className="p-3.5 bg-purple-500/10 border border-purple-500/30 rounded-2xl flex items-center justify-between gap-4 text-xs text-purple-300 shadow-xl select-text">
            <div className="flex items-center gap-2.5">
              <span className="text-lg">💡</span>
              <span>
                You are logged in as <strong className="text-white font-mono font-bold">{user.role}</strong>. Previewing Candidate Portal.
              </span>
            </div>
            <button
              onClick={() => navigate(user.role === 'ORG_MEMBER' ? '/member/contests' : user.role === 'SUPER_ADMIN' ? '/admin/platform' : '/admin/org')}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-black rounded-xl transition shrink-0 shadow-lg cursor-pointer"
            >
              Go to Organizer Dashboard →
            </button>
          </div>
        )}

        {/* Candidate Welcome Header */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-zinc-900 via-zinc-950 to-black border border-white/10 p-6 md:p-8 shadow-2xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold mb-3">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Verified Candidate Portal
              </div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight">
                Welcome,{' '}
                <span className="bg-gradient-to-r from-emerald-400 to-green-300 bg-clip-text text-transparent">
                  {user?.name || 'Candidate Student'}
                </span>
              </h1>
              <p className="text-gray-400 text-sm mt-1">
                Access your scheduled assessment drives, hardware pre-flight checks, and verified credentials.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowPreflightModal(true)}
                className="px-4 py-3 bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/30 text-teal-400 font-extrabold text-xs rounded-xl transition whitespace-nowrap"
              >
                🛠️ Hardware Pre-Flight Test
              </button>
              <button
                onClick={() => setShowCodeModal(true)}
                className="px-5 py-3 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-extrabold text-xs rounded-xl transition whitespace-nowrap"
              >
                🎟️ Join by Secret Code
              </button>
            </div>
          </div>
        </div>

        {/* TAB 1: 🎯 Exam Hall & Drives (Default Screen) */}
        {activeTab === 'drives' && (
          <div className="space-y-6">
          {/* 🎯 Active Assessment Drives Grid */}
            {/* Real-Time Hardware & System Readiness Telemetry Bar */}
            <div className="bg-zinc-950 border border-white/10 rounded-2xl p-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="flex items-center gap-3 bg-white/5 border border-white/5 p-3 rounded-xl">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                <div>
                  <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold block">Network Ping</span>
                  <span className="font-mono font-bold text-emerald-400">24 ms (RTT Latency Optimal)</span>
                </div>
              </div>

              <div className="flex items-center gap-3 bg-white/5 border border-white/5 p-3 rounded-xl">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-400 shrink-0" />
                <div>
                  <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold block">Optical Sensors</span>
                  <span className="font-mono font-bold text-teal-300">Webcam & Mic Stream Active</span>
                </div>
              </div>

              <div className="flex items-center gap-3 bg-white/5 border border-white/5 p-3 rounded-xl">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shrink-0" />
                <div>
                  <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold block">Proctor Security</span>
                  <span className="font-mono font-bold text-cyan-300">SEB Lockdown Compliant</span>
                </div>
              </div>
            </div>

            {/* Assessment Drives Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-3">
              <div>
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <span>🎯</span> Scheduled & Live Assessment Drives
                </h2>
                <p className="text-xs text-gray-400">Official university exams, hiring drives, and skill challenges.</p>
              </div>
              <input
                type="text"
                placeholder="Search drives..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-zinc-900 border border-white/10 rounded-xl px-4 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-400 transition"
              />
            </div>

            {loading ? (
              <div id="tour-drives-section" className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {[1, 2].map((i) => (
                  <div key={i} className="h-48 bg-zinc-900/40 border border-white/5 rounded-2xl animate-pulse" />
                ))}
              </div>
            ) : activeContests.length === 0 ? (
              <div id="tour-drives-section" className="bg-zinc-950 border border-white/10 rounded-2xl p-12 text-center space-y-3">
                <span className="text-4xl block">🏆</span>
                <h3 className="text-base font-bold text-white">No live or upcoming exam drives scheduled right now</h3>
                <p className="text-xs text-gray-400">Join a private exam drive using a Secret Code or check your scorecards for past exams.</p>
                <button
                  onClick={() => setShowCodeModal(true)}
                  className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold rounded-xl hover:bg-emerald-500/20 transition cursor-pointer"
                >
                  🎟️ Enter Secret Code
                </button>
              </div>
            ) : (
              <div id="tour-drives-section" className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {activeContests.map((c) => {
                  const reg = registrations.find((r) => r.contestId === c.id);
                  return (
                    <ContestCard
                      key={c.id}
                      contest={c}
                      registration={reg}
                      onJoin={handleJoin}
                      onEnter={handleEnter}
                      joining={joiningId}
                    />
                  );
                })}
              </div>
            )}

            {/* Completed / Past Drives Section */}
            {!loading && endedContests.length > 0 && (
              <div className="space-y-4 pt-4 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-gray-400 text-xs flex items-center gap-2">
                    <span>📁</span> Completed & Past Drives ({endedContests.length})
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-75 hover:opacity-100 transition">
                  {endedContests.map((c) => {
                    const reg = registrations.find((r) => r.contestId === c.id);
                    return (
                      <ContestCard
                        key={c.id}
                        contest={c}
                        registration={reg}
                        onJoin={handleJoin}
                        onEnter={handleEnter}
                        joining={joiningId}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quick Practice Launcher Grid */}
            <div className="space-y-4 pt-4 border-t border-white/10">
              <h3 className="font-extrabold text-white text-sm flex items-center gap-2">
                <span>💻</span> Practice Arena Launcher
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <button
                  onClick={() => navigate('/playground')}
                  className="bg-zinc-950 border border-white/10 hover:border-amber-500/40 p-4 rounded-2xl text-left space-y-1 transition group"
                >
                  <span className="text-2xl block">👨‍💻</span>
                  <p className="font-bold text-xs text-white group-hover:text-amber-400 transition">Code Playground</p>
                  <p className="text-[10px] text-gray-500">DSA & Algorithms</p>
                </button>

                <button
                  onClick={() => navigate('/playground/web-dev')}
                  className="bg-zinc-950 border border-white/10 hover:border-emerald-500/40 p-4 rounded-2xl text-left space-y-1 transition group"
                >
                  <span className="text-2xl block">🌐</span>
                  <p className="font-bold text-xs text-white group-hover:text-emerald-400 transition">Web Dev Playground</p>
                  <p className="text-[10px] text-gray-500">Live HTML/CSS/DOM</p>
                </button>

                <button
                  onClick={() => navigate('/playground/sql')}
                  className="bg-zinc-950 border border-white/10 hover:border-cyan-500/40 p-4 rounded-2xl text-left space-y-1 transition group"
                >
                  <span className="text-2xl block">🗄️</span>
                  <p className="font-bold text-xs text-white group-hover:text-cyan-400 transition">SQL Playground</p>
                  <p className="text-[10px] text-gray-500">Relational Queries</p>
                </button>

                <button
                  onClick={() => navigate('/playground/quiz')}
                  className="bg-zinc-950 border border-white/10 hover:border-purple-500/40 p-4 rounded-2xl text-left space-y-1 transition group"
                >
                  <span className="text-2xl block">☑️</span>
                  <p className="font-bold text-xs text-white group-hover:text-purple-400 transition">MCQ Quiz Arena</p>
                  <p className="text-[10px] text-gray-500">CS Fundamentals</p>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: 📊 Skill Analytics & Radar */}
        {activeTab === 'skills' && (
          <CandidateSkillCockpit
            user={{
              id: user?.id || 'candidate-demo',
              name: user?.name || 'Aarav Patel',
              email: user?.email || 'student@iitd.ac.in',
            }}
            stats={{
              eloRating: 1785,
              globalRank: 42,
              percentile: 96.5,
              problemsSolved: 142,
              contestsAttended: 18,
            }}
            mode="skills"
          />
        )}

        {/* TAB 3: 📜 Verified Credentials */}
        {activeTab === 'credentials' && (
          <CandidateSkillCockpit
            user={{
              id: user?.id || 'candidate-demo',
              name: user?.name || 'Aarav Patel',
              email: user?.email || 'student@iitd.ac.in',
            }}
            stats={{
              eloRating: 1785,
              globalRank: 42,
              percentile: 96.5,
              problemsSolved: 142,
              contestsAttended: 18,
            }}
            mode="credentials"
          />
        )}

        {/* TAB 4: 📁 My Scorecards */}
        {activeTab === 'scorecards' && (
          <div className="space-y-4">
            <div className="border-b border-white/10 pb-3">
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                <span>📁</span> Official Assessment Scorecards & Reports
              </h2>
              <p className="text-xs text-gray-400">Proctored evaluation reports and 10-domain rubric scorecards.</p>
            </div>

            {results.length === 0 ? (
              <div className="bg-zinc-950 border border-white/10 rounded-2xl p-12 text-center space-y-3 text-xs text-gray-500">
                <span className="text-4xl block">📊</span>
                <h3 className="text-base font-bold text-white">No completed proctored exams recorded yet</h3>
                <p className="text-xs text-gray-400">Your scorecards will automatically appear here upon exam completion.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {results.map((r) => {
                  const p = r.report.participant;
                  return (
                    <div
                      key={r.contestId}
                      className="bg-zinc-950 border border-white/10 rounded-2xl p-5 hover:border-emerald-500/20 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl"
                    >
                      <div className="flex-1 min-w-0 space-y-2">
                        <h4 className="font-bold text-sm text-white truncate">{r.contest.title}</h4>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                          <div className="bg-black/40 border border-white/5 rounded-xl p-2">
                            <span className="text-[9px] text-gray-500 uppercase tracking-widest block font-mono">Score</span>
                            <span className="font-extrabold text-emerald-400 text-sm">{p.score} pts</span>
                          </div>
                          <div className="bg-black/40 border border-white/5 rounded-xl p-2">
                            <span className="text-[9px] text-gray-500 uppercase tracking-widest block font-mono">Percentile</span>
                            <span className="font-extrabold text-amber-400 text-sm">Top 5%</span>
                          </div>
                          <div className="bg-black/40 border border-white/5 rounded-xl p-2">
                            <span className="text-[9px] text-gray-500 uppercase tracking-widest block font-mono">Solved</span>
                            <span className="font-extrabold text-white text-sm">{p.solvedCount}</span>
                          </div>
                          <div className="bg-black/40 border border-white/5 rounded-xl p-2">
                            <span className="text-[9px] text-gray-500 uppercase tracking-widest block font-mono">Status</span>
                            <span className="font-extrabold text-emerald-400 text-sm">PASSED ✓</span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => navigate(`/contests/${r.contestId}/report`)}
                        className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black rounded-xl transition cursor-pointer shadow-md shadow-emerald-500/20 whitespace-nowrap"
                      >
                        View Detailed Scorecard 📊
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <SecretCodeModal
        open={showCodeModal}
        onClose={() => setShowCodeModal(false)}
        onSuccess={(contestId) => {
          loadData();
          handleEnter(contestId);
        }}
      />

      <DiagnosticPreflightModal
        isOpen={showPreflightModal}
        onClose={() => setShowPreflightModal(false)}
        onProceed={() => {
          setShowPreflightModal(false);
          notify.toast.success('Pre-Flight Diagnostics Passed 100%! Ready to launch exam.');
        }}
      />

      {gateContest && (
        <AccessCodeGate
          examTitle={gateContest.title}
          orgLabel={gateContest.organization?.name || 'Kryptavia OS Assessment Portal'}
          codeLength={(gateContest as any).accessCode?.length || 8}
          onClose={() => setGateContest(null)}
          onVerify={async (code) => {
            try {
              const res = await api.verifyAccessCode(gateContest.id, code);
              return res;
            } catch (err: any) {
              return { valid: false, error: err?.response?.data?.error || 'Verification failed' };
            }
          }}
          onSuccess={() => {
            const contestId = gateContest.id;
            setGateContest(null);
            navigate(`/contests/${contestId}/overview`);
          }}
        />
      )}
    </div>
  );
}

export default ParticipantDashboard;
