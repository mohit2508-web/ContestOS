import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useNotify } from '../components/notifications';

// Role display config
const ROLE_CONFIG: Record<string, { label: string; emoji: string; color: string; redirect: string; description: string }> = {
  PROCTOR: {
    label: 'Proctor', emoji: '🎯', color: 'from-rose-500 to-rose-600', redirect: '/proctor/live',
    description: 'Monitor live contests, flag violations, and manage exam integrity in real time.',
  },
  EVALUATOR: {
    label: 'Evaluator', emoji: '📝', color: 'from-teal-500 to-teal-600', redirect: '/evaluator/assigned',
    description: 'Review and grade subjective responses, essay answers, and coding submissions.',
  },
  ORG_MEMBER: {
    label: 'Organization Member', emoji: '👥', color: 'from-blue-500 to-blue-600', redirect: '/member/contests',
    description: 'Create and manage contests, invite candidates, and view assessment analytics.',
  },
  ANALYTICS_VIEWER: {
    label: 'Analytics Viewer', emoji: '📊', color: 'from-cyan-500 to-cyan-600', redirect: '/analytics/dashboard',
    description: 'Access performance reports, candidate analytics, and export assessment data.',
  },
  COMPLIANCE_OFFICER: {
    label: 'Compliance Officer', emoji: '⚖️', color: 'from-red-600 to-rose-700', redirect: '/compliance/audit-logs',
    description: 'Monitor audit logs, GDPR compliance events, and platform security policies.',
  },
  CONTEST_MODERATOR: {
    label: 'Contest Moderator', emoji: '🏛️', color: 'from-orange-500 to-orange-600', redirect: '/moderator/dashboard',
    description: 'Oversee contest execution, handle candidate queries, and publish results.',
  },
};

function getPasswordStrength(pwd: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pwd.length >= 8) score++;
  if (pwd.length >= 12) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  if (score <= 1) return { score, label: 'Weak', color: '#ef4444' };
  if (score <= 2) return { score, label: 'Fair', color: '#f97316' };
  if (score <= 3) return { score, label: 'Strong', color: '#eab308' };
  return { score, label: 'Very Strong', color: '#22c55e' };
}

export function AcceptInvitePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { user } = useAuth();
  const notify = useNotify();

  const [loading, setLoading] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orgData, setOrgData] = useState<any>(null);

  // Invitation metadata (decoded from token preview)
  const [inviteInfo, setInviteInfo] = useState<{
    orgName?: string;
    inviterName?: string;
    role?: string;
    expiresAt?: string;
  }>({});

  // Password setup (for users who don't have an account yet)
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwdError, setPwdError] = useState('');

  // Try to preview invite details
  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const info = await api.getTeamInvitationInfo(token);
        setInviteInfo(info);
        if (!user && info.requiresAccount) {
          setNeedsPassword(true);
        }
      } catch {
        // If preview endpoint doesn't exist yet, fall back gracefully
        setInviteInfo({});
      }
    })();
  }, [token, user]);

  const roleConfig = ROLE_CONFIG[inviteInfo.role || ''] || {
    label: inviteInfo.role || 'Team Member',
    emoji: '✨',
    color: 'from-amber-500 to-yellow-600',
    redirect: '/org',
    description: 'You\'ve been invited to join an organization on ContestOS.',
  };

  // Check expiry warning (within 24 hours)
  const isExpiringSoon = inviteInfo.expiresAt
    ? (new Date(inviteInfo.expiresAt).getTime() - Date.now()) < 24 * 60 * 60 * 1000
    : false;

  const validatePassword = () => {
    if (!password) { setPwdError('Password is required'); return false; }
    if (password.length < 8) { setPwdError('At least 8 characters required'); return false; }
    if (!/[0-9]/.test(password)) { setPwdError('Include at least one number'); return false; }
    if (password !== confirmPassword) { setPwdError('Passwords do not match'); return false; }
    setPwdError('');
    return true;
  };

  const handleAccept = async () => {
    if (!token) return;
    if (needsPassword && !validatePassword()) return;

    setLoading(true);
    setError(null);
    try {
      const res = await api.acceptTeamInvitation(token, needsPassword ? password : undefined);
      setAccepted(true);
      setOrgData(res.organization);
      notify.toast.success(res.message || 'Invitation accepted successfully!');
      setTimeout(() => {
        navigate(roleConfig.redirect);
      }, 3000);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to accept invitation. Token may be invalid or expired.');
    } finally {
      setLoading(false);
    }
  };

  const pwdStrength = getPasswordStrength(password);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050505] px-4 py-10 relative">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="bg-zinc-950 border border-white/8 rounded-3xl shadow-2xl shadow-black/60 overflow-hidden">
          {/* Gradient bar */}
          <div className={`h-1 w-full bg-gradient-to-r ${roleConfig.color}`} />

          <div className="p-8 space-y-6">
            {/* Logo */}
            <div className="text-center">
              <h1 className="text-2xl font-black text-white">Contest<span className="text-amber-400">OS</span></h1>
              <p className="text-xs text-gray-500 mt-0.5">Team Invitation Portal</p>
            </div>

            {/* Role badge */}
            <div className={`flex items-center gap-3 p-4 rounded-2xl bg-gradient-to-r ${roleConfig.color} bg-opacity-10`}
              style={{ background: `linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)`, border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${roleConfig.color} flex items-center justify-center text-xl shadow-lg flex-shrink-0`}>
                {roleConfig.emoji}
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">You're invited as</p>
                <p className="text-base font-black text-white">{roleConfig.label}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{roleConfig.description}</p>
              </div>
            </div>

            {/* Org + Inviter info */}
            {(inviteInfo.orgName || inviteInfo.inviterName) && (
              <div className="bg-zinc-900/60 border border-white/8 rounded-xl p-4 space-y-2 text-xs">
                {inviteInfo.orgName && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Organization</span>
                    <span className="text-white font-bold">{inviteInfo.orgName}</span>
                  </div>
                )}
                {inviteInfo.inviterName && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Invited by</span>
                    <span className="text-amber-400 font-bold">{inviteInfo.inviterName}</span>
                  </div>
                )}
                {user && (
                  <div className="flex justify-between border-t border-white/5 pt-2 mt-2">
                    <span className="text-gray-500">Accepting as</span>
                    <span className="text-emerald-400 font-bold font-mono">{user.name || user.email}</span>
                  </div>
                )}
              </div>
            )}

            {/* Expiry warning */}
            {isExpiringSoon && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-xs text-amber-400 font-semibold flex items-center gap-2">
                ⏳ This invitation expires soon. Accept it before it becomes invalid.
              </div>
            )}

            {/* No token error */}
            {!token && (
              <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400 font-bold text-center">
                ⚠️ No invitation token found in URL. Please use the link from your email.
              </div>
            )}

            {/* Error message */}
            {error && (
              <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 text-xs text-rose-400 font-semibold">
                ⚠️ {error}
              </div>
            )}

            {/* Success */}
            {accepted ? (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-5 space-y-3 text-center">
                <span className="text-3xl block">🎉</span>
                <p className="font-extrabold text-sm text-emerald-400">
                  Welcome to {orgData?.name || inviteInfo.orgName || 'the organization'}!
                </p>
                <p className="text-xs text-gray-400">Your <strong className="text-white">{roleConfig.label}</strong> role has been activated.</p>
                <p className="text-[10px] text-gray-500 animate-pulse">Redirecting to your dashboard in 3 seconds...</p>
              </div>
            ) : token ? (
              <div className="space-y-4">
                {/* Password setup (for new users) */}
                {needsPassword && (
                  <div className="space-y-3 bg-zinc-900/60 border border-white/8 rounded-xl p-4">
                    <p className="text-xs font-bold text-white">Set Your Password</p>
                    <p className="text-[11px] text-gray-400">You don't have an account yet. Create a password to complete setup.</p>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Password</label>
                      <div className="relative">
                        <input
                          type={showPwd ? 'text' : 'password'}
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                          className="w-full bg-black/60 border border-white/10 text-white px-4 py-3 rounded-xl focus:outline-none focus:border-amber-400 text-sm transition placeholder-gray-600"
                          placeholder="Min 8 chars, 1 number"
                        />
                        <button type="button" onClick={() => setShowPwd(v => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-sm transition cursor-pointer">
                          {showPwd ? '🙈' : '👁️'}
                        </button>
                      </div>
                      {password && (
                        <div className="mt-2 space-y-1">
                          <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-300" style={{ width: `${Math.min(100, (pwdStrength.score / 5) * 100)}%`, backgroundColor: pwdStrength.color }} />
                          </div>
                          <span className="text-[10px] font-bold" style={{ color: pwdStrength.color }}>{pwdStrength.label}</span>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Confirm Password</label>
                      <div className="relative">
                        <input
                          type={showConfirm ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={e => setConfirmPassword(e.target.value)}
                          className="w-full bg-black/60 border border-white/10 text-white px-4 py-3 rounded-xl focus:outline-none focus:border-amber-400 text-sm transition placeholder-gray-600"
                          placeholder="Re-enter password"
                        />
                        <button type="button" onClick={() => setShowConfirm(v => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-sm transition cursor-pointer">
                          {showConfirm ? '🙈' : '👁️'}
                        </button>
                      </div>
                      {confirmPassword && password === confirmPassword && (
                        <p className="text-[10px] text-emerald-400 mt-1">✓ Passwords match</p>
                      )}
                    </div>

                    {pwdError && <p className="text-[10px] text-rose-400 font-semibold">⚠️ {pwdError}</p>}
                  </div>
                )}

                <button
                  onClick={handleAccept}
                  disabled={loading || !token}
                  className={`w-full py-3.5 bg-gradient-to-r ${roleConfig.color} text-white font-extrabold text-sm rounded-xl hover:opacity-90 transition shadow-lg cursor-pointer disabled:opacity-50`}
                >
                  {loading ? 'Accepting Invitation...' : `✅ Accept Invitation as ${roleConfig.label}`}
                </button>

                {!user && (
                  <p className="text-[10px] text-gray-500 text-center">
                    Already have an account?{' '}
                    <Link to="/login" className="text-amber-400 font-bold hover:underline">Sign in first</Link>
                    {' '}to accept with your existing credentials.
                  </p>
                )}
              </div>
            ) : null}
          </div>
        </div>

        <p className="text-center text-gray-600 text-[10px] mt-4 tracking-wide">
          🔒 256-bit SSL Encrypted · GDPR Compliant · SOC 2 Ready
        </p>
      </div>
    </div>
  );
}

export default AcceptInvitePage;
