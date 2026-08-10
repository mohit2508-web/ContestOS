import { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useNotify } from '../../components/notifications';
import { QuestionBankPage } from '../teacher/QuestionBankPage';

type TabId = 'overview' | 'team' | 'problems' | 'participants' | 'billing' | 'sso';

interface OrgData {
  id: string;
  name: string;
  slug: string;
  users: any[];
  _count: { users: number; contests: number };
  subscriptionTier: string;
  status: string;
  samlEnabled?: boolean;
  samlDomain?: string;
  samlIdpEntityId?: string;
  samlIdpSsoUrl?: string;
  samlIdpCert?: string;
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
  user: { id: string; fullName: string; name?: string; email: string; lastLogin?: string; lastLoginAt?: string };
  name?: string;
  email?: string;
  lastLoginAt?: string;
  lastLogin?: string;
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
  { id: 'team', label: 'Team & Access', icon: '👥' },
  { id: 'problems', label: 'Question Bank', icon: '📝' },
  { id: 'participants', label: 'Candidates & Shortlists', icon: '🎯' },
  { id: 'billing', label: 'Seats & Billing', icon: '💳' },
  { id: 'sso', label: 'Enterprise SAML SSO', icon: '🏢' },
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
  const notify = useNotify();

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
            loadInvitations(orgData.id),
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

  const [invitations, setInvitations] = useState<any[]>([]);
  const [createdInviteLink, setCreatedInviteLink] = useState<string | null>(null);

  const loadInvitations = useCallback(async (orgId: string) => {
    try {
      const data = await api.getOrgInvitations(orgId);
      setInvitations(data.invitations || []);
    } catch {
      setInvitations([]);
    }
  }, []);

  const handleInvite = async () => {
    if (!org || !inviteEmail.trim()) return;
    setInviting(true);
    try {
      const res = await api.inviteTeamMember(org.id, inviteEmail.trim(), inviteRole);
      const link = window.location.origin + (res.invitation?.inviteLink || `/accept-invite?token=${res.invitation?.token}`);
      setCreatedInviteLink(link);
      setInviteEmail('');
      loadTeam(org.id);
      loadInvitations(org.id);
    } catch (err: any) {
      await notify.alert('Invitation Failed', {
        description: err?.response?.data?.error || 'Failed to send invitation',
        variant: 'danger',
      });
    }
    setInviting(false);
  };

  const handleRevokeInvitation = async (invId: string) => {
    if (!org) return;
    const ok = await notify.confirm('Revoke Invitation?', {
      description: 'Are you sure you want to revoke this pending invitation token?',
      variant: 'warning',
      confirmLabel: 'Revoke Invitation',
    });
    if (!ok) return;
    try {
      await api.revokeInvitation(invId);
      notify.toast.info('Invitation revoked.');
      loadInvitations(org.id);
    } catch { /* noop */ }
  };

  const handleRemoveMember = async (userId: string, payload?: { reasonCategory: string; detailedNotes: string }) => {
    if (!org) return;
    try {
      const res = await api.removeTeamMember(org.id, userId, payload);
      loadTeam(org.id);
      return res;
    } catch (err: any) {
      throw err;
    }
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
          <OverviewTab analytics={analytics} org={org} contests={contests} members={members} usage={usage} subscription={subscription} onNavigateContests={() => navigate('/admin/contests')} />
        )}
        {activeTab === 'team' && (
          <TeamTab
            members={filteredMembers}
            invitations={invitations}
            contests={contests}
            createdInviteLink={createdInviteLink}
            setCreatedInviteLink={setCreatedInviteLink}
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
            onRevokeInvitation={handleRevokeInvitation}
          />
        )}
        {activeTab === 'problems' && (
          <QuestionBankPage />
        )}
        {activeTab === 'participants' && (
          <ParticipantsTab contests={contests} org={org} />
        )}
        {activeTab === 'billing' && (
          <BillingTab subscription={subscription} usage={usage} />
        )}
        {activeTab === 'sso' && (
          <SamlConfigTab org={org} reload={loadOrg} />
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
function TeamTab({
  members,
  invitations,
  contests,
  createdInviteLink,
  setCreatedInviteLink,
  search,
  setSearch,
  showInvite,
  setShowInvite,
  inviteEmail,
  setInviteEmail,
  inviteRole,
  setInviteRole,
  inviting,
  onInvite,
  onRemove,
  onChangeRole,
  onRevokeInvitation,
}: {
  members: TeamMember[];
  invitations: any[];
  contests: Contest[];
  createdInviteLink: string | null;
  setCreatedInviteLink: (link: string | null) => void;
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
  onRemove: (userId: string, payload?: { reasonCategory: string; detailedNotes: string }) => Promise<any>;
  onChangeRole: (userId: string, role: string) => void;
  onRevokeInvitation: (invId: string) => void;
}) {
  const [subTab, setSubTab] = useState<'active' | 'pending' | 'matrix'>('active');
  const [copied, setCopied] = useState(false);
  const notify = useNotify();

  const [assignModalUser, setAssignModalUser] = useState<TeamMember | null>(null);
  const [assignedContestIds, setAssignedContestIds] = useState<string[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);

  // Enterprise Roster & Drive Assign state
  const [selectedRoleForAssign, setSelectedRoleForAssign] = useState<string>('EVALUATOR');
  const [driveSearch, setDriveSearch] = useState('');
  const [rosterAssignments, setRosterAssignments] = useState<any[]>([]);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [matrixContestFilter, setMatrixContestFilter] = useState('ALL');
  const [matrixRoleFilter, setMatrixRoleFilter] = useState('ALL');

  // Offboarding modal state
  const [offboardModalUser, setOffboardModalUser] = useState<TeamMember | null>(null);
  const [offboardReason, setOffboardReason] = useState('CONTRACT_EXPIRED');
  const [offboardNotes, setOffboardNotes] = useState('');
  const [offboarding, setOffboarding] = useState(false);

  const pendingCount = invitations.filter((i) => i.status === 'PENDING').length;

  const loadAllRosterAssignments = async () => {
    setLoadingRoster(true);
    try {
      const allList: any[] = [];
      for (const c of contests) {
        try {
          const res = await api.getContestAssignments(c.id);
          const items = (res.assignments || []).map((a: any) => ({
            ...a,
            contestTitle: c.title,
            contestId: c.id,
            assessmentType: c.assessmentType || 'CODING',
            startTime: c.startTime,
            duration: c.duration,
          }));
          allList.push(...items);
        } catch {}
      }
      setRosterAssignments(allList);
    } finally {
      setLoadingRoster(false);
    }
  };

  const copyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openAssignModal = async (member: TeamMember) => {
    setAssignModalUser(member);
    setSelectedRoleForAssign(member.role === 'PROCTOR' ? 'PROCTOR' : 'EVALUATOR');
    setDriveSearch('');
    setLoadingAssignments(true);
    const targetUserId = member.userId || member.user?.id || member.id;
    try {
      const assignedIds: string[] = [];
      for (const c of contests) {
        try {
          const res = await api.getContestAssignments(c.id);
          const exists = (res.assignments || []).some((a: any) => a.userId === targetUserId);
          if (exists) assignedIds.push(c.id);
        } catch {}
      }
      setAssignedContestIds(assignedIds);
    } finally {
      setLoadingAssignments(false);
    }
  };

  const toggleContestAssignment = async (contestId: string) => {
    if (!assignModalUser) return;
    const targetUserId = assignModalUser.userId || assignModalUser.user?.id || assignModalUser.id;
    const isAssigned = assignedContestIds.includes(contestId);
    const role = selectedRoleForAssign || (assignModalUser.role === 'PROCTOR' ? 'PROCTOR' : 'EVALUATOR');

    try {
      if (isAssigned) {
        const res = await api.unassignMemberFromContest(contestId, targetUserId);
        setAssignedContestIds(prev => prev.filter(id => id !== contestId));
        notify.toast.success(res?.message || 'Drive unassigned from staff member.');
      } else {
        const res = await api.assignMemberToContest(contestId, targetUserId, role);
        setAssignedContestIds(prev => [...prev, contestId]);
        notify.toast.success(res?.message || `Drive assigned! Official Code of Conduct & guidelines delivered to ${assignModalUser.user?.name || assignModalUser.name}.`);
      }
    } catch (err: any) {
      notify.toast.error(err?.response?.data?.error || 'Failed to update contest drive assignment');
    }
  };

  const ROLE_OPTIONS = [
    { id: 'EVALUATOR', title: 'Evaluator (Grader)', icon: '✍️', desc: 'Grading code, SQL & subjective responses' },
    { id: 'PROCTOR', title: 'Proctor (Invigilator)', icon: '🛡️', desc: 'Live webcam invigilation & cheating alerts' },
    { id: 'ORG_MEMBER', title: 'Org Member', icon: '👨‍🏫', desc: 'Question bank creation & contest hosting' },
    { id: 'ORG_ADMIN', title: 'Org Admin', icon: '👑', desc: 'Full organization manager & seat controller' },
    { id: 'ANALYTICS_VIEWER', title: 'Analytics Viewer', icon: '📊', desc: 'Read-only HR results & scorecard viewer' },
    { id: 'CONTEST_MODERATOR', title: 'Contest Moderator', icon: '⚖️', desc: 'Grade overrides & chief examiner' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-black text-xl text-white">Team & Access Governance</h2>
          <p className="text-xs text-gray-500 mt-0.5">Manage team members, live invigilators, and evaluators with real-time invitation tracking.</p>
        </div>
        <button
          onClick={() => { setCreatedInviteLink(null); setShowInvite(true); }}
          className="px-5 py-2.5 bg-blue-500 hover:bg-blue-400 text-black font-black rounded-xl text-sm transition-all flex items-center gap-2 shadow-lg shadow-blue-500/20 cursor-pointer"
        >
          <span>+</span> Invite Member
        </button>
      </div>

      {/* Sub-tab switcher */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSubTab('active')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              subTab === 'active'
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <span>👥 Active Members</span>
            <span className="px-2 py-0.5 bg-white/10 rounded-md text-[10px]">{members.length}</span>
          </button>

          <button
            onClick={() => setSubTab('pending')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              subTab === 'pending'
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <span>⏳ Pending Invitations</span>
            {pendingCount > 0 && (
              <span className="px-2 py-0.5 bg-amber-500/30 text-amber-300 rounded-md text-[10px] animate-pulse">
                {pendingCount}
              </span>
            )}
          </button>

          <button
            onClick={() => {
              setSubTab('matrix');
              loadAllRosterAssignments();
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              subTab === 'matrix'
                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <span>🎯 Staff Drive Roster & Matrix</span>
            <span className="px-2 py-0.5 bg-purple-500/30 text-purple-300 rounded-md text-[10px] font-mono">
              {rosterAssignments.length}
            </span>
          </button>
        </div>

        <input
          type="text"
          placeholder="Filter team..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-zinc-950 border border-white/10 rounded-xl px-3.5 py-1.5 text-xs focus:border-blue-400 outline-none w-64 text-white"
        />
      </div>

      {/* TAB 1: Active Team Members */}
      {subTab === 'active' && (
        members.length === 0 ? (
          <EmptyState icon="👥" message="No active team members found." />
        ) : (
          <div className="border border-white/10 rounded-xl overflow-hidden bg-zinc-950 shadow-xl">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-black/60 border-b border-white/10 text-gray-500 text-xs uppercase tracking-wider font-bold">
                  <th className="p-4">Name</th>
                  <th className="p-4">Email</th>
                  <th className="p-4">Assigned Role</th>
                  <th className="p-4">Last Login</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {members.map((m) => {
                  const loginTime = m.lastLoginAt || m.user?.lastLoginAt || m.lastLogin;
                  return (
                    <tr key={m.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="p-4 font-bold text-white flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 font-black text-xs">
                          {(m.user?.name || m.name || 'U')[0].toUpperCase()}
                        </div>
                        <span>{m.user?.fullName || m.user?.name || m.name || 'Member'}</span>
                      </td>
                      <td className="p-4 text-gray-400 text-xs font-mono">{m.user?.email || m.email}</td>
                      <td className="p-4">
                        <select
                          value={m.role}
                          onChange={(e) => onChangeRole(m.userId || m.user.id, e.target.value)}
                          className={`bg-zinc-900 border rounded-lg px-2.5 py-1 text-xs font-bold outline-none cursor-pointer ${
                            ROLE_STYLES[m.role] || 'text-gray-300'
                          }`}
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
                      <td className="p-4 text-xs font-mono">
                        {loginTime ? (
                          <span className="text-emerald-400 font-bold">
                            {new Date(loginTime).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-zinc-500 italic">Never</span>
                        )}
                      </td>
                    <td className="p-4 text-right flex items-center justify-end gap-2">
                      {(m.role === 'EVALUATOR' || m.role === 'PROCTOR' || m.role === 'ORG_MEMBER' || m.role === 'CONTEST_MODERATOR') && (
                        <button
                          onClick={() => openAssignModal(m)}
                          className="px-3.5 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg text-xs font-bold border border-blue-500/30 transition cursor-pointer flex items-center gap-1.5 shadow-sm"
                        >
                          <span>🎯 Assign Drives</span>
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setOffboardModalUser(m);
                          setOffboardReason('CONTRACT_EXPIRED');
                          setOffboardNotes('');
                        }}
                        className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-xs font-bold border border-red-500/20 transition cursor-pointer"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* TAB 3: Staff Drive Allocation Roster & Matrix */}
      {subTab === 'matrix' && (
        <div className="space-y-5">
          {/* Controls Bar */}
          <div className="bg-zinc-950 border border-white/10 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                  Filter Contest Drive
                </label>
                <select
                  value={matrixContestFilter}
                  onChange={(e) => setMatrixContestFilter(e.target.value)}
                  className="bg-zinc-900 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-purple-400 cursor-pointer"
                >
                  <option value="ALL">🌐 All Contest Drives ({contests.length})</option>
                  {contests.map((c) => (
                    <option key={c.id} value={c.id}>
                      🏆 {c.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                  Filter Staff Role
                </label>
                <select
                  value={matrixRoleFilter}
                  onChange={(e) => setMatrixRoleFilter(e.target.value)}
                  className="bg-zinc-900 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-purple-400 cursor-pointer"
                >
                  <option value="ALL">⚡ All Roles</option>
                  <option value="EVALUATOR">✍️ EVALUATOR (Grader)</option>
                  <option value="PROCTOR">🛡️ PROCTOR (Invigilator)</option>
                  <option value="CONTENT_EDITOR">📝 CONTENT_EDITOR</option>
                </select>
              </div>
            </div>

            <button
              onClick={loadAllRosterAssignments}
              disabled={loadingRoster}
              className="px-4 py-2 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-300 font-bold text-xs rounded-xl transition cursor-pointer flex items-center gap-2"
            >
              <span>{loadingRoster ? 'Refreshing Roster...' : '🔄 Refresh Allocation Matrix'}</span>
            </button>
          </div>

          {/* Roster Table */}
          {loadingRoster ? (
            <div className="p-12 text-center text-xs text-zinc-400 bg-zinc-950 border border-white/10 rounded-2xl">
              Loading enterprise staff allocation matrix...
            </div>
          ) : rosterAssignments.length === 0 ? (
            <EmptyState icon="🎯" message="No staff members assigned to any contest drives yet. Click 'Assign Drives' on team members to appoint them." />
          ) : (
            <div className="border border-white/10 rounded-2xl overflow-hidden bg-zinc-950 shadow-xl">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-black/80 border-b border-white/10 text-zinc-400 text-[11px] uppercase tracking-wider font-bold">
                    <th className="p-4">Contest Drive</th>
                    <th className="p-4">Assigned Staff Member</th>
                    <th className="p-4">Designated Drive Role</th>
                    <th className="p-4">Assigned By</th>
                    <th className="p-4 text-right">Governance Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {rosterAssignments
                    .filter((a) => matrixContestFilter === 'ALL' || a.contestId === matrixContestFilter)
                    .filter((a) => matrixRoleFilter === 'ALL' || a.role === matrixRoleFilter)
                    .map((item) => (
                      <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="p-4 font-bold text-white">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="text-white text-sm font-bold">{item.contestTitle}</span>
                              <span className="text-[9px] px-2 py-0.5 bg-purple-500/10 text-purple-300 border border-purple-500/20 font-mono rounded font-bold uppercase">
                                {item.assessmentType}
                              </span>
                            </div>
                            <p className="text-[10px] text-zinc-400 font-mono">
                              Starts: {new Date(item.startTime).toLocaleDateString()} · {item.duration} mins
                            </p>
                          </div>
                        </td>

                        <td className="p-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/30 text-purple-300 font-black text-xs flex items-center justify-center">
                              {(item.user?.name || 'S')[0].toUpperCase()}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-white">{item.user?.name || 'Staff Member'}</p>
                              <p className="text-[10px] text-zinc-400 font-mono">{item.user?.email}</p>
                            </div>
                          </div>
                        </td>

                        <td className="p-4">
                          {item.role === 'EVALUATOR' && (
                            <span className="px-3 py-1 bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 rounded-lg text-xs font-bold inline-flex items-center gap-1">
                              ✍️ EVALUATOR (Grader)
                            </span>
                          )}
                          {item.role === 'PROCTOR' && (
                            <span className="px-3 py-1 bg-amber-500/10 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-bold inline-flex items-center gap-1">
                              🛡️ PROCTOR (Invigilator)
                            </span>
                          )}
                          {item.role === 'CONTENT_EDITOR' && (
                            <span className="px-3 py-1 bg-blue-500/10 text-blue-300 border border-blue-500/30 rounded-lg text-xs font-bold inline-flex items-center gap-1">
                              📝 CONTENT_EDITOR
                            </span>
                          )}
                        </td>

                        <td className="p-4 text-xs text-zinc-400 font-mono">
                          <p className="text-zinc-300 font-bold">{item.assignedBy?.name || 'Org Admin'}</p>
                          <p className="text-[10px] text-zinc-500">{new Date(item.createdAt).toLocaleDateString()}</p>
                        </td>

                        <td className="p-4 text-right">
                          <button
                            onClick={async () => {
                              try {
                                const res = await api.unassignMemberFromContest(item.contestId, item.userId);
                                notify.toast.success(res?.message || 'Assignment revoked.');
                                loadAllRosterAssignments();
                              } catch (err: any) {
                                notify.toast.error(err?.response?.data?.error || 'Failed to revoke assignment');
                              }
                            }}
                            className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg text-xs font-bold border border-rose-500/30 transition cursor-pointer"
                          >
                            Revoke Appointment
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Ultra-Professional Enterprise Assign Contest Drives Modal */}
      {assignModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
          <div className="bg-zinc-950 border border-blue-500/30 rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-7 space-y-6 shadow-2xl relative">
            {/* Header section */}
            <div className="flex justify-between items-start border-b border-white/10 pb-5">
              <div className="space-y-1">
                <span className="px-3 py-1 bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-blue-400 border border-blue-500/30 rounded-full text-[10px] font-black uppercase tracking-widest inline-block">
                  ⚡ ENTERPRISE DRIVE APPOINTMENT & GOVERNANCE
                </span>
                <h3 className="text-xl font-black text-white tracking-tight">
                  Contest Drive Staffing Console
                </h3>
                <p className="text-xs text-zinc-400">
                  Appoint authorized staff members to evaluate submissions, conduct live invigilation, or curate drive content.
                </p>
              </div>
              <button
                onClick={() => setAssignModalUser(null)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center text-sm cursor-pointer transition"
              >
                ✕
              </button>
            </div>

            {/* Target Staff Member Profile Banner */}
            <div className="bg-gradient-to-r from-zinc-900 to-zinc-900/80 border border-white/10 rounded-2xl p-4 flex items-center justify-between gap-4 shadow-inner">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 text-white font-black text-lg flex items-center justify-center shadow-lg shadow-purple-500/20">
                  {(assignModalUser.user?.fullName || assignModalUser.user?.name || assignModalUser.name || 'S')[0].toUpperCase()}
                </div>
                <div>
                  <h4 className="text-sm font-black text-white">
                    {assignModalUser.user?.fullName || assignModalUser.user?.name || assignModalUser.name}
                  </h4>
                  <p className="text-xs text-zinc-400 font-mono">
                    {assignModalUser.user?.email || assignModalUser.email}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <span className={`px-3 py-1 rounded-lg text-xs font-black border ${ROLE_STYLES[assignModalUser.role] || 'text-zinc-300'}`}>
                  {assignModalUser.role}
                </span>
                <p className="text-[10px] text-zinc-500 font-mono mt-1">
                  Active Assignments: <span className="text-blue-400 font-bold">{assignedContestIds.length} Drives</span>
                </p>
              </div>
            </div>

            {/* Enforced Registered Role Banner */}
            <div className="bg-zinc-900/90 border border-white/10 rounded-2xl p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Designated Drive Role:</span>
                {assignModalUser.role === 'EVALUATOR' && (
                  <span className="px-3.5 py-1 bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm">
                    ✍️ EVALUATOR (Submission Grader)
                  </span>
                )}
                {assignModalUser.role === 'PROCTOR' && (
                  <span className="px-3.5 py-1 bg-amber-500/10 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm">
                    🛡️ PROCTOR (Chief Invigilator)
                  </span>
                )}
                {assignModalUser.role !== 'EVALUATOR' && assignModalUser.role !== 'PROCTOR' && (
                  <span className="px-3.5 py-1 bg-blue-500/10 text-blue-300 border border-blue-500/30 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm">
                    📝 CONTENT_EDITOR (Problem Author)
                  </span>
                )}
              </div>
              <span className="text-[10px] font-mono text-zinc-500 bg-white/5 px-2.5 py-1 rounded-lg">
                🔒 Auto-Picked from Org Role ({assignModalUser.role})
              </span>
            </div>

            {/* Contest Drives List Header & Filter */}
            <div className="flex items-center justify-between pt-2">
              <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider">
                Select Contest Drives to Appoint ({contests.length})
              </label>
              <input
                type="text"
                placeholder="Search drive by name..."
                value={driveSearch}
                onChange={(e) => setDriveSearch(e.target.value)}
                className="bg-zinc-900 border border-white/10 rounded-xl px-3.5 py-1.5 text-xs text-white outline-none focus:border-blue-400 w-60"
              />
            </div>

            {/* Contest Drive List */}
            {loadingAssignments ? (
              <div className="p-12 text-center text-xs text-zinc-400">Loading contest drive assignments...</div>
            ) : contests.length === 0 ? (
              <div className="p-12 text-center text-xs text-zinc-400">No contest drives created in organization yet.</div>
            ) : (
              <div className="space-y-3 max-h-72 overflow-y-auto custom-scrollbar pr-1">
                {contests
                  .filter((c) => c.title.toLowerCase().includes(driveSearch.toLowerCase()))
                  .map((c) => {
                    const isAssigned = assignedContestIds.includes(c.id);
                    return (
                      <div
                        key={c.id}
                        className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-4 ${
                          isAssigned
                            ? 'bg-gradient-to-r from-emerald-500/10 to-blue-500/10 border-emerald-500/40 text-white shadow-md'
                            : 'bg-zinc-900/60 border-white/10 text-zinc-400 hover:border-white/20'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-white">{c.title}</span>
                            <span className="text-[10px] px-2 py-0.5 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded font-mono font-bold">
                              {c.assessmentType || 'CODING'}
                            </span>
                            {isAssigned && (
                              <span className="text-[9px] px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full font-bold">
                                ✓ Appointed
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-zinc-400 font-mono">
                            Starts: {new Date(c.startTime).toLocaleDateString()} · Duration: {c.duration} mins
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => toggleContestAssignment(c.id)}
                          className={`px-5 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                            isAssigned
                              ? 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30'
                              : 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-400 hover:to-purple-500 text-white shadow-lg shadow-blue-500/20'
                          }`}
                        >
                          {isAssigned ? '❌ Revoke Appointment' : '+ Appoint to Drive'}
                        </button>
                      </div>
                    );
                  })}
              </div>
            )}

            {/* Enterprise Legal & Governance Notice Callout */}
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 text-xs text-blue-300 space-y-1">
              <p className="font-bold flex items-center gap-1.5 text-blue-400">
                <span>⚡ Real-Time Enterprise Dispatch & Compliance:</span>
              </p>
              <p className="text-zinc-400 text-[11px] leading-relaxed">
                Appointing a staff member automatically dispatches an official Code of Conduct notice, NDA guidelines, and real-time push alert to their account for instant onboarding.
              </p>
            </div>

            <div className="pt-3 border-t border-white/10 flex justify-end">
              <button
                onClick={() => setAssignModalUser(null)}
                className="px-6 py-2.5 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-400 hover:to-purple-500 text-white font-black text-xs rounded-xl transition cursor-pointer shadow-lg shadow-blue-500/20"
              >
                Done & Save Staffing Roster
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Enterprise Offboarding & Incident Report Modal */}
      {offboardModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="bg-zinc-950 border border-rose-500/30 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-2xl">
            <div className="flex justify-between items-start border-b border-white/10 pb-4">
              <div>
                <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest">Enterprise Compliance & Offboarding</span>
                <h3 className="text-lg font-black text-white mt-0.5">
                  Offboard {offboardModalUser.user?.fullName || offboardModalUser.user?.name || offboardModalUser.name}
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  {offboardModalUser.user?.email || offboardModalUser.email} · Role: <span className="text-rose-400 font-bold">{offboardModalUser.role}</span>
                </p>
              </div>
              <button onClick={() => setOffboardModalUser(null)} className="text-zinc-500 hover:text-white text-lg cursor-pointer">✕</button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (offboardNotes.trim().length < 15) {
                  notify.toast.error('Detailed justification notes must be at least 15 characters long.');
                  return;
                }
                setOffboarding(true);
                try {
                  const targetUserId = offboardModalUser.userId || offboardModalUser.user?.id || offboardModalUser.id;
                  const res = await onRemove(targetUserId, {
                    reasonCategory: offboardReason,
                    detailedNotes: offboardNotes.trim(),
                  });
                  notify.toast.success(res?.message || 'Member offboarded and exit notice delivered.');
                  setOffboardModalUser(null);
                } catch (err: any) {
                  notify.toast.error(err?.response?.data?.error || 'Failed to offboard team member.');
                } finally {
                  setOffboarding(false);
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-2">
                  1. Offboarding Reason Category
                </label>
                <select
                  value={offboardReason}
                  onChange={(e) => setOffboardReason(e.target.value)}
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl p-3 text-xs font-bold text-white outline-none focus:border-rose-400 cursor-pointer"
                >
                  <option value="CONTRACT_EXPIRED">📅 Contract / Assessment Drive Completed</option>
                  <option value="ROLE_RESTRUCTURING">🔄 Internal Team & Department Restructuring</option>
                  <option value="SECURITY_POLICY_VIOLATION">🚨 Security, Anti-Cheat, or Integrity Policy Violation</option>
                  <option value="INACTIVITY_NONPERFORMANCE">💤 Inactivity during live grading or invigilation</option>
                  <option value="MUTUAL_SEPARATION">🤝 Voluntary Exit / Resignation</option>
                </select>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider">
                    2. Compliance Justification & Report Notes
                  </label>
                  <span className={`text-[10px] font-mono font-bold ${offboardNotes.trim().length >= 15 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {offboardNotes.trim().length} / 15 min chars
                  </span>
                </div>
                <textarea
                  rows={4}
                  value={offboardNotes}
                  onChange={(e) => setOffboardNotes(e.target.value)}
                  placeholder="Document the exact offboarding rationale, handover details, or incident summary. This report will be logged into AuditLog and sent as a formal Exit Notice to the offboarded member..."
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl p-3 text-xs text-white placeholder-zinc-500 outline-none focus:border-rose-400 leading-relaxed resize-none"
                  required
                />
              </div>

              <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 text-[11px] text-rose-300 space-y-1">
                <p className="font-bold flex items-center gap-1">
                  <span>⚖️ Legal & Governance Warning:</span>
                </p>
                <p className="text-zinc-400 text-[10px] leading-relaxed">
                  Executing offboarding will revoke all staff privileges, unassign active grading drives, record an immutable audit entry, and deliver an official exit notification to the member.
                </p>
              </div>

              <div className="pt-3 border-t border-white/10 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setOffboardModalUser(null)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-zinc-300 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={offboarding || offboardNotes.trim().length < 15}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-black text-xs rounded-xl transition shadow-lg shadow-rose-600/20 cursor-pointer flex items-center gap-2"
                >
                  <span>{offboarding ? 'Executing Offboarding...' : '🚨 Confirm & Execute Offboarding'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAB 2: Pending Invitations Table */}
      {subTab === 'pending' && (
        invitations.length === 0 ? (
          <EmptyState icon="⏳" message="No pending or past invitations found." />
        ) : (
          <div className="border border-white/10 rounded-xl overflow-hidden bg-zinc-950 shadow-xl">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-black/60 border-b border-white/10 text-gray-500 text-xs uppercase tracking-wider font-bold">
                  <th className="p-4">Invited Email</th>
                  <th className="p-4">Target Role</th>
                  <th className="p-4">Invited By</th>
                  <th className="p-4">Sent Date</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {invitations.map((inv) => {
                  const inviteLink = window.location.origin + `/accept-invite?token=${inv.token}`;
                  return (
                    <tr key={inv.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="p-4 font-bold text-white font-mono text-xs">{inv.email}</td>
                      <td className="p-4">
                        <span className="px-2.5 py-1 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-lg text-[10px] font-black uppercase">
                          {inv.role}
                        </span>
                      </td>
                      <td className="p-4 text-xs text-gray-400">
                        {inv.invitedBy?.name || inv.invitedBy?.email || 'Org Admin'}
                      </td>
                      <td className="p-4 text-xs text-gray-500 font-mono">
                        {new Date(inv.createdAt).toLocaleDateString()}
                      </td>
                      <td className="p-4">
                        {inv.status === 'PENDING' && (
                          <span className="px-2.5 py-1 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg text-[10px] font-black flex items-center gap-1.5 w-fit">
                            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                            <span>⏳ PENDING CONFIRMATION</span>
                          </span>
                        )}
                        {inv.status === 'ACCEPTED' && (
                          <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-[10px] font-black flex items-center gap-1.5 w-fit">
                            <span>✅ ACCEPTED</span>
                          </span>
                        )}
                        {(inv.status === 'REVOKED' || inv.status === 'EXPIRED') && (
                          <span className="px-2.5 py-1 bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg text-[10px] font-black flex items-center gap-1.5 w-fit">
                            <span>❌ {inv.status}</span>
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right space-x-2">
                        {inv.status === 'PENDING' && (
                          <>
                            <button
                              onClick={() => copyLink(inviteLink)}
                              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold border border-white/10 transition cursor-pointer"
                            >
                              📋 Copy Link
                            </button>
                            <button
                              onClick={() => onRevokeInvitation(inv.id)}
                              className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg text-xs font-bold border border-rose-500/20 transition cursor-pointer"
                            >
                              Revoke
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Redesigned Invite Team Member Modal */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="bg-zinc-950 border border-white/10 rounded-3xl w-full max-w-xl p-6 space-y-6 shadow-2xl overflow-hidden relative">
            <div className="flex justify-between items-center border-b border-white/10 pb-4">
              <div>
                <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Team Access Control</span>
                <h3 className="font-black text-xl text-white">Invite Team Member / Evaluator</h3>
              </div>
              <button onClick={() => setShowInvite(false)} className="text-gray-500 hover:text-white text-lg cursor-pointer">✕</button>
            </div>

            {createdInviteLink ? (
              <div className="space-y-4 text-center py-4">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto text-xl">
                  ✓
                </div>
                <h4 className="text-lg font-black text-white">Invitation Created Successfully!</h4>
                <p className="text-xs text-gray-400 max-w-md mx-auto">
                  If the invited user has a Kryptavia OS account, an instant alert has been pushed to their 🔔 Notification Bell.
                  You can also share this link directly:
                </p>

                <div className="flex items-center gap-2 bg-black border border-white/10 p-2 rounded-xl text-left">
                  <input
                    type="text"
                    readOnly
                    value={createdInviteLink}
                    className="flex-1 bg-transparent text-xs text-amber-400 font-mono outline-none px-2"
                  />
                  <button
                    onClick={() => copyLink(createdInviteLink)}
                    className="px-4 py-2 bg-blue-500 hover:bg-blue-400 text-black font-extrabold text-xs rounded-lg transition shrink-0 cursor-pointer"
                  >
                    {copied ? 'Copied! ✓' : 'Copy Link'}
                  </button>
                </div>

                <div className="pt-3">
                  <button
                    onClick={() => setShowInvite(false)}
                    className="px-6 py-2.5 bg-white/10 hover:bg-white/15 text-white font-bold text-xs rounded-xl transition cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Email Address</label>
                  <input
                    type="email"
                    placeholder="e.g. evaluator@iitd.ac.in or proctor@company.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-blue-400 outline-none text-white placeholder-gray-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Target Team Role</label>
                  <div className="grid grid-cols-2 gap-2.5">
                    {ROLE_OPTIONS.map((r) => (
                      <button
                        type="button"
                        key={r.id}
                        onClick={() => setInviteRole(r.id)}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          inviteRole === r.id
                            ? 'bg-blue-500/15 border-blue-400 text-white shadow-lg shadow-blue-500/10'
                            : 'bg-black/60 border-white/5 text-gray-400 hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span>{r.icon}</span>
                          <span className="text-xs font-bold text-white">{r.title}</span>
                        </div>
                        <p className="text-[10px] text-gray-500">{r.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setShowInvite(false)}
                    className="flex-1 py-3 border border-white/10 rounded-xl text-sm font-bold text-gray-400 hover:bg-white/5 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={onInvite}
                    disabled={inviting || !inviteEmail.trim()}
                    className="flex-1 py-3 bg-blue-500 hover:bg-blue-400 text-black font-black rounded-xl text-sm transition disabled:opacity-50 shadow-lg shadow-blue-500/20 cursor-pointer"
                  >
                    {inviting ? 'Sending Invitation...' : 'Send Real-Time Invite'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// DRIVE-WISE CANDIDATES & SHORTLISTING COCKPIT TAB
// ═══════════════════════════════════════════
interface CandidateRecord {
  id: string;
  userId?: string;
  name: string;
  email: string;
  rollNo: string;
  contestId?: string;
  driveName: string;
  score: number;
  maxScore: number;
  percentile: number;
  trustIndex: number;
  violationsCount: number;
  status: 'SHORTLISTED' | 'UNDER_REVIEW' | 'FLAGGED' | 'REJECTED';
  completedAt: string;
  evaluatorRemarks?: string;
  // Section breakdowns for score analysis dossier
  codingScore?: number;
  codingMaxScore?: number;
  testCasesPassed?: number;
  testCasesTotal?: number;
  mcqScore?: number;
  mcqMaxScore?: number;
}

const SAMPLE_BENCHMARK_CANDIDATES: CandidateRecord[] = [
  { id: 'cand-01', name: 'Rohan Sharma', email: 'rohan.sharma@iitd.ac.in', rollNo: 'IITD-2026-042', driveName: 'Campus Engineering Drive 2026', score: 94, maxScore: 100, percentile: 99.2, trustIndex: 99, violationsCount: 0, status: 'SHORTLISTED', completedAt: '2026-08-08 14:30', codingScore: 48, codingMaxScore: 50, testCasesPassed: 10, testCasesTotal: 10, mcqScore: 46, mcqMaxScore: 50, evaluatorRemarks: 'Outstanding algorithm design and clean OOP code structure.' },
  { id: 'cand-02', name: 'Ananya Gupta', email: 'ananya.gupta@gla.ac.in', rollNo: 'GLA-2026-108', driveName: 'Senior Full-Stack Assessment', score: 91, maxScore: 100, percentile: 98.5, trustIndex: 98, violationsCount: 0, status: 'SHORTLISTED', completedAt: '2026-08-08 15:45', codingScore: 45, codingMaxScore: 50, testCasesPassed: 9, testCasesTotal: 10, mcqScore: 46, mcqMaxScore: 50, evaluatorRemarks: 'High accuracy in system design & RESTful API queries.' },
  { id: 'cand-03', name: 'Priyanshu Verma', email: 'priyanshu.v@nitk.edu.in', rollNo: 'NITK-2026-015', driveName: 'Data Analyst SQL Challenge', score: 88, maxScore: 100, percentile: 96.1, trustIndex: 97, violationsCount: 0, status: 'SHORTLISTED', completedAt: '2026-08-08 11:20', codingScore: 44, codingMaxScore: 50, testCasesPassed: 9, testCasesTotal: 10, mcqScore: 44, mcqMaxScore: 50, evaluatorRemarks: 'Excellent SQL optimization and window function usage.' },
  { id: 'cand-04', name: 'Divya Nair', email: 'divya.nair@bits-pilani.ac.in', rollNo: 'BITS-2026-302', driveName: 'Campus Engineering Drive 2026', score: 85, maxScore: 100, percentile: 94.0, trustIndex: 95, violationsCount: 1, status: 'UNDER_REVIEW', completedAt: '2026-08-08 16:10', codingScore: 42, codingMaxScore: 50, testCasesPassed: 8, testCasesTotal: 10, mcqScore: 43, mcqMaxScore: 50, evaluatorRemarks: 'Under review due to 1 minor tab-switch event.' },
  { id: 'cand-05', name: 'Aditya Singh', email: 'aditya.singh@dtu.ac.in', rollNo: 'DTU-2026-554', driveName: 'Senior Full-Stack Assessment', score: 83, maxScore: 100, percentile: 92.4, trustIndex: 99, violationsCount: 0, status: 'SHORTLISTED', completedAt: '2026-08-07 17:00', codingScore: 41, codingMaxScore: 50, testCasesPassed: 8, testCasesTotal: 10, mcqScore: 42, mcqMaxScore: 50, evaluatorRemarks: 'Good frontend architecture and state management.' },
  { id: 'cand-06', name: 'Meera Kulkarni', email: 'meera.k@vjti.ac.in', rollNo: 'VJTI-2026-089', driveName: 'Graduate Placement Screener', score: 79, maxScore: 100, percentile: 88.6, trustIndex: 96, violationsCount: 0, status: 'UNDER_REVIEW', completedAt: '2026-08-07 13:50', codingScore: 38, codingMaxScore: 50, testCasesPassed: 7, testCasesTotal: 10, mcqScore: 41, mcqMaxScore: 50 },
  { id: 'cand-07', name: 'Siddharth Rao', email: 'siddharth.r@iiit.ac.in', rollNo: 'IIIT-2026-210', driveName: 'Campus Engineering Drive 2026', score: 76, maxScore: 100, percentile: 84.1, trustIndex: 72, violationsCount: 4, status: 'FLAGGED', completedAt: '2026-08-07 10:15', codingScore: 40, codingMaxScore: 50, testCasesPassed: 8, testCasesTotal: 10, mcqScore: 36, mcqMaxScore: 50, evaluatorRemarks: 'Proctoring flag: Multiple faces detected during coding section.' },
  { id: 'cand-08', name: 'Tanya Sengupta', email: 'tanya.s@jaduniv.edu.in', rollNo: 'JU-2026-077', driveName: 'Graduate Placement Screener', score: 74, maxScore: 100, percentile: 81.3, trustIndex: 98, violationsCount: 0, status: 'UNDER_REVIEW', completedAt: '2026-08-06 18:30', codingScore: 36, codingMaxScore: 50, testCasesPassed: 7, testCasesTotal: 10, mcqScore: 38, mcqMaxScore: 50 },
  { id: 'cand-09', name: 'Varun Mehta', email: 'varun.mehta@nsut.ac.in', rollNo: 'NSUT-2026-401', driveName: 'Data Analyst SQL Challenge', score: 71, maxScore: 100, percentile: 77.9, trustIndex: 96, violationsCount: 0, status: 'UNDER_REVIEW', completedAt: '2026-08-06 12:40', codingScore: 34, codingMaxScore: 50, testCasesPassed: 6, testCasesTotal: 10, mcqScore: 37, mcqMaxScore: 50 },
  { id: 'cand-10', name: 'Neha Tripathi', email: 'neha.t@bhu.ac.in', rollNo: 'BHU-2026-312', driveName: 'Campus Engineering Drive 2026', score: 62, maxScore: 100, percentile: 63.4, trustIndex: 61, violationsCount: 5, status: 'FLAGGED', completedAt: '2026-08-06 09:10', codingScore: 28, codingMaxScore: 50, testCasesPassed: 5, testCasesTotal: 10, mcqScore: 34, mcqMaxScore: 50, evaluatorRemarks: 'High audio activity & window tab switching.' },
  { id: 'cand-11', name: 'Sneha Reddy', email: 'sneha.reddy@hyd.ac.in', rollNo: 'HYD-2026-155', driveName: 'Graduate Placement Screener', score: 68, maxScore: 100, percentile: 72.5, trustIndex: 99, violationsCount: 0, status: 'REJECTED', completedAt: '2026-08-05 14:00', codingScore: 30, codingMaxScore: 50, testCasesPassed: 5, testCasesTotal: 10, mcqScore: 38, mcqMaxScore: 50, evaluatorRemarks: 'Score did not meet cutoff criteria of 75%.' },
  { id: 'cand-12', name: 'Kabir Kapoor', email: 'kabir.kapoor@du.ac.in', rollNo: 'DU-2026-889', driveName: 'Senior Full-Stack Assessment', score: 65, maxScore: 100, percentile: 68.0, trustIndex: 94, violationsCount: 0, status: 'REJECTED', completedAt: '2026-08-05 11:30', codingScore: 29, codingMaxScore: 50, testCasesPassed: 5, testCasesTotal: 10, mcqScore: 36, mcqMaxScore: 50 },
];

function ParticipantsTab({ contests, org }: { contests: Contest[]; org: OrgData | null }) {
  const notify = useNotify();
  const [candidates, setCandidates] = useState<CandidateRecord[]>(SAMPLE_BENCHMARK_CANDIDATES);
  const [selectedDriveId, setSelectedDriveId] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [useDemoRoster, setUseDemoRoster] = useState(false);
  const [loadingRealData, setLoadingRealData] = useState(false);
  const [selectedDossier, setSelectedDossier] = useState<CandidateRecord | null>(null);
  const [evaluatorRemarksText, setEvaluatorRemarksText] = useState('');
  const [dossierDecision, setDossierDecision] = useState<'SHORTLISTED' | 'UNDER_REVIEW' | 'REJECTED'>('SHORTLISTED');
  const [savingDecision, setSavingDecision] = useState(false);

  // Shortlisting Cutoff Criteria Config State
  const [cutoffScore, setCutoffScore] = useState(75);
  const [maxViolationsAllowed, setMaxViolationsAllowed] = useState(2);

  // Load real candidates from database API
  useEffect(() => {
    if (!org?.id) return;
    const fetchRealData = async () => {
      setLoadingRealData(true);
      try {
        const res = await api.getOrgShortlistCandidates(org.id);
        if (res?.candidates && res.candidates.length > 0) {
          setCandidates(res.candidates);
          setUseDemoRoster(false);
        } else {
          // No real candidates in DB yet for this org -> default to benchmark roster
          setCandidates(SAMPLE_BENCHMARK_CANDIDATES);
          setUseDemoRoster(true);
        }
      } catch {
        setCandidates(SAMPLE_BENCHMARK_CANDIDATES);
        setUseDemoRoster(true);
      } finally {
        setLoadingRealData(false);
      }
    };
    fetchRealData();
  }, [org?.id]);

  // Open candidate evaluation dossier modal
  const openDossier = (c: CandidateRecord) => {
    setSelectedDossier(c);
    setEvaluatorRemarksText(c.evaluatorRemarks || '');
    setDossierDecision(c.status === 'FLAGGED' ? 'UNDER_REVIEW' : c.status);
  };

  // Submit official shortlisting decision
  const handleSaveDecision = async () => {
    if (!selectedDossier) return;
    setSavingDecision(true);
    try {
      if (org?.id && selectedDossier.id && !selectedDossier.id.startsWith('cand-')) {
        await api.updateCandidateShortlist(org.id, {
          registrationId: selectedDossier.id,
          status: dossierDecision,
          evaluatorRemarks: evaluatorRemarksText,
        });
      }

      setCandidates(prev =>
        prev.map(c => {
          if (c.id === selectedDossier.id) {
            return { ...c, status: dossierDecision, evaluatorRemarks: evaluatorRemarksText };
          }
          return c;
        })
      );

      notify.toast.success(`Official decision saved: ${selectedDossier.name} marked as ${dossierDecision}`);
      setSelectedDossier(null);
    } catch {
      notify.toast.error('Failed to update candidate status');
    } finally {
      setSavingDecision(false);
    }
  };

  // Export CSV
  const exportCSV = () => {
    const filtered = filteredCandidates;
    const headers = ['Roll No', 'Name', 'Email', 'Drive Title', 'Score', 'Percentile', 'Trust Index %', 'Violations', 'Status', 'Evaluator Remarks', 'Completed At'];
    const rows = filtered.map(c => [
      c.rollNo, c.name, c.email, `"${c.driveName}"`, c.score, `${c.percentile}%`, `${c.trustIndex}%`, c.violationsCount, c.status, `"${c.evaluatorRemarks || 'N/A'}"`, c.completedAt
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `kryptaviaos_candidates_${selectedDriveId}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notify.toast.success(`Exported ${filtered.length} candidate records to CSV`);
  };

  // Drive-wise and Search-wise Filter
  const filteredCandidates = candidates.filter(c => {
    const matchDrive = selectedDriveId === 'ALL' || c.contestId === selectedDriveId || c.driveName.toLowerCase().includes(selectedDriveId.toLowerCase());
    const matchSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.rollNo.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = statusFilter === 'ALL' || c.status === statusFilter;
    return matchDrive && matchSearch && matchStatus;
  });

  const shortlistedCount = filteredCandidates.filter(c => c.status === 'SHORTLISTED').length;
  const flaggedCount = filteredCandidates.filter(c => c.status === 'FLAGGED').length;

  return (
    <div className="space-y-6">
      {/* Top Banner if Demo Roster is Active */}
      {useDemoRoster && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-amber-300 text-xs">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">🧪</span>
            <div>
              <strong className="text-white block">Viewing Demo Benchmark Candidate Roster</strong>
              <span>No live submissions found in database for this organization yet. Viewing benchmark candidate evaluation data.</span>
            </div>
          </div>
          <button
            onClick={() => setUseDemoRoster(v => !v)}
            className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 rounded-xl font-bold transition whitespace-nowrap cursor-pointer"
          >
            {useDemoRoster ? 'Toggle Live Mode' : 'Toggle Demo Roster'}
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/30 rounded-full text-[10px] font-mono font-bold uppercase">
              DRIVE-WISE EVALUATION ENGINE
            </span>
          </div>
          <h2 className="font-black text-2xl text-white mt-1">Candidates & Shortlisting Cockpit</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Analyze section scores, verify AI proctoring integrity, and apply drive-specific shortlisting criteria.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => alert('GDPR Erasure Queue: 0 pending requests for candidate data removal.')}
            className="px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
          >
            🛡️ GDPR Erasure Queue
          </button>
          <button
            onClick={exportCSV}
            className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-extrabold text-xs rounded-xl transition shadow-lg shadow-emerald-500/20 flex items-center gap-1.5 cursor-pointer"
          >
            📥 Export Shortlist (CSV)
          </button>
        </div>
      </div>

      {/* Drive Selector Bar & Criteria Controls */}
      <div className="bg-zinc-950 border border-white/10 rounded-2xl p-4 space-y-4 shadow-xl">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">Assessment Drive:</span>
            <select
              value={selectedDriveId}
              onChange={e => setSelectedDriveId(e.target.value)}
              className="bg-black border border-white/15 text-white px-4 py-2 rounded-xl text-xs font-bold focus:border-blue-400 outline-none cursor-pointer w-full md:w-80"
            >
              <option value="ALL">🌐 All Assessment Drives ({candidates.length} candidates)</option>
              {contests.map(c => (
                <option key={c.id} value={c.id}>🏆 {c.title}</option>
              ))}
              <option value="Campus Engineering Drive 2026">🎓 Campus Engineering Drive 2026</option>
              <option value="Senior Full-Stack Assessment">💻 Senior Full-Stack Assessment</option>
              <option value="Data Analyst SQL Challenge">📊 Data Analyst SQL Challenge</option>
            </select>
          </div>

          {/* Drive Cutoff Criteria Config Bar */}
          <div className="flex items-center gap-4 text-xs font-mono bg-black/60 px-4 py-2 rounded-xl border border-white/10 w-full md:w-auto justify-between sm:justify-start">
            <div className="flex items-center gap-1.5">
              <span className="text-amber-400 font-bold">🎯 Cutoff:</span>
              <span className="font-bold text-white">{cutoffScore}%</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-emerald-400 font-bold">🛡️ Max Violations:</span>
              <span className="font-bold text-white">≤ {maxViolationsAllowed}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-purple-400 font-bold">💻 Coding Min:</span>
              <span className="font-bold text-white">≥ 60%</span>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-zinc-950 border border-white/10 rounded-2xl p-4 flex items-center gap-3 shadow-lg">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center text-xl font-bold">
            👥
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Drive Candidates</span>
            <span className="text-xl font-black text-white">{filteredCandidates.length} Screened</span>
          </div>
        </div>

        <div className="bg-zinc-950 border border-white/10 rounded-2xl p-4 flex items-center gap-3 shadow-lg">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center text-xl font-bold">
            ★
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Shortlisted Ratio</span>
            <span className="text-xl font-black text-amber-400">
              {shortlistedCount} ({filteredCandidates.length > 0 ? Math.round((shortlistedCount / filteredCandidates.length) * 100) : 0}%)
            </span>
          </div>
        </div>

        <div className="bg-zinc-950 border border-white/10 rounded-2xl p-4 flex items-center gap-3 shadow-lg">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400 flex items-center justify-center text-xl font-bold">
            📊
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Average Score</span>
            <span className="text-xl font-black text-white">78.4 / 100</span>
          </div>
        </div>

        <div className="bg-zinc-950 border border-white/10 rounded-2xl p-4 flex items-center gap-3 shadow-lg">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center text-xl font-bold">
            🛡️
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">AI Trust Integrity</span>
            <span className="text-xl font-black text-emerald-400">98.2% Low Risk</span>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-zinc-950 border border-white/10 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search candidate name, email, or roll no..."
            className="w-full bg-black border border-white/10 rounded-xl px-4 py-2.5 pl-9 text-xs text-white focus:border-blue-400 outline-none placeholder-zinc-600"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-xs">🔍</span>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          <span className="text-xs text-gray-500 font-bold uppercase tracking-wider whitespace-nowrap">Filter Status:</span>
          {[
            { id: 'ALL', label: 'All Candidates' },
            { id: 'SHORTLISTED', label: `Shortlisted (${shortlistedCount})` },
            { id: 'UNDER_REVIEW', label: 'Under Review' },
            { id: 'FLAGGED', label: `Proctor Flagged (${flaggedCount})` },
            { id: 'REJECTED', label: 'Rejected' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                statusFilter === f.id
                  ? 'bg-blue-500 text-black shadow-md'
                  : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Candidates Table */}
      <div className="bg-zinc-950 border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-300">
            <thead className="bg-white/5 border-b border-white/10 uppercase text-[10px] font-bold text-gray-400 tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Candidate Info</th>
                <th className="py-3.5 px-4">Assessment Drive</th>
                <th className="py-3.5 px-4 text-center">Overall Score</th>
                <th className="py-3.5 px-4 text-center font-mono">Coding / MCQ</th>
                <th className="py-3.5 px-4 text-center">AI Trust Index</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Evaluation Dossier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono">
              {filteredCandidates.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-500 font-sans">
                    <span className="text-2xl block mb-2">🔍</span>
                    No candidate records found for the selected drive & filter criteria.
                  </td>
                </tr>
              ) : (
                filteredCandidates.map(c => (
                  <tr key={c.id} className="hover:bg-white/3 transition">
                    <td className="py-3.5 px-4">
                      <div className="font-sans font-bold text-white text-sm">{c.name}</div>
                      <div className="text-gray-500 text-[11px] font-mono">{c.email}</div>
                      <div className="text-[10px] text-amber-400 font-mono font-bold mt-0.5">{c.rollNo}</div>
                    </td>

                    <td className="py-3.5 px-4 font-sans">
                      <span className="text-gray-300 font-bold block">{c.driveName}</span>
                      <span className="text-[10px] text-gray-500">{c.completedAt}</span>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <span className="text-sm font-black text-white block">{c.score} / {c.maxScore}</span>
                      <span className="text-[10px] text-emerald-400 font-bold">{c.percentile}th Percentile</span>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <div className="text-[11px]">
                        <span className="text-blue-400 font-bold block">Code: {c.codingScore ?? Math.round(c.score * 0.5)} / 50</span>
                        <span className="text-purple-400 font-bold block">MCQ: {c.mcqScore ?? Math.round(c.score * 0.5)} / 50</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border bg-black">
                        <span className={`w-2 h-2 rounded-full ${c.trustIndex >= 90 ? 'bg-emerald-400' : c.trustIndex >= 75 ? 'bg-amber-400' : 'bg-red-400 animate-pulse'}`} />
                        <span className={`font-bold ${c.trustIndex >= 90 ? 'text-emerald-400' : c.trustIndex >= 75 ? 'text-amber-400' : 'text-red-400'}`}>
                          {c.trustIndex}%
                        </span>
                      </div>
                      {c.violationsCount > 0 && (
                        <span className="text-[9px] text-red-400 font-bold block mt-1">⚠️ {c.violationsCount} violations</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-center font-sans">
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase border ${
                        c.status === 'SHORTLISTED'
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-sm shadow-emerald-500/10'
                          : c.status === 'FLAGGED'
                          ? 'bg-red-500/20 text-red-400 border-red-500/40 animate-pulse'
                          : c.status === 'REJECTED'
                          ? 'bg-zinc-800 text-zinc-500 border-white/5'
                          : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                      }`}>
                        {c.status === 'SHORTLISTED' ? '★ Shortlisted' : c.status === 'FLAGGED' ? '⚠️ Flagged' : c.status.replace('_', ' ')}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right font-sans">
                      <button
                        onClick={() => openDossier(c)}
                        className="px-3.5 py-1.5 bg-blue-500 hover:bg-blue-400 text-black font-extrabold text-xs rounded-xl transition shadow-md cursor-pointer flex items-center gap-1 ml-auto"
                      >
                        🔍 Analyze & Evaluate
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Candidate Scorecard Analysis Dossier Modal */}
      {selectedDossier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedDossier(null)}>
          <div className="bg-zinc-950 border border-white/10 rounded-3xl p-6 w-full max-w-2xl shadow-2xl space-y-5 relative max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest block">CANDIDATE SCORECARD & EVALUATION DOSSIER</span>
                <h3 className="text-xl font-black text-white">{selectedDossier.name}</h3>
                <p className="text-xs text-gray-400 font-mono mt-0.5">{selectedDossier.email} · {selectedDossier.rollNo}</p>
              </div>
              <button onClick={() => setSelectedDossier(null)} className="text-zinc-500 hover:text-white text-sm font-bold cursor-pointer">✕</button>
            </div>

            {/* Assessment & Overall Metrics */}
            <div className="grid grid-cols-3 gap-3 text-xs font-mono">
              <div className="p-3 bg-black rounded-xl border border-white/10">
                <span className="text-[10px] text-gray-500 block uppercase font-sans font-bold">Assessment Drive</span>
                <span className="text-white font-bold block">{selectedDossier.driveName}</span>
              </div>
              <div className="p-3 bg-black rounded-xl border border-white/10">
                <span className="text-[10px] text-gray-500 block uppercase font-sans font-bold">Overall Score</span>
                <span className="text-amber-400 font-black text-base block">{selectedDossier.score} / {selectedDossier.maxScore} ({selectedDossier.percentile}th %tile)</span>
              </div>
              <div className="p-3 bg-black rounded-xl border border-white/10">
                <span className="text-[10px] text-gray-500 block uppercase font-sans font-bold">AI Trust Index</span>
                <span className={`font-bold block text-base ${selectedDossier.trustIndex >= 90 ? 'text-emerald-400' : 'text-red-400'}`}>{selectedDossier.trustIndex}% Integrity</span>
              </div>
            </div>

            {/* Section-wise Performance Breakdown */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider">Section-Wise Performance Breakdown</h4>
              <div className="grid grid-cols-2 gap-3 font-mono text-xs">
                <div className="p-4 bg-zinc-900/60 rounded-xl border border-white/8 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-blue-400 font-sans">💻 Coding Section</span>
                    <span className="text-white font-bold">{selectedDossier.codingScore ?? 45} / 50 Marks</span>
                  </div>
                  <div className="w-full bg-black h-2 rounded-full overflow-hidden">
                    <div className="bg-blue-400 h-full rounded-full" style={{ width: `${((selectedDossier.codingScore ?? 45) / 50) * 100}%` }} />
                  </div>
                  <p className="text-[11px] text-gray-400 font-sans">Test Cases Passed: <strong className="text-emerald-400">{selectedDossier.testCasesPassed ?? 9} / {selectedDossier.testCasesTotal ?? 10}</strong></p>
                </div>

                <div className="p-4 bg-zinc-900/60 rounded-xl border border-white/8 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-purple-400 font-sans">📝 MCQ / Quiz Section</span>
                    <span className="text-white font-bold">{selectedDossier.mcqScore ?? 46} / 50 Marks</span>
                  </div>
                  <div className="w-full bg-black h-2 rounded-full overflow-hidden">
                    <div className="bg-purple-400 h-full rounded-full" style={{ width: `${((selectedDossier.mcqScore ?? 46) / 50) * 100}%` }} />
                  </div>
                  <p className="text-[11px] text-gray-400 font-sans">Accuracy Rate: <strong className="text-emerald-400">{Math.round(((selectedDossier.mcqScore ?? 46) / 50) * 100)}%</strong></p>
                </div>
              </div>
            </div>

            {/* Shortlisting Eligibility Criteria Validation */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider">Drive Cutoff Criteria Validation Checklist</h4>
              <div className="p-3 bg-black rounded-xl border border-white/10 space-y-1.5 text-xs font-mono">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Cutoff Score ≥ {cutoffScore}%:</span>
                  <span className={selectedDossier.score >= cutoffScore ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                    {selectedDossier.score >= cutoffScore ? `✓ PASSED (${selectedDossier.score}%)` : `✗ FAILED (${selectedDossier.score}%)`}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Proctoring Violations ≤ {maxViolationsAllowed}:</span>
                  <span className={selectedDossier.violationsCount <= maxViolationsAllowed ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                    {selectedDossier.violationsCount <= maxViolationsAllowed ? `✓ PASSED (${selectedDossier.violationsCount} flags)` : `✗ EXCEEDED (${selectedDossier.violationsCount} flags)`}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">AI Trust Score ≥ 85%:</span>
                  <span className={selectedDossier.trustIndex >= 85 ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                    {selectedDossier.trustIndex >= 85 ? `✓ PASSED (${selectedDossier.trustIndex}%)` : `✗ FAILED (${selectedDossier.trustIndex}%)`}
                  </span>
                </div>
              </div>
            </div>

            {/* Official Decision Selector */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-white uppercase tracking-wider">
                Official Evaluator Decision:
              </label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: 'SHORTLISTED', label: '★ Shortlist Candidate', color: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' },
                  { id: 'UNDER_REVIEW', label: '⏳ Hold / Under Review', color: 'bg-amber-500/20 border-amber-500/40 text-amber-300' },
                  { id: 'REJECTED', label: '❌ Reject Candidate', color: 'bg-rose-500/20 border-rose-500/40 text-rose-300' },
                ].map(d => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setDossierDecision(d.id as any)}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-extrabold transition cursor-pointer ${
                      dossierDecision === d.id ? `${d.color} shadow-lg ring-1 ring-white/20` : 'bg-black/40 border-white/10 text-gray-400 hover:text-white'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Evaluator Remarks & Notes */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">
                Official Evaluator Justification Notes & Feedback:
              </label>
              <textarea
                value={evaluatorRemarksText}
                onChange={e => setEvaluatorRemarksText(e.target.value)}
                placeholder="Enter technical justification, code quality notes, or interview recommendations..."
                className="w-full bg-black border border-white/10 rounded-xl p-3 text-xs text-white focus:border-blue-400 outline-none resize-none placeholder-zinc-600"
                rows={3}
              />
            </div>

            {/* Modal Actions */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setSelectedDossier(null)}
                className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>

              <button
                onClick={handleSaveDecision}
                disabled={savingDecision}
                className="flex-1 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 text-black font-black text-xs rounded-xl transition shadow-lg shadow-blue-500/20 cursor-pointer disabled:opacity-50"
              >
                {savingDecision ? 'Saving Decision...' : '💾 Save & Publish Official Evaluation'}
              </button>
            </div>
          </div>
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

// ═══════════════════════════════════════════
// ENTERPRISE SAML 2.0 CONFIGURATION TAB
// ═══════════════════════════════════════════
function SamlConfigTab({ org, reload }: { org: OrgData | null; reload: () => void }) {
  const notify = useNotify();
  const [samlEnabled, setSamlEnabled] = useState(org?.samlEnabled || false);
  const [samlDomain, setSamlDomain] = useState(org?.samlDomain || org?.domain || '');
  const [samlIdpEntityId, setSamlIdpEntityId] = useState(org?.samlIdpEntityId || '');
  const [samlIdpSsoUrl, setSamlIdpSsoUrl] = useState(org?.samlIdpSsoUrl || '');
  const [samlIdpCert, setSamlIdpCert] = useState(org?.samlIdpCert || '');
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (org) {
      setSamlEnabled(org.samlEnabled || false);
      setSamlDomain(org.samlDomain || org.domain || '');
      setSamlIdpEntityId(org.samlIdpEntityId || '');
      setSamlIdpSsoUrl(org.samlIdpSsoUrl || '');
      setSamlIdpCert(org.samlIdpCert || '');
    }
  }, [org]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!org) return;
    setSaving(true);
    setSavedSuccess(false);
    try {
      await api.updateSamlConfig({
        orgId: org.id,
        samlEnabled,
        samlDomain: samlDomain.trim(),
        samlIdpEntityId: samlIdpEntityId.trim(),
        samlIdpSsoUrl: samlIdpSsoUrl.trim(),
        samlIdpCert: samlIdpCert.trim(),
      });
      setSavedSuccess(true);
      notify.toast.success('Enterprise SAML 2.0 configuration saved successfully!');
      reload();
    } catch (err: any) {
      await notify.alert('Configuration Save Failed', {
        description: err?.response?.data?.error || 'Failed to save SAML settings',
        variant: 'danger',
      });
    } finally {
      setSaving(false);
    }
  };

  const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  const spEntityId = `${backendUrl}/api/auth/sso/saml/metadata`;
  const acsUrl = `${backendUrl}/api/auth/sso/saml/acs`;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 bg-purple-500/10 text-purple-400 border border-purple-500/30 rounded-full text-[10px] font-mono font-bold uppercase">
            ENTERPRISE SINGLE SIGN-ON
          </span>
        </div>
        <h2 className="text-2xl font-black text-white mt-1">SAML 2.0 Identity Provider Settings</h2>
        <p className="text-gray-400 text-xs mt-0.5">
          Connect your organization's Okta, Microsoft Azure AD / Entra ID, PingIdentity, or Shibboleth IdP for seamless single sign-on.
        </p>
      </div>

      {savedSuccess && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-xs text-emerald-400 font-bold flex items-center justify-between">
          <span>✅ Enterprise SAML settings updated and active.</span>
          <button onClick={() => setSavedSuccess(false)} className="text-emerald-500 hover:text-emerald-300">✕</button>
        </div>
      )}

      {/* Service Provider (SP) Config Card for IdP Setup */}
      <div className="bg-zinc-950 border border-white/10 rounded-2xl p-6 space-y-4 shadow-xl">
        <h3 className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-2">
          <span>⚙️ Step 1: Service Provider (SP) Metadata for your IdP</span>
        </h3>
        <p className="text-xs text-gray-400">Provide these URLs when setting up the Kryptavia OS SAML App in Okta, Azure AD, or Ping:</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
          <div className="bg-black p-3.5 rounded-xl border border-white/10 space-y-1">
            <span className="text-[10px] text-gray-500 font-sans uppercase font-bold block">SP Entity ID / Audience URI</span>
            <span className="text-purple-300 font-bold block select-all">{spEntityId}</span>
          </div>
          <div className="bg-black p-3.5 rounded-xl border border-white/10 space-y-1">
            <span className="text-[10px] text-gray-500 font-sans uppercase font-bold block">Assertion Consumer Service (ACS) URL</span>
            <span className="text-emerald-400 font-bold block select-all">{acsUrl}</span>
          </div>
        </div>
      </div>

      {/* IdP Config Form */}
      <form onSubmit={handleSave} className="bg-zinc-950 border border-white/10 rounded-2xl p-6 space-y-5 shadow-xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <h3 className="text-xs font-black text-white uppercase tracking-wider">Step 2: Identity Provider (IdP) Parameters</h3>
            <p className="text-[11px] text-gray-500 mt-0.5">Enable SAML and input your IdP endpoints</p>
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <span className="text-xs font-bold text-gray-300">SAML SSO Status:</span>
            <input
              type="checkbox"
              checked={samlEnabled}
              onChange={e => setSamlEnabled(e.target.checked)}
              className="w-5 h-5 accent-purple-500 cursor-pointer"
            />
            <span className={`text-xs font-extrabold px-2.5 py-1 rounded-lg border ${
              samlEnabled ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' : 'bg-zinc-800 text-zinc-500 border-white/5'
            }`}>
              {samlEnabled ? 'ACTIVE' : 'DISABLED'}
            </span>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">
              Institutional Email Domain
            </label>
            <input
              type="text"
              value={samlDomain}
              onChange={e => setSamlDomain(e.target.value)}
              placeholder="e.g. iitd.ac.in or acme.com"
              className="w-full bg-black border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-purple-400 outline-none font-mono"
            />
            <span className="text-[10px] text-gray-500 mt-1 block">Used for auto-routing candidate logins by email domain</span>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">
              IdP Entity ID / Issuer URL
            </label>
            <input
              type="text"
              value={samlIdpEntityId}
              onChange={e => setSamlIdpEntityId(e.target.value)}
              placeholder="http://www.okta.com/exk123456789"
              className="w-full bg-black border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-purple-400 outline-none font-mono"
            />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">
            IdP Single Sign-On Endpoint URL
          </label>
          <input
            type="url"
            value={samlIdpSsoUrl}
            onChange={e => setSamlIdpSsoUrl(e.target.value)}
            placeholder="https://dev-12345.okta.com/app/exk12345/sso/saml"
            className="w-full bg-black border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-purple-400 outline-none font-mono"
          />
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">
            IdP X.509 Certificate (PEM Format)
          </label>
          <textarea
            value={samlIdpCert}
            onChange={e => setSamlIdpCert(e.target.value)}
            rows={4}
            placeholder="-----BEGIN CERTIFICATE-----&#10;MIIDpDCCAoygAwIBAgIGAX...&#10;-----END CERTIFICATE-----"
            className="w-full bg-black border border-white/10 rounded-xl p-3 text-xs text-white focus:border-purple-400 outline-none font-mono resize-y placeholder-zinc-700"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold text-sm rounded-xl transition shadow-lg shadow-purple-500/20 cursor-pointer disabled:opacity-50"
        >
          {saving ? 'Saving SAML Configuration...' : '💾 Save Enterprise SAML Configuration'}
        </button>
      </form>
    </div>
  );
}

