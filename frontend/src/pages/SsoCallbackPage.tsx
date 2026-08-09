import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { PortalLoader } from '../components/common/PortalLoader';

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
  switch (role?.toUpperCase()) {
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

export function SsoCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userInfo, setUserInfo] = useState<{ name: string; provider: string; path: string }>({
    name: '',
    provider: 'SSO',
    path: '/contests',
  });

  useEffect(() => {
    const token = searchParams.get('token');
    const refreshToken = searchParams.get('refreshToken');
    const name = searchParams.get('name') || 'User';
    const email = searchParams.get('email') || '';
    const role = searchParams.get('role') || 'STUDENT';
    const provider = searchParams.get('provider') || 'Single Sign-On';
    const err = searchParams.get('error');

    if (err) {
      setError(err);
      setLoading(false);
      return;
    }

    if (!token || !refreshToken) {
      setError('Missing authentication tokens from SSO response.');
      setLoading(false);
      return;
    }

    const redirectPath = roleToPath(role);

    // Save tokens and user session in AuthContext
    login(token, refreshToken, {
      id: `sso-${email}`,
      name,
      email,
      role,
      hierarchyLevel: HIERARCHY_MAP[role.toUpperCase()] || 5,
    });

    setUserInfo({
      name,
      provider,
      path: redirectPath,
    });

    setLoading(true);
  }, [searchParams, login]);

  if (error) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center px-4">
        <div className="bg-zinc-950 border border-red-500/30 rounded-3xl p-8 max-w-md w-full text-center space-y-4 shadow-2xl">
          <div className="w-12 h-12 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center justify-center text-2xl mx-auto text-red-400">
            ⚠️
          </div>
          <h2 className="text-xl font-black text-white">Single Sign-On Failed</h2>
          <p className="text-xs text-zinc-400 leading-relaxed">{error}</p>
          <Link
            to="/login"
            className="inline-block w-full py-3 bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs rounded-xl transition cursor-pointer"
          >
            ← Return to Sign In
          </Link>
        </div>
      </div>
    );
  }

  if (loading && userInfo.name) {
    return (
      <PortalLoader
        duration={2500}
        title={`${userInfo.name} · Authenticated via ${userInfo.provider}`}
        onComplete={() => navigate(userInfo.path)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-400" />
    </div>
  );
}

export default SsoCallbackPage;
