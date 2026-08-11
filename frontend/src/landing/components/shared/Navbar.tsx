import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { KryptaviaLogo } from '../../../components/common/KryptaviaLogo';

type NavPage = 'company' | 'college' | 'about' | 'pricing' | 'security';

interface Props {
  page: NavPage;
  onNavigate: (page: NavPage) => void;
}

const AUDIENCE_PAGES = new Set<NavPage>(['company', 'college']);

export default function Navbar({ page, onNavigate }: Props) {
  const { user, logout } = useAuth();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-[90] transition-all duration-500"
      style={{
        background: scrolled ? 'rgba(0,0,0,0.85)' : 'transparent',
        backdropFilter: scrolled ? 'blur(20px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(255,255,255,0.06)' : '1px solid transparent',
      }}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <KryptaviaLogo size="sm" />
        </div>

        <div className="flex items-center gap-1 bg-white/[0.05] rounded-full p-1 border border-white/[0.06]">
          <button
            onClick={() => onNavigate('company')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-300 ${
              page === 'company'
                ? 'bg-white/10 text-white shadow-lg'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            For Companies
          </button>
          <button
            onClick={() => onNavigate('college')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-300 ${
              page === 'college'
                ? 'bg-white/10 text-white shadow-lg'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            For Colleges
          </button>
        </div>

        <div className="hidden md:flex items-center gap-4 text-sm text-gray-400">
          <button
            onClick={() => onNavigate('about')}
            className={`hover:text-white transition-colors ${page === 'about' ? 'text-white' : ''}`}
          >
            About
          </button>
          <button
            onClick={() => onNavigate('pricing')}
            className={`hover:text-white transition-colors ${page === 'pricing' ? 'text-white' : ''}`}
          >
            Pricing
          </button>
          <button
            onClick={() => onNavigate('security')}
            className={`hover:text-white transition-colors ${page === 'security' ? 'text-white' : ''}`}
          >
            Security
          </button>

          <Link
            to="/login"
            className="px-4 py-2 bg-white/10 hover:bg-white/15 rounded-full text-white transition-colors text-sm font-medium border border-white/10 text-center"
          >
            Sign In
          </Link>
          <Link
            to="/register"
            className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black font-bold rounded-full transition-all shadow-md text-sm text-center"
          >
            Get Started
          </Link>
        </div>
      </div>
    </nav>
  );
}

