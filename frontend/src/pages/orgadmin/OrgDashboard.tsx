import { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { QuestionBankPage } from '../teacher/QuestionBankPage';

type TabId = 'overview' | 'contests' | 'team' | 'problems' | 'participants' | 'billing';

interface OrgData {
  id: string;
  name: string;
  slug: string;
  users: any[];
  _count: { users: number; contests: number };
  subscriptionTier: string;
  status: string;
}

interface Analytics {
  totalUsers: number;
  totalContests: number;
  activeContests: number;
  totalSubmissions: number;
}

interface TeamMember {
  id: string;
  userId: string;
  role: string;
  user: { id: string; fullName: string; name?: string; email: string; lastLogin?: string };
  name?: string;
  email?: string;
}

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
  pasteMode: string;
  randomizeQuestionOrder: boolean;
  snapshotIntervalSeconds: number;
  maxWarnings: number;
  assessmentType?: string;
  _count: { participants: number; problems: number };
}

interface Problem {
  id: string;
  title: string;
  difficulty: string;
  category?: string;
  problemType?: string;
}

interface Subscription {
  tier: string;
  status: string;
  maxUsers: number;
  maxContests: number;
  expiresAt?: string;
}

interface Usage {
  users: number;
  contests: number;
  submissions: number;
}

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'overview', label: 'Command Center', icon: '📊' },
  { id: 'contests', label: 'Contest Suite', icon: '🏆' },
  { id: 'team', label: 'Team & Access', icon: '👥' },
  { id: 'problems', label: 'Question Bank', icon: '📝' },
  { id: 'participants', label: 'Candidates & Shortlists', icon: '🎯' },
  { id: 'billing', label: 'Seats & Billing', icon: '💳' },
];

const ASSESSMENT_TYPES = [
  { id: 'CODING', label: 'DSA Coding', icon: '💻', desc: 'Automated test case execution in 25+ languages' },
  { id: 'SQL', label: 'SQL & Database', icon: '🗄️', desc: 'Real SQLite schema execution & result grid comparison' },
  { id: 'WEB_DEV', label: 'Web Development', icon: '🌐', desc: 'Live HTML/CSS/JS preview & DOM criteria check' },
  { id: 'MCQ', label: 'Technical MCQ', icon: '☑️', desc: 'Single & multi-choice questions with distractor rationale' },
  { id: 'APTITUDE', label: 'Aptitude & Numerical', icon: '🔢', desc: 'Numerical problem solving with formula calculator' },
  { id: 'VERBAL', label: 'Verbal Reasoning', icon: '📖', desc: 'Reading comprehension passages & linked items' },
  { id: 'LOGICAL', label: 'Logical & Abstract', icon: '🧩', desc: 'Pattern recognition & spatial reasoning' },
  { id: 'PSYCHOMETRIC', label: 'Psychometric (OCEAN)', icon: '🧠', desc: 'Big-5 personality constructs & Likert scaling' },
  { id: 'SJT', label: 'Situational Judgment', icon: '⚖️', desc: 'Workplace scenario ranking & efficacy scoring' },
  { id: 'ESSAY', label: 'Subjective & Essay', icon: '📝', desc: 'Long-form answer evaluation with rubric grading' },
  { id: 'HYBRID', label: 'Multi-Section Hybrid', icon: '⚡', desc: 'Combined multi-domain assessment drive' }
];

const CONTEST_TEMPLATES = [
  {
    name: 'Campus Engineering Drive',
    type: 'HYBRID',
    duration: 90,
    difficulty: 'Medium',
    desc: 'Section A: Aptitude (20m) + Section B: Coding DSA (70m)'
  },
  {
    name: 'Senior Full-Stack Assessment',
    type: 'WEB_DEV',
    duration: 120,
    difficulty: 'Hard',
    desc: 'React component building + Node SQL optimization'
  },
  {
    name: 'Graduate Placement Screener',
    type: 'APTITUDE',
    duration: 60,
    difficulty: 'Easy',
    desc: 'Numerical, Verbal, & Logical reasoning evaluation'
  },
  {
    name: 'Data Analyst SQL Challenge',
    type: 'SQL',
    duration: 45,
    difficulty: 'Medium',
    desc: 'Complex JOINs, Aggregations, & Window Functions'
  }
];

const ROLE_STYLES: Record<string, string> = {
  ORG_ADMIN: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  ORG_MEMBER: 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
  EVALUATOR: 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30',
  PROCTOR: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
  STUDENT: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
  ANALYTICS_VIEWER: 'bg-teal-500/20 text-teal-400 border border-teal-500/30',
  CONTEST_MODERATOR: 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
  COMPLIANCE_OFFICER: 'bg-red-500/20 text-red-400 border border-red-500/30',
  GUEST_CANDIDATE: 'bg-zinc-500/20 text-zinc-400 border border-zinc-500/30',
};

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'bg-green-500/20 text-green-400 border border-green-500/30',
  SUSPENDED: 'bg-red-500/20 text-red-400 border border-red-500/30',
};

function Sparkline({ color }: { color: string }) {
  const points = [20, 35, 28, 45, 52, 48, 65, 58, 75].map((v, i) => `${i * 11},${80 - v}`).join(' ');
  return (
    <svg className="w-14 h-5 opacity-60" viewBox="0 0 88 80">
      <polyline fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={points} />
    </svg>
  );
}

function difficultyColor(d: string) {
  if (d === 'Easy') return 'bg-green-500/20 text-green-400';
  if (d === 'Medium') return 'bg-yellow-500/20 text-yellow-400';
  return 'bg-red-500/20 text-red-400';
}

export function OrgDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [org, setOrg] = useState<OrgData | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [contests, setContests] = useState<Contest[]>([]);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('ORG_MEMBER');
  const [inviting, setInviting] = useState(false);

  const [teamSearch, setTeamSearch] = useState('');
  const [problemSearch, setProblemSearch] = useState('');
  const [problemFilterDiff, setProblemFilterDiff] = useState('all');
  const [problemFilterType, setProblemFilterType] = useState('all');

  const [showCreateContest, setShowCreateContest] = useState(false);
  const [creatingContest, setCreatingContest] = useState(false);
  const [selectedAssessmentType, setSelectedAssessmentType] = useState('CODING');

  const [contestForm, setContestForm] = useState({
    title: '', description: '', startTime: '', endTime: '', duration: 120,
    difficulty: 'Medium', isPublic: false, requireFullscreen: true,
    preventTabSwitch: true, disableCopyPaste: true, enableProctoring: false,
    requireSeb: false, allowMultipleMonitors: false,
    pasteMode: 'LOG_ONLY' as 'ALLOWED' | 'LOG_ONLY' | 'BLOCKED',
    randomizeQuestionOrder: true, snapshotIntervalSeconds: 45, maxWarnings: 3,
    assessmentType: 'CODING'
  });

  const loadOrg = useCallback(async () => {
    try {
      const data = await api.getOrganization();
      setOrg(data.organization);
      return data.organization;
    } catch { return null; }
  }, []);

  const loadAnalytics = useCallback(async (orgId: string) => {
    try {
      const data = await api.getOrgAnalytics(orgId);
      setAnalytics(data.analytics);
    } catch { /* noop */ }
  }, []);

  const loadTeam = useCallback(async (orgId: string) => {
    try {
      const data = await api.getOrgTeam(orgId);
      setMembers(data.members || []);
    } catch { /* noop */ }
  }, []);

  const loadContests = useCallback(async () => {
    try {
      const data = await api.getTeacherManagedContests();
      setContests(data.contests || []);
    } catch { /* noop */ }
  }, []);

  const loadProblems = useCallback(async () => {
    try {
      const data = await api.getProblems();
      setProblems(data.problems || []);
    } catch { /* noop */ }
  }, []);

  const loadBilling = useCallback(async () => {
    try {
      const [sub, u] = await Promise.all([api.getSubscription(), api.getUsage()]);
      setSubscription(sub.subscription);
      setUsage(u.usage);
    } catch { /* noop */ }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const orgData = await loadOrg();
        if (orgData) {
          setLoading(false);
          Promise.all([
            loadAnalytics(orgData.id),
            loadTeam(orgData.id),
            loadContests(),
            loadProblems(),
            loadBilling(),
          ]).catch(console.error);
        } else {
          setError('Failed to load organization data.');
          setLoading(false);
        }
      } catch { 
        setError('Failed to load organization data.'); 
        setLoading(false);
      }
    })();
  }, [loadOrg, loadAnalytics, loadTeam, loadContests, loadProblems, loadBilling]);

  const handleInvite = async () => {
    if (!org || !inviteEmail.trim()) return;
    setInviting(true);
    try {
      await api.inviteTeamMember(org.id, inviteEmail.trim());
      setShowInvite(false);
      setInviteEmail('');
      setInviteRole('ORG_MEMBER');
      loadTeam(org.id);
    } catch { /* noop */ }
    setInviting(false);
  };

  const handleRemoveMember = async (userId: string) => {
    if (!org) return;
    if (!window.confirm('Remove this member from the organization?')) return;
    try {
      await api.removeTeamMember(org.id, userId);
      loadTeam(org.id);
    } catch { /* noop */ }
  };

  const handleChangeRole = async (userId: string, newRole: string) => {
    if (!org) return;
    try {
      await api.changeMemberRole(org.id, userId, newRole);
      loadTeam(org.id);
    } catch { /* noop */ }
  };

  const applyTemplate = (tpl: typeof CONTEST_TEMPLATES[0]) => {
    setSelectedAssessmentType(tpl.type);
    setContestForm(prev => ({
      ...prev,
      title: tpl.name,
      description: tpl.desc,
      duration: tpl.duration,
      difficulty: tpl.difficulty,
      assessmentType: tpl.type
    }));
  };

  const handleCreateContest = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingContest(true);
    try {
      await api.createManagerContest({
        ...contestForm,
        assessmentType: selectedAssessmentType
      });
      setShowCreateContest(false);
      loadContests();
      setContestForm({
        title: '', description: '', startTime: '', endTime: '', duration: 120,
        difficulty: 'Medium', isPublic: false, requireFullscreen: true,
        preventTabSwitch: true, disableCopyPaste: true, enableProctoring: false,
        requireSeb: false, allowMultipleMonitors: false,
        pasteMode: 'LOG_ONLY', randomizeQuestionOrder: true,
        snapshotIntervalSeconds: 45, maxWarnings: 3,
        assessmentType: 'CODING'
      });
    } catch { /* noop */ }
    setCreatingContest(false);
  };

  const filteredMembers = members.filter(m => {
    const name = (m.user?.name || m.user?.fullName || m.name || '').toLowerCase();
    const email = (m.user?.email || m.email || '').toLowerCase();
    const query = teamSearch.toLowerCase();
    return name.includes(query) || email.includes(query);
  });

  const filteredProblems = problems.filter(p => {
    const matchSearch = p.title.toLowerCase().includes(problemSearch.toLowerCase());
    const matchDiff = problemFilterDiff === 'all' || p.difficulty === problemFilterDiff;
    const matchType = problemFilterType === 'all' || (p.problemType || 'code') === problemFilterType;
    return matchSearch && matchDiff && matchType;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-red-400 text-lg">{error}</p>
          <button onClick={() => window.location.reload()} className="px-4 py-2 bg-blue-500 hover:bg-blue-400 text-white rounded-lg font-bold text-sm">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-zinc-950">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-black tracking-tight">
                {org?.name || 'Organization'}<span className="text-blue-400">.</span>
              </h1>
              <p className="text-gray-500 text-sm mt-0.5">
                Organiser Admin Command Center
                {org?.slug && <span className="ml-2 text-gray-600 font-mono text-xs">/{org.slug}</span>}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {org?.status && (
                <span className={`px-3 py-1 rounded-lg text-xs font-bold ${STATUS_STYLES[org.status] || ''}`}>
                  {org.status}
                </span>
              )}
              {org?.subscriptionTier && (
                <span className="px-3 py-1 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-lg text-xs font-bold uppercase">
                  {org.subscriptionTier} TIER
                </span>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-5 -mb-px overflow-x-auto">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 rounded-t-lg text-sm font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  activeTab === tab.id
                    ? 'bg-black text-blue-400 border-t border-x border-white/10'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                }`}
              >
                <span>{tab.icon}</span> {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {activeTab === 'overview' && (
          <OverviewTab analytics={analytics} org={org} contests={contests} members={members} usage={usage} subscription={subscription} onNavigateContests={() => setActiveTab('contests')} />
        )}
        {activeTab === 'contests' && (
          <ContestsTab
            contests={contests}
            showCreate={showCreateContest}
            setShowCreate={setShowCreateContest}
            contestForm={contestForm}
            setContestForm={setContestForm}
            creating={creatingContest}
            onCreate={handleCreateContest}
            navigate={navigate}
            reload={loadContests}
            selectedType={selectedAssessmentType}
            setSelectedType={setSelectedAssessmentType}
            applyTemplate={applyTemplate}
          />
        )}
        {activeTab === 'team' && (
          <TeamTab
            members={filteredMembers}
            search={teamSearch}
            setSearch={setTeamSearch}
            showInvite={showInvite}
            setShowInvite={setShowInvite}
            inviteEmail={inviteEmail}
            setInviteEmail={setInviteEmail}
            inviteRole={inviteRole}
            setInviteRole={setInviteRole}
            inviting={inviting}
            onInvite={handleInvite}
            onRemove={handleRemoveMember}
            onChangeRole={handleChangeRole}
          />
        )}
        {activeTab === 'problems' && (
          <QuestionBankPage />
        )}
        {activeTab === 'participants' && (
          <ParticipantsTab contests={contests} />
        )}
        {activeTab === 'billing' && (
          <BillingTab subscription={subscription} usage={usage} />
        )}
      </div>

      {/* 10-Type Aware Contest Creation Modal */}
      {showCreateContest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="bg-zinc-950 border border-white/10 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-6 border-b border-white/10 flex justify-between items-center sticky top-0 bg-zinc-950 z-10">
              <div>
                <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Multi-Modal Assessment Builder</span>
                <h2 className="text-xl font-black text-white">Create New Assessment Drive</h2>
              </div>
              <button onClick={() => setShowCreateContest(false)} className="text-gray-500 hover:text-white text-lg">✕</button>
            </div>
            
            <form onSubmit={handleCreateContest} className="p-6 space-y-6">
              {/* Step 1: Select Assessment Type */}
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">
                  1. Assessment Type & Format
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {ASSESSMENT_TYPES.map(t => (
                    <button
                      type="button"
                      key={t.id}
                      onClick={() => { setSelectedAssessmentType(t.id); setContestForm({ ...contestForm, assessmentType: t.id }); }}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        selectedAssessmentType === t.id
                          ? 'bg-blue-500/10 border-blue-400 text-white shadow-lg shadow-blue-500/10'
                          : 'bg-zinc-900/60 border-white/5 text-gray-400 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span>{t.icon}</span>
                        <span className="text-xs font-bold text-white">{t.label}</span>
                      </div>
                      <p className="text-[10px] text-gray-500 line-clamp-2">{t.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick Template Chooser */}
              <div>
                <span className="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase">Or Choose Pre-Built Template:</span>
                <div className="flex flex-wrap gap-2">
                  {CONTEST_TEMPLATES.map(tpl => (
                    <button
                      key={tpl.name}
                      type="button"
                      onClick={() => applyTemplate(tpl)}
                      className="px-3 py-1.5 bg-white/5 hover:bg-blue-500/10 border border-white/10 hover:border-blue-400/40 rounded-lg text-xs font-bold text-gray-300 transition"
                    >
                      ⚡ {tpl.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Step 2: Basic Info */}
              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white/10">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">Contest Title</label>
                  <input required type="text" placeholder="e.g. National Aptitude & Technical Hiring 2026" className="w-full bg-black border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:border-blue-400 outline-none" value={contestForm.title} onChange={e => setContestForm({ ...contestForm, title: e.target.value })} />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">Description & Instructions</label>
                  <textarea placeholder="Instructions for candidates regarding sections, scoring, and proctoring rules..." className="w-full bg-black border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:border-blue-400 outline-none h-20 resize-none" value={contestForm.description} onChange={e => setContestForm({ ...contestForm, description: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">Start Time</label>
                  <input required type="datetime-local" className="w-full bg-black border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:border-blue-400 outline-none [color-scheme:dark]" value={contestForm.startTime} onChange={e => setContestForm({ ...contestForm, startTime: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">End Time</label>
                  <input required type="datetime-local" className="w-full bg-black border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:border-blue-400 outline-none [color-scheme:dark]" value={contestForm.endTime} onChange={e => setContestForm({ ...contestForm, endTime: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">Duration (mins)</label>
                  <input required type="number" min="1" className="w-full bg-black border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:border-blue-400 outline-none" value={contestForm.duration} onChange={e => setContestForm({ ...contestForm, duration: parseInt(e.target.value) })} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">Difficulty Level</label>
                  <select className="w-full bg-black border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:border-blue-400 outline-none" value={contestForm.difficulty} onChange={e => setContestForm({ ...contestForm, difficulty: e.target.value })}>
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">Paste Policy</label>
                  <select className="w-full bg-black border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:border-blue-400 outline-none" value={contestForm.pasteMode} onChange={e => setContestForm({ ...contestForm, pasteMode: e.target.value as any })}>
                    <option value="ALLOWED">Allowed</option>
                    <option value="LOG_ONLY">Log Violation Only</option>
                    <option value="BLOCKED">Completely Blocked</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">Access Scope</label>
                  <select className="w-full bg-black border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:border-blue-400 outline-none" value={contestForm.isPublic ? 'true' : 'false'} onChange={e => setContestForm({ ...contestForm, isPublic: e.target.value === 'true' })}>
                    <option value="false">Private (Invite Link Only)</option>
                    <option value="true">Public (Listed in Contest Directory)</option>
                  </select>
                </div>
              </div>

              {/* Step 3: Proctoring & Integrity */}
              <div className="space-y-3 pt-2 border-t border-white/10">
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider">Security & AI Invigilation Controls</h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: 'requireFullscreen', label: 'Mandatory Fullscreen Mode' },
                    { key: 'preventTabSwitch', label: 'Prevent Window / Tab Switching' },
                    { key: 'disableCopyPaste', label: 'Disable Clipboard & Context Menu' },
                    { key: 'enableProctoring', label: 'Enable AI Webcam Proctoring' },
                    { key: 'requireSeb', label: 'Require Safe Exam Browser (SEB)' },
                    { key: 'randomizeQuestionOrder', label: 'Randomize Item Order per Candidate' },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2.5 p-2 bg-white/5 border border-white/5 rounded-xl cursor-pointer hover:border-white/20 transition">
                      <input
                        type="checkbox"
                        checked={(contestForm as any)[key]}
                        onChange={e => setContestForm({ ...contestForm, [key]: e.target.checked })}
                        className="w-4 h-4 accent-blue-400 rounded"
                      />
                      <span className="text-xs font-bold text-gray-300">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-white/10">
                <button type="button" onClick={() => setShowCreateContest(false)} className="flex-1 py-3 border border-white/10 rounded-xl text-sm font-bold text-gray-400 hover:bg-white/5 transition">
                  Cancel
                </button>
                <button type="submit" disabled={creatingContest} className="flex-1 py-3 bg-blue-500 hover:bg-blue-400 text-black font-black rounded-xl text-sm transition disabled:opacity-50 shadow-lg shadow-blue-500/20">
                  {creatingContest ? 'Creating Assessment...' : 'Publish Contest Drive'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// OVERVIEW / COMMAND CENTER TAB
// ═══════════════════════════════════════════
function OverviewTab({ analytics, org, contests, members, usage, subscription, onNavigateContests }: {
  analytics: Analytics | null;
  org: OrgData | null;
  contests: Contest[];
  members: TeamMember[];
  usage: Usage | null;
  subscription: Subscription | null;
  onNavigateContests: () => void;
}) {
  const activeContests = contests.filter(c => new Date(c.endTime).getTime() > Date.now());
  const totalParticipants = contests.reduce((sum, c) => sum + (c._count?.participants || 0), 0);
  const totalSubmissions = analytics?.totalSubmissions || 0;

  const stats = [
    { label: 'My Contests', value: analytics?.totalContests ?? contests.length, icon: '🏆', color: 'blue', spark: '#60a5fa', trend: '+2 drives' },
    { label: 'Active Contests', value: activeContests.length, icon: '⚡', color: 'green', spark: '#4ade80', trend: 'Live now' },
    { label: 'Team Members', value: analytics?.totalUsers ?? members.length, icon: '👥', color: 'purple', spark: '#c084fc', trend: '7 active seats' },
    { label: 'Total Participants', value: totalParticipants, icon: '🎯', color: 'cyan', spark: '#22d3ee', trend: '+180 candidates' },
    { label: 'Total Submissions', value: totalSubmissions, icon: '📝', color: 'amber', spark: '#fbbf24', trend: '+45 today' },
  ];

  const maxUsers = subscription?.maxUsers || 5;
  const currentUsers = usage?.users || members.length;
  const seatPct = Math.min(100, Math.round((currentUsers / maxUsers) * 100));

  return (
    <div className="space-y-6">
      {/* Live Contest Banner */}
      {activeContests.length > 0 && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
            <div>
              <p className="text-sm font-black text-emerald-400">⚡ {activeContests.length} Contest Drive Active Live</p>
              <p className="text-xs text-emerald-500/80">{activeContests[0].title} is currently receiving candidate submissions.</p>
            </div>
          </div>
          <button onClick={onNavigateContests} className="px-4 py-2 bg-emerald-500 text-black font-extrabold text-xs rounded-xl hover:bg-emerald-400 transition">
            Monitor Drive →
          </button>
        </div>
      )}

      {/* KPI Cards with Sparklines */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {stats.map(s => (
          <div key={s.label} className="bg-zinc-950 border border-white/10 rounded-xl p-5 hover:border-white/20 transition">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xl">{s.icon}</span>
              <Sparkline color={s.spark} />
            </div>
            <div className="text-2xl font-black text-white">{s.value}</div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mt-1">{s.label}</p>
            <p className="text-[10px] text-gray-600 mt-0.5">{s.trend}</p>
          </div>
        ))}
      </div>

      {/* Seat Utilization Bar */}
      <div className="p-4 bg-zinc-950 border border-white/10 rounded-xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-lg">💺</span>
          <div>
            <p className="text-xs font-bold text-white">Team Seat Capacity Utilization</p>
            <p className="text-[10px] text-gray-500">{currentUsers} of {maxUsers} seats occupied ({seatPct}%)</p>
          </div>
        </div>
        <div className="w-48 flex items-center gap-2">
          <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${seatPct > 80 ? 'bg-amber-400' : 'bg-blue-400'}`} style={{ width: `${seatPct}%` }} />
          </div>
          <span className="text-xs font-bold font-mono text-gray-400">{seatPct}%</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-zinc-950 border border-white/10 rounded-xl p-6">
          <h3 className="font-black text-sm text-gray-400 uppercase tracking-wider mb-4">Recent Assessment Drives</h3>
          {contests.length === 0 ? (
            <EmptyState icon="🏆" message="No contests yet." />
          ) : (
            <div className="space-y-3">
              {contests.slice(0, 5).map(c => {
                const nowTime = Date.now();
                const isLive = new Date(c.startTime).getTime() <= nowTime && new Date(c.endTime).getTime() > nowTime;
                const isUpcoming = new Date(c.startTime).getTime() > nowTime;
                return (
                  <div key={c.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5">
                    <div>
                      <p className="text-sm font-bold text-white">{c.title}</p>
                      <p className="text-xs text-gray-500 font-mono">{new Date(c.startTime).toLocaleDateString()} · {c.duration} mins</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      isLive ? 'bg-green-500/20 text-green-400' : isUpcoming ? 'bg-yellow-500/20 text-yellow-400' : 'bg-zinc-800 text-zinc-500'
                    }`}>
                      {isLive ? 'Live' : isUpcoming ? 'Upcoming' : 'Ended'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-zinc-950 border border-white/10 rounded-xl p-6">
          <h3 className="font-black text-sm text-gray-400 uppercase tracking-wider mb-4">Team Members</h3>
          {members.length === 0 ? (
            <EmptyState icon="👥" message="No team members." />
          ) : (
            <div className="space-y-3">
              {members.slice(0, 5).map(m => (
                <div key={m.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5">
                  <div>
                    <p className="text-sm font-bold text-white">{m.user?.fullName || m.user?.name || 'Member'}</p>
                    <p className="text-xs text-gray-500">{m.user?.email}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${ROLE_STYLES[m.role] || 'bg-zinc-800 text-zinc-400'}`}>
                    {m.role}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// CONTESTS SUITE TAB
// ═══════════════════════════════════════════
function ContestsTab({ contests, showCreate, setShowCreate, contestForm, setContestForm, creating, onCreate, navigate, reload, selectedType, setSelectedType, applyTemplate }: {
  contests: Contest[];
  showCreate: boolean;
  setShowCreate: (v: boolean) => void;
  contestForm: any;
  setContestForm: (f: any) => void;
  creating: boolean;
  onCreate: (e: React.FormEvent) => void;
  navigate: any;
  reload: () => void;
  selectedType: string;
  setSelectedType: (t: string) => void;
  applyTemplate: (t: any) => void;
}) {
  const nowTime = Date.now();
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-black text-xl">Contest Assessment Suite</h2>
          <p className="text-xs text-gray-500 mt-0.5">Manage, monitor, and configure active & scheduled assessment drives.</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="px-5 py-2.5 bg-blue-500 hover:bg-blue-400 text-black font-black rounded-xl text-sm transition-all flex items-center gap-2 shadow-lg shadow-blue-500/20">
          <span>+</span> Create Assessment Drive
        </button>
      </div>

      {contests.length === 0 ? (
        <EmptyState icon="🏆" message="No contests created yet. Click 'Create Assessment Drive' to launch your first test." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {contests.map(c => {
            const isLive = new Date(c.startTime).getTime() <= nowTime && new Date(c.endTime).getTime() > nowTime;
            const isUpcoming = new Date(c.startTime).getTime() > nowTime;
            return (
              <div key={c.id} className="bg-zinc-950 border border-white/10 rounded-2xl p-5 hover:border-blue-400/30 transition-all shadow-xl space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-black text-base text-white leading-tight">{c.title}</h3>
                    <span className="text-[10px] font-bold text-blue-400 font-mono mt-1 block">
                      Type: {c.assessmentType || 'CODING'}
                    </span>
                  </div>
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${c.isPublic ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'}`}>
                    {c.isPublic ? 'Public' : 'Private'}
                  </span>
                </div>

                <div className="space-y-1 text-xs text-gray-400 font-mono bg-white/5 p-3 rounded-xl">
                  <p>Starts: {new Date(c.startTime).toLocaleString()}</p>
                  <p>Ends: {new Date(c.endTime).toLocaleString()}</p>
                  <p>Duration: {c.duration} min</p>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3 text-gray-500 font-bold">
                    <span>{c._count?.participants || 0} candidates</span>
                    <span>{c._count?.problems || 0} items</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    isLive ? 'bg-green-500/20 text-green-400' : isUpcoming ? 'bg-yellow-500/20 text-yellow-400' : 'bg-zinc-800 text-zinc-500'
                  }`}>
                    {isLive ? 'Live' : isUpcoming ? 'Upcoming' : 'Ended'}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {c.requireFullscreen && <Tag>Fullscreen</Tag>}
                  {c.preventTabSwitch && <Tag>No Tabs</Tag>}
                  {c.disableCopyPaste && <Tag>No Copy</Tag>}
                  {c.enableProctoring && <Tag accent>AI Proctoring</Tag>}
                  {c.requireSeb && <Tag accent>SEB</Tag>}
                </div>

                <button
                  onClick={() => navigate(`/contests/manager/${c.id}`)}
                  className="w-full py-2.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 font-black rounded-xl transition-all text-sm flex items-center justify-center gap-2"
                >
                  Monitor & Manage
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// TEAM & ACCESS TAB
// ═══════════════════════════════════════════
function TeamTab({ members, search, setSearch, showInvite, setShowInvite, inviteEmail, setInviteEmail, inviteRole, setInviteRole, inviting, onInvite, onRemove, onChangeRole }: {
  members: TeamMember[];
  search: string;
  setSearch: (v: string) => void;
  showInvite: boolean;
  setShowInvite: (v: boolean) => void;
  inviteEmail: string;
  setInviteEmail: (v: string) => void;
  inviteRole: string;
  setInviteRole: (v: string) => void;
  inviting: boolean;
  onInvite: () => void;
  onRemove: (userId: string) => void;
  onChangeRole: (userId: string, role: string) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-black text-xl">Team & Access Governance</h2>
          <p className="text-xs text-gray-500 mt-0.5">Manage team members, invigilators, and evaluators.</p>
        </div>
        <button onClick={() => setShowInvite(true)} className="px-5 py-2.5 bg-blue-500 hover:bg-blue-400 text-black font-black rounded-xl text-sm transition-all flex items-center gap-2 shadow-lg shadow-blue-500/20">
          <span>+</span> Invite Member
        </button>
      </div>

      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 bg-zinc-950 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:border-blue-400 outline-none placeholder-gray-600"
        />
        <span className="text-xs text-gray-500 font-bold">{members.length} member(s)</span>
      </div>

      {members.length === 0 ? (
        <EmptyState icon="👥" message="No team members yet. Invite someone to get started." />
      ) : (
        <div className="border border-white/10 rounded-xl overflow-hidden bg-zinc-950">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-black/60 border-b border-white/10 text-gray-500 text-xs uppercase tracking-wider font-bold">
                <th className="p-4">Name</th>
                <th className="p-4">Email</th>
                <th className="p-4">Role</th>
                <th className="p-4">Last Login</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {members.map(m => (
                <tr key={m.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="p-4 font-bold text-white">{m.user?.fullName || m.user?.name || m.name || 'Member'}</td>
                  <td className="p-4 text-gray-400 text-xs font-mono">{m.user?.email || m.email}</td>
                  <td className="p-4">
                    <select
                      value={m.role}
                      onChange={e => onChangeRole(m.userId || m.user.id, e.target.value)}
                      className={`bg-transparent border rounded-lg px-2 py-1 text-[10px] font-bold outline-none cursor-pointer ${ROLE_STYLES[m.role] || ''}`}
                    >
                      <option value="ORG_ADMIN">ORG_ADMIN</option>
                      <option value="ORG_MEMBER">ORG_MEMBER</option>
                      <option value="EVALUATOR">EVALUATOR</option>
                      <option value="PROCTOR">PROCTOR</option>
                      <option value="ANALYTICS_VIEWER">ANALYTICS_VIEWER</option>
                      <option value="CONTEST_MODERATOR">CONTEST_MODERATOR</option>
                      <option value="COMPLIANCE_OFFICER">COMPLIANCE_OFFICER</option>
                    </select>
                  </td>
                  <td className="p-4 text-gray-500 text-xs font-mono">
                    {m.user?.lastLogin ? new Date(m.user.lastLogin).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => onRemove(m.userId || m.user.id)}
                      className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-xs font-bold border border-red-500/20 transition"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="bg-zinc-950 border border-white/10 rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl">
            <div className="flex justify-between items-center">
              <h3 className="font-black text-lg text-white">Invite Team Member</h3>
              <button onClick={() => setShowInvite(false)} className="text-gray-500 hover:text-white">✕</button>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">Email Address</label>
              <input
                type="email"
                placeholder="colleague@org.ac.in"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                className="w-full bg-black border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:border-blue-400 outline-none placeholder-gray-600"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">Assigned Role</label>
              <select
                value={inviteRole}
                onChange={e => setInviteRole(e.target.value)}
                className="w-full bg-black border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:border-blue-400 outline-none"
              >
                <option value="ORG_MEMBER">Org Member (Question Author)</option>
                <option value="ORG_ADMIN">Org Admin (Full Manager)</option>
                <option value="EVALUATOR">Evaluator (Grader)</option>
                <option value="PROCTOR">Proctor (Live Invigilator)</option>
                <option value="ANALYTICS_VIEWER">Analytics Viewer (Read-Only HR)</option>
                <option value="CONTEST_MODERATOR">Contest Moderator (Chief Examiner)</option>
                <option value="COMPLIANCE_OFFICER">Compliance & GDPR Officer</option>
              </select>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowInvite(false)} className="flex-1 py-2.5 border border-white/10 rounded-lg text-sm font-bold text-gray-400 hover:bg-white/5 transition">
                Cancel
              </button>
              <button
                onClick={onInvite}
                disabled={inviting || !inviteEmail.trim()}
                className="flex-1 py-2.5 bg-blue-500 hover:bg-blue-400 text-black font-black rounded-lg text-sm transition disabled:opacity-50"
              >
                {inviting ? 'Sending...' : 'Send Invitation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// CANDIDATES & SHORTLISTS TAB
// ═══════════════════════════════════════════
function ParticipantsTab({ contests }: { contests: Contest[] }) {
  const nowTime = Date.now();
  const activeContests = contests.filter(c => new Date(c.endTime).getTime() > nowTime);
  const endedContests = contests.filter(c => new Date(c.endTime).getTime() <= nowTime);
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('ALL');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-black text-xl text-white">Candidates & Shortlisting Panel</h2>
          <p className="text-xs text-gray-500 mt-0.5">Review submissions, flag proctoring violations, and mark shortlisted candidates.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => alert('GDPR Erasure Queue: 0 pending requests for candidate data removal.')}
            className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl text-xs font-bold transition"
          >
            🛡️ GDPR Erasure Queue
          </button>
        </div>
      </div>

      {contests.length === 0 ? (
        <EmptyState icon="🎯" message="No contests available. Create a contest to see participant data." />
      ) : (
        <div className="space-y-6">
          {activeContests.length > 0 && (
            <div>
              <h3 className="font-black text-sm text-green-400 uppercase tracking-wider mb-3">Active Assessment Drives</h3>
              <div className="space-y-3">
                {activeContests.map(c => (
                  <div key={c.id} className="bg-zinc-950 border border-white/10 rounded-xl p-5 hover:border-blue-400/20 transition">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-black text-white">{c.title}</h4>
                      <span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-[10px] font-bold uppercase">Live</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500 font-mono">
                      <span>{c._count?.participants || 0} candidates registered</span>
                      <span>{c._count?.problems || 0} items</span>
                      <span>Ends {new Date(c.endTime).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {endedContests.length > 0 && (
            <div>
              <h3 className="font-black text-sm text-gray-500 uppercase tracking-wider mb-3">Completed Assessment Drives</h3>
              <div className="space-y-3">
                {endedContests.map(c => (
                  <div key={c.id} className="bg-zinc-950 border border-white/5 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-bold text-gray-300">{c.title}</h4>
                      <span className="px-2 py-0.5 bg-zinc-800 text-zinc-500 rounded text-[10px] font-bold uppercase">Ended</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-600 font-mono">
                      <span>{c._count?.participants || 0} candidates completed</span>
                      <span>Ended {new Date(c.endTime).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// SEATS & BILLING TAB
// ═══════════════════════════════════════════
function BillingTab({ subscription, usage }: { subscription: Subscription | null; usage: Usage | null }) {
  const tiers = [
    { name: 'Free', price: '$0', features: ['5 Team Members', '10 Contests', 'Basic Proctoring'], tier: 'free' },
    { name: 'Pro', price: '$49/mo', features: ['25 Team Members', '50 Contests', 'AI Proctoring', 'Priority Support'], tier: 'pro' },
    { name: 'Enterprise', price: '$199/mo', features: ['Unlimited Members', 'Unlimited Contests', 'Custom SSO', 'Dedicated Support'], tier: 'enterprise' },
  ];

  const currentTier = subscription?.tier || 'free';

  return (
    <div className="space-y-6">
      <h2 className="font-black text-xl text-white">Seats & Subscription Billing</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-zinc-950 border border-white/10 rounded-xl p-6">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Current Active Tier</p>
          <p className="text-2xl font-black text-blue-400 uppercase">{currentTier}</p>
          {subscription?.expiresAt && (
            <p className="text-xs text-gray-500 mt-2 font-mono">Renews {new Date(subscription.expiresAt).toLocaleDateString()}</p>
          )}
        </div>
        <div className="bg-zinc-950 border border-white/10 rounded-xl p-6">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Account Status</p>
          <p className={`text-2xl font-black uppercase ${subscription?.status === 'ACTIVE' ? 'text-green-400' : 'text-red-400'}`}>
            {subscription?.status || 'Active'}
          </p>
        </div>
      </div>

      {usage && (
        <div className="bg-zinc-950 border border-white/10 rounded-xl p-6">
          <h3 className="font-black text-sm text-gray-400 uppercase tracking-wider mb-4">Capacity Utilization</h3>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Team Seats', value: usage.users, max: subscription?.maxUsers || 5 },
              { label: 'Contest Drives', value: usage.contests, max: subscription?.maxContests || 10 },
              { label: 'Candidate Submissions', value: usage.submissions, max: null },
            ].map(u => (
              <div key={u.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-bold text-gray-400">{u.label}</span>
                  <span className="text-gray-600 font-mono">{u.value}{u.max ? ` / ${u.max}` : ''}</span>
                </div>
                {u.max && (
                  <div className="w-full h-2 bg-black rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${u.value / u.max > 0.8 ? 'bg-amber-400' : 'bg-blue-400'}`}
                      style={{ width: `${Math.min((u.value / u.max) * 100, 100)}%` }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h3 className="font-black text-sm text-gray-400 uppercase tracking-wider mb-4">Available Tiers</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {tiers.map(t => (
            <div
              key={t.tier}
              className={`bg-zinc-950 border rounded-2xl p-6 transition-all ${
                currentTier === t.tier ? 'border-blue-400/50 shadow-lg shadow-blue-500/10' : 'border-white/10 hover:border-white/20'
              }`}
            >
              <div className="mb-4">
                <h4 className="font-black text-lg text-white">{t.name}</h4>
                <p className="text-2xl font-black text-blue-400 mt-1">{t.price}</p>
              </div>
              <ul className="space-y-2 mb-6">
                {t.features.map(f => (
                  <li key={f} className="text-xs text-gray-400 flex items-center gap-2">
                    <span className="text-blue-400">✓</span> {f}
                  </li>
                ))}
              </ul>
              {currentTier === t.tier ? (
                <div className="w-full py-2.5 bg-blue-500/10 text-blue-400 border border-blue-500/30 rounded-xl text-sm font-bold text-center">
                  Current Plan
                </div>
              ) : currentTier === 'enterprise' || (currentTier === 'pro' && t.tier === 'free') ? (
                <div className="w-full py-2.5 bg-white/5 text-gray-500 rounded-xl text-sm font-bold text-center border border-white/10">
                  Contact Support
                </div>
              ) : (
                <button
                  onClick={async () => { try { await api.upgradeTier(t.tier); window.location.reload(); } catch {} }}
                  className="w-full py-2.5 bg-blue-500 hover:bg-blue-400 text-black font-black rounded-xl text-sm transition-all"
                >
                  Upgrade Tier
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ icon, message }: { icon: string; message: string }) {
  return (
    <div className="text-center py-16 bg-zinc-950 rounded-xl border border-white/10">
      <span className="text-3xl block mb-2">{icon}</span>
      <p className="text-gray-500 text-sm">{message}</p>
    </div>
  );
}

function Tag({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold border ${
      accent
        ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
        : 'bg-white/5 text-gray-300 border-white/10'
    }`}>
      {children}
    </span>
  );
}
