import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function Navbar() {
  const { user, login } = useAuth();
  const location = useLocation();

  // Hide global navbar inside immersive full-screen contest exam zone
  if (location.pathname.startsWith('/contests/') && location.pathname.split('/').length > 2) {
    return null;
  }

  const handleRoleSwitch = (role: 'STUDENT' | 'TEACHER' | 'ADMIN') => {
    if (role === 'STUDENT') {
      login('demo-access-token', 'demo-refresh-token', {
        id: 'student-id-1',
        name: 'Aarav Patel (Student)',
        email: 'student@iitd.ac.in',
        role: 'STUDENT',
        hierarchyLevel: 5,
      });
    } else if (role === 'TEACHER') {
      login('demo-access-token', 'demo-refresh-token', {
        id: 'teacher-id-1',
        name: 'Dr. Sharma (Host / Teacher)',
        email: 'teacher@iitd.ac.in',
        role: 'ORG_MEMBER',
        hierarchyLevel: 3,
      });
    } else {
      login('demo-access-token', 'demo-refresh-token', {
        id: 'admin-id-1',
        name: 'SuperAdmin (Owner)',
        email: 'admin@contestos.io',
        role: 'SUPER_ADMIN',
        hierarchyLevel: 1,
      });
    }
  };

  return (
    <header className="bg-zinc-950 border-b border-white/10 sticky top-0 z-50 backdrop-blur-xl bg-zinc-950/90">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Left: Brand Logo */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center text-black font-black text-lg shadow-lg shadow-amber-500/20">
            ⚡
          </div>
          <div>
            <span className="text-lg font-black text-white tracking-tight block leading-none">
              Contest<span className="text-amber-400">OS</span>
            </span>
            <span className="text-[9px] text-gray-400 font-mono tracking-wider uppercase block mt-0.5">
              Secure Assessment Platform
            </span>
          </div>
        </div>

        {/* Center: Portal Switcher Tabs */}
        <nav className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
          <NavLink
            to="/contests"
            className={({ isActive }) =>
              `px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                isActive && !location.pathname.startsWith('/admin')
                  ? 'bg-amber-500 text-black shadow-md'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`
            }
          >
            <span>🎓</span>
            <span>Student Portal</span>
          </NavLink>

          <NavLink
            to="/admin/contests"
            className={({ isActive }) =>
              `px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                isActive
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`
            }
          >
            <span>👨‍🏫</span>
            <span>Host / Teacher Portal</span>
          </NavLink>

          <NavLink
            to="/leaderboard"
            className={({ isActive }) =>
              `px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                isActive
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`
            }
          >
            <span>🏆</span>
            <span>Leaderboard</span>
          </NavLink>
        </nav>

        {/* Right: Active Identity & Demo Role Selector */}
        <div className="flex items-center gap-3">
          <a
            href="http://localhost:3000"
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-gray-400 hover:text-white transition-colors border border-white/10 rounded-lg hover:bg-white/5"
          >
            <span>🌐</span>
            <span>Back to Site</span>
          </a>
          <div className="hidden md:flex flex-col text-right">
            <span className="text-xs font-bold text-white leading-tight">{user?.name || 'Aarav Patel'}</span>
            <span className="text-[10px] text-amber-400 font-mono">{user?.email || 'student@iitd.ac.in'}</span>
          </div>

          {/* Quick Role Switcher Dropdown for Testing */}
          <div className="relative group">
            <button className="px-3 py-1.5 bg-white/10 hover:bg-white/15 border border-white/10 rounded-lg text-xs font-bold text-gray-200 flex items-center gap-1.5 transition cursor-pointer">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Switch Role</span>
              <span className="text-[10px]">▼</span>
            </button>
            <div className="absolute right-0 mt-1 w-52 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl p-1.5 hidden group-hover:block z-50 space-y-1">
              <p className="text-[9px] text-gray-500 font-mono px-2 py-1 uppercase tracking-wider">Demo Account Switcher</p>
              <button
                onClick={() => handleRoleSwitch('STUDENT')}
                className="w-full text-left px-3 py-2 rounded-lg text-xs font-bold hover:bg-amber-500/20 text-amber-400 flex items-center gap-2 transition cursor-pointer"
              >
                🎓 Student Candidate
              </button>
              <button
                onClick={() => handleRoleSwitch('TEACHER')}
                className="w-full text-left px-3 py-2 rounded-lg text-xs font-bold hover:bg-blue-500/20 text-blue-400 flex items-center gap-2 transition cursor-pointer"
              >
                👨‍🏫 Teacher / Host
              </button>
              <button
                onClick={() => handleRoleSwitch('ADMIN')}
                className="w-full text-left px-3 py-2 rounded-lg text-xs font-bold hover:bg-purple-500/20 text-purple-400 flex items-center gap-2 transition cursor-pointer"
              >
                👑 Owner / SuperAdmin
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Navbar;
