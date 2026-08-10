import React, { useState } from 'react';

// =================================================================
// Kryptavia OS Unified Error States System
// Same visual language as empty states (radial glow + eyebrow badge + vector scene)
// so the entire platform feels like one cohesive system across all portals.
// =================================================================

const BORDER = '#1e1e24';
const TEXT_MUTED = '#8b93a6';

function Glow({ color }: { color: string }) {
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        top: '-40px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '260px',
        height: '180px',
        background: `radial-gradient(circle, ${color}33 0%, ${color}00 70%)`,
        filter: 'blur(6px)',
        pointerEvents: 'none',
      }}
    />
  );
}

/* ---------- 1. Network error — broken connection ---------- */
function NetworkScene() {
  const c = '#fb7185';
  return (
    <svg viewBox="0 0 220 140" width="220" height="140">
      <g style={{ animation: 'driftL 3.2s ease-in-out infinite' }}>
        <rect x="30" y="60" width="36" height="20" rx="4" fill="#1a1416" stroke={c} strokeOpacity="0.6" strokeWidth="1.6" />
        <circle cx="66" cy="70" r="3" fill={c} />
      </g>
      <g style={{ animation: 'driftR 3.2s ease-in-out infinite' }}>
        <rect x="154" y="60" width="36" height="20" rx="4" fill="#1a1416" stroke={c} strokeOpacity="0.6" strokeWidth="1.6" />
        <circle cx="154" cy="70" r="3" fill={c} />
      </g>
      <path d="M70 70 L96 70" stroke={c} strokeOpacity="0.35" strokeWidth="2.5" strokeDasharray="4 5" />
      <path d="M124 70 L150 70" stroke={c} strokeOpacity="0.35" strokeWidth="2.5" strokeDasharray="4 5" />
      <g style={{ animation: 'sparkPulse 1.4s ease-in-out infinite' }}>
        <path d="M102 60 l7 10 l-4 0 l7 10" fill="none" stroke={c} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      {[[100, 42], [126, 96], [90, 90]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="1.6" fill={c} style={{ animation: `twinkle 2s ease-in-out ${i * 0.4}s infinite` }} />
      ))}
      <style>{`
        @keyframes driftL { 0%,100% { transform: translateX(0); } 50% { transform: translateX(-4px); } }
        @keyframes driftR { 0%,100% { transform: translateX(0); } 50% { transform: translateX(4px); } }
        @keyframes sparkPulse { 0%,100% { opacity: 0.4; } 50% { opacity: 1; } }
        @keyframes twinkle { 0%,100% { opacity: 0.15; } 50% { opacity: 0.9; } }
      `}</style>
    </svg>
  );
}

/* ---------- 2. 404 — lost compass ---------- */
function NotFoundScene() {
  const c = '#a78bfa';
  return (
    <svg viewBox="0 0 220 140" width="220" height="140">
      <circle cx="110" cy="68" r="38" fill="none" stroke={c} strokeOpacity="0.35" strokeWidth="1.6" />
      <circle cx="110" cy="68" r="38" fill="none" stroke={c} strokeOpacity="0.15" strokeWidth="10" />
      {[0, 90, 180, 270].map((a, i) => (
        <text
          key={i}
          x={110 + 46 * Math.sin((a * Math.PI) / 180)}
          y={68 - 46 * Math.cos((a * Math.PI) / 180) + 4}
          textAnchor="middle"
          fontSize="9"
          fill={c}
          fillOpacity="0.5"
        >
          {['N', 'E', 'S', 'W'][i]}
        </text>
      ))}
      <g style={{ transformOrigin: '110px 68px', animation: 'needleSpin 3.6s ease-in-out infinite' }}>
        <path d="M110 68 L118 68 L110 44 Z" fill={c} />
        <path d="M110 68 L102 68 L110 92 Z" fill={c} fillOpacity="0.4" />
      </g>
      <circle cx="110" cy="68" r="4" fill="#0f0f13" stroke={c} strokeWidth="1.6" />
      <text x="110" y="128" textAnchor="middle" fontSize="26" fontWeight="700" fill={c} fillOpacity="0.5">404</text>
      <style>{`
        @keyframes needleSpin { 0%,100% { transform: rotate(-18deg); } 50% { transform: rotate(24deg); } }
      `}</style>
    </svg>
  );
}

/* ---------- 3. Server error — glitching circuit ---------- */
function ServerErrorScene() {
  const c = '#f5a623';
  return (
    <svg viewBox="0 0 220 140" width="220" height="140">
      <rect x="72" y="34" width="76" height="72" rx="8" fill="#1c1710" stroke={c} strokeOpacity="0.55" strokeWidth="1.6" />
      <line x1="72" y1="56" x2="148" y2="56" stroke={c} strokeOpacity="0.3" />
      <line x1="72" y1="78" x2="148" y2="78" stroke={c} strokeOpacity="0.3" />
      {[46, 68, 90].map((y, i) => (
        <circle key={i} cx="84" cy={y === 46 ? 46 : y} r="2.4" fill={c} fillOpacity="0.6" />
      ))}
      <g style={{ animation: 'glitch 2.6s steps(1) infinite' }}>
        <rect x="90" y="42" width="46" height="8" fill={c} fillOpacity="0.25" />
        <rect x="90" y="64" width="30" height="8" fill={c} fillOpacity="0.4" />
        <rect x="90" y="86" width="40" height="8" fill={c} fillOpacity="0.2" />
      </g>
      <g style={{ animation: 'bolt 2.6s ease-in-out infinite' }}>
        <path d="M112 20 l-8 20 l7 0 l-9 22 l18 -26 l-8 0 z" fill={c} />
      </g>
      <style>{`
        @keyframes glitch {
          0%,80%,100% { transform: translateX(0); opacity: 1; }
          82% { transform: translateX(-3px); opacity: 0.6; }
          85% { transform: translateX(3px); opacity: 1; }
          88% { transform: translateX(-2px); opacity: 0.7; }
          91% { transform: translateX(0); opacity: 1; }
        }
        @keyframes bolt { 0%,100% { opacity: 0.6; transform: scale(1); } 50% { opacity: 1; transform: scale(1.1); } }
      `}</style>
    </svg>
  );
}

/* ---------- 4. Forbidden / unauthorized — locked ---------- */
function ForbiddenScene() {
  const c = '#38bdf8';
  return (
    <svg viewBox="0 0 220 140" width="220" height="140">
      <circle cx="110" cy="65" r="30" fill="none" stroke={c} strokeOpacity="0.2" strokeWidth="12" />
      <rect x="88" y="60" width="44" height="34" rx="6" fill="#0d1b24" stroke={c} strokeOpacity="0.7" strokeWidth="1.8" />
      <path
        d="M96 60 v-10 a14 14 0 0 1 28 0 v10"
        fill="none"
        stroke={c}
        strokeOpacity="0.7"
        strokeWidth="2.2"
        style={{ transformOrigin: '110px 60px', animation: 'shackle 3s ease-in-out infinite' }}
      />
      <circle cx="110" cy="75" r="3.4" fill={c} style={{ animation: 'dotPulse 1.8s ease-in-out infinite' }} />
      <line x1="110" y1="78" x2="110" y2="84" stroke={c} strokeWidth="2" strokeLinecap="round" />
      <style>{`
        @keyframes shackle { 0%,80%,100% { transform: rotate(0deg); } 90% { transform: rotate(-6deg); } }
        @keyframes dotPulse { 0%,100% { opacity: 0.6; } 50% { opacity: 1; } }
      `}</style>
    </svg>
  );
}

/* ---------- 5. Session expired — hourglass ---------- */
function SessionScene() {
  const c = '#fb923c';
  return (
    <svg viewBox="0 0 220 140" width="220" height="140">
      <g transform="translate(110,68)">
        <path d="M-22 -34 h44 v10 l-16 24 l16 24 v10 h-44 v-10 l16 -24 l-16 -24 z" fill="none" stroke={c} strokeOpacity="0.6" strokeWidth="2" strokeLinejoin="round" />
        <clipPath id="topBulb"><path d="M-20 -32 h40 v8 l-14 22 h-12 l-14 -22 z" /></clipPath>
        <g clipPath="url(#topBulb)">
          <rect x="-20" y="-32" width="40" height="14" fill={c} fillOpacity="0.55" style={{ animation: 'drain 2.6s linear infinite' }} />
        </g>
        <clipPath id="botBulb"><path d="M-14 12 h28 v10 l14 12 v8 h-40 v-8 l14 -12 z" /></clipPath>
        <g clipPath="url(#botBulb)">
          <rect x="-14" y="30" width="28" height="0" fill={c} fillOpacity="0.55" style={{ animation: 'fill 2.6s linear infinite' }} />
        </g>
        <rect x="-2" y="-2" width="4" height="4" fill={c} style={{ animation: 'grain 2.6s linear infinite' }} />
      </g>
      <style>{`
        @keyframes drain { 0% { height: 14px; y: -32px; } 100% { height: 0px; y: -18px; } }
        @keyframes fill { 0% { height: 0px; y: 30px; } 100% { height: 12px; y: 18px; } }
        @keyframes grain { 0% { transform: translateY(-30px); opacity: 1; } 90% { opacity: 1; } 100% { transform: translateY(30px); opacity: 0; } }
      `}</style>
    </svg>
  );
}

/* ---------------------------------------------------------------- */

export interface ErrorStateConfig {
  Scene: React.ComponentType;
  accent: string;
  tint: string;
  eyebrow: string;
  title: string;
  body: string;
  cta: string;
}

export const VARIANTS: Record<string, ErrorStateConfig> = {
  network: {
    Scene: NetworkScene,
    accent: '#fb7185',
    tint: '#241014',
    eyebrow: 'Connection Error',
    title: 'Lost the connection',
    body: "Check your internet and we'll pick up right where you left off.",
    cta: 'Retry Connection',
  },
  notFound: {
    Scene: NotFoundScene,
    accent: '#a78bfa',
    tint: '#211c2c',
    eyebrow: 'Error 404',
    title: "This page took a wrong turn",
    body: "The link's broken or the page has moved. Let's get you back on track.",
    cta: 'Back to Dashboard',
  },
  server: {
    Scene: ServerErrorScene,
    accent: '#f5a623',
    tint: '#241c0d',
    eyebrow: 'Error 500',
    title: 'Something glitched on our end',
    body: "Our system logged this glitch automatically. Try again in a moment.",
    cta: 'Try Again',
  },
  forbidden: {
    Scene: ForbiddenScene,
    accent: '#38bdf8',
    tint: '#0d1b24',
    eyebrow: 'Error 403',
    title: "You don't have access here",
    body: 'This section requires elevated permissions. Request access from an administrator.',
    cta: 'Request Access',
  },
  session: {
    Scene: SessionScene,
    accent: '#fb923c',
    tint: '#241a0d',
    eyebrow: 'Session Expired',
    title: 'Your session timed out',
    body: 'For security, we sign you out after a period of inactivity. Sign back in to continue.',
    cta: 'Sign In Again',
  },
};

export interface ErrorStateProps {
  variant?: 'network' | 'notFound' | 'server' | 'forbidden' | 'session' | string;
  title?: string;
  body?: string;
  eyebrow?: string;
  ctaLabel?: string;
  onAction?: () => void;
  fullScreen?: boolean;
}

export function ErrorState({
  variant = 'network',
  title,
  body,
  eyebrow,
  ctaLabel,
  onAction,
  fullScreen = false,
}: ErrorStateProps) {
  const cfg = VARIANTS[variant] || VARIANTS.network;
  const { Scene } = cfg;

  const displayTitle = title || cfg.title;
  const displayBody = body || cfg.body;
  const displayEyebrow = eyebrow || cfg.eyebrow;
  const displayCta = ctaLabel || cfg.cta;

  const handleAction = () => {
    if (onAction) {
      onAction();
    } else {
      if (variant === 'notFound' || variant === 'forbidden') {
        window.location.href = '/dashboard';
      } else if (variant === 'session') {
        window.location.href = '/login';
      } else {
        window.location.reload();
      }
    }
  };

  const containerClasses = fullScreen
    ? 'min-h-screen w-full flex flex-col items-center justify-center text-center p-6 bg-black'
    : 'relative flex flex-col items-center justify-center text-center py-16 px-6 overflow-hidden rounded-2xl border bg-zinc-950/80';

  return (
    <div
      className={containerClasses}
      style={{
        borderColor: BORDER,
        background: 'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0) 60%)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
      }}
    >
      <Glow color={cfg.accent} />

      <span
        className="relative text-[10px] font-semibold uppercase tracking-widest mb-1 px-2.5 py-1 rounded-full"
        style={{ color: cfg.accent, backgroundColor: `${cfg.accent}1a`, letterSpacing: '0.12em' }}
      >
        {displayEyebrow}
      </span>

      <div className="relative">
        <Scene />
      </div>

      <h3 className="relative text-white text-xl font-semibold mt-1 mb-2 tracking-tight">{displayTitle}</h3>
      <p className="relative text-sm max-w-xs mb-7 leading-relaxed" style={{ color: TEXT_MUTED }}>
        {displayBody}
      </p>

      <button
        type="button"
        onClick={handleAction}
        className="relative px-5 py-2.5 rounded-lg text-sm font-semibold es-btn cursor-pointer"
        style={{ backgroundColor: 'transparent', color: cfg.accent, border: `1px solid ${cfg.accent}55` }}
      >
        {displayCta}
      </button>

      <style>{`
        .es-btn { transition: transform 0.15s ease, filter 0.15s ease, background-color 0.15s ease; }
        .es-btn:hover { filter: brightness(1.12); transform: translateY(-1px); background-color: rgba(255,255,255,0.03); }
        .es-btn:active { transform: scale(0.97); }
      `}</style>
    </div>
  );
}

export default ErrorState;
