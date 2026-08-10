import { useState, useEffect, ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ROLE_LABELS, ROLE_COLORS } from '../config/roles';

import { NotificationBell } from './NotificationBell';
import { KryptaviaLogo } from './common/KryptaviaLogo';

const Icon = ({ d }: { d: string }) => (
  <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
);

const icons = {
  bell: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
  dashboard: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  trophy: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z',
  code: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4',
  users: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
  clipboard: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
  shield: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  chart: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  search: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  eye: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z',
  check: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  doc: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  credit: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
  flag: 'M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2z',
  menu: 'M4 6h16M4 12h16M4 18h16',
  close: 'M6 18L18 6M6 6l12 12',
  logout: 'M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1',
  globe: 'M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9',
};

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

function getNavSections(role: string): NavSection[] {
  switch ((role || 'STUDENT').toUpperCase()) {
    case 'SUPER_ADMIN':
      return [
        { title: 'Tenant Command', items: [
          { path: '/admin/platform', label: 'Tenant Command', icon: icons.globe },
          { path: '/admin/platform?tab=billing', label: 'Revenue & Billing', icon: icons.chart },
          { path: '/admin/platform?tab=features', label: 'Feature Flags', icon: icons.flag },
        ]},
        { title: 'Identity & Access', items: [
          { path: '/admin/platform?tab=users', label: 'Users & IAM', icon: icons.users },
          { path: '/admin/platform?tab=audit', label: 'Security & Audit', icon: icons.shield },
        ]},
        { title: 'Observability & Communications', items: [
          { path: '/notifications', label: '🔔 System Notifications & Alerts', icon: icons.bell },
          { path: '/admin/platform?tab=health', label: 'Platform Health', icon: icons.chart },
          { path: '/admin/platform?tab=announcements', label: 'Announcements', icon: icons.flag },
        ]},
      ];

    case 'PLATFORM_CONTENT_AUTHOR':
      return [
        { title: 'Platform Content Curation', items: [
          { path: '/governance/sme-bank', label: 'Global Item Repository', icon: icons.doc },
          { path: '/governance/authoring?scope=PLATFORM_GLOBAL', label: '+ Author New Global Item', icon: icons.code },
          { path: '/governance/reviews', label: 'Peer Review Queue', icon: icons.check },
        ]},
        { title: 'Psychometrics & Alerts', items: [
          { path: '/notifications', label: '🔔 Notifications & Alerts', icon: icons.bell },
          { path: '/governance/sme-bank?filter=PUBLISHED', label: 'Live Item Telemetry', icon: icons.chart },
          { path: '/governance/sme-bank?filter=PEER_REVIEW', label: 'Awaiting My Review', icon: icons.eye },
        ]},
      ];

    case 'ORG_ADMIN':
      return [
        { title: 'Organization', items: [
          { path: '/admin/org', label: 'Dashboard & Command', icon: icons.dashboard },
          { path: '/admin/contests', label: 'Contest Management', icon: icons.trophy },
        ]},
        { title: 'Content & Governance', items: [
          { path: '/governance/banks', label: 'Question Banks Repository', icon: icons.doc },
          { path: '/governance/reviews', label: 'Four-Eyes Review Queue', icon: icons.check },
          { path: '/governance/authoring', label: '+ Author Question (Draft)', icon: icons.code },
        ]},
        { title: 'Communications & Alerts', items: [
          { path: '/notifications', label: '🔔 Notifications & Invitations', icon: icons.bell },
        ]},
      ];

    case 'ORG_MEMBER':
      return [
        { title: 'My Work', items: [
          { path: '/member/contests', label: 'Assigned Contests', icon: icons.clipboard },
        ]},
        { title: 'Content & Governance', items: [
          { path: '/governance/banks', label: 'Question Banks Repository', icon: icons.doc },
          { path: '/governance/reviews', label: 'Four-Eyes Review Queue', icon: icons.check },
          { path: '/governance/authoring', label: '+ Author Question (Draft)', icon: icons.code },
        ]},
        { title: 'Alerts & Communications', items: [
          { path: '/notifications', label: '🔔 Notifications & Invites', icon: icons.bell },
        ]},
      ];

    case 'PROCTOR':
      return [
        { title: 'Invigilation', items: [
          { path: '/proctor/live', label: 'Live Exam Proctor Console', icon: icons.eye },
          { path: '/proctor/live?tab=incidents', label: 'Security Incident Logs', icon: icons.flag },
        ]},
        { title: 'Alerts & Communications', items: [
          { path: '/notifications', label: '🔔 Notifications & Invites', icon: icons.bell },
        ]},
      ];

    case 'ANALYTICS_VIEWER':
      return [
        { title: 'Analytics Hub', items: [
          { path: '/analytics/dashboard', label: 'Performance Dashboard', icon: icons.chart },
          { path: '/analytics/contests', label: 'Contest Results', icon: icons.trophy },
        ]},
        { title: 'Alerts & Communications', items: [
          { path: '/notifications', label: '🔔 Notifications', icon: icons.bell },
        ]},
      ];

    case 'CONTEST_MODERATOR':
      return [
        { title: 'Moderation', items: [
          { path: '/moderator/dashboard', label: 'Assigned Contests', icon: icons.clipboard },
          { path: '/moderator/queue', label: 'Evaluation Queue', icon: icons.check },
        ]},
        { title: 'Alerts & Communications', items: [
          { path: '/notifications', label: '🔔 Notifications & Alerts', icon: icons.bell },
        ]},
      ];

    case 'COMPLIANCE_OFFICER':
      return [
        { title: 'Compliance & Audit', items: [
          { path: '/compliance/audit-logs', label: 'Audit Log Viewer', icon: icons.shield },
          { path: '/compliance/gdpr', label: 'GDPR Erasure Queue', icon: icons.doc },
        ]},
        { title: 'Alerts & Notices', items: [
          { path: '/notifications', label: '🔔 Notifications & Offboard Notices', icon: icons.bell },
        ]},
      ];

    case 'GUEST_CANDIDATE':
      return [];

    case 'EVALUATOR':
      return [
        { title: 'Evaluation', items: [
          { path: '/evaluator/assigned', label: 'Grading Queue', icon: icons.clipboard },
          { path: '/evaluator/assigned?tab=history', label: 'Graded History', icon: icons.check },
        ]},
        { title: 'Alerts & Invites', items: [
          { path: '/notifications', label: '🔔 Notifications & Invites', icon: icons.bell },
        ]},
      ];

    case 'CANDIDATE':
    case 'STUDENT':
    default:
      return [
        { title: 'Assessment & Exams', items: [
          { path: '/dashboard', label: '🎯 Exam Hall & Drives', icon: icons.dashboard },
          { path: '/dashboard?tab=skills', label: '📊 Skill Analytics & Radar', icon: icons.chart },
          { path: '/dashboard?tab=credentials', label: '📜 Verified Credentials', icon: icons.doc },
          { path: '/dashboard?tab=scorecards', label: '📁 My Scorecards', icon: icons.clipboard },
        ]},
        { title: 'Practice & Skills', items: [
          { path: '/playground', label: 'Code Playground', icon: icons.code },
          { path: '/playground/web-dev', label: 'Web Dev Playground', icon: icons.flag },
          { path: '/playground/sql', label: 'SQL Playground', icon: icons.doc },
          { path: '/playground/quiz', label: 'MCQ Quiz Playground', icon: icons.clipboard },
        ]},
        { title: 'Alerts & Communications', items: [
          { path: '/notifications', label: '🔔 Notifications & Invites', icon: icons.bell },
        ]},
      ];
  }
}

export function Sidebar({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    if (location.pathname.startsWith('/playground')) {
      setIsCollapsed(true);
    }
  }, [location.pathname]);

  const isSeb =
    navigator.userAgent.toLowerCase().includes('seb') ||
    navigator.userAgent.toLowerCase().includes('safeexambrowser') ||
    new URLSearchParams(window.location.search).get('seb') === '1';

  if (isSeb || location.pathname.startsWith('/playground/web-dev') || location.pathname.startsWith('/guest') || location.pathname === '/login' || location.pathname === '/register' || location.pathname === '/' || location.pathname === '/landing') {
    return <>{children}</>;
  }

  const role = (user?.role || 'STUDENT').toUpperCase();
  const sections = getNavSections(role);
  const roleLabel = ROLE_LABELS[role] || 'Participant';
  const roleColor = ROLE_COLORS[role] || 'bg-emerald-600';

  const isActive = (path: string) => {
    const [itemPath, itemQuery] = path.split('?');
    const currentPath = location.pathname;
    const currentSearch = location.search;

    if (currentPath !== itemPath) {
      return false;
    }

    if (itemQuery) {
      return currentSearch.includes(itemQuery);
    }

    const params = new URLSearchParams(currentSearch);
    const currentTab = params.get('tab');
    return !currentTab || currentTab === 'overview';
  };

  return (
    <div className="flex h-screen bg-black overflow-hidden relative">
      {/* Mobile Header Bar */}
      <div className="md:hidden absolute top-0 left-0 right-0 h-16 bg-zinc-950 border-b border-white/10 flex items-center justify-between px-4 z-40">
        <KryptaviaLogo size="sm" />
        <button onClick={() => setIsOpen(true)} className="text-white p-2">
          <Icon d={icons.menu} />
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
          {!isCollapsed ? (
            <div>
              <KryptaviaLogo size="sm" />
              <span
                className={`px-2 py-0.5 text-[9px] uppercase tracking-wider font-bold rounded ${roleColor} text-white mt-1 inline-block`}
              >
                {roleLabel}
              </span>
            </div>
          ) : (
            <KryptaviaLogo size="sm" showTagline={false} />
          )}
          <div className="flex items-center gap-1">
            <NotificationBell position="left" />
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="hidden md:flex text-gray-400 hover:text-white p-1.5 hover:bg-white/5 rounded-lg transition cursor-pointer"
            >
              {isCollapsed ? '\u2192' : '\u2190'}
            </button>
          </div>
          <button onClick={() => setIsOpen(false)} className="md:hidden text-gray-400 p-1">
            <Icon d={icons.close} />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 p-3 space-y-4 overflow-y-auto custom-scrollbar">
          {sections.map((section) => (
            <div key={section.title}>
              {!isCollapsed && (
                <h3 className="text-[10px] text-gray-500 uppercase tracking-widest font-bold px-3 mb-1.5">
                  {section.title}
                </h3>
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const active = isActive(item.path);
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={() => setIsOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                        active
                          ? 'bg-gradient-to-r from-amber-500 to-amber-400 text-black shadow-lg shadow-amber-500/20 font-black'
                          : 'text-gray-400 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <Icon d={item.icon} />
                      {!isCollapsed && <span className="truncate">{item.label}</span>}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User Identity Footer */}
        <div className="p-3 border-t border-white/10 bg-zinc-900/50 shrink-0 space-y-2">
          {!isCollapsed && user && (
            <div className="bg-white/5 p-2.5 rounded-xl border border-white/5">
              <p className="text-xs font-bold text-white truncate">{user.name}</p>
              <p className="text-[10px] text-amber-400 truncate">{user.email}</p>
            </div>
          )}

          <div className="flex gap-2">
            {!user ? (
              <NavLink
                to="/login"
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs rounded-xl text-center transition"
              >
                Login
              </NavLink>
            ) : (
              <button
                onClick={() => {
                  logout();
                  navigate('/login');
                }}
                className="w-full py-2.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Icon d={icons.logout} />
                {!isCollapsed && <span>Logout</span>}
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
