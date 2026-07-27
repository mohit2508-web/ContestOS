import { useState, useEffect, ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ROLE_LABELS: Record<string, string> = {
  student: 'Student Candidate',
  teacher: 'Teacher / Host',
  college_head: 'Institution Head',
  coordinator: 'Coordinator',
  owner: 'SuperAdmin / Owner',
  SUPER_ADMIN: 'SuperAdmin / Owner',
  TEACHER: 'Teacher / Host',
  STUDENT: 'Student Candidate',
};

const ROLE_COLORS: Record<string, string> = {
  student: 'bg-emerald-600',
  teacher: 'bg-blue-600',
  college_head: 'bg-indigo-600',
  coordinator: 'bg-purple-600',
  owner: 'bg-amber-600',
  SUPER_ADMIN: 'bg-amber-600',
  TEACHER: 'bg-blue-600',
  STUDENT: 'bg-emerald-600',
};

const DashboardIcon = () => (
  <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);

const LeaderboardIcon = () => (
  <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
  </svg>
);

const TrophyIcon = () => (
  <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 3h16M3 7h16v4a4 4 0 01-4 4H7a4 4 0 01-4-4V7zm8 8v4m0 0H8m5 0h3" />
  </svg>
);

const CodeIcon = () => (
  <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
  </svg>
);

const UsersIcon = () => (
  <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

const SettingsIcon = () => (
  <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const MenuIcon = () => (
  <svg className="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

const CloseIcon = () => (
  <svg className="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

interface NavItem {
  path: string;
  label: string;
  icon: ReactNode;
  section?: string;
}

function getNavItemsForRole(role: string): NavItem[] {
  const normalizedRole = (role || 'STUDENT').toUpperCase();

  // Strict isolation: STUDENTS see ONLY student assessment features
  if (normalizedRole === 'STUDENT') {
    return [
      { path: '/contests', label: 'Contests & Exams', icon: <TrophyIcon />, section: 'Assessment' },
      { path: '/leaderboard', label: 'Live Leaderboard', icon: <LeaderboardIcon />, section: 'Assessment' },
    ];
  }

  // TEACHER / HOST Portal links
  if (normalizedRole === 'TEACHER') {
    return [
      { path: '/contests', label: 'Contest Arena', icon: <TrophyIcon />, section: 'Assessment' },
      { path: '/admin/contests', label: 'Host & Create Contest', icon: <CodeIcon />, section: 'Management' },
      { path: '/admin/problems/new', label: 'Question Bank Editor', icon: <CodeIcon />, section: 'Management' },
      { path: '/leaderboard', label: 'Leaderboard', icon: <LeaderboardIcon />, section: 'Management' },
    ];
  }

  // OWNER / SUPERADMIN Portal links
  return [
    { path: '/contests', label: 'Contest Arena', icon: <TrophyIcon />, section: 'Assessment' },
    { path: '/admin/contests', label: 'Host & Create Contest', icon: <CodeIcon />, section: 'Management' },
    { path: '/admin/problems/new', label: 'Question Bank Editor', icon: <CodeIcon />, section: 'Management' },
    { path: '/leaderboard', label: 'Leaderboard', icon: <LeaderboardIcon />, section: 'Management' },
  ];
}

export function Sidebar({ children }: { children: ReactNode }) {
  const { user, logout, login } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // SEB Immersive Mode: hide sidebar completely inside SEB
  const isSeb =
    navigator.userAgent.toLowerCase().includes('seb') ||
    navigator.userAgent.toLowerCase().includes('safeexambrowser') ||
    new URLSearchParams(window.location.search).get('seb') === '1';

  // Do not render sidebar on login, register, or inside SEB exam mode
  if (isSeb || location.pathname === '/login' || location.pathname === '/register') {
    return <>{children}</>;
  }

  const role = user?.role || 'STUDENT';
  const navItems = getNavItemsForRole(role);

  return (
    <div className="flex h-screen bg-black overflow-hidden relative">
      {/* Mobile Header Bar */}
      <div className="md:hidden absolute top-0 left-0 right-0 h-16 bg-zinc-950 border-b border-white/10 flex items-center justify-between px-4 z-40">
        <h1 className="text-lg font-black text-white">
          Contest<span className="text-amber-400">OS</span>
        </h1>
        <button onClick={() => setIsOpen(true)} className="text-white p-2">
          <MenuIcon />
        </button>
      </div>

      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/80 z-40 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Left Sidebar */}
      <aside
        className={`fixed md:static inset-y-0 left-0 ${
          isCollapsed ? 'w-20' : 'w-64'
        } bg-zinc-950 border-r border-white/10 flex flex-col z-50 transform transition-all duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Logo & Brand Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between h-16 shrink-0">
          {!isCollapsed && (
            <div>
              <h1 className="text-xl font-black text-white tracking-tight">
                Contest<span className="text-amber-400">OS</span>
              </h1>
              <span
                className={`px-2 py-0.5 text-[9px] uppercase tracking-wider font-bold rounded ${
                  ROLE_COLORS[role] || 'bg-emerald-600'
                } text-white mt-1 inline-block`}
              >
                {ROLE_LABELS[role] || 'Student Candidate'}
              </span>
            </div>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden md:flex text-gray-400 hover:text-white p-1.5 hover:bg-white/5 rounded-lg transition"
          >
            {isCollapsed ? '👉' : '👈'}
          </button>
          <button onClick={() => setIsOpen(false)} className="md:hidden text-gray-400 p-1">
            <CloseIcon />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => {
            const isActive =
              location.pathname === item.path ||
              (item.path !== '/' && location.pathname.startsWith(item.path + '/'));

            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-amber-500 to-amber-400 text-black shadow-lg shadow-amber-500/20 font-black'
                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                {item.icon}
                {!isCollapsed && <span>{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>

        {/* User Identity & Role Switcher Footer */}
        <div className="p-3 border-t border-white/10 bg-zinc-900/50 shrink-0 space-y-2">
          {!isCollapsed && (
            <div className="bg-white/5 p-2 rounded-xl border border-white/5 flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate">{user?.name || 'Aarav Patel'}</p>
                <p className="text-[10px] text-amber-400 truncate">{user?.email || 'student@iitd.ac.in'}</p>
              </div>
              <button
                onClick={() => {
                  if (role === 'STUDENT') {
                    login('token', { id: '2', name: 'Dr. Sharma (Host)', email: 'teacher@iitd.ac.in', role: 'TEACHER' });
                  } else {
                    login('token', { id: '1', name: 'Aarav Patel (Student)', email: 'student@iitd.ac.in', role: 'STUDENT' });
                  }
                }}
                className="px-2 py-1 bg-white/10 hover:bg-white/20 rounded text-[9px] font-bold text-white transition shrink-0 cursor-pointer"
                title="Switch test persona"
              >
                🔁 Switch
              </button>
            </div>
          )}

          <div className="flex gap-2">
            {!user ? (
              <NavLink
                to="/login"
                className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs rounded-xl text-center transition"
              >
                Login
              </NavLink>
            ) : (
              <button
                onClick={() => {
                  logout();
                  navigate('/login');
                }}
                className="w-full py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1 cursor-pointer"
              >
                <span>🚪</span> Logout
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto bg-black text-white relative">
        {children}
      </main>
    </div>
  );
}

export default Sidebar;
