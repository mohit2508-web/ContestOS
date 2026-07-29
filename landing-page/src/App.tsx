import { useState, useEffect, useCallback, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import GalaxyCanvas from './GalaxyCanvas';
import IceBreakOverlay from './IceBreakOverlay';
import type { GalaxyHandle } from './GalaxyCanvas';
import Navbar from './components/shared/Navbar';
import CompanyPage from './pages/CompanyPage';
import CollegePage from './pages/CollegePage';
import AboutPage from './pages/AboutPage';
import PricingPage from './pages/PricingPage';
import SecurityPage from './pages/SecurityPage';

type Page = 'company' | 'college' | 'about' | 'pricing' | 'security';

function getPageFromHash(): Page {
  const hash = window.location.hash.replace('#/', '').replace('#', '');
  if (hash === 'college') return 'college';
  if (hash === 'about') return 'about';
  if (hash === 'pricing') return 'pricing';
  if (hash === 'security') return 'security';
  return 'company';
}

const AUDIENCE_PAGES = new Set(['company', 'college']);

export default function App() {
  const [page, setPage] = useState<Page>(getPageFromHash);
  const [introComplete, setIntroComplete] = useState(() => {
    return localStorage.getItem('contestos-intro-done') === '1';
  });
  const galaxyRef = useRef<GalaxyHandle>(null);

  useEffect(() => {
    const onHashChange = () => setPage(getPageFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = useCallback((p: Page) => {
    window.location.hash = `/${p}`;
  }, []);

  const handleIntroComplete = useCallback(() => {
    localStorage.setItem('contestos-intro-done', '1');
    galaxyRef.current?.fadeToBlack(1200);
    setTimeout(() => setIntroComplete(true), 300);
  }, []);

  const showIntro = !introComplete;
  const isAudiencePage = AUDIENCE_PAGES.has(page);

  return (
    <div className="bg-black text-white min-h-screen">
      {showIntro && <GalaxyCanvas ref={galaxyRef} />}

      {showIntro && (
        <IceBreakOverlay
          onComplete={handleIntroComplete}
          onFading={() => {}}
        />
      )}

      <div
        className="relative z-10"
        style={{
          opacity: introComplete ? 1 : 0,
          transition: 'opacity 0.8s ease-in 0.3s',
          pointerEvents: introComplete ? 'auto' : 'none',
        }}
      >
        <Navbar page={page} onNavigate={navigate} />

        <AnimatePresence mode="wait">
          {page === 'company' && <CompanyPage key="company" />}
          {page === 'college' && <CollegePage key="college" />}
          {page === 'about' && <AboutPage key="about" />}
          {page === 'pricing' && <PricingPage key="pricing" />}
          {page === 'security' && <SecurityPage key="security" />}
        </AnimatePresence>
      </div>
    </div>
  );
}
