import { useState, useEffect, useRef, useMemo } from 'react';

// =================================================================
// Kryptavia OS — flagship portal loader.
// Cinematic sequence built for app shell & post-login transition,
// syncing to a 4s beat with rotating conic rings, orbiting module icons,
// exploding/reassembling hex emblem, typewriter status, and equalizer bar.
// =================================================================

const ACCENT = '#f5a623';
const ACCENT_2 = '#22d3a4';
const ACCENT_3 = '#a78bfa';
const TEXT_MUTED = '#8b93a6';

const MESSAGES = [
  'initializing secure environment',
  'checking organizer permissions',
  'syncing contest ledger',
  'indexing question bank',
  'queuing four-eyes review',
  'warming up the podium',
];

const ICON_ANGLES = [0, 90, 180, 270];

function useTypewriter(words: string[], typeMs = 32, holdMs = 900, deleteMs = 16) {
  const [text, setText] = useState('');
  const [wordIndex, setWordIndex] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const word = words[wordIndex % words.length];
    let i = 0;
    const type = () => {
      if (cancelled) return;
      i++;
      setText(word.slice(0, i));
      if (i < word.length) setTimeout(type, typeMs);
      else setTimeout(erase, holdMs);
    };
    const erase = () => {
      if (cancelled) return;
      i--;
      setText(word.slice(0, i));
      if (i > 0) setTimeout(erase, deleteMs);
      else setTimeout(() => setWordIndex((n) => n + 1), 200);
    };
    setTimeout(type, 60);
    return () => { cancelled = true; };
  }, [wordIndex, words, typeMs, holdMs, deleteMs]);
  return text;
}

function usePercent(duration = 4000, onComplete?: () => void) {
  const [pct, setPct] = useState(0);
  const start = useRef(Date.now());
  const completedRef = useRef(false);

  useEffect(() => {
    let raf: number;
    const tick = () => {
      const elapsed = Date.now() - start.current;
      const currentPct = Math.min(100, Math.round((elapsed / duration) * 100));
      setPct(currentPct);
      if (currentPct >= 100 && !completedRef.current) {
        completedRef.current = true;
        if (onComplete) onComplete();
      } else {
        raf = requestAnimationFrame(tick);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [duration, onComplete]);
  return pct;
}

function useActiveIndex(len: number, interval = 700) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((n) => (n + 1) % len), interval);
    return () => clearInterval(id);
  }, [len, interval]);
  return i;
}

const HEX_R = 36;
const hexEdges = Array.from({ length: 6 }, (_, i) => {
  const a1 = ((Math.PI / 180) * (60 * i - 90));
  const a2 = ((Math.PI / 180) * (60 * (i + 1) - 90));
  const v1 = [HEX_R * Math.cos(a1), HEX_R * Math.sin(a1)];
  const v2 = [HEX_R * Math.cos(a2), HEX_R * Math.sin(a2)];
  const mx = (v1[0] + v2[0]) / 2;
  const my = (v1[1] + v2[1]) / 2;
  const dx = v2[0] - v1[0];
  const dy = v2[1] - v1[1];
  const len = Math.sqrt(dx * dx + dy * dy);
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  return { mx, my, len, angle, rx: mx * 1.9, ry: my * 1.9 };
});

function Particles() {
  const particles = useMemo(
    () =>
      Array.from({ length: 22 }, () => ({
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: 1 + Math.random() * 1.6,
        dur: 4 + Math.random() * 5,
        delay: Math.random() * 5,
      })),
    []
  );
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p, i) => (
        <span
          key={i}
          style={{
            position: 'absolute',
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            borderRadius: '50%',
            background: ACCENT,
            opacity: 0.35,
            animation: `drift ${p.dur}s ease-in-out ${p.delay}s infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes drift {
          0%,100% { transform: translateY(0) translateX(0); opacity: 0.15; }
          50% { transform: translateY(-14px) translateX(6px); opacity: 0.6; }
        }
      `}</style>
    </div>
  );
}

function ModuleIcon({ kind, active }: { kind: string; active: boolean }) {
  const color = active ? ACCENT : '#3a3a42';
  const paths: Record<string, JSX.Element> = {
    trophy: <path d="M-5 -6h10v5a5 5 0 0 1-10 0z M-5 -4c-3 0-4 3-1.5 5 M5 -4c3 0 4 3 1.5 5" />,
    folder: <path d="M-6 -4h5l2 2h5v7h-12z" />,
    shield: <path d="M0 -7l7 3v5c0 4-3 6.5-7 8-4-1.5-7-4-7-8v-5z" />,
    bell: <path d="M-5 3a5 6 0 0 1 10 0M-6 3h12M-1.5 6a1.5 1.5 0 0 0 3 0" />,
  };
  return (
    <g fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"
      style={{ transition: 'stroke 0.3s ease' }}>
      {paths[kind]}
    </g>
  );
}

export interface PortalLoaderProps {
  duration?: number;
  onComplete?: () => void;
  title?: string;
}

export function PortalLoader({ duration = 3500, onComplete, title = 'Kryptavia OS Portal' }: PortalLoaderProps) {
  const pct = usePercent(duration, onComplete);
  const typed = useTypewriter(MESSAGES);
  const activeIcon = useActiveIndex(4, 700);
  const icons = ['trophy', 'folder', 'shield', 'bell'];

  return (
    <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center min-h-screen w-full overflow-hidden bg-black font-sans selection:bg-amber-500/20">
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          maskImage: 'radial-gradient(circle at 50% 45%, black 0%, transparent 65%)',
          WebkitMaskImage: 'radial-gradient(circle at 50% 45%, black 0%, transparent 65%)',
        }}
      />
      <Particles />

      {/* Security scanline */}
      <div
        aria-hidden
        className="absolute left-0 right-0 pointer-events-none"
        style={{
          height: '120px',
          background: `linear-gradient(180deg, transparent, ${ACCENT}22, transparent)`,
          animation: 'scan 3s linear infinite',
          mixBlendMode: 'screen',
        }}
      />

      <div className="relative" style={{ width: 240, height: 240 }}>
        {/* Outer Conic Ring */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: `conic-gradient(from 0deg, ${ACCENT}, ${ACCENT_2}, ${ACCENT_3}, ${ACCENT})`,
            maskImage: 'radial-gradient(closest-side, transparent 84%, black 86%, black 92%, transparent 94%)',
            WebkitMaskImage: 'radial-gradient(closest-side, transparent 84%, black 86%, black 92%, transparent 94%)',
            animation: 'spin 5s linear infinite',
            opacity: 0.85,
          }}
        />

        {/* Inner Counter-Rotating Ring */}
        <div
          className="absolute rounded-full"
          style={{
            inset: 34,
            background: `conic-gradient(from 180deg, ${ACCENT_3}, ${ACCENT}, ${ACCENT_2}, ${ACCENT_3})`,
            maskImage: 'radial-gradient(closest-side, transparent 78%, black 80%, black 90%, transparent 92%)',
            WebkitMaskImage: 'radial-gradient(closest-side, transparent 78%, black 80%, black 90%, transparent 92%)',
            animation: 'spinReverse 4s linear infinite',
            opacity: 0.6,
          }}
        />

        <svg viewBox="0 0 240 240" width="240" height="240" className="absolute inset-0">
          <g style={{ transformOrigin: '120px 120px', animation: 'spinReverse 18s linear infinite' }}>
            {ICON_ANGLES.map((a, i) => (
              <g key={i} transform={`rotate(${a} 120 120) translate(120 30)`}>
                <g style={{ transformOrigin: '0px 0px', transition: 'transform 0.4s ease' }}
                   transform={activeIcon === i ? 'scale(1.3)' : 'scale(1)'}>
                  <circle r="11" fill="#111116" stroke={activeIcon === i ? ACCENT : '#26262e'} strokeWidth="1.2"
                    style={{ transition: 'stroke 0.3s ease' }} />
                  <ModuleIcon kind={icons[i]} active={activeIcon === i} />
                </g>
              </g>
            ))}
          </g>

          <radialGradient id="core" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={ACCENT} stopOpacity="0.6" />
            <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
          </radialGradient>
          <circle cx="120" cy="120" r="44" fill="url(#core)" style={{ animation: 'coreGlow 4s ease-in-out infinite' }} />

          <g transform="translate(120,120)">
            {hexEdges.map((e, i) => (
              <g
                key={i}
                style={{
                  animation: 'assemble 4s cubic-bezier(0.22,1,0.36,1) infinite',
                  animationDelay: `${i * 0.05}s`,
                  transformOrigin: `${e.mx}px ${e.my}px`,
                  ['--rx' as any]: `${e.rx - e.mx}px`,
                  ['--ry' as any]: `${e.ry - e.my}px`,
                }}
              >
                <rect
                  x={-e.len / 2} y="-1.6" width={e.len} height="3.2" rx="1.6"
                  fill={ACCENT}
                  transform={`translate(${e.mx} ${e.my}) rotate(${e.angle})`}
                />
              </g>
            ))}
            <text
              textAnchor="middle" dominantBaseline="central" fontSize="26" fontWeight="700" fill={ACCENT}
              style={{ animation: 'coreMark 4s ease-in-out infinite' }}
            >
              K
            </text>
          </g>
        </svg>
      </div>

      {/* Percentage */}
      <div className="relative text-4xl font-black font-mono tracking-tight text-white -mt-2">
        {pct}<span style={{ color: ACCENT }}>%</span>
      </div>

      {/* Title */}
      <div className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-400/90 mt-1">
        {title}
      </div>

      {/* Terminal Typewriter Line */}
      <div className="relative mt-2 flex items-center gap-1.5" style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
        <span style={{ color: ACCENT_2, fontSize: 13 }}>{'>'}</span>
        <span style={{ color: TEXT_MUTED, fontSize: 13, minHeight: 18 }}>{typed}</span>
        <span style={{ width: 6, height: 14, background: ACCENT, animation: 'caret 0.8s steps(1) infinite' }} />
      </div>

      {/* Equalizer segmented bar */}
      <div className="relative flex gap-1 mt-6">
        {Array.from({ length: 16 }).map((_, i) => (
          <span
            key={i}
            style={{
              width: 4,
              height: 14,
              borderRadius: 2,
              background: ACCENT,
              opacity: 0.15,
              animation: `bar 1.6s ease-in-out ${(i * 0.08) % 1.6}s infinite`,
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes spinReverse { from { transform: rotate(360deg); } to { transform: rotate(0deg); } }
        @keyframes scan { 0% { top: -20%; } 100% { top: 110%; } }
        @keyframes coreGlow { 0%,100% { opacity: 0.45; transform: scale(1); } 50% { opacity: 0.85; transform: scale(1.12); } }
        @keyframes coreMark {
          0%, 14% { opacity: 0; transform: scale(0.6); }
          22%, 68% { opacity: 1; transform: scale(1); }
          78%, 100% { opacity: 0; transform: scale(0.6); }
        }
        @keyframes assemble {
          0% { transform: translate(var(--rx, 0), var(--ry, 0)) scale(0.4); opacity: 0; }
          20% { transform: translate(0,0) scale(1); opacity: 1; }
          70% { transform: translate(0,0) scale(1); opacity: 1; }
          85% { transform: scale(1.15); opacity: 1; }
          100% { transform: translate(var(--rx, 0), var(--ry, 0)) scale(0.4); opacity: 0; }
        }
        @keyframes caret { 50% { opacity: 0; } }
        @keyframes bar {
          0%, 100% { opacity: 0.15; transform: scaleY(0.4); }
          50% { opacity: 1; transform: scaleY(1); }
        }
      `}</style>
    </div>
  );
}

export default PortalLoader;
