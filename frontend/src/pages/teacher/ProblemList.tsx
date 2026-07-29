import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { useNotify } from '../../components/notifications';

interface Problem {
  id: string;
  title: string;
  difficulty: string;
  category: string | null;
  problemType?: string;
  evaluationStrategy: string;
  testCases?: any[];
  _count?: { testCases?: number; contestProblems?: number };
  createdById?: string;
  createdAt: string;
}

const TYPE_TABS = ['all', 'code', 'sql', 'web-dev'] as const;

const TYPE_LABELS: Record<string, string> = {
  code: 'Code',
  sql: 'SQL',
  'web-dev': 'Web Dev',
};

const TYPE_COLORS: Record<string, string> = {
  code: 'text-blue-400 bg-blue-500/10',
  sql: 'text-purple-400 bg-purple-500/10',
  'web-dev': 'text-orange-400 bg-orange-500/10',
};

const DIFFICULTY_COLORS: Record<string, string> = {
  Easy: 'text-green-400 bg-green-500/10',
  Medium: 'text-yellow-400 bg-yellow-500/10',
  Hard: 'text-red-400 bg-red-500/10',
};

const STRATEGY_LABELS: Record<string, string> = {
  EXACT_MATCH: 'Exact Match',
  UNORDERED_MATCH: 'Any Order',
  FLOAT_TOLERANCE: 'Float Tolerance',
};

export function TeacherProblemListPage() {
  const notify = useNotify();
  const [problems, setProblems] = useState<Problem[]>(() => {
    try {
      const c = sessionStorage.getItem('teacher:problems');
      return c ? JSON.parse(c) : [];
    } catch { return []; }
  });
  const [loading, setLoading] = useState(!problems.length);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [filterType, setFilterType] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const navigate = useNavigate();

  useEffect(() => {
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const u = JSON.parse(userStr);
        setCurrentUserId(u.id || u.userId || '');
      }
    } catch {}
    loadProblems();
  }, []);

  const loadProblems = async () => {
    try {
      const data = await api.getProblems();
      setProblems(data.problems || []);
      try { sessionStorage.setItem('teacher:problems', JSON.stringify(data.problems || [])); } catch (err) { console.error('Operation failed:', err); }
    } catch (err) {
      console.error('Failed to load problems:', err);
    } finally {
      if (loading) setLoading(false);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!(await notify.confirm(`Delete "${title}"? This cannot be undone.`, { variant: 'error' }))) return;
    try {
      await api.deleteProblem(id);
      setProblems(prev => prev.filter(p => p.id !== id));
      notify.toast.success('Problem deleted');
    } catch (err) {
      console.error('Failed to delete problem:', err);
    }
  };

  const handleClone = async (id: string, title: string) => {
    try {
      await api.copyPublicProblem(id);
      notify.toast.success(`"${title}" cloned to your Organization Bank!`);
      loadProblems();
    } catch (err: any) {
      notify.toast.error(err?.response?.data?.error || 'Failed to clone problem');
    }
  };

  if (loading) {
    return <div className="bg-white/5 rounded-lg h-64" />;
  }

  const sampleCount = (tc?: any[]) => (Array.isArray(tc) ? tc.filter((t: any) => !t.isHidden).length : 0);
  const hiddenCount = (tc?: any[]) => (Array.isArray(tc) ? tc.filter((t: any) => t.isHidden).length : 0);

  const filteredProblems = problems.filter(p => {
    const typeMatch = activeTab === 'all' || (p.problemType || 'code') === activeTab;
    const catMatch = filterCategory === 'all' || (p.category || 'General') === filterCategory;
    return typeMatch && catMatch;
  });

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight mb-2">
            Problem Bank<span className="text-[var(--accent-green)]">.</span>
          </h1>
          <p className="text-gray-400 font-medium">Manage and curate coding challenges</p>
        </div>
        <Link
          to="/problems/new"
          className="px-4 py-2 bg-[var(--accent-green)] text-white font-semibold rounded-lg hover:opacity-90 transition"
        >
          + New Problem
        </Link>
      </div>

      {/* Type tabs */}
      <div className="flex items-center gap-1 mb-6 bg-[var(--bg-card)] border border-white/10 rounded-lg p-1 w-fit">
        {TYPE_TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
              activeTab === tab
                ? 'bg-[var(--accent-blue)] text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab === 'all' ? 'All' : TYPE_LABELS[tab]}
            {tab !== 'all' && (
              <span className="ml-1.5 text-xs opacity-60">
                ({problems.filter(p => (p.problemType || 'code') === tab).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {problems.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-500 text-lg mb-4">No problems yet</p>
          <Link
            to="/problems/new"
            className="px-6 py-3 bg-[var(--accent-blue)] text-white font-semibold rounded-lg hover:opacity-90 transition"
          >
            Create your first problem
          </Link>
        </div>
      ) : filteredProblems.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-500 text-lg mb-4">No problems match the selected filters.</p>
        </div>
      ) : (
        <>
          <div className="flex gap-4 mb-6">
            <select 
              className="bg-[var(--bg-card)] border border-white/10 rounded-lg px-4 py-2 outline-none focus:border-[var(--accent-green)] text-sm text-white min-w-[150px]"
              value={filterType} onChange={e => setFilterType(e.target.value)}
            >
              <option value="all">All Types</option>
              <option value="code">Coding</option>
              <option value="web-dev">Web Dev</option>
              <option value="sql">SQL</option>
            </select>
            <select 
              className="bg-[var(--bg-card)] border border-white/10 rounded-lg px-4 py-2 outline-none focus:border-[var(--accent-green)] text-sm text-white min-w-[150px]"
              value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
            >
              <option value="all">All Categories</option>
              {Array.from(new Set(problems.map(p => p.category || 'General'))).map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="space-y-3">
            {filteredProblems.map(problem => (
              <div
                key={problem.id}
                className="bg-[var(--bg-card)] border border-white/10 rounded-xl p-4 hover:border-white/20 transition cursor-pointer"
                onClick={() => navigate(`/problems/${problem.id}/edit`)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h3 className="text-white font-semibold">{problem.title}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${DIFFICULTY_COLORS[problem.difficulty] || 'text-gray-400'}`}>
                      {problem.difficulty}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${TYPE_COLORS[problem.problemType || 'code']}`}>
                      {TYPE_LABELS[problem.problemType || 'code']}
                    </span>
                    {problem.category && (
                      <span className="text-xs text-gray-500 bg-white/5 px-2 py-0.5 rounded">
                        {problem.category}
                      </span>
                    )}
                    {problem.createdById === currentUserId ? (
                      <span className="text-xs px-2 py-0.5 rounded font-bold border border-green-500/30 text-green-400 bg-green-500/10">
                        My Creation
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded font-medium border border-white/5 text-gray-400 bg-white/5">
                        Shared
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-gray-500">
                      {Array.isArray(problem.testCases)
                        ? `${sampleCount(problem.testCases)} sample · ${hiddenCount(problem.testCases)} hidden`
                        : `${problem._count?.testCases || 0} test cases`}
                    </span>
                    <span className="text-xs text-gray-400 bg-white/5 px-2 py-0.5 rounded">
                      {STRATEGY_LABELS[problem.evaluationStrategy] || problem.evaluationStrategy}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleClone(problem.id, problem.title); }}
                      className="text-xs px-2.5 py-1 rounded font-bold border border-blue-500/30 text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 transition flex items-center gap-1"
                      title="Clone to Private Bank"
                    >
                      <span>📥</span> Clone
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(problem.id, problem.title); }}
                      className="text-gray-500 hover:text-red-400 p-1 transition"
                      title="Delete problem"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
