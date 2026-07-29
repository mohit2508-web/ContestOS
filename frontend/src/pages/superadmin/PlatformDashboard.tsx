import { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

type TabId = 'overview' | 'organizations' | 'users' | 'audit' | 'billing' | 'features';

interface PlatformAnalytics {
  totalOrgs: number;
  activeOrgs: number;
  totalUsers: number;
  totalContests: number;
  activeContests: number;
  totalSubmissions: number;
  usersByRole: Record<string, number>;
  orgsByTier: Record<string, number>;
}

interface Org {
  id: string;
  name: string;
  slug: string;
  status: string;
  subscriptionTier: string;
  _count: { users: number; contests: number };
}

interface User {
  id: string;
  fullName: string;
  name?: string;
  email: string;
  role: string;
  organization?: { name: string };
  status: string;
  createdAt: string;
}

interface AuditLog {
  id: string;
  userName: string;
  action: string;
  resource: string;
  resourceId: string;
  details?: string;
  createdAt: string;
}

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'overview', label: 'Overview', icon: '📊' },
  { id: 'organizations', label: 'Organizations', icon: '🏢' },
  { id: 'users', label: 'Users', icon: '👥' },
  { id: 'audit', label: 'Audit Logs', icon: '📋' },
  { id: 'billing', label: 'Billing', icon: '💳' },
  { id: 'features', label: 'Feature Flags', icon: '🚩' },
];

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'bg-green-500/20 text-green-400 border border-green-500/30',
  SUSPENDED: 'bg-red-500/20 text-red-400 border border-red-500/30',
};

const ROLE_STYLES: Record<string, string> = {
  SUPER_ADMIN: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
  ORG_ADMIN: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  ORG_MEMBER: 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
  EVALUATOR: 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30',
  STUDENT: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
};

const TIER_STYLES: Record<string, string> = {
  FREE: 'bg-zinc-500/20 text-zinc-400 border border-zinc-500/30',
  PRO: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  ENTERPRISE: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
};

export function PlatformDashboard() {
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [loading, setLoading] = useState(true);

  const [analytics, setAnalytics] = useState<PlatformAnalytics | null>(null);

  const [orgs, setOrgs] = useState<Org[]>([]);
  const [orgsTotal, setOrgsTotal] = useState(0);
  const [orgsPage, setOrgsPage] = useState(1);
  const [orgsTotalPages, setOrgsTotalPages] = useState(1);
  const [orgsSearch, setOrgsSearch] = useState('');
  const [loadingOrgs, setLoadingOrgs] = useState(false);

  const [users, setUsers] = useState<User[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersPage, setUsersPage] = useState(1);
  const [usersTotalPages, setUsersTotalPages] = useState(1);
  const [usersSearch, setUsersSearch] = useState('');
  const [usersRoleFilter, setUsersRoleFilter] = useState('all');
  const [loadingUsers, setLoadingUsers] = useState(false);

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotalPages, setAuditTotalPages] = useState(1);
  const [auditActionFilter, setAuditActionFilter] = useState('all');
  const [loadingAudit, setLoadingAudit] = useState(false);

  const [featureFlags, setFeatureFlags] = useState<Record<string, { proctoring: boolean; seb: boolean; advancedAnalytics: boolean }>>({});

  const loadAnalytics = useCallback(async () => {
    try {
      const data = await api.getPlatformAnalytics();
      const analytics = data.analytics;
      if (analytics) {
        if (Array.isArray(analytics.usersByRole)) {
          const map: Record<string, number> = {};
          analytics.usersByRole.forEach((item: any) => { map[item.role] = item._count?.role || item._count?._all || 0; });
          analytics.usersByRole = map;
        }
        if (Array.isArray(analytics.orgsByTier)) {
          const map: Record<string, number> = {};
          analytics.orgsByTier.forEach((item: any) => { map[item.subscriptionTier] = item._count?.subscriptionTier || item._count?._all || 0; });
          analytics.orgsByTier = map;
        }
      }
      setAnalytics(analytics);
    } catch { /* noop */ }
  }, []);

  const loadOrgs = useCallback(async (page: number, search: string) => {
    setLoadingOrgs(true);
    try {
      const data = await api.getAllOrganizations(page, search);
      setOrgs(data.organizations || []);
      setOrgsTotal(data.total || 0);
      setOrgsTotalPages(data.totalPages || 1);
    } catch { /* noop */ }
    setLoadingOrgs(false);
  }, []);

  const loadUsers = useCallback(async (page: number, search: string, role: string) => {
    setLoadingUsers(true);
    try {
      const data = await api.getAllUsers(page, search, role === 'all' ? undefined : role);
      setUsers(data.users || []);
      setUsersTotal(data.total || 0);
      setUsersTotalPages(data.totalPages || 1);
    } catch { /* noop */ }
    setLoadingUsers(false);
  }, []);

  const loadAuditLogs = useCallback(async (page: number, action: string) => {
    setLoadingAudit(true);
    try {
      const data = await api.getAuditLogs(page, action === 'all' ? undefined : action);
      setAuditLogs(data.logs || []);
      setAuditTotal(data.total || 0);
      setAuditTotalPages(data.totalPages || 1);
    } catch { /* noop */ }
    setLoadingAudit(false);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadAnalytics();
      setLoading(false);
    })();
  }, [loadAnalytics]);

  useEffect(() => {
    if (activeTab === 'organizations') {
      loadOrgs(orgsPage, orgsSearch);
    }
  }, [activeTab, orgsPage, orgsSearch, loadOrgs]);

  useEffect(() => {
    if (activeTab === 'users') {
      loadUsers(usersPage, usersSearch, usersRoleFilter);
    }
  }, [activeTab, usersPage, usersSearch, usersRoleFilter, loadUsers]);

  useEffect(() => {
    if (activeTab === 'audit') {
      loadAuditLogs(auditPage, auditActionFilter);
    }
  }, [activeTab, auditPage, auditActionFilter, loadAuditLogs]);

  useEffect(() => {
    if (activeTab === 'features' && analytics?.orgsByTier) {
      const flags: Record<string, { proctoring: boolean; seb: boolean; advancedAnalytics: boolean }> = {};
      Object.keys(analytics.orgsByTier).forEach(tier => {
        flags[tier] = {
          proctoring: tier === 'PRO' || tier === 'ENTERPRISE',
          seb: tier === 'ENTERPRISE',
          advancedAnalytics: tier === 'PRO' || tier === 'ENTERPRISE',
        };
      });
      setFeatureFlags(flags);
    }
  }, [activeTab, analytics]);

  const handleOrgStatus = async (orgId: string, status: string) => {
    try {
      await api.updateOrgStatus(orgId, status);
      loadOrgs(orgsPage, orgsSearch);
      loadAnalytics();
    } catch { /* noop */ }
  };

  const handleOrgTier = async (orgId: string, tier: string) => {
    try {
      await api.updateOrgTier(orgId, tier);
      loadOrgs(orgsPage, orgsSearch);
      loadAnalytics();
    } catch { /* noop */ }
  };

  const handleUserSuspend = async (userId: string, status: string) => {
    try {
      await api.suspendUser(userId, status);
      loadUsers(usersPage, usersSearch, usersRoleFilter);
      loadAnalytics();
    } catch { /* noop */ }
  };

  const toggleFeatureFlag = (tier: string, flag: string) => {
    setFeatureFlags(prev => ({
      ...prev,
      [tier]: {
        ...prev[tier],
        [flag]: !(prev[tier]?.[flag as keyof typeof prev[string]]),
      },
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-400" />
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
                Platform<span className="text-amber-400">.</span>
              </h1>
              <p className="text-gray-500 text-sm mt-0.5">
                Super Admin Dashboard
                <span className="ml-2 text-gray-600 font-mono text-xs">@{user?.email}</span>
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg text-xs font-bold uppercase">
                Super Admin
              </span>
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
                    ? 'bg-black text-amber-400 border-t border-x border-white/10'
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
          <OverviewTab analytics={analytics} />
        )}
        {activeTab === 'organizations' && (
          <OrganizationsTab
            orgs={orgs}
            total={orgsTotal}
            page={orgsPage}
            totalPages={orgsTotalPages}
            setPage={setOrgsPage}
            search={orgsSearch}
            setSearch={setOrgsSearch}
            loading={loadingOrgs}
            onStatus={handleOrgStatus}
            onTier={handleOrgTier}
          />
        )}
        {activeTab === 'users' && (
          <UsersTab
            users={users}
            total={usersTotal}
            page={usersPage}
            totalPages={usersTotalPages}
            setPage={setUsersPage}
            search={usersSearch}
            setSearch={setUsersSearch}
            roleFilter={usersRoleFilter}
            setRoleFilter={setUsersRoleFilter}
            loading={loadingUsers}
            onSuspend={handleUserSuspend}
          />
        )}
        {activeTab === 'audit' && (
          <AuditLogsTab
            logs={auditLogs}
            total={auditTotal}
            page={auditPage}
            totalPages={auditTotalPages}
            setPage={setAuditPage}
            actionFilter={auditActionFilter}
            setActionFilter={setAuditActionFilter}
            loading={loadingAudit}
          />
        )}
        {activeTab === 'billing' && (
          <BillingTab orgsByTier={analytics?.orgsByTier || {}} />
        )}
        {activeTab === 'features' && (
          <FeatureFlagsTab
            orgsByTier={analytics?.orgsByTier || {}}
            featureFlags={featureFlags}
            onToggle={toggleFeatureFlag}
          />
        )}
      </div>
    </div>
  );
}

function OverviewTab({ analytics }: { analytics: PlatformAnalytics | null }) {
  const stats = [
    { label: 'Total Organizations', value: analytics?.totalOrgs ?? 0, icon: '🏢', color: 'amber' },
    { label: 'Total Users', value: analytics?.totalUsers ?? 0, icon: '👥', color: 'blue' },
    { label: 'Total Contests', value: analytics?.totalContests ?? 0, icon: '🏆', color: 'purple' },
    { label: 'Active Contests', value: analytics?.activeContests ?? 0, icon: '⚡', color: 'green' },
    { label: 'Total Submissions', value: analytics?.totalSubmissions ?? 0, icon: '📝', color: 'cyan' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {stats.map(s => (
          <div key={s.label} className="bg-zinc-950 border border-white/10 rounded-xl p-5 hover:border-white/20 transition">
            <div className="flex items-center justify-between mb-3">
              <span className="text-lg">{s.icon}</span>
              <span className={`text-2xl font-black text-${s.color}-400`}>{s.value}</span>
            </div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-zinc-950 border border-white/10 rounded-xl p-6">
          <h3 className="font-black text-sm text-gray-400 uppercase tracking-wider mb-4">Users by Role</h3>
          {!analytics?.usersByRole || (Array.isArray(analytics.usersByRole) ? analytics.usersByRole.length === 0 : Object.keys(analytics.usersByRole).length === 0) ? (
            <EmptyState icon="👥" message="No user data available." />
          ) : (
            <div className="space-y-3">
              {(Array.isArray(analytics.usersByRole)
                ? analytics.usersByRole
                : Object.entries(analytics.usersByRole).map(([role, data]: [string, any]) => ({ role, _count: typeof data === 'object' ? data._count : data }))
              ).map((item: any) => {
                const role = item.role || item[0];
                const count = typeof item._count === 'object' ? (item._count.role || item._count._all || 0) : (item._count || item[1] || 0);
                return (
                  <div key={role} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${ROLE_STYLES[role] || 'bg-zinc-800 text-zinc-400 border border-zinc-500/30'}`}>
                      {role}
                    </span>
                    <span className="text-sm font-black text-white">{count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-zinc-950 border border-white/10 rounded-xl p-6">
          <h3 className="font-black text-sm text-gray-400 uppercase tracking-wider mb-4">Organizations by Tier</h3>
          {!analytics?.orgsByTier || (Array.isArray(analytics.orgsByTier) ? analytics.orgsByTier.length === 0 : Object.keys(analytics.orgsByTier).length === 0) ? (
            <EmptyState icon="🏢" message="No org data available." />
          ) : (
            <div className="space-y-3">
              {(Array.isArray(analytics.orgsByTier)
                ? analytics.orgsByTier
                : Object.entries(analytics.orgsByTier).map(([tier, data]: [string, any]) => ({ subscriptionTier: tier, _count: typeof data === 'object' ? data._count : data }))
              ).map((item: any) => {
                const tier = item.subscriptionTier || item[0];
                const count = typeof item._count === 'object' ? (item._count.subscriptionTier || item._count._all || 0) : (item._count || item[1] || 0);
                return (
                  <div key={tier} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${TIER_STYLES[tier] || 'bg-zinc-800 text-zinc-400 border border-zinc-500/30'}`}>
                      {tier}
                    </span>
                    <span className="text-sm font-black text-white">{count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function OrganizationsTab({ orgs, total, page, totalPages, setPage, search, setSearch, loading, onStatus, onTier }: {
  orgs: Org[];
  total: number;
  page: number;
  totalPages: number;
  setPage: (p: number) => void;
  search: string;
  setSearch: (s: string) => void;
  loading: boolean;
  onStatus: (orgId: string, status: string) => void;
  onTier: (orgId: string, tier: string) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="font-black text-lg">Organization Management</h2>
        <span className="text-xs text-gray-500 font-bold">{total} organization(s)</span>
      </div>

      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="Search by name or slug..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="flex-1 bg-zinc-950 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:border-amber-400 outline-none placeholder-gray-600"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400" />
        </div>
      ) : orgs.length === 0 ? (
        <EmptyState icon="🏢" message="No organizations found." />
      ) : (
        <div className="border border-white/10 rounded-xl overflow-hidden bg-zinc-950">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-black/60 border-b border-white/10 text-gray-500 text-xs uppercase tracking-wider font-bold">
                <th className="p-4">Name</th>
                <th className="p-4">Slug</th>
                <th className="p-4">Status</th>
                <th className="p-4">Tier</th>
                <th className="p-4">Users</th>
                <th className="p-4">Contests</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {orgs.map(org => (
                <tr key={org.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="p-4 font-bold text-white">{org.name}</td>
                  <td className="p-4 text-gray-500 text-xs font-mono">{org.slug}</td>
                  <td className="p-4">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${STATUS_STYLES[org.status] || ''}`}>
                      {org.status}
                    </span>
                  </td>
                  <td className="p-4">
                    <select
                      value={org.subscriptionTier}
                      onChange={e => onTier(org.id, e.target.value)}
                      className={`bg-transparent border rounded-lg px-2 py-1 text-[10px] font-bold outline-none cursor-pointer ${TIER_STYLES[org.subscriptionTier] || ''}`}
                    >
                      <option value="FREE">FREE</option>
                      <option value="PRO">PRO</option>
                      <option value="ENTERPRISE">ENTERPRISE</option>
                    </select>
                  </td>
                  <td className="p-4 text-gray-400 text-xs font-mono">{org._count?.users || 0}</td>
                  <td className="p-4 text-gray-400 text-xs font-mono">{org._count?.contests || 0}</td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => onStatus(org.id, org.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border ${
                        org.status === 'ACTIVE'
                          ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/20'
                          : 'bg-green-500/10 hover:bg-green-500/20 text-green-400 border-green-500/20'
                      }`}
                    >
                      {org.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} setPage={setPage} />
      )}
    </div>
  );
}

function UsersTab({ users, total, page, totalPages, setPage, search, setSearch, roleFilter, setRoleFilter, loading, onSuspend }: {
  users: User[];
  total: number;
  page: number;
  totalPages: number;
  setPage: (p: number) => void;
  search: string;
  setSearch: (s: string) => void;
  roleFilter: string;
  setRoleFilter: (r: string) => void;
  loading: boolean;
  onSuspend: (userId: string, status: string) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="font-black text-lg">User Management</h2>
        <span className="text-xs text-gray-500 font-bold">{total} user(s)</span>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="flex-1 min-w-[200px] bg-zinc-950 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:border-amber-400 outline-none placeholder-gray-600"
        />
        <select
          value={roleFilter}
          onChange={e => { setRoleFilter(e.target.value); setPage(1); }}
          className="bg-zinc-950 border border-white/10 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-amber-400"
        >
          <option value="all">All Roles</option>
          <option value="SUPER_ADMIN">Super Admin</option>
          <option value="ORG_ADMIN">Org Admin</option>
          <option value="ORG_MEMBER">Org Member</option>
          <option value="EVALUATOR">Evaluator</option>
          <option value="STUDENT">Student</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400" />
        </div>
      ) : users.length === 0 ? (
        <EmptyState icon="👥" message="No users found." />
      ) : (
        <div className="border border-white/10 rounded-xl overflow-hidden bg-zinc-950">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-black/60 border-b border-white/10 text-gray-500 text-xs uppercase tracking-wider font-bold">
                <th className="p-4">Name</th>
                <th className="p-4">Email</th>
                <th className="p-4">Role</th>
                <th className="p-4">Organization</th>
                <th className="p-4">Status</th>
                <th className="p-4">Joined</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="p-4 font-bold text-white">{u.name || u.fullName || 'User'}</td>
                  <td className="p-4 text-gray-400 text-xs font-mono">{u.email}</td>
                  <td className="p-4">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${ROLE_STYLES[u.role] || 'bg-zinc-800 text-zinc-400 border border-zinc-500/30'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="p-4 text-gray-400 text-xs">{u.organization?.name || '-'}</td>
                  <td className="p-4">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${STATUS_STYLES[u.status] || ''}`}>
                      {u.status}
                    </span>
                  </td>
                  <td className="p-4 text-gray-500 text-xs font-mono">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => onSuspend(u.id, u.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border ${
                        u.status === 'ACTIVE'
                          ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/20'
                          : 'bg-green-500/10 hover:bg-green-500/20 text-green-400 border-green-500/20'
                      }`}
                    >
                      {u.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} setPage={setPage} />
      )}
    </div>
  );
}

function AuditLogsTab({ logs, total, page, totalPages, setPage, actionFilter, setActionFilter, loading }: {
  logs: any[];
  total: number;
  page: number;
  totalPages: number;
  setPage: (p: number) => void;
  actionFilter: string;
  setActionFilter: (a: string) => void;
  loading: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="font-black text-lg">Audit Logs</h2>
        <span className="text-xs text-gray-500 font-bold">{total} log(s)</span>
      </div>

      <div className="flex items-center gap-3">
        <select
          value={actionFilter}
          onChange={e => { setActionFilter(e.target.value); setPage(1); }}
          className="bg-zinc-950 border border-white/10 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-amber-400"
        >
          <option value="all">All Actions</option>
          <option value="CREATE">Create</option>
          <option value="UPDATE">Update</option>
          <option value="DELETE">Delete</option>
          <option value="LOGIN">Login</option>
          <option value="SUSPEND">Suspend</option>
          <option value="ACTIVATE">Activate</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400" />
        </div>
      ) : logs.length === 0 ? (
        <EmptyState icon="📋" message="No audit logs found." />
      ) : (
        <div className="border border-white/10 rounded-xl overflow-hidden bg-zinc-950">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-black/60 border-b border-white/10 text-gray-500 text-xs uppercase tracking-wider font-bold">
                <th className="p-4">User</th>
                <th className="p-4">Action</th>
                <th className="p-4">Resource</th>
                <th className="p-4">Resource ID</th>
                <th className="p-4">Details</th>
                <th className="p-4">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {logs.map(log => (
                <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="p-4 font-bold text-white">{log.user?.name || log.userName || 'System'}</td>
                  <td className="p-4">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                      log.action === 'CREATE' ? 'bg-green-500/20 text-green-400 border-green-500/30'
                      : log.action === 'DELETE' ? 'bg-red-500/20 text-red-400 border-red-500/30'
                      : log.action === 'SUSPEND' ? 'bg-orange-500/20 text-orange-400 border-orange-500/30'
                      : log.action === 'LOGIN' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                      : 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30'
                    }`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="p-4 text-gray-400 text-xs">{log.resource}</td>
                  <td className="p-4 text-gray-500 text-xs font-mono truncate max-w-[120px]">{log.resourceId}</td>
                  <td className="p-4 text-gray-500 text-xs truncate max-w-[200px]">
                    {typeof log.details === 'object' && log.details !== null
                      ? JSON.stringify(log.details)
                      : log.details || '-'}
                  </td>
                  <td className="p-4 text-gray-500 text-xs font-mono">
                    {new Date(log.timestamp || log.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} setPage={setPage} />
      )}
    </div>
  );
}

function BillingTab({ orgsByTier }: { orgsByTier: Record<string, number> }) {
  const tiers = [
    {
      name: 'FREE',
      price: '$0',
      description: 'For small teams getting started',
      features: ['5 Team Members', '10 Contests', 'Basic Support', 'Standard Analytics'],
      color: 'zinc',
    },
    {
      name: 'PRO',
      price: '$49/mo',
      description: 'For growing organizations',
      features: ['25 Team Members', '50 Contests', 'Proctoring', 'Advanced Analytics', 'Priority Support', 'Custom Branding'],
      color: 'blue',
    },
    {
      name: 'ENTERPRISE',
      price: '$199/mo',
      description: 'For large-scale deployments',
      features: ['Unlimited Members', 'Unlimited Contests', 'Safe Exam Browser', 'Full Analytics Suite', 'Custom SSO', 'Dedicated Support', 'SLA Guarantee', 'API Access'],
      color: 'amber',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="font-black text-lg">Billing Overview</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {tiers.map(t => (
          <div
            key={t.name}
            className={`bg-zinc-950 border rounded-2xl p-6 transition-all hover:border-${t.color}-400/30`}
          >
            <div className="mb-4">
              <div className="flex items-center justify-between">
                <h4 className="font-black text-lg">{t.name}</h4>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${TIER_STYLES[t.name] || ''}`}>
                  {orgsByTier[t.name] || 0} orgs
                </span>
              </div>
              <p className="text-2xl font-black text-amber-400 mt-1">{t.price}</p>
              <p className="text-xs text-gray-500 mt-1">{t.description}</p>
            </div>
            <ul className="space-y-2">
              {t.features.map(f => (
                <li key={f} className="text-xs text-gray-400 flex items-center gap-2">
                  <span className="text-amber-400">✓</span> {f}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function FeatureFlagsTab({ orgsByTier, featureFlags, onToggle }: {
  orgsByTier: Record<string, number>;
  featureFlags: Record<string, { proctoring: boolean; seb: boolean; advancedAnalytics: boolean }>;
  onToggle: (tier: string, flag: string) => void;
}) {
  const flags = ['proctoring', 'seb', 'advancedAnalytics'] as const;

  const flagLabels: Record<string, string> = {
    proctoring: 'Proctoring',
    seb: 'Safe Exam Browser',
    advancedAnalytics: 'Advanced Analytics',
  };

  return (
    <div className="space-y-6">
      <h2 className="font-black text-lg">Feature Flags by Tier</h2>
      <p className="text-sm text-gray-500">Toggle features available to each subscription tier.</p>

      <div className="border border-white/10 rounded-xl overflow-hidden bg-zinc-950">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-black/60 border-b border-white/10 text-gray-500 text-xs uppercase tracking-wider font-bold">
              <th className="p-4">Tier</th>
              <th className="p-4">Orgs</th>
              {flags.map(f => (
                <th key={f} className="p-4 text-center">{flagLabels[f]}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {['FREE', 'PRO', 'ENTERPRISE'].map(tier => (
              <tr key={tier} className="hover:bg-white/[0.02] transition-colors">
                <td className="p-4">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${TIER_STYLES[tier] || ''}`}>
                    {tier}
                  </span>
                </td>
                <td className="p-4 text-gray-400 text-xs font-mono">{orgsByTier[tier] || 0}</td>
                {flags.map(f => (
                  <td key={f} className="p-4 text-center">
                    <button
                      onClick={() => onToggle(tier, f)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        featureFlags[tier]?.[f]
                          ? 'bg-amber-500'
                          : 'bg-zinc-700'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          featureFlags[tier]?.[f] ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Pagination({ page, totalPages, setPage }: { page: number; totalPages: number; setPage: (p: number) => void }) {
  return (
    <div className="flex items-center justify-center gap-2 mt-6">
      <button
        onClick={() => setPage(Math.max(1, page - 1))}
        disabled={page === 1}
        className="px-4 py-2 bg-zinc-950 border border-white/10 rounded-lg text-sm text-gray-400 hover:text-white hover:border-white/20 transition disabled:opacity-30 disabled:cursor-not-allowed"
      >
        ← Prev
      </button>
      <span className="text-sm text-gray-500 font-mono px-3">
        {page} / {totalPages}
      </span>
      <button
        onClick={() => setPage(Math.min(totalPages, page + 1))}
        disabled={page === totalPages}
        className="px-4 py-2 bg-zinc-950 border border-white/10 rounded-lg text-sm text-gray-400 hover:text-white hover:border-white/20 transition disabled:opacity-30 disabled:cursor-not-allowed"
      >
        Next →
      </button>
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
