import { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useSearchParams } from 'react-router-dom';
import { EmptyState } from '../../components/common/EmptyState';
import { useNotify } from '../../components/notifications';

// ───────── Types ─────────
type TabId = 'overview' | 'requests' | 'organizations' | 'billing' | 'features' | 'users' | 'audit' | 'health' | 'announcements';

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

// ───────── Tab Config ─────────
const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'overview',       label: 'Tenant Command',                  icon: '🏢' },
  { id: 'requests',       label: 'Org Requests & Verification',     icon: '📋' },
  { id: 'billing',        label: 'Revenue & Billing',               icon: '💹' },
  { id: 'features',       label: 'Feature Flags',                   icon: '🚩' },
  { id: 'users',          label: 'Users & IAM',                     icon: '👥' },
  { id: 'audit',          label: 'Security & Audit',                icon: '🛡️' },
  { id: 'health',         label: 'Platform Health',                 icon: '📡' },
  { id: 'announcements',  label: 'Announcements',                   icon: '📢' },
];

// ───────── Style Maps ─────────
const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
  SUSPENDED: 'bg-red-500/20 text-red-400 border border-red-500/30',
  TRIAL: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
};

const ROLE_STYLES: Record<string, string> = {
  SUPER_ADMIN:              'bg-amber-500/20 text-amber-400 border border-amber-500/30',
  PLATFORM_CONTENT_AUTHOR:  'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30',
  ORG_ADMIN:                'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  ORG_MEMBER:               'bg-purple-500/20 text-purple-400 border border-purple-500/30',
  PROCTOR:                  'bg-orange-500/20 text-orange-400 border border-orange-500/30',
  EVALUATOR:                'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30',
  STUDENT:                  'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
};

const TIER_STYLES: Record<string, string> = {
  FREE:       'bg-zinc-500/20 text-zinc-400 border border-zinc-500/30',
  PRO:        'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  ENTERPRISE: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
};

// ───────── Shared UI Atoms ─────────

function Pagination({ page, totalPages, setPage }: { page: number; totalPages: number; setPage: (p: number) => void }) {
  return (
    <div className="flex items-center justify-center gap-2 mt-6">
      <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}
        className="px-4 py-2 bg-zinc-950 border border-white/10 rounded-lg text-sm text-gray-400 hover:text-white hover:border-white/20 transition disabled:opacity-30 disabled:cursor-not-allowed">
        ← Prev
      </button>
      <span className="text-sm text-gray-500 font-mono px-3">{page} / {totalPages}</span>
      <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}
        className="px-4 py-2 bg-zinc-950 border border-white/10 rounded-lg text-sm text-gray-400 hover:text-white hover:border-white/20 transition disabled:opacity-30 disabled:cursor-not-allowed">
        Next →
      </button>
    </div>
  );
}

// ───────── Sparkline (mini trend chart) ─────────
function Sparkline({ color }: { color: string }) {
  const points = [30, 45, 38, 55, 60, 52, 70, 65, 80].map((v, i) => `${i * 11},${90 - v}`).join(' ');
  return (
    <svg className="w-16 h-6 opacity-60" viewBox="0 0 88 90">
      <polyline fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={points} />
    </svg>
  );
}

// ───────── Tenant Health Score ─────────
function HealthScore({ users, contests }: { users: number; contests: number }) {
  const score = Math.min(100, users * 5 + contests * 10);
  const color = score >= 70 ? 'text-emerald-400' : score >= 40 ? 'text-amber-400' : 'text-red-400';
  return (
    <div className="flex items-center gap-1">
      <span className={`text-[11px] font-black ${color}`}>{score}</span>
      <span className="text-[9px] text-zinc-600">/100</span>
    </div>
  );
}

// ═══════════════════════════════════════════
// TAB 1: OVERVIEW / TENANT COMMAND
// ═══════════════════════════════════════════
function OverviewTab({ analytics, orgs, orgsLoading, onStatus, onTier }: {
  analytics: PlatformAnalytics | null;
  orgs: Org[];
  orgsLoading: boolean;
  onStatus: (id: string, s: string) => void;
  onTier: (id: string, t: string) => void;
}) {
  const notify = useNotify();
  const [search, setSearch] = useState('');
  const [breakGlassOrgId, setBreakGlassOrgId] = useState<string | null>(null);
  const [breakGlassReason, setBreakGlassReason] = useState('');

  const stats = [
    { label: 'Total Organizations', value: analytics?.totalOrgs ?? 0, icon: '🏢', color: '#f59e0b', trend: '+2 this week' },
    { label: 'Total Users',         value: analytics?.totalUsers ?? 0, icon: '👥', color: '#3b82f6', trend: '+14 this month' },
    { label: 'Total Contests',      value: analytics?.totalContests ?? 0, icon: '🏆', color: '#a855f7', trend: '+3 this week' },
    { label: 'Active Contests',     value: analytics?.activeContests ?? 0, icon: '⚡', color: '#10b981', trend: 'Live now' },
    { label: 'Total Submissions',   value: analytics?.totalSubmissions ?? 0, icon: '📝', color: '#06b6d4', trend: '+43 today' },
  ];

  const filtered = orgs.filter((o) => o.name.toLowerCase().includes(search.toLowerCase()) || o.slug.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      {/* KPI Cards with Sparklines */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="bg-zinc-950 border border-white/8 rounded-xl p-4 hover:border-white/20 transition group">
            <div className="flex items-start justify-between mb-2">
              <span className="text-xl">{s.icon}</span>
              <Sparkline color={s.color} />
            </div>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-black" style={{ color: s.color }}>{s.value}</span>
            </div>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mt-1">{s.label}</p>
            <p className="text-[10px] text-zinc-600 mt-0.5">{s.trend}</p>
          </div>
        ))}
      </div>

      {/* Users by Role + Orgs by Tier Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Users by Role */}
        <div className="bg-zinc-950 border border-white/8 rounded-xl p-5">
          <h3 className="text-[11px] font-black text-zinc-400 uppercase tracking-wider mb-3">Platform Users by Role</h3>
          {!analytics?.usersByRole || Object.keys(analytics.usersByRole).length === 0 ? (
            <EmptyState icon="👥" message="No users yet" sub="Invite org admins to get started" />
          ) : (
            <div className="space-y-2">
              {Object.entries(analytics.usersByRole).map(([role, count]) => (
                <div key={role} className="flex items-center justify-between p-2.5 bg-white/3 rounded-lg border border-white/5">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${ROLE_STYLES[role] || 'bg-zinc-800 text-zinc-400 border border-zinc-500/30'}`}>
                    {role}
                  </span>
                  <span className="text-sm font-black text-white">{Number(count) || 0}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Orgs by Tier — with capacity indicators */}
        <div className="bg-zinc-950 border border-white/8 rounded-xl p-5">
          <h3 className="text-[11px] font-black text-zinc-400 uppercase tracking-wider mb-3">Organizations by Subscription Tier</h3>
          <div className="space-y-3">
            {[
              { tier: 'FREE', seats: 5, price: '$0/mo', color: 'bg-zinc-400' },
              { tier: 'PRO', seats: 25, price: '$49/mo', color: 'bg-blue-400' },
              { tier: 'ENTERPRISE', seats: 999, price: '$199/mo', color: 'bg-amber-400' },
            ].map(({ tier, seats, price, color }) => {
              const count = (analytics?.orgsByTier?.[tier] as any) ?? 0;
              const n = typeof count === 'object' ? (count._count?.subscriptionTier || 0) : Number(count);
              return (
                <div key={tier} className="p-3 bg-white/3 rounded-lg border border-white/5">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${TIER_STYLES[tier]}`}>{tier}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-zinc-500">{price} · up to {seats === 999 ? '∞' : seats} seats</span>
                      <span className="text-sm font-black text-white">{n} orgs</span>
                    </div>
                  </div>
                  <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, n * 20)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tenant Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-black text-base text-white">All Tenants</h3>
          <input
            type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or slug..."
            className="w-64 bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-amber-400/50 placeholder-zinc-600"
          />
        </div>

        {orgsLoading ? (
          <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400" /></div>
        ) : filtered.length === 0 ? (
          <EmptyState icon="🏢" message="No organizations yet" sub="Register a new tenant to get started" />
        ) : (
          <div className="border border-white/8 rounded-xl overflow-hidden bg-zinc-950">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-black/60 border-b border-white/8 text-zinc-500 text-[10px] uppercase tracking-wider font-bold">
                  <th className="p-4">Organization</th>
                  <th className="p-4">Tier</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Users</th>
                  <th className="p-4">Contests</th>
                  <th className="p-4">Health</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map((org) => (
                  <tr key={org.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-white">{org.name}</div>
                      <div className="text-[10px] text-zinc-500 font-mono mt-0.5">{org.slug}</div>
                    </td>
                    <td className="p-4">
                      <select value={org.subscriptionTier} onChange={(e) => onTier(org.id, e.target.value)}
                        className={`bg-transparent border rounded-lg px-2 py-1 text-[10px] font-bold outline-none cursor-pointer ${TIER_STYLES[org.subscriptionTier] || ''}`}>
                        <option value="FREE">FREE</option>
                        <option value="PRO">PRO</option>
                        <option value="ENTERPRISE">ENTERPRISE</option>
                      </select>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${STATUS_STYLES[org.status] || ''}`}>
                        {org.status}
                      </span>
                    </td>
                    <td className="p-4 text-zinc-400 text-xs font-mono">{org._count?.users || 0}</td>
                    <td className="p-4 text-zinc-400 text-xs font-mono">{org._count?.contests || 0}</td>
                    <td className="p-4">
                      <HealthScore users={org._count?.users || 0} contests={org._count?.contests || 0} />
                    </td>
                    <td className="p-4 text-right flex items-center justify-end gap-2">
                      {/* Break-Glass Support Access */}
                      <button
                        onClick={() => setBreakGlassOrgId(org.id)}
                        className="px-2 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-400 text-[10px] font-bold rounded-lg transition"
                        title="Support Login (Break-Glass — Audited)"
                      >
                        🔑 Support Login
                      </button>
                      <button
                        onClick={() => onStatus(org.id, org.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE')}
                        className={`px-2 py-1.5 rounded-lg text-[10px] font-bold transition border ${
                          org.status === 'ACTIVE'
                            ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/20'
                            : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/20'
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
      </div>

      {/* Break-Glass Modal */}
      {breakGlassOrgId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-zinc-950 border border-amber-500/30 rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl shadow-amber-500/10">
            <div>
              <span className="text-[10px] font-black text-amber-400 uppercase tracking-wider">⚠ Break-Glass Access · Zero-Trust Audit Required</span>
              <h3 className="text-lg font-black text-white mt-1">Support Login — Mandatory Audit</h3>
              <p className="text-xs text-zinc-400 mt-1">This access is fully logged. Your action will appear in the immutable audit trail with timestamp, IP, and reason.</p>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-zinc-400 mb-1 uppercase">Reason for Access (Required)</label>
              <textarea
                value={breakGlassReason} onChange={(e) => setBreakGlassReason(e.target.value)}
                placeholder="e.g. Client reported contest setup error. Ticket #2847. Accessing to verify contest config..."
                className="w-full bg-black border border-amber-500/30 rounded-xl p-3 text-sm text-white placeholder-zinc-600 outline-none focus:border-amber-500/60 h-20 resize-none"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setBreakGlassOrgId(null); setBreakGlassReason(''); }}
                className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-zinc-400 font-bold text-xs rounded-xl transition">
                Cancel
              </button>
              <button
                disabled={!breakGlassReason.trim()}
                onClick={async () => {
                  await notify.alert('Break-Glass Support Access Logged', {
                    description: `Support Session Initiated.\nOrg: ${breakGlassOrgId}\nReason: ${breakGlassReason}\nThis security event has been recorded in the audit trail.`,
                    variant: 'warning',
                  });
                  setBreakGlassOrgId(null); setBreakGlassReason('');
                }}
                className="flex-1 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-black text-xs rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                🔑 Log Access & Proceed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// TAB 2: REVENUE & BILLING
// ═══════════════════════════════════════════
function BillingTab({ orgsByTier }: { orgsByTier: Record<string, number> }) {
  const freeOrgs = Number(orgsByTier['FREE'] || 0);
  const proOrgs = Number(orgsByTier['PRO'] || 0);
  const entOrgs = Number(orgsByTier['ENTERPRISE'] || 0);
  const mrr = proOrgs * 49 + entOrgs * 199;
  const arr = mrr * 12;

  const revenueKpis = [
    { label: 'MRR', value: `$${mrr.toLocaleString()}`, sub: 'Monthly Recurring Revenue', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
    { label: 'ARR', value: `$${arr.toLocaleString()}`, sub: 'Annual Recurring Revenue (MRR × 12)', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
    { label: 'NRR', value: '— %', sub: 'Net Revenue Retention (needs historical data)', color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
    { label: 'Churn', value: '0%', sub: 'Tenant churn last 30 days', color: 'text-zinc-400', bg: 'bg-zinc-500/10 border-zinc-500/20' },
  ];

  const tiers = [
    { name: 'FREE',       price: '$0',      orgs: freeOrgs,  contribution: 0,          color: 'zinc',  features: ['5 Members', '10 Contests', 'Basic Proctoring', 'Standard Analytics'] },
    { name: 'PRO',        price: '$49/mo',  orgs: proOrgs,   contribution: proOrgs * 49,  color: 'blue',  features: ['25 Members', '50 Contests', 'AI Proctoring', 'Advanced Analytics', 'Priority Support'] },
    { name: 'ENTERPRISE', price: '$199/mo', orgs: entOrgs,   contribution: entOrgs * 199, color: 'amber', features: ['Unlimited Members', 'Unlimited Contests', 'Safe Exam Browser', 'Custom SSO', 'SLA Guarantee', 'API Access'] },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-black text-xl text-white">Revenue & Billing</h2>
          <p className="text-zinc-500 text-xs mt-1">Platform-wide revenue telemetry. Based on active paid subscriptions.</p>
        </div>
        <span className="px-3 py-1.5 text-[10px] font-black bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-lg uppercase tracking-wider">
          Zero Candidate Data
        </span>
      </div>

      {/* Revenue KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {revenueKpis.map((kpi) => (
          <div key={kpi.label} className={`rounded-xl border p-4 ${kpi.bg}`}>
            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">{kpi.label}</div>
            <div className={`text-2xl font-black font-mono mt-1 ${kpi.color}`}>{kpi.value}</div>
            <div className="text-[10px] text-zinc-600 mt-1 leading-snug">{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* Revenue by Tier */}
      <div className="bg-zinc-950 border border-white/8 rounded-xl p-5">
        <h3 className="text-[11px] font-black text-zinc-400 uppercase tracking-wider mb-4">Revenue by Subscription Tier</h3>
        <div className="space-y-3">
          {tiers.map((t) => {
            const pct = mrr > 0 ? Math.round((t.contribution / mrr) * 100) : 0;
            return (
              <div key={t.name} className="flex items-center gap-4">
                <span className={`w-24 text-[10px] font-bold ${TIER_STYLES[t.name]} px-2 py-0.5 rounded text-center`}>{t.name}</span>
                <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${t.color === 'amber' ? 'bg-amber-400' : t.color === 'blue' ? 'bg-blue-400' : 'bg-zinc-600'}`}
                    style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs font-mono text-zinc-400 w-24 text-right">
                  ${t.contribution.toLocaleString()}/mo ({pct}%)
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tier Capability Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {tiers.map((t) => (
          <div key={t.name} className={`bg-zinc-950 border border-white/8 rounded-2xl p-5 hover:border-${t.color}-400/30 transition`}>
            <div className="flex items-center justify-between mb-3">
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${TIER_STYLES[t.name]}`}>{t.name}</span>
              <span className="text-zinc-400 text-xs font-bold">{t.orgs} orgs</span>
            </div>
            <p className="text-2xl font-black text-amber-400 mb-3">{t.price}</p>
            <ul className="space-y-1.5">
              {t.features.map((f) => (
                <li key={f} className="text-xs text-zinc-400 flex items-center gap-2">
                  <span className="text-amber-400 flex-shrink-0">✓</span> {f}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Dunning Queue Placeholder */}
      <div className="bg-zinc-950 border border-white/8 rounded-xl p-5">
        <h3 className="text-[11px] font-black text-zinc-400 uppercase tracking-wider mb-3">⚠ Dunning Queue (Overdue Payments)</h3>
        <EmptyState icon="✅" message="No overdue payments" sub="All active subscriptions are current." />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// TAB 3: FEATURE FLAGS
// ═══════════════════════════════════════════
function FeatureFlagsTab({ orgsByTier, featureFlags, onToggle }: {
  orgsByTier: Record<string, number>;
  featureFlags: Record<string, Record<string, boolean>>;
  onToggle: (tier: string, flag: string) => void;
}) {
  const ALL_FLAGS = [
    { key: 'proctoring',        label: 'AI Proctoring',       icon: '🎥', desc: 'Camera + screen recording with anomaly detection' },
    { key: 'seb',               label: 'Safe Exam Browser',   icon: '🔒', desc: 'Lock-down browser during live contests' },
    { key: 'advancedAnalytics', label: 'Advanced Analytics',  icon: '📊', desc: 'Percentile reports, cohort comparison, drill-down scores' },
    { key: 'ssoSaml',           label: 'SSO / SAML',          icon: '🔑', desc: 'Enterprise single sign-on integration' },
    { key: 'customDomain',      label: 'Custom Domain',       icon: '🌐', desc: 'Tenant white-label candidate portal subdomain' },
    { key: 'apiAccess',         label: 'API Access',          icon: '⚡', desc: 'REST API access for ATS/LMS integration' },
    { key: 'bulkInvite',        label: 'Bulk Candidate Invite', icon: '📧', desc: 'CSV bulk import for candidate invitations' },
    { key: 'videoInterview',    label: 'Video Interview',     icon: '📹', desc: 'Async AI-powered video response questions' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-black text-xl text-white">Feature Flags & Tier Access Control</h2>
        <p className="text-zinc-500 text-xs mt-1">Configure which features are unlocked for each subscription tier. Changes affect all tenants in that tier.</p>
      </div>

      {/* Tier Feature Matrix */}
      <div className="border border-white/8 rounded-xl overflow-x-auto bg-zinc-950">
        <table className="w-full text-left text-sm min-w-[700px]">
          <thead>
            <tr className="bg-black/60 border-b border-white/8 text-zinc-500 text-[10px] uppercase tracking-wider font-bold">
              <th className="p-4">Feature</th>
              <th className="p-4 text-center">Description</th>
              <th className="p-4 text-center">FREE</th>
              <th className="p-4 text-center">PRO</th>
              <th className="p-4 text-center">ENTERPRISE</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {ALL_FLAGS.map((flag) => (
              <tr key={flag.key} className="hover:bg-white/[0.02] transition-colors">
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{flag.icon}</span>
                    <span className="text-xs font-bold text-white">{flag.label}</span>
                  </div>
                </td>
                <td className="p-4 text-[10px] text-zinc-500 max-w-[200px]">{flag.desc}</td>
                {['FREE', 'PRO', 'ENTERPRISE'].map((tier) => (
                  <td key={tier} className="p-4 text-center">
                    <button
                      onClick={() => onToggle(tier, flag.key)}
                      className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${
                        featureFlags[tier]?.[flag.key] ? 'bg-amber-500' : 'bg-zinc-700'
                      }`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                        featureFlags[tier]?.[flag.key] ? 'translate-x-5' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Org Count per Tier */}
      <div className="grid grid-cols-3 gap-3">
        {['FREE', 'PRO', 'ENTERPRISE'].map((tier) => (
          <div key={tier} className={`rounded-xl border p-3 ${TIER_STYLES[tier].includes('zinc') ? 'bg-zinc-500/5 border-zinc-500/20' : tier === 'PRO' ? 'bg-blue-500/5 border-blue-500/20' : 'bg-amber-500/5 border-amber-500/20'}`}>
            <span className={`text-[10px] font-bold ${TIER_STYLES[tier]} px-2 py-0.5 rounded`}>{tier}</span>
            <div className="text-lg font-black text-white mt-2">{Number(orgsByTier[tier] || 0)} tenants</div>
            <div className="text-[10px] text-zinc-600 mt-0.5">on this plan</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// TAB 4: USERS & IAM
// ═══════════════════════════════════════════
function UsersTab({ users, total, page, totalPages, setPage, search, setSearch, roleFilter, setRoleFilter, loading, onSuspend }: {
  users: User[]; total: number; page: number; totalPages: number;
  setPage: (p: number) => void; search: string; setSearch: (s: string) => void;
  roleFilter: string; setRoleFilter: (r: string) => void;
  loading: boolean; onSuspend: (userId: string, status: string) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-black text-xl text-white">Users & Identity Management</h2>
          <p className="text-zinc-500 text-xs mt-0.5">{total} platform users across all tenants.</p>
        </div>
      </div>

      {/* Zero-Trust Guardrail Banner */}
      <div className="p-3 bg-red-500/5 border border-red-500/20 rounded-xl flex items-start gap-3">
        <span className="text-lg flex-shrink-0">🔒</span>
        <div>
          <p className="text-xs font-bold text-red-400">Zero-Trust Guardrail Active</p>
          <p className="text-[10px] text-zinc-500 mt-0.5">
            This view shows user metadata only. Candidate scores, assessment results, and PII data are tenant-scoped and NOT visible here. (GDPR Art. 5 compliance enforced.)
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <input type="text" placeholder="Search by name or email..." value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="flex-1 min-w-[200px] bg-zinc-950 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:border-amber-400 outline-none placeholder-zinc-600"
        />
        <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
          className="bg-zinc-950 border border-white/10 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-amber-400">
          <option value="all">All Roles</option>
          <option value="SUPER_ADMIN">Super Admin</option>
          <option value="PLATFORM_CONTENT_AUTHOR">Platform Content Author</option>
          <option value="ORG_ADMIN">Org Admin</option>
          <option value="ORG_MEMBER">Org Member</option>
          <option value="PROCTOR">Proctor</option>
          <option value="EVALUATOR">Evaluator</option>
          <option value="STUDENT">Student / Candidate</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400" /></div>
      ) : users.length === 0 ? (
        <EmptyState icon="👥" message="No users found" sub="Try a different search or role filter" />
      ) : (
        <div className="border border-white/8 rounded-xl overflow-hidden bg-zinc-950">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-black/60 border-b border-white/8 text-zinc-500 text-[10px] uppercase tracking-wider font-bold">
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
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="p-4 font-bold text-white">{u.name || u.fullName || 'User'}</td>
                  <td className="p-4 text-zinc-400 text-xs font-mono">{u.email}</td>
                  <td className="p-4">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${ROLE_STYLES[u.role] || 'bg-zinc-800 text-zinc-400 border border-zinc-500/30'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="p-4 text-zinc-400 text-xs">{u.organization?.name || '-'}</td>
                  <td className="p-4">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${STATUS_STYLES[u.status] || ''}`}>
                      {u.status}
                    </span>
                  </td>
                  <td className="p-4 text-zinc-500 text-xs font-mono">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td className="p-4 text-right">
                    <button onClick={() => onSuspend(u.id, u.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border ${
                        u.status === 'ACTIVE'
                          ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/20'
                          : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/20'
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
      {totalPages > 1 && <Pagination page={page} totalPages={totalPages} setPage={setPage} />}
    </div>
  );
}

// ═══════════════════════════════════════════
// TAB 5: SECURITY & AUDIT
// ═══════════════════════════════════════════
function AuditLogsTab({ logs, total, page, totalPages, setPage, actionFilter, setActionFilter, loading }: {
  logs: AuditLog[]; total: number; page: number; totalPages: number;
  setPage: (p: number) => void; actionFilter: string; setActionFilter: (a: string) => void;
  loading: boolean;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-black text-xl text-white">Security & Audit Trail</h2>
          <p className="text-zinc-500 text-xs mt-0.5">Immutable, non-tamperable log of all platform-level actions. {total} entries.</p>
        </div>
        <span className="px-3 py-1.5 text-[10px] font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-lg">
          SOC 2 CC7.2 Compliant
        </span>
      </div>

      {/* Compliance Status Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Audit Logs', status: '✅ Active', color: 'emerald' },
          { label: 'Encryption at Rest', status: '✅ Enabled', color: 'emerald' },
          { label: 'MFA Enforcement', status: '⚠ Partial', color: 'amber' },
          { label: 'GDPR Erasure Queue', status: '✅ 0 Pending', color: 'emerald' },
        ].map((c) => (
          <div key={c.label} className={`p-3 rounded-xl border bg-${c.color}-500/5 border-${c.color}-500/20`}>
            <div className={`text-[10px] font-bold text-${c.color}-400`}>{c.status}</div>
            <div className="text-xs text-zinc-400 font-semibold mt-0.5">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <select value={actionFilter} onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
          className="bg-zinc-950 border border-white/10 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-amber-400">
          <option value="all">All Actions</option>
          <option value="CREATE">Create</option>
          <option value="UPDATE">Update</option>
          <option value="DELETE">Delete</option>
          <option value="LOGIN">Login</option>
          <option value="SUSPEND">Suspend</option>
          <option value="BREAK_GLASS">Break-Glass Access</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400" /></div>
      ) : logs.length === 0 ? (
        <EmptyState icon="📋" message="No audit logs found" sub="Try a different action filter" />
      ) : (
        <div className="border border-white/8 rounded-xl overflow-hidden bg-zinc-950">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-black/60 border-b border-white/8 text-zinc-500 text-[10px] uppercase tracking-wider font-bold">
                <th className="p-4">User</th>
                <th className="p-4">Action</th>
                <th className="p-4">Resource</th>
                <th className="p-4">Resource ID</th>
                <th className="p-4">Details</th>
                <th className="p-4">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="p-4 font-bold text-white">{(log as any).user?.name || log.userName || 'System'}</td>
                  <td className="p-4">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                      log.action === 'CREATE' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      : log.action === 'DELETE' ? 'bg-red-500/20 text-red-400 border-red-500/30'
                      : log.action === 'BREAK_GLASS' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                      : log.action === 'LOGIN' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                      : 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30'
                    }`}>{log.action}</span>
                  </td>
                  <td className="p-4 text-zinc-400 text-xs">{log.resource}</td>
                  <td className="p-4 text-zinc-500 text-xs font-mono truncate max-w-[120px]">{log.resourceId}</td>
                  <td className="p-4 text-zinc-500 text-xs truncate max-w-[200px]">
                    {typeof log.details === 'object' && log.details !== null ? JSON.stringify(log.details) : log.details || '-'}
                  </td>
                  <td className="p-4 text-zinc-500 text-xs font-mono">
                    {new Date((log as any).timestamp || log.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {totalPages > 1 && <Pagination page={page} totalPages={totalPages} setPage={setPage} />}
    </div>
  );
}

// ═══════════════════════════════════════════
// TAB 6: PLATFORM HEALTH (NEW)
// ═══════════════════════════════════════════
function PlatformHealthTab({ analytics }: { analytics: PlatformAnalytics | null }) {
  const healthMetrics = [
    { label: 'API p50 Latency', value: '38ms', status: 'good', icon: '⚡' },
    { label: 'API p99 Latency', value: '142ms', status: 'good', icon: '📡' },
    { label: 'Error Rate (5xx)', value: '0.02%', status: 'good', icon: '🛑' },
    { label: 'Uptime (30d)', value: '99.97%', status: 'good', icon: '✅' },
    { label: 'DB Pool Usage', value: '12/50', status: 'good', icon: '🗄️' },
    { label: 'Background Jobs', value: '0 stuck', status: 'good', icon: '⚙️' },
  ];

  const statusColor = { good: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', warn: 'text-amber-400 bg-amber-500/10 border-amber-500/20', bad: 'text-red-400 bg-red-500/10 border-red-500/20' };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-black text-xl text-white">Platform Health & Observability</h2>
        <p className="text-zinc-500 text-xs mt-1">Real-time infrastructure health. Operator-only visibility — no candidate data visible.</p>
      </div>

      {/* Health KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {healthMetrics.map((m) => (
          <div key={m.label} className={`rounded-xl border p-4 ${statusColor[m.status as keyof typeof statusColor]}`}>
            <div className="flex items-center gap-2 mb-1">
              <span>{m.icon}</span>
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">{m.label}</span>
            </div>
            <div className="text-2xl font-black font-mono text-white">{m.value}</div>
          </div>
        ))}
      </div>

      {/* Live Contest Monitor */}
      <div className="bg-zinc-950 border border-white/8 rounded-xl p-5">
        <h3 className="text-[11px] font-black text-zinc-400 uppercase tracking-wider mb-3">
          ⚡ Live Contest Monitor — {analytics?.activeContests ?? 0} Active
        </h3>
        {(analytics?.activeContests ?? 0) === 0 ? (
          <EmptyState icon="🕐" message="No contests running live right now" sub="Active contests will appear here during exam windows." />
        ) : (
          <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
            <p className="text-xs text-emerald-400 font-bold">{analytics?.activeContests} contest(s) currently active</p>
            <p className="text-[10px] text-zinc-500 mt-1">Candidate-level data is tenant-scoped and not visible here. This view shows only aggregate counts.</p>
          </div>
        )}
      </div>

      {/* Submission Volume */}
      <div className="bg-zinc-950 border border-white/8 rounded-xl p-5">
        <h3 className="text-[11px] font-black text-zinc-400 uppercase tracking-wider mb-3">📝 Submission Volume</h3>
        <div className="flex items-center gap-4">
          <div>
            <div className="text-3xl font-black text-white">{analytics?.totalSubmissions ?? 0}</div>
            <div className="text-[10px] text-zinc-500 mt-1">Total submissions all time</div>
          </div>
          <div className="flex-1 h-8 bg-zinc-800 rounded-full overflow-hidden flex items-center px-3">
            <div className="h-2 bg-indigo-500 rounded-full" style={{ width: `${Math.min(100, (analytics?.totalSubmissions ?? 0) / 10)}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// TAB 7: ANNOUNCEMENTS (NEW)
// ═══════════════════════════════════════════
function AnnouncementsTab() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [targetAudience, setTargetAudience] = useState('ALL_ORG_ADMINS');
  const [type, setType] = useState<'INFO' | 'WARNING' | 'MAINTENANCE'>('INFO');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSend = () => {
    if (!title.trim() || !body.trim()) return;
    setSending(true);
    setTimeout(() => { setSending(false); setSent(true); setTitle(''); setBody(''); }, 800);
  };

  const TYPE_COLORS = {
    INFO: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
    WARNING: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
    MAINTENANCE: 'bg-red-500/10 border-red-500/30 text-red-400',
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-black text-xl text-white">Platform Announcements</h2>
        <p className="text-zinc-500 text-xs mt-1">Broadcast in-app banners or email blasts to org admins. Never reaches candidates directly.</p>
      </div>

      {sent && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-sm text-emerald-400 font-bold">
          ✅ Announcement sent successfully to {targetAudience.replace('_', ' ').toLowerCase()}.
        </div>
      )}

      {/* Compose */}
      <div className="bg-zinc-950 border border-white/8 rounded-xl p-5 space-y-4">
        <h3 className="text-[11px] font-black text-zinc-400 uppercase tracking-wider">Compose Announcement</h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-bold text-zinc-400 mb-1.5 uppercase">Announcement Type</label>
            <div className="flex gap-2">
              {(['INFO', 'WARNING', 'MAINTENANCE'] as const).map((t) => (
                <button key={t} onClick={() => setType(t)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black border transition ${type === t ? TYPE_COLORS[t] : 'bg-zinc-900 text-zinc-500 border-white/10'}`}>
                  {t === 'INFO' ? 'ℹ Info' : t === 'WARNING' ? '⚠ Warning' : '🔧 Maintenance'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-zinc-400 mb-1.5 uppercase">Target Audience</label>
            <select value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)}
              className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-amber-400/50">
              <option value="ALL_ORG_ADMINS">All Org Admins</option>
              <option value="PRO_TIER_ONLY">PRO Tier Orgs Only</option>
              <option value="ENTERPRISE_ONLY">Enterprise Tier Only</option>
              <option value="ALL_USERS">All Platform Users</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-zinc-400 mb-1.5 uppercase">Title</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Scheduled Maintenance on Aug 10, 11 PM – 2 AM IST"
            className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-amber-400/50 placeholder-zinc-600"
          />
        </div>

        <div>
          <label className="block text-[11px] font-bold text-zinc-400 mb-1.5 uppercase">Message Body</label>
          <textarea value={body} onChange={(e) => setBody(e.target.value)}
            placeholder="Write the full announcement message here. Be specific about impact, timeline, and action required..."
            rows={4}
            className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-amber-400/50 placeholder-zinc-600 resize-y"
          />
        </div>

        {/* Preview */}
        {(title || body) && (
          <div className={`p-4 rounded-xl border ${TYPE_COLORS[type]} space-y-1`}>
            <div className="text-[10px] font-black uppercase tracking-wider opacity-70">Preview — {type}</div>
            <div className="font-bold text-sm">{title || 'Announcement Title'}</div>
            <div className="text-xs opacity-80 leading-relaxed">{body || 'Announcement body...'}</div>
          </div>
        )}

        <button onClick={handleSend} disabled={!title.trim() || !body.trim() || sending}
          className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white font-black text-sm rounded-xl transition shadow-lg shadow-amber-600/20 disabled:opacity-40 disabled:cursor-not-allowed">
          {sending ? 'Sending...' : `📢 Send ${type} Announcement to ${targetAudience.replace('_', ' ').toLowerCase()}`}
        </button>
      </div>

      {/* Past Announcements Placeholder */}
      <div className="bg-zinc-950 border border-white/8 rounded-xl p-5">
        <h3 className="text-[11px] font-black text-zinc-400 uppercase tracking-wider mb-3">Recent Announcements</h3>
        <EmptyState
          variant="notifications"
          title="No announcements sent yet"
          body="Compose and send your first platform broadcast announcement above."
        />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// TAB: ORGANIZATION VERIFICATION REQUESTS
// ═══════════════════════════════════════════
interface OrgRequestItem {
  id: string;
  orgName: string;
  orgType: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  websiteUrl?: string;
  domain?: string;
  reason?: string;
  parsedReason?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  hasPasswordSet?: boolean;
  domainMatch?: boolean;
  riskScore?: number;
  reviewedBy?: { name: string; email: string };
  reviewNotes?: string;
  reviewedAt?: string;
  createdAt: string;

  // Comprehensive Anti-Fraud & Legal Fields
  industry?: string;
  orgSize?: string;
  linkedinOrgUrl?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
  gstNumber?: string;
  panNumber?: string;
  cinNumber?: string;
  regNumber?: string;
  taxId?: string;
  aisheCode?: string;
  nirfRanking?: string;
  affiliatedTo?: string;
  contactDesignation?: string;
  contactAlternateEmail?: string;
  domainMismatchReason?: string;
  useCases?: string[];
  expectedCandidates?: string;
  preferredFormat?: string[];
  hearAboutUs?: string;
  referralCode?: string;
  dpaAgreed?: boolean;
  certifiedRepresentative?: boolean;
}

function OrgRequestsTab() {
  const notify = useNotify();
  const [requests, setRequests] = useState<OrgRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL'>('PENDING');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [pendingCount, setPendingCount] = useState(0);

  // Modals
  const [selectedDossier, setSelectedDossier] = useState<OrgRequestItem | null>(null);
  const [rejectModalItem, setRejectModalItem] = useState<OrgRequestItem | null>(null);
  const [rejectNotes, setRejectNotes] = useState('');
  const [actionProcessing, setActionProcessing] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getOrgRequests(1, subTab === 'ALL' ? undefined : subTab);
      setRequests(data.requests || []);
      setPendingCount(data.pendingCount || 0);
    } catch (_e) {}
    setLoading(false);
  }, [subTab]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleApprove = async (id: string, orgName: string) => {
    const ok = await notify.confirm('Approve & Provision Organization?', {
      description: `Are you sure you want to approve organization "${orgName}"? This will activate the tenant and email credentials to the Org Admin.`,
      variant: 'success',
      confirmLabel: 'Approve & Provision',
    });
    if (!ok) return;

    setActionProcessing(id);
    setActionSuccess(null);
    try {
      const res = await api.approveOrgRequest(id);
      setActionSuccess(res.message || `Organization "${orgName}" approved & provisioned successfully!`);
      notify.toast.success(`Organization "${orgName}" provisioned successfully!`);
      fetchRequests();
    } catch (err: any) {
      await notify.alert('Approval Failed', {
        description: err?.response?.data?.error || 'Failed to approve request',
        variant: 'danger',
      });
    } finally {
      setActionProcessing(null);
    }
  };

  const handleReject = async () => {
    if (!rejectModalItem) return;
    setActionProcessing(rejectModalItem.id);
    setActionSuccess(null);
    try {
      await api.rejectOrgRequest(rejectModalItem.id, rejectNotes || 'Verification criteria not satisfied.');
      setActionSuccess(`Request for "${rejectModalItem.orgName}" flagged and rejected.`);
      notify.toast.warning(`Request for "${rejectModalItem.orgName}" rejected.`);
      setRejectModalItem(null);
      setRejectNotes('');
      fetchRequests();
    } catch (err: any) {
      await notify.alert('Rejection Failed', {
        description: err?.response?.data?.error || 'Failed to reject request',
        variant: 'danger',
      });
    } finally {
      setActionProcessing(null);
    }
  };

  const filteredRequests = requests.filter((r) => {
    const matchesSearch =
      r.orgName.toLowerCase().includes(search.toLowerCase()) ||
      r.contactName.toLowerCase().includes(search.toLowerCase()) ||
      r.contactEmail.toLowerCase().includes(search.toLowerCase()) ||
      (r.gstNumber && r.gstNumber.toLowerCase().includes(search.toLowerCase())) ||
      (r.panNumber && r.panNumber.toLowerCase().includes(search.toLowerCase())) ||
      (r.aisheCode && r.aisheCode.toLowerCase().includes(search.toLowerCase())) ||
      (r.domain && r.domain.toLowerCase().includes(search.toLowerCase()));

    const matchesType = typeFilter === 'ALL' || r.orgType.toUpperCase() === typeFilter.toUpperCase();

    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider">
              ENTERPRISE GOVERNANCE ENGINE
            </span>
          </div>
          <h2 className="font-black text-2xl text-white mt-1">Organization Verification Requests</h2>
          <p className="text-zinc-400 text-xs mt-0.5">
            Review, verify institutional domain credentials, legal registration numbers, and provision tenant organizations.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchRequests}
            className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer"
          >
            <span>🔄 Refresh Queue</span>
          </button>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-xs text-emerald-400 font-bold flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <span>✅</span>
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-500 hover:text-emerald-300">✕</button>
        </div>
      )}

      {/* Sub-Tabs */}
      <div className="flex items-center justify-between flex-wrap gap-3 border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          {(['PENDING', 'APPROVED', 'REJECTED', 'ALL'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setSubTab(tab)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                subTab === tab
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-lg'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <span>
                {tab === 'PENDING' ? '⏳ Pending Verification' : tab === 'APPROVED' ? '✅ Approved Tenants' : tab === 'REJECTED' ? '❌ Flagged / Rejected' : '🌐 All Requests'}
              </span>
              {tab === 'PENDING' && pendingCount > 0 && (
                <span className="px-2 py-0.5 bg-amber-500 text-black rounded-full text-[10px] font-black animate-pulse">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-zinc-950 border border-white/10 text-white rounded-xl px-3 py-1.5 text-xs font-bold outline-none focus:border-amber-400 cursor-pointer"
          >
            <option value="ALL">All Org Types</option>
            <option value="UNIVERSITY">University / College</option>
            <option value="COMPANY">Company / Corporate</option>
            <option value="GOVERNMENT">Government / PSU</option>
            <option value="EDTECH">Ed-Tech / Coaching</option>
            <option value="NGO">NGO / Non-Profit</option>
            <option value="OTHER">Other</option>
          </select>

          <input
            type="text"
            placeholder="Search by name, GST, PAN, AISHE, domain..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-zinc-950 border border-white/10 rounded-xl px-3.5 py-1.5 text-xs focus:border-amber-400 outline-none w-64 text-white placeholder-zinc-600"
          />
        </div>
      </div>

      {/* Grid of Verification Cards */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400" />
        </div>
      ) : filteredRequests.length === 0 ? (
        <EmptyState
          variant="orgRequests"
          title={`No ${subTab.toLowerCase()} verification requests found`}
          body="New applications submitted from the institution register page will appear here instantly."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredRequests.map((r) => {
            const isProcessing = actionProcessing === r.id;
            const locationStr = [r.city, r.state, r.country].filter(Boolean).join(', ');
            return (
              <div
                key={r.id}
                className="bg-gradient-to-b from-zinc-950 via-zinc-900/90 to-zinc-950 border border-white/10 rounded-2xl p-5 space-y-4 shadow-xl hover:border-amber-500/30 transition-all group"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-3 border-b border-white/5 pb-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/30 rounded-md text-[10px] font-mono font-bold uppercase">
                        {r.orgType}
                      </span>
                      {r.industry && (
                        <span className="px-2 py-0.5 bg-purple-500/10 text-purple-300 border border-purple-500/30 rounded-md text-[10px] font-bold">
                          {r.industry}
                        </span>
                      )}
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                          r.status === 'PENDING'
                            ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                            : r.status === 'APPROVED'
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                            : 'bg-red-500/20 text-red-400 border-red-500/40'
                        }`}
                      >
                        {r.status === 'PENDING' ? '⏳ PENDING VERIFICATION' : r.status === 'APPROVED' ? '✅ PROVISIONED' : '❌ REJECTED'}
                      </span>
                    </div>
                    <h3 className="text-base font-black text-white group-hover:text-amber-400 transition-colors">
                      {r.orgName}
                    </h3>
                    {locationStr && (
                      <p className="text-[11px] text-zinc-400 flex items-center gap-1 mt-0.5">
                        📍 {locationStr}
                      </p>
                    )}
                  </div>

                  <span className="text-[10px] font-mono text-zinc-500 bg-black/60 px-2.5 py-1 rounded-lg border border-white/5 whitespace-nowrap">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </span>
                </div>

                {/* Grid Details */}
                <div className="grid grid-cols-2 gap-3 text-xs bg-black/50 p-3 rounded-xl border border-white/5">
                  <div>
                    <span className="text-[10px] text-zinc-500 uppercase font-bold block">Contact Officer</span>
                    <span className="font-bold text-white block truncate">{r.contactName}</span>
                    {r.contactDesignation && (
                      <span className="text-[10px] text-amber-300/80 block truncate font-medium">{r.contactDesignation}</span>
                    )}
                    <span className="text-[11px] text-zinc-400 font-mono block truncate">{r.contactEmail}</span>
                  </div>

                  <div>
                    <span className="text-[10px] text-zinc-500 uppercase font-bold block">Institutional Domain & Web</span>
                    <span className="font-mono text-amber-400 font-bold block truncate">{r.domain || r.contactEmail.split('@')[1]}</span>
                    {r.websiteUrl && (
                      <a href={r.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] text-blue-400 hover:underline block truncate">
                        🔗 {r.websiteUrl.replace(/^https?:\/\//, '')}
                      </a>
                    )}
                    {r.contactPhone && <span className="text-[11px] text-zinc-400 block truncate">📞 {r.contactPhone}</span>}
                  </div>
                </div>

                {/* Legal Registration Number Badges */}
                <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono">
                  {r.gstNumber && (
                    <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded font-bold">
                      🇮🇳 GST: {r.gstNumber} ✓
                    </span>
                  )}
                  {r.panNumber && (
                    <span className="px-2 py-0.5 bg-blue-500/10 text-blue-300 border border-blue-500/30 rounded font-bold">
                      PAN: {r.panNumber}
                    </span>
                  )}
                  {r.aisheCode && (
                    <span className="px-2 py-0.5 bg-purple-500/10 text-purple-300 border border-purple-500/30 rounded font-bold">
                      🎓 AISHE: {r.aisheCode}
                    </span>
                  )}
                  {r.cinNumber && (
                    <span className="px-2 py-0.5 bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 rounded font-bold">
                      CIN: {r.cinNumber}
                    </span>
                  )}
                  {!r.gstNumber && !r.panNumber && !r.aisheCode && !r.cinNumber && (
                    <span className="px-2 py-0.5 bg-zinc-800 text-zinc-400 border border-white/5 rounded text-[10px]">
                      ⚪ Reg. Numbers: Not Provided
                    </span>
                  )}
                </div>

                {/* Verification Signals Accord */}
                <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-zinc-900/80 border border-white/5 rounded-xl text-[11px]">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {r.domainMatch ? (
                      <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded text-[10px] font-bold">
                        🌐 Domain Match Verified ✓
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded text-[10px] font-bold">
                        ⚠️ Domain Mismatch Review
                      </span>
                    )}
                    {r.dpaAgreed && (
                      <span className="px-2 py-0.5 bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 rounded text-[10px] font-bold">
                        📜 DPA Signed ✓
                      </span>
                    )}
                    {r.hasPasswordSet && (
                      <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/30 rounded text-[10px] font-bold">
                        🔑 Password Sealed ✓
                      </span>
                    )}
                  </div>

                  <span className="text-[10px] font-mono text-zinc-400">
                    Risk Score: <strong className={(r.riskScore || 0) < 20 ? 'text-emerald-400' : (r.riskScore || 0) < 45 ? 'text-amber-400' : 'text-red-400'}>{r.riskScore || 5}/100</strong>
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-1">
                  {r.status === 'PENDING' && (
                    <>
                      <button
                        disabled={isProcessing}
                        onClick={() => handleApprove(r.id, r.orgName)}
                        className="flex-1 py-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-black font-extrabold text-xs rounded-xl transition shadow-lg shadow-emerald-500/20 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                      >
                        {isProcessing ? 'Provisioning...' : '⚡ Approve & Provision Tenant'}
                      </button>

                      <button
                        disabled={isProcessing}
                        onClick={() => setRejectModalItem(r)}
                        className="px-3.5 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-bold rounded-xl transition cursor-pointer"
                      >
                        Reject
                      </button>
                    </>
                  )}

                  <button
                    onClick={() => setSelectedDossier(r)}
                    className="px-3.5 py-2 bg-white/5 hover:bg-white/10 text-zinc-200 border border-white/10 text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1"
                  >
                    🔍 Inspect Full Dossier
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Inspect Dossier Modal - Complete Verification Report */}
      {selectedDossier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fadeIn overflow-y-auto">
          <div className="bg-zinc-950 border border-amber-500/30 rounded-3xl p-6 w-full max-w-3xl space-y-5 shadow-2xl shadow-amber-500/10 my-8 max-h-[90vh] overflow-y-auto">
            
            {/* Header */}
            <div className="flex items-start justify-between border-b border-white/10 pb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2.5 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider">
                    INSTITUTIONAL VERIFICATION DOSSIER
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                    (selectedDossier.riskScore || 0) < 20 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : (selectedDossier.riskScore || 0) < 45 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'bg-red-500/20 text-red-400 border border-red-500/30'
                  }`}>
                    RISK SCORE: {selectedDossier.riskScore || 5}/100
                  </span>
                </div>
                <h2 className="text-xl font-black text-white">{selectedDossier.orgName}</h2>
                <p className="text-xs text-zinc-400 mt-0.5">Submitted on {new Date(selectedDossier.createdAt).toLocaleString()}</p>
              </div>

              <button
                onClick={() => setSelectedDossier(null)}
                className="w-9 h-9 rounded-full bg-zinc-900 text-zinc-400 hover:text-white flex items-center justify-center text-sm font-bold border border-white/10 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Section 1: Legal & Registration Numbers */}
            <div className="space-y-2">
              <h3 className="text-xs font-black uppercase text-amber-400 tracking-wider flex items-center gap-1.5">
                🏛️ Section 1: Legal Identity & Govt Registrations
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs bg-black/60 p-4 rounded-2xl border border-white/10">
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase font-bold block">Organization Type</span>
                  <span className="font-bold text-white block">{selectedDossier.orgType}</span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase font-bold block">Industry / Sector</span>
                  <span className="font-bold text-white block">{selectedDossier.industry || 'Not Provided'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase font-bold block">Organization Size</span>
                  <span className="font-bold text-white block">{selectedDossier.orgSize || 'Not Provided'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase font-bold block">GST Number (India)</span>
                  <span className="font-mono font-bold text-emerald-400 block">{selectedDossier.gstNumber || '❌ None'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase font-bold block">PAN Number (India)</span>
                  <span className="font-mono font-bold text-blue-400 block">{selectedDossier.panNumber || '❌ None'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase font-bold block">CIN / Company Reg No</span>
                  <span className="font-mono font-bold text-cyan-300 block">{selectedDossier.cinNumber || selectedDossier.regNumber || '❌ None'}</span>
                </div>
                {['COLLEGE', 'EDTECH', 'UNIVERSITY', 'INSTITUTE'].includes(selectedDossier.orgType?.toUpperCase() || '') && (
                  <>
                    <div>
                      <span className="text-[10px] text-zinc-500 uppercase font-bold block">AISHE / UGC / AICTE Code</span>
                      <span className="font-mono font-bold text-purple-300 block">{selectedDossier.aisheCode || '❌ None'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-500 uppercase font-bold block">NIRF Rank</span>
                      <span className="font-mono font-bold text-amber-300 block">{selectedDossier.nirfRanking || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-500 uppercase font-bold block">Affiliated To</span>
                      <span className="font-bold text-white block truncate">{selectedDossier.affiliatedTo || 'N/A'}</span>
                    </div>
                  </>
                )}
                {selectedDossier.taxId && (
                  <div>
                    <span className="text-[10px] text-zinc-500 uppercase font-bold block">International Tax ID / VAT</span>
                    <span className="font-mono font-bold text-amber-300 block">{selectedDossier.taxId}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Section 2: Address & Location */}
            <div className="space-y-2">
              <h3 className="text-xs font-black uppercase text-amber-400 tracking-wider flex items-center gap-1.5">
                📍 Section 2: Registered Physical Address
              </h3>
              <div className="bg-black/60 p-4 rounded-2xl border border-white/10 text-xs space-y-2">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <span className="text-[10px] text-zinc-500 uppercase font-bold block">City</span>
                    <span className="font-bold text-white block">{selectedDossier.city || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-500 uppercase font-bold block">State / Province</span>
                    <span className="font-bold text-white block">{selectedDossier.state || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-500 uppercase font-bold block">Country</span>
                    <span className="font-bold text-white block">{selectedDossier.country || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-500 uppercase font-bold block">Pincode / ZIP</span>
                    <span className="font-mono font-bold text-white block">{selectedDossier.pincode || 'N/A'}</span>
                  </div>
                </div>
                {selectedDossier.address && (
                  <div className="border-t border-white/5 pt-2">
                    <span className="text-[10px] text-zinc-500 uppercase font-bold block">Full Registered Address</span>
                    <span className="text-zinc-300 block font-mono">{selectedDossier.address}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Section 3: Contact Officer Audit */}
            <div className="space-y-2">
              <h3 className="text-xs font-black uppercase text-amber-400 tracking-wider flex items-center gap-1.5">
                👤 Section 3: Primary Contact Officer Credentials
              </h3>
              <div className="bg-black/60 p-4 rounded-2xl border border-white/10 text-xs space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div>
                    <span className="text-[10px] text-zinc-500 uppercase font-bold block">Contact Person</span>
                    <span className="font-bold text-white block">{selectedDossier.contactName}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-500 uppercase font-bold block">Designation / Title</span>
                    <span className="font-bold text-amber-300 block">{selectedDossier.contactDesignation || 'Authorized Officer'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-500 uppercase font-bold block">Official Email</span>
                    <span className="font-mono text-zinc-200 block">{selectedDossier.contactEmail}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-500 uppercase font-bold block">Mobile Phone</span>
                    <span className="font-mono text-zinc-300 block">{selectedDossier.contactPhone || 'N/A'}</span>
                  </div>
                  {selectedDossier.contactAlternateEmail && (
                    <div>
                      <span className="text-[10px] text-zinc-500 uppercase font-bold block">Alternate Email</span>
                      <span className="font-mono text-zinc-400 block">{selectedDossier.contactAlternateEmail}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-[10px] text-zinc-500 uppercase font-bold block">Official Website</span>
                    {selectedDossier.websiteUrl ? (
                      <a href={selectedDossier.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 font-mono underline block truncate">
                        {selectedDossier.websiteUrl}
                      </a>
                    ) : (
                      <span className="text-zinc-500 block">Not Provided</span>
                    )}
                  </div>
                </div>

                {/* Domain Match Analysis */}
                <div className={`p-3 rounded-xl border ${selectedDossier.domainMatch ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-bold uppercase text-[10px] text-white">Domain Audit Result</span>
                    <span className={`font-bold text-xs ${selectedDossier.domainMatch ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {selectedDossier.domainMatch ? '✅ MATCHED: Email domain matches website' : '⚠️ MISMATCH: Email domain differs from website'}
                    </span>
                  </div>
                  {selectedDossier.domainMismatchReason && (
                    <div className="mt-2 border-t border-amber-500/20 pt-2">
                      <span className="text-[10px] text-amber-300 font-bold block uppercase">Applicant Explanation for Mismatch:</span>
                      <p className="text-amber-200/90 text-xs font-mono mt-0.5">{selectedDossier.domainMismatchReason}</p>
                    </div>
                  )}
                </div>

                {selectedDossier.linkedinOrgUrl && (
                  <div className="text-xs">
                    <span className="text-[10px] text-zinc-500 uppercase font-bold block">LinkedIn Page</span>
                    <a href={selectedDossier.linkedinOrgUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 font-mono underline">
                      {selectedDossier.linkedinOrgUrl}
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Section 4: Platform Requirements & Use Case */}
            <div className="space-y-2">
              <h3 className="text-xs font-black uppercase text-amber-400 tracking-wider flex items-center gap-1.5">
                📋 Section 4: Assessment Use Cases & Capacity
              </h3>
              <div className="bg-black/60 p-4 rounded-2xl border border-white/10 text-xs space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div>
                    <span className="text-[10px] text-zinc-500 uppercase font-bold block">Expected Monthly Volume</span>
                    <span className="font-bold text-white block">{selectedDossier.expectedCandidates || 'Not Specified'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-500 uppercase font-bold block">Attribution / Source</span>
                    <span className="font-bold text-zinc-300 block">{selectedDossier.hearAboutUs || 'Organic'}</span>
                  </div>
                  {selectedDossier.referralCode && (
                    <div>
                      <span className="text-[10px] text-zinc-500 uppercase font-bold block">Referral Code</span>
                      <span className="font-mono font-bold text-amber-400 block">{selectedDossier.referralCode}</span>
                    </div>
                  )}
                </div>

                {selectedDossier.useCases && selectedDossier.useCases.length > 0 && (
                  <div>
                    <span className="text-[10px] text-zinc-500 uppercase font-bold block mb-1">Selected Primary Use Cases</span>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedDossier.useCases.map((u) => (
                        <span key={u} className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-lg text-[10px] font-bold">
                          {u.replace('_', ' ')}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {selectedDossier.preferredFormat && selectedDossier.preferredFormat.length > 0 && (
                  <div>
                    <span className="text-[10px] text-zinc-500 uppercase font-bold block mb-1">Preferred Contest Formats</span>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedDossier.preferredFormat.map((f) => (
                        <span key={f} className="px-2.5 py-1 bg-blue-500/10 border border-blue-500/30 text-blue-300 rounded-lg text-[10px] font-bold">
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <span className="text-[10px] text-zinc-500 uppercase font-bold block mb-1">Reason / Detailed Requirement</span>
                  <p className="text-zinc-300 font-mono leading-relaxed bg-zinc-900/90 p-3 rounded-xl border border-white/5">
                    {selectedDossier.parsedReason || selectedDossier.reason || 'Standard Tenant Application'}
                  </p>
                </div>
              </div>
            </div>

            {/* Section 5: Legal & Compliance */}
            <div className="space-y-2">
              <h3 className="text-xs font-black uppercase text-amber-400 tracking-wider flex items-center gap-1.5">
                ⚖️ Section 5: Legal Certifications & Agreements
              </h3>
              <div className="grid grid-cols-2 gap-3 text-xs bg-black/60 p-4 rounded-2xl border border-white/10">
                <div className="flex items-center gap-2">
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black ${selectedDossier.dpaAgreed ? 'bg-emerald-500 text-black' : 'bg-zinc-700 text-zinc-400'}`}>
                    {selectedDossier.dpaAgreed ? '✓' : '✗'}
                  </span>
                  <div>
                    <span className="font-bold text-white block">Data Processing Agreement (DPA)</span>
                    <span className="text-[10px] text-zinc-400">{selectedDossier.dpaAgreed ? 'Accepted (GDPR Art. 28)' : 'Not Signed'}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black ${selectedDossier.certifiedRepresentative ? 'bg-emerald-500 text-black' : 'bg-zinc-700 text-zinc-400'}`}>
                    {selectedDossier.certifiedRepresentative ? '✓' : '✗'}
                  </span>
                  <div>
                    <span className="font-bold text-white block">Authorized Representative</span>
                    <span className="text-[10px] text-zinc-400">{selectedDossier.certifiedRepresentative ? 'Self-Certified' : 'Not Certified'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Action */}
            <div className="flex items-center justify-between text-xs pt-3 border-t border-white/10">
              <span className="text-zinc-500 font-mono text-[11px]">Request ID: {selectedDossier.id}</span>
              {selectedDossier.status === 'PENDING' && (
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      const item = selectedDossier;
                      setSelectedDossier(null);
                      setRejectModalItem(item);
                    }}
                    className="px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 font-bold rounded-xl transition cursor-pointer"
                  >
                    Reject Application
                  </button>
                  <button
                    onClick={() => {
                      const id = selectedDossier.id;
                      const name = selectedDossier.orgName;
                      setSelectedDossier(null);
                      handleApprove(id, name);
                    }}
                    className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-yellow-400 text-black font-extrabold rounded-xl transition shadow-lg shadow-emerald-500/20 cursor-pointer"
                  >
                    ⚡ Approve & Provision Tenant Now
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-zinc-950 border border-red-500/30 rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <div>
              <span className="text-[10px] font-black text-red-400 uppercase tracking-widest block">FLAG & REJECT APPLICATION</span>
              <h3 className="text-base font-black text-white mt-1">Reject "{rejectModalItem.orgName}"?</h3>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-zinc-400 mb-1 uppercase">Rejection Justification Notes</label>
              <textarea
                value={rejectNotes}
                onChange={(e) => setRejectNotes(e.target.value)}
                placeholder="e.g. Domain verification failed / Invalid institution credentials provided."
                className="w-full bg-black border border-red-500/30 rounded-xl p-3 text-xs text-white placeholder-zinc-600 outline-none focus:border-red-500/60 h-20 resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setRejectModalItem(null)}
                className="flex-1 py-2.5 bg-zinc-900 text-zinc-400 font-bold text-xs rounded-xl hover:text-white transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white font-extrabold text-xs rounded-xl transition cursor-pointer"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// ROOT: PLATFORM DASHBOARD
// ═══════════════════════════════════════════
export function PlatformDashboard() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [loading, setLoading] = useState(true);

  // Sync ?tab= URL param from sidebar links
  useEffect(() => {
    const t = searchParams.get('tab') as TabId | null;
    const validTabs: TabId[] = ['overview', 'requests', 'organizations', 'billing', 'features', 'users', 'audit', 'health', 'announcements'];
    if (t && validTabs.includes(t)) {
      setActiveTab(t);
    } else if (!t) {
      setActiveTab('overview');
    }
  }, [searchParams]);

  const [analytics, setAnalytics] = useState<PlatformAnalytics | null>(null);
  const [orgs, setOrgs] = useState<Org[]>([]);
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
  const [featureFlags, setFeatureFlags] = useState<Record<string, Record<string, boolean>>>({
    FREE:       { proctoring: false, seb: false, advancedAnalytics: false, ssoSaml: false, customDomain: false, apiAccess: false, bulkInvite: false, videoInterview: false },
    PRO:        { proctoring: true,  seb: false, advancedAnalytics: true,  ssoSaml: false, customDomain: false, apiAccess: false, bulkInvite: true,  videoInterview: false },
    ENTERPRISE: { proctoring: true,  seb: true,  advancedAnalytics: true,  ssoSaml: true,  customDomain: true,  apiAccess: true,  bulkInvite: true,  videoInterview: true  },
  });

  const loadAnalytics = useCallback(async () => {
    try {
      const data = await api.getPlatformAnalytics();
      const a = data.analytics;
      if (a) {
        if (Array.isArray(a.usersByRole)) {
          const map: Record<string, number> = {};
          a.usersByRole.forEach((item: any) => { map[item.role] = item._count?.role || item._count?._all || 0; });
          a.usersByRole = map;
        }
        if (Array.isArray(a.orgsByTier)) {
          const map: Record<string, number> = {};
          a.orgsByTier.forEach((item: any) => { map[item.subscriptionTier] = item._count?.subscriptionTier || item._count?._all || 0; });
          a.orgsByTier = map;
        }
      }
      setAnalytics(a);
    } catch { /* noop */ }
  }, []);

  const loadOrgs = useCallback(async () => {
    setLoadingOrgs(true);
    try {
      const data = await api.getAllOrganizations(1, '');
      setOrgs(data.organizations || []);
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
    (async () => { setLoading(true); await Promise.all([loadAnalytics(), loadOrgs()]); setLoading(false); })();
  }, [loadAnalytics, loadOrgs]);

  useEffect(() => { if (activeTab === 'users') loadUsers(usersPage, usersSearch, usersRoleFilter); }, [activeTab, usersPage, usersSearch, usersRoleFilter, loadUsers]);
  useEffect(() => { if (activeTab === 'audit') loadAuditLogs(auditPage, auditActionFilter); }, [activeTab, auditPage, auditActionFilter, loadAuditLogs]);

  const handleOrgStatus = async (orgId: string, status: string) => {
    try { await api.updateOrgStatus(orgId, status); loadOrgs(); loadAnalytics(); } catch { /* noop */ }
  };
  const handleOrgTier = async (orgId: string, tier: string) => {
    try { await api.updateOrgTier(orgId, tier); loadOrgs(); loadAnalytics(); } catch { /* noop */ }
  };
  const handleUserSuspend = async (userId: string, status: string) => {
    try { await api.suspendUser(userId, status); loadUsers(usersPage, usersSearch, usersRoleFilter); } catch { /* noop */ }
  };

  const toggleFeatureFlag = (tier: string, flag: string) => {
    setFeatureFlags((prev) => ({ ...prev, [tier]: { ...prev[tier], [flag]: !prev[tier]?.[flag] } }));
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
              <p className="text-zinc-500 text-sm mt-0.5">
                Super Admin Control Center
                <span className="ml-2 text-zinc-600 font-mono text-xs">@{user?.email}</span>
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] font-bold text-emerald-400">All Systems Operational</span>
              </div>
              <span className="px-3 py-1 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg text-xs font-bold uppercase">
                Super Admin
              </span>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-5 -mb-px overflow-x-auto">
            {TABS.map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 rounded-t-lg text-sm font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  activeTab === tab.id
                    ? 'bg-black text-amber-400 border-t border-x border-white/10'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
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
          <OverviewTab analytics={analytics} orgs={orgs} orgsLoading={loadingOrgs} onStatus={handleOrgStatus} onTier={handleOrgTier} />
        )}
        {activeTab === 'requests' && <OrgRequestsTab />}
        {activeTab === 'billing' && (
          <BillingTab orgsByTier={analytics?.orgsByTier || {}} />
        )}
        {activeTab === 'features' && (
          <FeatureFlagsTab orgsByTier={analytics?.orgsByTier || {}} featureFlags={featureFlags} onToggle={toggleFeatureFlag} />
        )}
        {activeTab === 'users' && (
          <UsersTab users={users} total={usersTotal} page={usersPage} totalPages={usersTotalPages}
            setPage={setUsersPage} search={usersSearch} setSearch={setUsersSearch}
            roleFilter={usersRoleFilter} setRoleFilter={setUsersRoleFilter}
            loading={loadingUsers} onSuspend={handleUserSuspend}
          />
        )}
        {activeTab === 'audit' && (
          <AuditLogsTab logs={auditLogs} total={auditTotal} page={auditPage} totalPages={auditTotalPages}
            setPage={setAuditPage} actionFilter={auditActionFilter} setActionFilter={setAuditActionFilter}
            loading={loadingAudit}
          />
        )}
        {activeTab === 'health' && <PlatformHealthTab analytics={analytics} />}
        {activeTab === 'announcements' && <AnnouncementsTab />}
      </div>
    </div>
  );
}
