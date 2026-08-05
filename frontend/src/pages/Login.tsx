import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';

const HIERARCHY_MAP: Record<string, number> = {
  SUPER_ADMIN: 1, PLATFORM_CONTENT_AUTHOR: 2, ORG_ADMIN: 3, PROCTOR: 4, ORG_MEMBER: 5, EVALUATOR: 6, STUDENT: 7, CANDIDATE: 7,
};

function roleToPath(role: string): string {
  switch (role) {
    case 'SUPER_ADMIN': return '/admin/platform';
    case 'PLATFORM_CONTENT_AUTHOR': return '/governance/banks?scope=PLATFORM_GLOBAL';
    case 'ORG_ADMIN': return '/admin/org';
    case 'PROCTOR': return '/proctor/live';
    case 'ORG_MEMBER': return '/member/contests';
    case 'EVALUATOR': return '/evaluator/assigned';
    case 'STUDENT': return '/contests';
    case 'CANDIDATE': return '/contests';
    default: return '/contests';
  }
}

const DEMO_ACCOUNTS = [
  { label: 'Super Admin', role: 'SUPER_ADMIN', email: 'admin@contestos.io', password: 'Admin@123456', color: 'from-red-500 to-red-600' },
  { label: 'Platform Content SME', role: 'PLATFORM_CONTENT_AUTHOR', email: 'sme@contestos.io', password: 'Sme@123456', color: 'from-indigo-500 to-indigo-600' },
  { label: 'Org Admin', role: 'ORG_ADMIN', email: 'admin@iitd.ac.in', password: 'Admin@123456', color: 'from-purple-500 to-purple-600' },
  { label: 'Proctor', role: 'PROCTOR', email: 'proctor@iitd.ac.in', password: 'Proctor@123456', color: 'from-rose-500 to-rose-600' },
  { label: 'Org Member', role: 'ORG_MEMBER', email: 'teacher@iitd.ac.in', password: 'Teacher@123456', color: 'from-blue-500 to-blue-600' },
  { label: 'Evaluator', role: 'EVALUATOR', email: 'evaluator@iitd.ac.in', password: 'Evaluator@123456', color: 'from-teal-500 to-teal-600' },
  { label: 'Candidate', role: 'CANDIDATE', email: 'student@iitd.ac.in', password: 'Student@123456', color: 'from-emerald-500 to-emerald-600' },
];

export function LoginPageComponent() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const doLogin = async (loginEmail: string, loginPassword: string) => {
    setError('');
    setLoading(true);
    try {
      const result = await api.login(loginEmail, loginPassword);
      login(result.accessToken, result.refreshToken, {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        role: result.user.role,
        organizationId: result.user.organizationId,
        hierarchyLevel: HIERARCHY_MAP[result.user.role] || 5,
      });
      navigate(roleToPath(result.user.role));
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Login failed. Please check credentials.');
    } finally {
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-black px-4 relative selection:bg-amber-500/20">
      <div className="bg-zinc-950 border border-white/10 rounded-3xl p-8 w-full max-w-md shadow-2xl space-y-6 relative overflow-hidden z-10">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 via-yellow-400 to-emerald-500" />

        <div className="text-center">
          <h1 className="text-3xl font-black text-white tracking-tight">
            Contest<span className="text-amber-400">OS</span>
          </h1>
          <p className="text-xs text-gray-400 mt-1">Sign in to your assessment portal</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-xs font-bold text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-gray-400 text-xs font-bold uppercase tracking-wider mb-1.5">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-black/60 border border-white/10 text-white px-4 py-3 rounded-xl focus:outline-none focus:border-amber-400 text-sm transition"
              placeholder="e.g. student@iitd.ac.in"
              required
            />
          </div>

          <div>
            <label className="block text-gray-400 text-xs font-bold uppercase tracking-wider mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-black/60 border border-white/10 text-white px-4 py-3 rounded-xl focus:outline-none focus:border-amber-400 text-sm transition"
              placeholder="Enter password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-amber-400 text-black font-extrabold text-sm rounded-xl hover:from-amber-400 hover:to-yellow-400 transition shadow-lg shadow-amber-500/20 cursor-pointer"
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <div className="relative pt-2">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-zinc-950 px-3 text-gray-500 uppercase tracking-widest">Quick Access (Testing)</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2">
          {DEMO_ACCOUNTS.map((account) => (
            <button
              key={account.role}
              onClick={() => handleDemoLogin(account)}
              disabled={loading}
              className={`flex items-center justify-between px-4 py-2.5 bg-gradient-to-r ${account.color} text-white text-xs font-bold rounded-xl hover:opacity-90 transition shadow-md cursor-pointer disabled:opacity-40`}
            >
              <span>{account.label}</span>
              <span className="text-white/70 font-mono text-[10px]">{account.email}</span>
            </button>
          ))}
        </div>

        <p className="text-gray-400 text-center text-xs pt-1">
          Don't have an account?{' '}
          <Link to="/register" className="text-amber-400 font-bold hover:underline">
            Register as Participant
          </Link>
        </p>
      </div>
    </div>
  );
}

export default LoginPageComponent;
