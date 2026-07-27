import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../services/api';

interface ExternalContest {
  id: string;
  contestId: string;
  name: string;
  url: string | null;
  platform: string;
  startTime: string;
  endTime: string;
  duration: number | null;
  status: string;
  description: string | null;
  participants: number | null;
  isBookmarked: boolean;
}

const PLATFORMS = ['all', 'codeforces', 'codechef', 'leetcode', 'atcoder', 'geeksforgeeks'] as const;
const STATUS_FILTERS = ['all', 'upcoming', 'ongoing', 'past'] as const;

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const PLATFORM_META: Record<string, { label: string; color: string; bg: string; image: string }> = {
  codeforces: { label: 'CodeForces', color: 'text-blue-400', bg: 'bg-blue-500/10', image: '/images/contest/codeforces.webp' },
  codechef: { label: 'CodeChef', color: 'text-orange-400', bg: 'bg-orange-500/10', image: '/images/contest/codechef.png' },
  leetcode: { label: 'LeetCode', color: 'text-yellow-400', bg: 'bg-yellow-500/10', image: '/images/contest/leetcode.png' },
  atcoder: { label: 'AtCoder', color: 'text-red-400', bg: 'bg-red-500/10', image: '/images/contest/codechef.png' },
  geeksforgeeks: { label: 'GFG', color: 'text-green-400', bg: 'bg-green-500/10', image: '/images/contest/gfg.png' },
};

function AnimatedCountdown({ target }: { target: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const diff = new Date(target).getTime() - now;
  if (diff <= 0) return <span className="text-green-400 text-xs font-medium">Started</span>;
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return (
    <span className="text-[var(--accent-yellow)] text-xs font-mono tabular-nums">
      {d > 0 ? `${d}d ` : ''}{String(h).padStart(2, '0')}:{String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    upcoming: 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/25',
    ongoing: 'bg-gradient-to-r from-green-600 to-green-500 text-white shadow-lg shadow-green-500/25',
    past: 'bg-gradient-to-r from-gray-600 to-gray-500 text-white shadow-lg shadow-gray-500/25',
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${styles[status] || styles.past}`}>
      {status}
    </span>
  );
}

function PlatformIcon({ platform }: { platform: string }) {
  const meta = PLATFORM_META[platform] || { label: platform, color: 'text-gray-400', bg: 'bg-gray-500/10', image: '' };
  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-bold ${meta.bg} ${meta.color}`}>
      {meta.image && (
        <img src={meta.image} alt={meta.label} className="w-4 h-4 object-contain rounded" />
      )}
      {meta.label}
    </div>
  );
}

function ContestFooter() {
  return (
    <footer className="mt-12 pt-8 pb-6 border-t border-white/5 text-center">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-center gap-6 mb-4 text-xs text-gray-600">
          <a href="#" className="hover:text-gray-400 transition">About</a>
          <a href="#" className="hover:text-gray-400 transition">Privacy</a>
          <a href="#" className="hover:text-gray-400 transition">Terms</a>
          <a href="#" className="hover:text-gray-400 transition">Contact</a>
        </div>
        <p className="text-xs text-gray-600">
          &copy; {new Date().getFullYear()} TalentOS — Contest Board. All contests are property of their respective platforms.
        </p>
      </div>
    </footer>
  );
}

export function ContestBoardPage() {
  const [platform, setPlatform] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('upcoming');
  const [contests, setContests] = useState<ExternalContest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [scraping, setScraping] = useState(false);

  const loadContests = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getExternalContests(
        platform !== 'all' ? platform : undefined,
        statusFilter !== 'all' ? statusFilter : undefined,
      );
      setContests(data.contests || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load contests');
    } finally {
      setLoading(false);
    }
  }, [platform, statusFilter]);

  useEffect(() => { loadContests(); }, [loadContests]);

  const handleScrape = async () => {
    setScraping(true);
    try {
      await api.scrapeContests(platform !== 'all' ? platform : undefined);
      await loadContests();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to scrape');
    } finally {
      setScraping(false);
    }
  };

  const toggleBookmark = async (id: string) => {
    try {
      await api.toggleContestBookmark(id);
      setContests(prev => prev.map(c =>
        c.id === id ? { ...c, isBookmarked: !c.isBookmarked } : c
      ));
    } catch (err) { console.error('Operation failed:', err); }
  };

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return '\u2014';
    if (minutes >= 1440) return `${Math.floor(minutes / 1440)}d`;
    if (minutes >= 60) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
    return `${minutes}m`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const ongoingCount = contests.filter(c => c.status === 'ongoing').length;
  const upcomingCount = contests.filter(c => c.status === 'upcoming').length;
  const totalCount = contests.length;

  return (
    <div className="min-h-screen bg-black p-4 md:p-6">
      <div className="max-w-5xl mx-auto">
        {/* Hero section */}
        <div className="relative mb-10 overflow-hidden rounded-2xl bg-gradient-to-br from-[var(--accent-yellow)]/10 via-[var(--accent-red)]/5 to-transparent border border-white/5 p-6 md:p-8">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-[var(--accent-yellow)]/20 to-transparent rounded-full blur-3xl" />
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-medium text-gray-300 mb-4">
              <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              Live contest tracker
            </div>
            <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight mb-2">
              Contest{' '}
              <span className="bg-gradient-to-r from-[var(--accent-yellow)] to-[var(--accent-red)] bg-clip-text text-transparent">
                Board
              </span>
            </h1>
            <p className="text-gray-400 text-sm md:text-base max-w-xl">
              Track upcoming, ongoing, and past coding contests across Codeforces, CodeChef, LeetCode, and AtCoder.
            </p>
            <motion.div
              initial={{ opacity: 0, filter: 'blur(4px)' }}
              animate={{ opacity: 1, filter: 'blur(0px)' }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="flex gap-4 mt-4 text-sm"
            >
              <div className="flex items-center gap-1.5">
                <span className="text-2xl font-black text-white">{totalCount}</span>
                <span className="text-gray-500 text-xs">Total</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-2xl font-black text-emerald-400">{ongoingCount}</span>
                <span className="text-gray-500 text-xs">Live</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-2xl font-black text-blue-400">{upcomingCount}</span>
                <span className="text-gray-500 text-xs">Upcoming</span>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Filter controls */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex gap-1 bg-white/5 rounded-lg p-1 w-fit overflow-x-auto">
              {PLATFORMS.map(p => (
                <motion.button
                  key={p} onClick={() => setPlatform(p)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition whitespace-nowrap ${platform === p ? 'bg-[var(--accent-yellow)] text-black' : 'text-gray-400 hover:text-white'}`}
                >
                  {p !== 'all' && PLATFORM_META[p]?.image && (
                    <img src={PLATFORM_META[p].image} alt="" className="w-3.5 h-3.5 object-contain rounded" />
                  )}
                  {p === 'all' ? 'All' : PLATFORM_META[p]?.label || p}
                </motion.button>
              ))}
          </div>

          <div className="flex gap-1 bg-white/5 rounded-lg p-1 w-fit overflow-x-auto">
            {STATUS_FILTERS.map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition whitespace-nowrap ${statusFilter === s ? 'bg-[var(--accent-yellow)] text-black' : 'text-gray-400 hover:text-white'}`}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          <button onClick={handleScrape} disabled={scraping}
            className="px-4 py-1.5 bg-[var(--accent-red)]/20 text-[var(--accent-red)] rounded-lg text-xs font-bold hover:bg-[var(--accent-red)]/30 transition disabled:opacity-50 ml-auto"
          >
            {scraping ? 'Scraping...' : 'Refresh'}
          </button>
        </div>

        {error && (
          <div className="p-3 mb-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent-yellow)]" />
          </div>
        ) : contests.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-500">No contests found</p>
          </div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid gap-3"
          >
            {contests.map(contest => (
              <motion.div
                key={contest.id}
                variants={{
                  hidden: { opacity: 0, y: 20 },
                  visible: { opacity: 1, y: 0 },
                }}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                className="bg-[var(--bg-card)] border border-white/5 rounded-xl p-4 flex flex-col md:flex-row md:items-center gap-3 hover:border-white/20 transition"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <PlatformIcon platform={contest.platform} />
                    <StatusBadge status={contest.status} />
                  </div>
                  <h3 className="text-white font-bold text-sm truncate">{contest.name}</h3>
                  <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-gray-400">
                    <span>{formatDate(contest.startTime)}</span>
                    <span className="text-gray-600">&rarr;</span>
                    <span>{formatDate(contest.endTime)}</span>
                    <span className="text-gray-600">&bull;</span>
                    <span>{formatDuration(contest.duration)}</span>
                  </div>
                  <div className="mt-1.5">
                    {contest.status === 'upcoming' ? (
                      <AnimatedCountdown target={contest.startTime} />
                    ) : contest.status === 'ongoing' ? (
                      <AnimatedCountdown target={contest.endTime} />
                    ) : null}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button onClick={() => toggleBookmark(contest.id)}
                    className={`p-2 rounded-lg transition ${contest.isBookmarked ? 'text-yellow-400 bg-yellow-500/10' : 'text-gray-500 hover:text-gray-300 bg-white/5'}`}
                    title={contest.isBookmarked ? 'Remove bookmark' : 'Bookmark'}
                  >
                    <svg className="w-4 h-4" fill={contest.isBookmarked ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                    </svg>
                  </button>
                  {contest.url && (
                    <a href={contest.url} target="_blank" rel="noopener noreferrer"
                      className="p-2 rounded-lg text-gray-500 hover:text-[var(--accent-blue)] bg-white/5 hover:bg-white/10 transition"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  )}
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}

        <ContestFooter />
      </div>
    </div>
  );
}

export default ContestBoardPage;
