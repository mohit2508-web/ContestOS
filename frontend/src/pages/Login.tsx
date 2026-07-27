import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function LoginPage() {
  const [email, setEmail] = useState('student@iitd.ac.in');
  const [password, setPassword] = useState('Student@123456');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let role = 'STUDENT';
      let name = 'Aarav Patel (Student)';
      if (email.includes('teacher')) {
        role = 'TEACHER';
        name = 'Dr. Sharma (Host / Teacher)';
      } else if (email.includes('admin')) {
        role = 'SUPER_ADMIN';
        name = 'SuperAdmin (Owner)';
      }

      login('demo-jwt-token', {
        id: 'user-id-1',
        name,
        email,
        role,
      });

      if (role === 'TEACHER' || role === 'SUPER_ADMIN') {
        navigate('/admin/contests');
      } else {
        navigate('/contests');
      }
    } catch {
      setError('Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = (demoRole: 'student' | 'teacher' | 'admin') => {
    if (demoRole === 'student') {
      login('token', { id: 's1', name: 'Aarav Patel (Student)', email: 'student@iitd.ac.in', role: 'STUDENT' });
      navigate('/contests');
    } else if (demoRole === 'teacher') {
      login('token', { id: 't1', name: 'Dr. Sharma (Host)', email: 'teacher@iitd.ac.in', role: 'TEACHER' });
      navigate('/admin/contests');
    } else {
      login('token', { id: 'a1', name: 'SuperAdmin (Owner)', email: 'admin@contestos.io', role: 'SUPER_ADMIN' });
      navigate('/admin/contests');
    }
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

        <form onSubmit={handleLoginSubmit} className="space-y-4">
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
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-amber-400 text-black font-extrabold text-sm rounded-xl hover:from-amber-400 hover:to-yellow-400 transition shadow-lg shadow-amber-500/20 cursor-pointer"
          >
            {loading ? 'Authenticating...' : 'Sign In →'}
          </button>
        </form>

        {/* Demo Quick Login Options */}
        <div className="border-t border-white/10 pt-4 space-y-2">
          <p className="text-[10px] text-gray-500 uppercase tracking-widest font-mono text-center">Quick Demo Login Persona</p>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => handleDemoLogin('student')}
              className="py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 rounded-lg text-[10px] font-bold transition cursor-pointer"
            >
              🎓 Student
            </button>
            <button
              onClick={() => handleDemoLogin('teacher')}
              className="py-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-400 rounded-lg text-[10px] font-bold transition cursor-pointer"
            >
              👨‍🏫 Host / Teacher
            </button>
            <button
              onClick={() => handleDemoLogin('admin')}
              className="py-2 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 text-purple-400 rounded-lg text-[10px] font-bold transition cursor-pointer"
            >
              👑 Owner Admin
            </button>
          </div>
        </div>

        <p className="text-gray-400 text-center text-xs pt-2">
          Don't have an account?{' '}
          <Link to="/register" className="text-amber-400 font-bold hover:underline">
            Register Candidate / Host →
          </Link>
        </p>
      </div>
    </div>
  );
}

export default LoginPage;
