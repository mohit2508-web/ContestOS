import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import type { LeaderboardEntry } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useNotify } from '../components/notifications';

export function LeaderboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const notify = useNotify();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(() => {
    try {
      const c = sessionStorage.getItem('leaderboard:data');
      return c ? JSON.parse(c) : [];
    } catch { return []; }
  });
  const [leetcodeLeaderboard, setLeetcodeLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(!leaderboard.length);
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState<'global' | 'category' | 'department' | 'platform' | 'leetcode'>('platform');
  const [periodTab, setPeriodTab] = useState<'weekly' | 'monthly' | 'all'>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selectedCategory, setSelectedCategory] = useState<string>('legend');
  const [departments, setDepartments] = useState<string[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('leetcode');
  const [leetcodeUsername, setLeetcodeUsername] = useState('');
  const [registering, setRegistering] = useState(false);
  const [syncingId, setSyncingId] = useState<number | null>(null);
  const [error, setError] = useState('');

  const PLATFORMS = [
    { id: 'leetcode', name: 'LeetCode', fullName: 'LeetCode', sortBy: 'Problems' },
    { id: 'codeforces', name: 'Codeforces', fullName: 'Codeforces', sortBy: 'Rating' },
    { id: 'codechef', name: 'CodeChef', fullName: 'CodeChef', sortBy: 'Rating' },
    { id: 'github', name: 'GitHub', fullName: 'GitHub', sortBy: 'Contributions' }
  ] as const;

  useEffect(() => {
    setPage(1);
    loadLeaderboard();
    loadDepartments();
  }, [activeTab, selectedCategory, selectedDepartment, selectedPlatform, periodTab]);

  const [platformLeaderboard, setPlatformLeaderboard] = useState<any[]>([]);

  const loadLeaderboard = async () => {
    setLoading(true);
    try {
      let data;
      if (activeTab === 'platform') {
        data = await api.getPlatformLeaderboard(selectedPlatform, 50);
        setPlatformLeaderboard(data?.leaderboard || []);
        setLeaderboard([]);
        setLeetcodeLeaderboard([]);
      } else if (activeTab === 'global') {
        data = await api.getGlobalLeaderboard(50);
        setLeaderboard(data?.leaderboard || []);
        setPlatformLeaderboard([]);
        setLeetcodeLeaderboard([]);
      } else if (activeTab === 'category') {
        data = await api.getCategoryLeaderboard(selectedCategory);
        setLeaderboard(data?.leaderboard || []);
        setPlatformLeaderboard([]);
        setLeetcodeLeaderboard([]);
      } else if (activeTab === 'department' && selectedDepartment) {
        data = await api.getDepartmentLeaderboard(selectedDepartment, 50);
        setLeaderboard(data?.leaderboard || []);
        setPlatformLeaderboard([]);
        setLeetcodeLeaderboard([]);
      } else if (activeTab === 'leetcode') {
        data = await api.getLeetcodeLeaderboard();
        setLeetcodeLeaderboard(data?.leaderboard || []);
        setLeaderboard([]);
        setPlatformLeaderboard([]);
        try { sessionStorage.setItem('leaderboard:data', JSON.stringify(data?.leaderboard || [])); } catch (err) { console.error('Operation failed:', err); }
      }
      if (activeTab !== 'platform') {
        try { sessionStorage.setItem('leaderboard:data', JSON.stringify(data?.leaderboard || [])); } catch (err) { console.error('Operation failed:', err); }
      }
    } catch (error) {
      console.error('Failed to load leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDepartments = async () => {
    try {
      const data = await api.getDepartments();
      setDepartments(data.departments);
      if (data.departments.length > 0) {
        setSelectedDepartment(data.departments[0]);
      }
    } catch (error) {
      console.error('Failed to load departments:', error);
    }
  };

  const handleSyncAll = async () => {
    setSyncing(true);
    try {
      await api.syncAllPlatforms();
      await loadLeaderboard();
    } catch (error) {
      console.error('Failed to sync:', error);
    } finally {
      setSyncing(false);
    }
  };

  const loadLeetcodeLeaderboard = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getLeetcodeLeaderboard();
      setLeetcodeLeaderboard(data.leaderboard || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load LeetCode leaderboard');
    } finally {
      setLoading(false);
    }
  };

  const handleLeetcodeRegister = async () => {
    if (!leetcodeUsername.trim()) return;
    setRegistering(true);
    setError('');
    try {
      await api.registerLeetcodeStat({ leetcodeUsername: leetcodeUsername.trim() });
      setLeetcodeUsername('');
      await loadLeetcodeLeaderboard();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setRegistering(false);
    }
  };

  const handleLeetcodeSync = async (id: number) => {
    setSyncingId(id);
    try {
      await api.syncLeetcodeStats(id);
      await loadLeetcodeLeaderboard();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncingId(null);
    }
  };

  const handleLeetcodeDelete = async (id: number) => {
    if (!await notify.confirm('Delete this entry?', { variant: 'error' })) return;
    try {
      await api.deleteLeetcodeStat(id);
      await loadLeetcodeLeaderboard();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const getCategoryColor = (cat?: string) => {
    switch (cat) {
      case 'legend': return 'bg-purple-500/20 text-purple-400';
      case 'builder': return 'bg-green-500/20 text-green-400';
      case 'grinder': return 'bg-yellow-500/20 text-yellow-400';
      case 'starter': return 'bg-blue-500/20 text-blue-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  const paginatedData = useMemo(() => {
    const data = activeTab === 'platform' ? platformLeaderboard : leaderboard;
    const start = (page - 1) * pageSize;
    return data.slice(start, start + pageSize);
  }, [leaderboard, platformLeaderboard, page, pageSize, activeTab]);

  const totalPages = useMemo(() => {
    const data = activeTab === 'platform' ? platformLeaderboard : leaderboard;
    return Math.max(1, Math.ceil(data.length / pageSize));
  }, [leaderboard, platformLeaderboard, pageSize, activeTab]);

  const goToPage = (p: number) => {
    if (p >= 1 && p <= totalPages) setPage(p);
  };

  const PERIODS = [
    { id: 'weekly', label: 'Weekly' },
    { id: 'monthly', label: 'Monthly' },
    { id: 'all', label: 'All Time' },
  ] as const;

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="bg-black border-b border-white/5 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-black text-white tracking-tight">
            Talent<span className="text-[var(--accent-yellow)] text-glow-yellow">OS</span>
          </h1>
          <div className="flex items-center gap-4">
            <button
              onClick={handleSyncAll}
              disabled={syncing}
              className="px-3 py-1.5 bg-[var(--accent-green)] hover:bg-green-500 disabled:opacity-50 text-black text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors"
            >
              {syncing ? (
                <div className="w-3 h-3 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
              ) : (
                '↻'
              )}
              Refresh
            </button>
            <nav className="flex gap-6 font-medium text-sm">
              <a href="/dashboard" className="text-gray-400 hover:text-white transition-colors">Dashboard</a>
              <a href="/leaderboard" className="text-[var(--accent-green)]">Leaderboard</a>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Tabs */}
        <div className="flex flex-wrap gap-3 mb-8">
          <button
            onClick={() => setActiveTab('platform')}
            className={`px-5 py-2.5 rounded-lg font-bold text-sm tracking-wide uppercase transition-all ${activeTab === 'platform'
              ? 'bg-[var(--accent-yellow)]/20 text-[var(--accent-yellow)] border border-[var(--accent-yellow)]/50 shadow-[0_0_10px_var(--accent-yellow)]'
              : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 border border-transparent'
              }`}
          >
            Platforms
          </button>
          <button
            onClick={() => setActiveTab('global')}
            className={`px-5 py-2.5 rounded-lg font-bold text-sm tracking-wide uppercase transition-all ${activeTab === 'global'
              ? 'bg-[var(--accent-yellow)]/20 text-[var(--accent-yellow)] border border-[var(--accent-yellow)]/50 shadow-[0_0_10px_var(--accent-yellow)]'
              : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 border border-transparent'
              }`}
          >
            Global
          </button>
          <button
            onClick={() => setActiveTab('department')}
            className={`px-5 py-2.5 rounded-lg font-bold text-sm tracking-wide uppercase transition-all ${activeTab === 'department'
              ? 'bg-[var(--accent-yellow)]/20 text-[var(--accent-yellow)] border border-[var(--accent-yellow)]/50 shadow-[0_0_10px_var(--accent-yellow)]'
              : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 border border-transparent'
              }`}
          >
            Department
          </button>
          <button
            onClick={() => setActiveTab('category')}
            className={`px-5 py-2.5 rounded-lg font-bold text-sm tracking-wide uppercase transition-all ${activeTab === 'category'
              ? 'bg-[var(--accent-yellow)]/20 text-[var(--accent-yellow)] border border-[var(--accent-yellow)]/50 shadow-[0_0_10px_var(--accent-yellow)]'
              : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 border border-transparent'
              }`}
          >
            By Category
          </button>
          <button
            onClick={() => setActiveTab('leetcode')}
            className={`px-5 py-2.5 rounded-lg font-bold text-sm tracking-wide uppercase transition-all ${activeTab === 'leetcode'
              ? 'bg-[var(--accent-yellow)]/20 text-[var(--accent-yellow)] border border-[var(--accent-yellow)]/50 shadow-[0_0_10px_var(--accent-yellow)]'
              : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 border border-transparent'
              }`}
          >
            LeetCode
          </button>
        </div>

        {/* LeetCode Registration and Leaderboard */}
        {activeTab === 'leetcode' && (
          <div className="mb-8">
            {/* Registration Form */}
            {!user?.id || !leetcodeLeaderboard.some(e => e.userId === user?.id) ? (
              <div className="bg-[var(--bg-card)] border border-white/5 rounded-xl p-5 mb-6">
                <h2 className="text-lg font-bold text-white mb-4">Register for LeetCode Leaderboard</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <input
                    type="text"
                    placeholder="Name"
                    value={user?.name || ''}
                    readOnly
                    className="w-full px-4 py-2 bg-black/50 border border-gray-700 rounded-lg text-gray-400 cursor-not-allowed"
                  />
                  <input
                    type="text"
                    placeholder="Email"
                    value={user?.email || ''}
                    readOnly
                    className="w-full px-4 py-2 bg-black/50 border border-gray-700 rounded-lg text-gray-400 cursor-not-allowed"
                  />
                  <input
                    type="text"
                    placeholder="LeetCode Username"
                    value={leetcodeUsername}
                    onChange={(e) => setLeetcodeUsername(e.target.value)}
                    className="w-full px-4 py-2 bg-black/50 border border-gray-700 rounded-lg text-white focus:border-[var(--accent-yellow)] focus:outline-none"
                  />
                </div>
                <button
                  onClick={handleLeetcodeRegister}
                  disabled={registering || !leetcodeUsername.trim()}
                  className="px-6 py-2 bg-[var(--accent-yellow)] hover:bg-yellow-500 disabled:opacity-50 text-black font-bold rounded-lg transition-colors"
                >
                  {registering ? 'Registering...' : 'Register'}
                </button>
              </div>
            ) : (
              <div className="bg-[var(--bg-card)] border border-white/5 rounded-xl p-4 mb-6 flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Your LeetCode Username</p>
                  <p className="text-white font-bold">{leetcodeLeaderboard.find(e => e.userId === user?.id)?.leetcodeUsername}</p>
                </div>
                <span className="px-3 py-1 bg-[var(--accent-yellow)]/20 text-[var(--accent-yellow)] rounded-lg text-sm font-bold">Rank #{leetcodeLeaderboard.find(e => e.userId === user?.id)?.rank}</span>
              </div>
            )}

            {error && (
              <div className="p-3 mb-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Leaderboard Table */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent-yellow)]" />
              </div>
            ) : leetcodeLeaderboard.length === 0 ? (
              <div className="text-center py-20 bg-[var(--bg-card)] border border-white/5 rounded-xl">
                <p className="text-gray-500 font-medium text-lg">No LeetCode entries yet. Register above to join!</p>
              </div>
            ) : (
              <div className="bg-[var(--bg-card)] border border-white/5 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left whitespace-nowrap">
                    <thead className="bg-white/5 border-b border-white/10 uppercase text-xs tracking-wider">
                      <tr>
                        <th className="px-6 py-4 text-gray-400 font-bold">Rank</th>
                        <th className="px-6 py-4 text-gray-400 font-bold">Student</th>
                        <th className="px-6 py-4 text-gray-400 font-bold">LeetCode Username</th>
                        <th className="px-6 py-4 text-[var(--accent-green)] font-bold">Easy</th>
                        <th className="px-6 py-4 text-[var(--accent-yellow)] font-bold">Medium</th>
                        <th className="px-6 py-4 text-[var(--accent-red)] font-bold">Hard</th>
                        <th className="px-6 py-4 text-gray-400 font-bold">Total</th>
                        <th className="px-6 py-4 text-[var(--accent-yellow)] font-bold">Score</th>
                        <th className="px-6 py-4 text-right text-gray-400 font-bold">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {leetcodeLeaderboard.map((entry) => (
                        <tr key={entry.id} className={`hover:bg-white/5 transition-colors ${entry.userId === user?.id ? 'bg-[var(--accent-yellow)]/5' : ''}`}>
                          <td className="px-6 py-4">
                            <span className={`text-xl font-black italic tracking-tighter ${entry.rank <= 3 ? 'text-[var(--accent-yellow)]' : 'text-gray-500'}`}>
                              #{entry.rank}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                                {entry.fullName.charAt(0)}
                              </div>
                              <span className="text-white font-bold text-sm">{entry.fullName}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <a
                              href={`https://leetcode.com/${entry.leetcodeUsername}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[var(--accent-yellow)] hover:underline"
                            >
                              @{entry.leetcodeUsername}
                            </a>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-green-400 font-bold text-lg">{entry.easySolved}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-[var(--accent-yellow)] font-bold text-lg">{entry.mediumSolved}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-red-400 font-bold text-lg">{entry.hardSolved}</span>
                          </td>
                          <td className="px-6 py-4 text-white font-bold text-lg">{entry.totalSolved}</td>
                          <td className="px-6 py-4">
                            <span className="font-bold text-[var(--accent-yellow)] text-lg">{entry.score}</span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            {entry.userId === user?.id && (
                              <div className="flex gap-2 justify-end">
                                <button
                                  onClick={() => handleLeetcodeSync(entry.id)}
                                  disabled={syncingId === entry.id}
                                  className="px-3 py-1.5 bg-[var(--accent-green)]/20 hover:bg-green-500/30 disabled:opacity-50 text-[var(--accent-green)] text-xs font-bold rounded-lg transition-colors"
                                >
                                  {syncingId === entry.id ? 'Syncing...' : 'Sync'}
                                </button>
                                <button
                                  onClick={() => handleLeetcodeDelete(entry.id)}
                                  className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-bold rounded-lg transition-colors"
                                >
                                  Delete
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Period Tabs */}
        <div className="flex items-center gap-2 mb-6 px-1">
          <span className="text-xs font-bold uppercase tracking-widest text-gray-500 mr-2">Period</span>
          {PERIODS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriodTab(p.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-bold tracking-wide transition-all ${periodTab === p.id
                ? 'bg-white/10 text-white border border-white/20'
                : 'text-gray-500 hover:text-gray-300 border border-transparent'
                }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Category Filter */}
        {activeTab === 'category' && (
          <div className="flex flex-wrap gap-2 mb-8 p-4 bg-white/5 rounded-xl border border-white/5">
            {['legend', 'builder', 'grinder', 'starter'].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${selectedCategory === cat
                  ? getCategoryColor(cat) + ' shadow-lg scale-105'
                  : 'bg-black/50 text-gray-500 hover:text-white hover:bg-white/10'
                  }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* Department Filter */}
        {activeTab === 'department' && departments.length > 0 && (
          <div className="mb-8 p-4 bg-white/5 rounded-xl border border-white/5 flex items-center gap-4">
            <span className="text-gray-400 font-medium text-sm uppercase tracking-wider">Select Dept:</span>
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="bg-black/50 border border-gray-700 focus:border-[var(--accent-green)] text-white px-4 py-2 rounded-lg outline-none font-medium"
            >
              {departments.map((dept) => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
        )}

        {/* Platform Filter */}
        {activeTab === 'platform' && (
          <>
            <div className="flex flex-wrap gap-2 mb-4 p-4 bg-white/5 rounded-xl border border-white/5">
              {PLATFORMS.map((platform) => (
                <button
                  key={platform.id}
                  onClick={() => setSelectedPlatform(platform.id)}
                  className={`px-4 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${selectedPlatform === platform.id
                    ? 'bg-[var(--accent-green)]/20 text-[var(--accent-green)] border border-[var(--accent-green)]/50 shadow-lg scale-105'
                    : 'bg-black/50 text-gray-500 hover:text-white hover:bg-white/10 border border-transparent'
                    }`}
                >
                  {platform.name}
                </button>
              ))}
            </div>
            {platformLeaderboard.length > 0 && (
              <div className="mb-6 px-2">
                <span className="text-sm text-gray-500">
                  Showing all students • <span className="text-[var(--accent-green)]">{platformLeaderboard.filter(e => e.hasConnected).length}</span> connected {PLATFORMS.find(p => p.id === selectedPlatform)?.fullName}
                </span>
              </div>
            )}
          </>
        )}

        {/* Leaderboard Table - Only show for non-platform tabs */}
        {activeTab !== 'platform' && (
          <>
            {loading || syncing ? (
              <div className="bg-white/5 rounded-lg h-48" />
            ) : (
              <div className="card-container rounded-xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left whitespace-nowrap">
                <thead className="bg-white/5 border-b border-white/10 uppercase text-xs tracking-wider">
                  <tr>
                    <th className="px-6 py-4 text-gray-400 font-bold">Rank</th>
                    <th className="px-6 py-4 text-gray-400 font-bold">Student</th>
                    <th className="px-6 py-4 text-gray-400 font-bold hidden md:table-cell">Institution</th>
                    <th className="px-6 py-4 text-[var(--accent-green)] font-bold">Trust Score</th>
                    <th className="px-6 py-4 text-gray-400 font-bold">Category</th>
                    <th className="px-6 py-4 text-right text-gray-400 font-bold">Activity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {paginatedData.map((entry, index) => (
                    <tr key={entry.id} onClick={() => navigate(`/u/${encodeURIComponent(entry.username || entry.profileUsername || entry.name)}`)} className="hover:bg-white/5 transition-colors group cursor-pointer">
                      <td className="px-6 py-4">
                        <span className={`text-xl font-black italic tracking-tighter ${index === 0 ? 'text-[var(--accent-yellow)] text-glow-yellow' :
                          index === 1 ? 'text-gray-300' :
                            index === 2 ? 'text-[#cd7f32]' : // bronze
                              'text-gray-500 group-hover:text-white'
                          }`}>
                          #{entry.rank}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          {entry.avatar_url ? (
                            <img src={entry.avatar_url} alt="" className="w-10 h-10 rounded-full border-2 border-transparent group-hover:border-[var(--accent-yellow)] transition-colors" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center text-white font-bold text-lg border-2 border-transparent group-hover:border-[var(--accent-yellow)] transition-colors shadow-lg">
                              {entry.name.charAt(0)}
                            </div>
                          )}
                          <span className="text-white font-bold text-sm sm:text-base">{entry.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 hidden md:table-cell">
                        <div className="flex flex-col">
                          <span className="text-gray-300 font-medium text-sm">{entry.university || 'N/A'}</span>
                          {entry.department && <span className="text-[var(--accent-yellow)]/70 text-xs font-bold uppercase tracking-wider mt-0.5">{entry.department}</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {entry.trust_score ? (
                          <span className={`font-black text-lg tracking-tight ${entry.trust_score >= 80 ? 'text-[var(--accent-green)] text-glow-green' :
                            entry.trust_score >= 60 ? 'text-[var(--accent-yellow)]' :
                              'text-[var(--accent-red)]'
                            }`}>
                            {entry.trust_score}%
                          </span>
                        ) : (
                          <span className="text-gray-600 font-medium px-2">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {entry.category ? (
                          <span className={`px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider ${getCategoryColor(entry.category)}`}>
                            {entry.category}
                          </span>
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="bg-white/5 text-white font-bold px-3 py-1.5 rounded-lg text-sm border border-white/10 group-hover:border-[var(--accent-green)] transition-colors">
                          {entry.problems_solved || entry.activity_score || 0}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {leaderboard.length === 0 && (
              <div className="text-center py-12 text-gray-500 font-medium text-lg italic">
                No students found
              </div>
            )}

            {leaderboard.length > 0 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-white/5 bg-white/[0.02]">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 font-medium">Rows:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                    className="bg-black/50 border border-gray-700 rounded text-xs text-gray-300 px-2 py-1 outline-none focus:border-[var(--accent-green)]"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                  <span className="text-xs text-gray-500 ml-2">
                    {(page - 1) * pageSize + 1}&ndash;{Math.min(page * pageSize, leaderboard.length)} of {leaderboard.length}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => goToPage(page - 1)}
                    disabled={page <= 1}
                    className="px-3 py-1.5 rounded text-xs font-bold bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    Prev
                  </button>
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    const start = Math.max(1, Math.min(page - 3, totalPages - 6));
                    const p = start + i;
                    if (p > totalPages) return null;
                    return (
                      <button
                        key={p}
                        onClick={() => goToPage(p)}
                        className={`w-8 h-8 rounded text-xs font-bold transition-all ${page === p
                          ? 'bg-[var(--accent-green)]/20 text-[var(--accent-green)] border border-[var(--accent-green)]/50'
                          : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
                          }`}
                      >
                        {p}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => goToPage(page + 1)}
                    disabled={page >= totalPages}
                    className="px-3 py-1.5 rounded text-xs font-bold bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
            )}
          </>
        )}

        {/* Platform-specific Leaderboard Table */}
        {activeTab === 'platform' && (loading || syncing ? (
          <div className="bg-white/5 rounded-lg h-48" />
        ) : (
          <div className="card-container rounded-xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left whitespace-nowrap">
                <thead className="bg-white/5 border-b border-white/10 uppercase text-xs tracking-wider">
                  <tr>
                    <th className="px-6 py-4 text-gray-400 font-bold">Rank</th>
                    <th className="px-6 py-4 text-gray-400 font-bold">Student</th>
                    <th className="px-6 py-4 text-gray-400 font-bold hidden md:table-cell">Institution</th>
                    <th className="px-6 py-4 text-gray-400 font-bold">
                      {selectedPlatform === 'leetcode' && 'Problems Solved'}
                      {selectedPlatform === 'codeforces' && 'Rating'}
                      {selectedPlatform === 'codechef' && 'Rating'}
                      {selectedPlatform === 'github' && 'Contributions'}
                    </th>
                    <th className="px-6 py-4 text-gray-400 font-bold">Username</th>
                    {selectedPlatform === 'github' && (
                      <th className="px-6 py-4 text-right text-gray-400 font-bold">Public Repos</th>
                    )}
                    {!selectedPlatform.includes('github') && (
                      <th className="px-6 py-4 text-right text-gray-400 font-bold">
                        {selectedPlatform === 'leetcode' && 'Difficulty'}
                        {selectedPlatform === 'codeforces' && 'Rank'}
                        {selectedPlatform === 'codechef' && 'Stars'}
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {paginatedData.map((entry, index) => (
                    <tr key={entry.id} onClick={() => navigate(`/u/${encodeURIComponent(entry.profileUsername || entry.name)}`)} className={`hover:bg-white/5 transition-colors group cursor-pointer ${!entry.hasConnected ? 'opacity-50' : ''}`}>
                      <td className="px-6 py-4">
                        <span className={`text-xl font-black italic tracking-tighter ${!entry.hasConnected ? 'text-gray-600' :
                          index === 0 ? 'text-[var(--accent-yellow)] text-glow-yellow' :
                            index === 1 ? 'text-gray-300' :
                              index === 2 ? 'text-[#cd7f32]' : 'text-gray-500 group-hover:text-white'
                          }`}>
                          #{entry.rank}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          {entry.avatar_url ? (
                            <img src={entry.avatar_url} alt="" className="w-10 h-10 rounded-full border-2 border-transparent group-hover:border-[var(--accent-yellow)] transition-colors" />
                          ) : (
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg border-2 border-transparent group-hover:border-[var(--accent-yellow)] transition-colors shadow-lg ${!entry.hasConnected ? 'bg-gray-700' : 'bg-gradient-to-br from-gray-700 to-gray-900'}`}>
                              {entry.name.charAt(0)}
                            </div>
                          )}
                          <span className={`font-bold text-sm sm:text-base ${!entry.hasConnected ? 'text-gray-500' : 'text-white'}`}>{entry.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 hidden md:table-cell">
                        <div className="flex flex-col">
                          <span className="text-gray-300 font-medium text-sm">{entry.university || 'N/A'}</span>
                          {entry.department && <span className="text-[var(--accent-yellow)]/70 text-xs font-bold uppercase tracking-wider mt-0.5">{entry.department}</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`font-black text-lg tracking-tight ${!entry.hasConnected ? 'text-gray-600' :
                          entry.score >= 2000 ? 'text-[var(--accent-green)] text-glow-green' :
                            entry.score >= 1000 ? 'text-[var(--accent-yellow)]' : 'text-white'
                          }`}>
                          {entry.hasConnected ? entry.score : '—'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`font-bold text-sm ${entry.hasConnected ? 'text-[var(--accent-blue)]' : 'text-gray-600'}`}>
                          {entry.hasConnected ? `@${entry.username}` : 'N/A'}
                        </span>
                      </td>
                      {selectedPlatform === 'github' && (
                        <td className="px-6 py-4 text-right">
                          {entry.hasConnected && entry.stats ? (
                            <span className="bg-white/5 text-white font-bold px-3 py-1.5 rounded-lg text-sm border border-white/10 group-hover:border-[var(--accent-green)] transition-colors">
                              {entry.stats.repos || 0} repos
                            </span>
                          ) : (
                            <span className="text-gray-600 text-sm">Not connected</span>
                          )}
                        </td>
                      )}
                      {!selectedPlatform.includes('github') && (
                        <td className="px-6 py-4 text-right">
                          <div className="flex flex-col items-end">
                            {selectedPlatform === 'leetcode' && entry.hasConnected && entry.stats && (
                              <span className="bg-white/5 text-white font-bold px-3 py-1.5 rounded-lg text-sm border border-white/10 group-hover:border-[var(--accent-green)] transition-colors">
                                {entry.stats.easy || 0}E / {entry.stats.medium || 0}M / {entry.stats.hard || 0}H
                              </span>
                            )}
                            {selectedPlatform === 'codeforces' && entry.hasConnected && entry.stats && (
                              <span className="bg-white/5 text-white font-bold px-3 py-1.5 rounded-lg text-sm border border-white/10 group-hover:border-[var(--accent-green)] transition-colors">
                                {entry.stats.rank || 'newbie'}
                              </span>
                            )}
                            {selectedPlatform === 'codechef' && entry.hasConnected && entry.stats && (
                              <span className="bg-white/5 text-white font-bold px-3 py-1.5 rounded-lg text-sm border border-white/10 group-hover:border-[var(--accent-green)] transition-colors">
                                {entry.stats.stars || '0'}★
                              </span>
                            )}
                            {selectedPlatform === 'github' && entry.hasConnected && entry.stats && (
                              <span className="bg-white/5 text-white font-bold px-3 py-1.5 rounded-lg text-sm border border-white/10 group-hover:border-[var(--accent-green)] transition-colors">
                                {entry.stats.repos || 0} repos
                              </span>
                            )}
                            {!entry.hasConnected && (
                              <span className="text-gray-600 text-sm">Not connected</span>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {platformLeaderboard.length === 0 && (
              <div className="text-center py-12 text-gray-500 font-medium text-lg italic">
                No students found
              </div>
            )}

            {platformLeaderboard.length > 0 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-white/5 bg-white/[0.02]">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 font-medium">Rows:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                    className="bg-black/50 border border-gray-700 rounded text-xs text-gray-300 px-2 py-1 outline-none focus:border-[var(--accent-green)]"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                  <span className="text-xs text-gray-500 ml-2">
                    {(page - 1) * pageSize + 1}&ndash;{Math.min(page * pageSize, platformLeaderboard.length)} of {platformLeaderboard.length}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => goToPage(page - 1)}
                    disabled={page <= 1}
                    className="px-3 py-1.5 rounded text-xs font-bold bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    Prev
                  </button>
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    const start = Math.max(1, Math.min(page - 3, totalPages - 6));
                    const p = start + i;
                    if (p > totalPages) return null;
                    return (
                      <button
                        key={p}
                        onClick={() => goToPage(p)}
                        className={`w-8 h-8 rounded text-xs font-bold transition-all ${page === p
                          ? 'bg-[var(--accent-green)]/20 text-[var(--accent-green)] border border-[var(--accent-green)]/50'
                          : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
                          }`}
                      >
                        {p}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => goToPage(page + 1)}
                    disabled={page >= totalPages}
                    className="px-3 py-1.5 rounded text-xs font-bold bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </main>
    </div>
  );
}
