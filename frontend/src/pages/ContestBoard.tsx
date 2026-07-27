import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api } from '../services/api';

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
  const [contests, setContests] = useState<ContestOSContest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'live' | 'upcoming' | 'ended'>('all');
  const [search, setSearch] = useState('');

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
    <div className="min-h-screen bg-black text-white p-6 md:p-10">
      <div className="max-w-6xl mx-auto">
        {/* Header Hero */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-900/30 via-purple-900/20 to-black border border-white/10 p-8 mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold mb-3">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                ContestOS Arena Engine
              </div>
              <h1 className="text-3xl md:text-5xl font-black tracking-tight mb-2">
                Coding <span className="bg-gradient-to-r from-yellow-400 to-amber-500 bg-clip-text text-transparent">Contests & Exams</span>
              </h1>
              <p className="text-gray-400 text-sm md:text-base max-w-xl">
                Participate in institutional coding contests, proctored midterm exams, and speed programming challenges.
              </p>
            </div>

            <button
              onClick={() => navigate('/admin/contests')}
              className="px-6 py-3 bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-black font-bold rounded-xl transition shadow-lg shadow-yellow-500/20 text-sm whitespace-nowrap self-start md:self-auto"
            >
              + Host / Create Contest
            </button>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center mb-8">
          <div className="flex gap-2 bg-white/5 p-1.5 rounded-xl border border-white/10 w-full md:w-auto">
            {(['all', 'live', 'upcoming', 'ended'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition ${
                  filter === f
                    ? 'bg-yellow-500 text-black shadow-md'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <input
            type="text"
            placeholder="Search contests..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full md:w-72 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-yellow-500"
          />
        </div>

        {/* Contest List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-yellow-500" />
          </div>
        ) : filteredContests.length === 0 ? (
          <div className="text-center py-20 bg-white/5 rounded-2xl border border-white/10">
            <p className="text-gray-400 text-lg mb-4">No contests available under this filter</p>
            <button
              onClick={() => navigate('/admin/contests')}
              className="px-5 py-2 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-lg transition"
            >
              Create your first contest
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredContests.map((contest) => {
              const status = getStatus(contest.startTime, contest.endTime);
              return (
                <motion.div
                  key={contest.id}
                  whileHover={{ y: -2 }}
                  className="bg-white/5 border border-white/10 hover:border-white/20 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 transition"
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span
                        className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          status === 'live'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : status === 'upcoming'
                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                            : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                        }`}
                      >
                        {status === 'live' ? '🔴 LIVE NOW' : status}
                      </span>

                      {contest.requireSeb && (
                        <span className="px-3 py-1 bg-red-500/20 text-red-400 border border-red-500/30 rounded-full text-[10px] font-bold flex items-center gap-1">
                          🔒 SEB Proctoring
                        </span>
                      )}

                      <span className="text-xs text-gray-400">
                        {contest.organization?.name || 'ContestOS Academy'}
                      </span>
                    </div>

                    <h2 className="text-xl font-bold text-white">{contest.title}</h2>
                    {contest.description && (
                      <p className="text-gray-400 text-sm line-clamp-2">{contest.description}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400 pt-2">
                      <span>⏱️ {contest.duration} Minutes</span>
                      <span>•</span>
                      <span>📅 {new Date(contest.startTime).toLocaleString()}</span>
                      <span>•</span>
                      <span>🎯 {contest._count?.problems || 0} Problems</span>
                      <span>•</span>
                      <span>👥 {contest._count?.participants || 0} Participants</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {status === 'live' ? (
                      <button
                        onClick={() => navigate(`/contests/${contest.id}`)}
                        className="w-full md:w-auto px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl transition shadow-lg shadow-emerald-500/20 text-sm"
                      >
                        Enter Arena ⚡
                      </button>
                    ) : status === 'upcoming' ? (
                      <button
                        onClick={() => navigate(`/contests/${contest.id}`)}
                        className="w-full md:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition text-sm"
                      >
                        Register / View Details
                      </button>
                    ) : (
                      <button
                        onClick={() => navigate(`/contests/${contest.id}/overview`)}
                        className="w-full md:w-auto px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl transition text-sm"
                      >
                        View Leaderboard
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default ContestBoardPage;
