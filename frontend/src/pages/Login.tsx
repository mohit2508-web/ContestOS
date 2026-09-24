import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import { PortalLoader } from '../components/common/PortalLoader';
import { CinematicAuthBackground } from '../components/common/CinematicAuthBackground';

const HIERARCHY_MAP: Record<string, number> = {
  SUPER_ADMIN: 1,
  PLATFORM_CONTENT_AUTHOR: 2,
  ORG_ADMIN: 3,
  PROCTOR: 4,
  ORG_MEMBER: 4,
  EVALUATOR: 4,
  CONTEST_MODERATOR: 4,
  COMPLIANCE_OFFICER: 4,
  ANALYTICS_VIEWER: 5,
  STUDENT: 6,
  CANDIDATE: 6,
  GUEST_CANDIDATE: 7,
};

function roleToPath(role: string): string {
  switch (role) {
    case 'SUPER_ADMIN': return '/admin/platform';
    case 'PLATFORM_CONTENT_AUTHOR': return '/governance/sme-bank';
    case 'ORG_ADMIN': return '/admin/org';
    case 'PROCTOR': return '/proctor/live';
    case 'ORG_MEMBER': return '/member/contests';
    case 'EVALUATOR': return '/evaluator/assigned';
    case 'ANALYTICS_VIEWER': return '/analytics/dashboard';
    case 'COMPLIANCE_OFFICER': return '/compliance/audit-logs';
    case 'CONTEST_MODERATOR': return '/moderator/dashboard';
    case 'STUDENT': return '/contests';
    case 'CANDIDATE': return '/contests';
    default: return '/contests';
  }
}

const DEMO_ACCOUNTS = [
  { label: 'Super Admin', role: 'SUPER_ADMIN', email: 'admin@kryptavia.io', password: 'Admin@123456', color: 'from-red-500 to-red-600' },
  { label: 'Platform Content SME', role: 'PLATFORM_CONTENT_AUTHOR', email: 'sme@kryptavia.io', password: 'Sme@123456', color: 'from-indigo-500 to-indigo-600' },
  { label: 'Org Admin (IIT Delhi)', role: 'ORG_ADMIN', email: 'admin@iitd.ac.in', password: 'Admin@123456', color: 'from-purple-500 to-purple-600' },
  { label: 'Org Admin (GLA Univ)', role: 'GLA_ORG_ADMIN', email: 'neeraj@gla.ac.in', password: 'GlaAdmin@123456', color: 'from-amber-600 to-yellow-600' },
  { label: 'Proctor', role: 'PROCTOR', email: 'proctor@iitd.ac.in', password: 'Proctor@123456', color: 'from-rose-500 to-rose-600' },
  { label: 'Org Member', role: 'ORG_MEMBER', email: 'teacher@iitd.ac.in', password: 'Teacher@123456', color: 'from-blue-500 to-blue-600' },
  { label: 'Evaluator', role: 'EVALUATOR', email: 'evaluator@iitd.ac.in', password: 'Evaluator@123456', color: 'from-teal-500 to-teal-600' },
  { label: 'Analytics Viewer (HR)', role: 'ANALYTICS_VIEWER', email: 'analytics@iitd.ac.in', password: 'Analytics@123456', color: 'from-cyan-500 to-cyan-600' },
  { label: 'Chief Examiner / Moderator', role: 'CONTEST_MODERATOR', email: 'moderator@iitd.ac.in', password: 'Moderator@123456', color: 'from-orange-500 to-orange-600' },
  { label: 'Compliance & GDPR Officer', role: 'COMPLIANCE_OFFICER', email: 'compliance@iitd.ac.in', password: 'Compliance@123456', color: 'from-red-600 to-rose-700' },
  { label: 'Candidate', role: 'CANDIDATE', email: 'student@iitd.ac.in', password: 'Student@123456', color: 'from-emerald-500 to-emerald-600' },
];

// Forgot password modal
function ForgotPasswordModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) setSent(true);
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-zinc-950 border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl relative" onClick={e => e.stopPropagation()}>
        <div className="h-0.5 w-full bg-gradient-to-r from-amber-500 to-emerald-500 absolute top-0 left-0 rounded-t-2xl" />
        {sent ? (
          <div className="text-center space-y-3 pt-2">
            <div className="text-3xl">📬</div>
            <h3 className="text-base font-black text-white">Check Your Inbox</h3>
            <p className="text-xs text-gray-400">If an account exists for <strong className="text-white">{email}</strong>, a password reset link has been sent.</p>
            <button onClick={onClose} className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm rounded-xl transition cursor-pointer">Done</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div>
              <h3 className="text-base font-black text-white">Forgot Password?</h3>
              <p className="text-xs text-gray-400 mt-1">Enter your registered email and we'll send a reset link.</p>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Email Address</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="w-full bg-black/60 border border-white/10 text-white px-4 py-3 rounded-xl focus:outline-none focus:border-amber-400 text-sm transition placeholder-gray-600"
                placeholder="your@email.com" required autoFocus
              />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={onClose}
                className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-gray-400 text-sm font-bold rounded-xl transition cursor-pointer">
                Cancel
              </button>
              <button type="submit"
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-sm rounded-xl transition cursor-pointer">
                Send Reset Link
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// Enterprise SAML SSO Modal
function SamlLoginModal({ onClose }: { onClose: () => void }) {
  const [domainOrSlug, setDomainOrSlug] = useState('');
  const [error, setError] = useState('');

  const handleSamlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!domainOrSlug.trim()) {
      setError('Please enter your organization domain or slug');
      return;
    }
    const baseUrl = import.meta.env.VITE_API_URL || window.location.origin;
    const cleanInput = domainOrSlug.trim().toLowerCase();
    const queryParam = cleanInput.includes('.') ? `domain=${encodeURIComponent(cleanInput)}` : `orgSlug=${encodeURIComponent(cleanInput)}`;
    window.location.href = `${baseUrl}/api/auth/sso/saml/login?${queryParam}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-zinc-950 border border-purple-500/30 rounded-3xl p-6 w-full max-w-sm shadow-2xl relative space-y-4" onClick={e => e.stopPropagation()}>
        <div className="h-1 w-full bg-gradient-to-r from-purple-500 to-indigo-500 absolute top-0 left-0 rounded-t-3xl" />
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            <span className="text-xl">🏢</span>
            <h3 className="text-base font-black text-white">Enterprise SAML 2.0 SSO</h3>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white text-sm font-bold cursor-pointer">✕</button>
        </div>
        <p className="text-xs text-zinc-400">
          Sign in via your corporate or university Identity Provider (Okta, Azure AD / Entra ID, Ping, Shibboleth).
        </p>
        {error && (
          <div className="p-2.5 bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold rounded-xl">
            ⚠️ {error}
          </div>
        )}
        <form onSubmit={handleSamlSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1.5">
              Organization Domain or Slug
            </label>
            <input
              type="text"
              value={domainOrSlug}
              onChange={e => setDomainOrSlug(e.target.value)}
              className="w-full bg-black/60 border border-white/10 text-white px-4 py-3 rounded-xl focus:outline-none focus:border-purple-400 text-sm transition placeholder-zinc-600 font-mono"
              placeholder="e.g. iitd.ac.in or google.com"
              required autoFocus
            />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-zinc-400 text-xs font-bold rounded-xl transition cursor-pointer">
              Cancel
            </button>
            <button type="submit"
              className="flex-1 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold text-xs rounded-xl transition shadow-lg shadow-purple-500/20 cursor-pointer">
              Launch SAML SSO →
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function LoginPageComponent() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [showSamlModal, setShowSamlModal] = useState(false);
  const [showDevPanel, setShowDevPanel] = useState(false);
  const [portalState, setPortalState] = useState<{ active: boolean; path: string; name: string }>({
    active: false, path: '/contests', name: '',
  });
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSocialLogin = (provider: string) => {
    const baseUrl = import.meta.env.VITE_API_URL || window.location.origin;
    window.location.href = `${baseUrl}/api/auth/sso/${provider.toLowerCase()}`;
  };

  const doLogin = async (loginEmail: string, loginPassword: string) => {
    setError('');
    setLoading(true);
    try {
      const result = await api.login(loginEmail, loginPassword);
      if (rememberMe) {
        localStorage.setItem('kryptaviaos_remember_email', loginEmail);
      } else {
        localStorage.removeItem('kryptaviaos_remember_email');
      }
      login(result.accessToken, result.refreshToken, {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        role: result.user.role,
        organizationId: result.user.organizationId,
        hierarchyLevel: HIERARCHY_MAP[result.user.role] || 5,
      });
      setPortalState({
        active: true,
        path: roleToPath(result.user.role),
        name: result.user.name || result.user.email || 'User',
      });
    } catch (err: any) {
      const msg = err?.response?.data?.error || '';
      if (msg.includes('not found') || msg.includes('No user')) {
        setError('No account found with this email address. Please register first.');
      } else if (msg.includes('password') || msg.includes('credentials') || msg.includes('Invalid')) {
        setError('Incorrect password. Please try again or use "Forgot Password".');
      } else {
        setError(msg || 'Sign in failed. Please check your credentials and try again.');
      }
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await doLogin(email, password);
  };

  const handleDemoLogin = (account: typeof DEMO_ACCOUNTS[number]) => {
    setEmail(account.email);
    setPassword(account.password);
    doLogin(account.email, account.password);
  };

  if (portalState.active) {
    return (
      <PortalLoader
        duration={3500}
        title={`${portalState.name} · Authenticated`}
        onComplete={() => navigate(portalState.path)}
      />
    );
  }

  return (
    <>
      {showForgot && <ForgotPasswordModal onClose={() => setShowForgot(false)} />}
      {showSamlModal && <SamlLoginModal onClose={() => setShowSamlModal(false)} />}

      <CinematicAuthBackground maxWidthClass="max-w-md">
        <div className="p-8 space-y-6">
          {/* Header */}
          <div className="text-center">
            <h1 className="text-3xl font-black tracking-tight logo-shimmer">
              <span className="text-white">Kryptavia</span><span className="text-amber-400">OS</span>
            </h1>
            <p className="text-xs text-gray-400 mt-1">Sign in to your assessment portal</p>
          </div>

          {/* Social Login Buttons (Disabled) */}
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'google', icon: 'G', label: 'Google' },
                { id: 'github', icon: '⌥', label: 'GitHub' },
                { id: 'linkedin', icon: 'in', label: 'LinkedIn' },
              ].map(({ id, icon, label }) => (
                <button
                  key={id}
                  type="button"
                  disabled
                  title="Social OAuth is currently disabled"
                  className="w-full py-2.5 bg-white/5 border border-white/5 rounded-xl text-zinc-500 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-not-allowed opacity-40 select-none"
                >
                  <span className="font-black opacity-50">{icon}</span>
                  <span>{label}</span>
                </button>
              ))}
            </div>

            {/* Enterprise SAML Option */}
            <button
              type="button"
              onClick={() => setShowSamlModal(true)}
              className="w-full py-2 px-3 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-300 text-[11px] font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>🏢 Enterprise SAML 2.0 Single Sign-On (Okta / Azure AD)</span>
            </button>
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/8" />
            </div>
            <div className="relative flex justify-center text-[10px]">
              <span className="bg-[#08080a] px-3 text-gray-500 uppercase tracking-widest font-bold">or sign in with email</span>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3 rounded-xl text-xs font-bold text-center">
              ⚠️ {error}
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">
                Email Address
              </label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="w-full bg-black/60 border border-white/10 text-white px-4 py-3 rounded-xl focus:outline-none focus:border-amber-400 focus:shadow-sm focus:shadow-amber-400/10 text-sm transition placeholder-gray-600"
                placeholder="e.g. priya@iitd.ac.in"
                required autoComplete="email"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400">Password</label>
                <button type="button" onClick={() => setShowForgot(true)}
                  className="text-[10px] text-amber-400 hover:text-amber-300 font-semibold transition cursor-pointer">
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-black/60 border border-white/10 text-white px-4 py-3 pr-11 rounded-xl focus:outline-none focus:border-amber-400 focus:shadow-sm focus:shadow-amber-400/10 text-sm transition placeholder-gray-600"
                  placeholder="Enter your password"
                  required autoComplete="current-password"
                />
                <button
                  type="button" onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition cursor-pointer text-sm"
                  tabIndex={-1}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <label className="flex items-center gap-2.5 cursor-pointer group">
              <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded accent-amber-500 cursor-pointer" />
              <span className="text-xs text-gray-400 group-hover:text-gray-200 transition">Remember me on this device</span>
            </label>

            <button
              type="submit" disabled={loading}
              className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-amber-400 text-black font-extrabold text-sm rounded-xl hover:from-amber-400 hover:to-yellow-400 transition shadow-lg shadow-amber-500/20 cursor-pointer disabled:opacity-60 relative overflow-hidden group"
            >
              <span className="relative z-10">{loading ? 'Authenticating...' : 'Sign In →'}</span>
              <div className="absolute inset-0 bg-white/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500 skew-x-12" />
            </button>
          </form>

          {/* Dev Demo Panel — only in development */}
          {import.meta.env.DEV && (
            <div>
              <button
                type="button"
                onClick={() => setShowDevPanel(v => !v)}
                className="w-full py-2 px-4 bg-zinc-900/50 border border-white/8 text-gray-400 hover:text-gray-200 hover:border-white/20 text-[10px] font-bold uppercase tracking-widest rounded-xl transition cursor-pointer flex items-center justify-center gap-2"
              >
                🧪 Developer Quick Access {showDevPanel ? '▲' : '▼'}
              </button>

              {showDevPanel && (
                <div className="mt-2 space-y-1.5 max-h-72 overflow-y-auto pr-1">
                  {DEMO_ACCOUNTS.map(account => (
                    <button
                      key={account.role}
                      onClick={() => handleDemoLogin(account)}
                      disabled={loading}
                      className={`w-full flex items-center justify-between px-4 py-2.5 bg-gradient-to-r ${account.color} text-white text-xs font-bold rounded-xl hover:opacity-90 transition shadow-md cursor-pointer disabled:opacity-40`}
                    >
                      <span>{account.label}</span>
                      <span className="text-white/60 font-mono text-[10px]">{account.email}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <p className="text-gray-400 text-center text-xs pt-1 border-t border-white/5">
            Don't have an account?{' '}
            <Link to="/register" className="text-amber-400 font-bold hover:underline">Register</Link>
          </p>
        </div>
      </CinematicAuthBackground>
    </>
  );
}

export default LoginPageComponent;
