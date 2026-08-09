import React, { useState } from 'react';

const BORDER = '#1e1e24';
const TEXT_MUTED = '#8b93a6';

/* ---------- shared: ambient glow blob behind the scene ---------- */
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

/* ---------- 1. Contest Management — spotlit podium ---------- */
function ContestScene() {
  const c = '#f5a623';
  return (
    <svg viewBox="0 0 220 150" width="220" height="150">
      <defs>
        <linearGradient id="beam" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={c} stopOpacity="0.4" />
          <stop offset="100%" stopColor={c} stopOpacity="0" />
        </linearGradient>
        <linearGradient id="podiumTop" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={c} stopOpacity="0.25" />
          <stop offset="100%" stopColor={c} stopOpacity="0" />
        </linearGradient>
        <radialGradient id="trophyGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={c} stopOpacity="0.55" />
          <stop offset="100%" stopColor={c} stopOpacity="0" />
        </radialGradient>
        <filter id="soft"><feGaussianBlur stdDeviation="0.4" /></filter>
      </defs>

      <g style={{ transformOrigin: '110px 5px', animation: 'beamSweep 4s ease-in-out infinite' }}>
        <polygon points="110,5 55,150 165,150" fill="url(#beam)" />
      </g>

      <rect x="18" y="104" width="46" height="36" rx="4" fill="#17171d" stroke="#2a2a32" />
      <rect x="18" y="104" width="46" height="6" fill="url(#podiumTop)" />
      <rect x="87" y="80" width="46" height="60" rx="4" fill="#1c1710" stroke={c} strokeOpacity="0.55" />
      <rect x="87" y="80" width="46" height="6" fill="url(#podiumTop)" />
      <rect x="156" y="112" width="46" height="28" rx="4" fill="#17171d" stroke="#2a2a32" />
      <rect x="156" y="112" width="46" height="6" fill="url(#podiumTop)" />

      <text x="41" y="126" textAnchor="middle" fill="#4a4a52" fontSize="12" fontWeight="600">2</text>
      <text x="110" y="105" textAnchor="middle" fill={c} fillOpacity="0.8" fontSize="13" fontWeight="700">1</text>
      <text x="179" y="132" textAnchor="middle" fill="#4a4a52" fontSize="12" fontWeight="600">3</text>

      <circle cx="110" cy="52" r="22" fill="url(#trophyGlow)" style={{ animation: 'glowPulse 2.6s ease-in-out infinite' }} />
      <g style={{ transformOrigin: '110px 60px', animation: 'trophyFloat 3s ease-in-out infinite' }} filter="url(#soft)">
        <path d="M100 48h20v10a10 10 0 0 1-20 0z" fill="none" stroke={c} strokeWidth="2" strokeLinejoin="round" />
        <path d="M100 50c-6 0-8 6-3 10M120 50c6 0 8 6 3 10" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" />
        <rect x="107" y="68" width="6" height="7" fill={c} />
        <rect x="101" y="75" width="18" height="4" rx="1" fill={c} />
      </g>

      {[[36, 42], [176, 58], [58, 18], [152, 28], [96, 12], [128, 96]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="1.6" fill={c} style={{ animation: `twinkle 2.4s ease-in-out ${i * 0.4}s infinite` }} />
      ))}

      <style>{`
        @keyframes beamSweep { 0%,100% { transform: rotate(-13deg); } 50% { transform: rotate(13deg); } }
        @keyframes glowPulse { 0%,100% { opacity: 0.5; transform: scale(1); } 50% { opacity: 0.95; transform: scale(1.18); } }
        @keyframes trophyFloat { 0%,100% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(-5px) rotate(-2deg); } }
        @keyframes twinkle { 0%,100% { opacity: 0.1; } 50% { opacity: 1; } }
      `}</style>
    </svg>
  );
}

/* ---------- 2. Question Bank — fanned index cards ---------- */
function QuestionBankScene() {
  const c = '#a78bfa';
  return (
    <svg viewBox="0 0 220 150" width="220" height="150">
      <defs>
        <linearGradient id="cardSheen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={c} stopOpacity="0.14" />
          <stop offset="100%" stopColor={c} stopOpacity="0" />
        </linearGradient>
      </defs>
      <g transform="translate(110,95)">
        <g transform="rotate(-14)" style={{ transformOrigin: '0px 30px' }}>
          <rect x="-38" y="-30" width="76" height="58" rx="7" fill="#18151f" stroke="#2a2732" />
        </g>
        <g transform="rotate(7)" style={{ transformOrigin: '0px 30px' }}>
          <rect x="-38" y="-30" width="76" height="58" rx="7" fill="#1c1826" stroke="#332e40" />
        </g>
        <g style={{ transformOrigin: '0px 30px', animation: 'cardTilt 3.4s ease-in-out infinite' }}>
          <rect x="-38" y="-30" width="76" height="58" rx="7" fill="#211c2c" stroke={c} strokeOpacity="0.65" strokeWidth="1.3" />
          <rect x="-38" y="-30" width="76" height="58" rx="7" fill="url(#cardSheen)" />
          <line x1="-26" y1="-14" x2="18" y2="-14" stroke={c} strokeOpacity="0.6" strokeWidth="3" strokeLinecap="round" />
          <line x1="-26" y1="-2" x2="10" y2="-2" stroke={c} strokeOpacity="0.4" strokeWidth="3" strokeLinecap="round" />
          <circle cx="21" cy="14" r="7" fill="none" stroke={c} strokeOpacity="0.75" strokeWidth="2" />
          <path d="M18 14a3 3 0 1 1 4 2.8" fill="none" stroke={c} strokeOpacity="0.75" strokeWidth="1.4" strokeLinecap="round" />
        </g>
      </g>

      <g transform="translate(160,40)" style={{ animation: 'badgeBob 2.8s ease-in-out infinite' }}>
        <circle r="15" fill="#211c2c" stroke={c} strokeWidth="1.5" />
        <line x1="-6" y1="0" x2="6" y2="0" stroke={c} strokeWidth="2.2" strokeLinecap="round" />
        <line x1="0" y1="-6" x2="0" y2="6" stroke={c} strokeWidth="2.2" strokeLinecap="round" />
      </g>

      <style>{`
        @keyframes cardTilt { 0%,100% { transform: rotate(0deg) translateY(0); } 50% { transform: rotate(-5deg) translateY(-4px); } }
        @keyframes badgeBob { 0%,100% { transform: translate(160px,40px) translateY(0) scale(1); } 50% { transform: translate(160px,40px) translateY(-5px) scale(1.08); } }
      `}</style>
    </svg>
  );
}

/* ---------- 3. Four-Eyes Review — overlapping rings, checkmark ---------- */
function ReviewScene() {
  const c = '#22d3a4';
  return (
    <svg viewBox="0 0 220 150" width="220" height="150">
      <circle cx="90" cy="75" r="34" fill="none" stroke={c} strokeOpacity="0.15" strokeWidth="14" />
      <circle cx="130" cy="75" r="34" fill="none" stroke={c} strokeOpacity="0.15" strokeWidth="14" />
      <g style={{ animation: 'eyeL 3.6s ease-in-out infinite' }}>
        <circle cx="90" cy="75" r="34" fill="none" stroke={c} strokeOpacity="0.5" strokeWidth="1.5" />
      </g>
      <g style={{ animation: 'eyeR 3.6s ease-in-out infinite 0.45s' }}>
        <circle cx="130" cy="75" r="34" fill="none" stroke={c} strokeOpacity="0.5" strokeWidth="1.5" />
      </g>

      <g style={{ animation: 'checkDraw 3.2s ease-in-out infinite' }}>
        <path d="M96 76 l12 12 l24 -26" fill="none" stroke={c} strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" pathLength="1" strokeDasharray="1" />
      </g>

      <g style={{ transformOrigin: '110px 75px', animation: 'orbit 6s linear infinite' }}>
        <circle cx="110" cy="34" r="2.6" fill={c} />
      </g>
      <g style={{ transformOrigin: '110px 75px', animation: 'orbit 6s linear infinite reverse' }}>
        <circle cx="110" cy="116" r="2" fill={c} fillOpacity="0.6" />
      </g>

      <style>{`
        @keyframes eyeL { 0%,100% { opacity: 0.55; transform: scale(1); } 50% { opacity: 1; transform: scale(1.05); } }
        @keyframes eyeR { 0%,100% { opacity: 0.55; transform: scale(1); } 50% { opacity: 1; transform: scale(1.05); } }
        @keyframes checkDraw {
          0% { stroke-dashoffset: 1; opacity: 0; }
          25% { stroke-dashoffset: 0; opacity: 1; }
          72% { stroke-dashoffset: 0; opacity: 1; }
          100% { stroke-dashoffset: 0; opacity: 0; }
        }
        @keyframes orbit { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </svg>
  );
}

/* ---------- 4. Notifications — bell with fading chime rings ---------- */
function NotificationsScene() {
  const c = '#38bdf8';
  return (
    <svg viewBox="0 0 220 150" width="220" height="150">
      {[0, 0.7, 1.4].map((d, i) => (
        <path key={i} d="M132 40 a30 30 0 0 1 0 40" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round"
          style={{ transformOrigin: '128px 60px', animation: `chime 2.6s ease-out ${d}s infinite` }} />
      ))}
      {[0, 0.7, 1.4].map((d, i) => (
        <path key={`b${i}`} d="M96 40 a30 30 0 0 0 0 40" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeOpacity="0.5"
          style={{ transformOrigin: '100px 60px', animation: `chime 2.6s ease-out ${d}s infinite` }} />
      ))}

      <g style={{ transformOrigin: '108px 40px', animation: 'swing 3.6s ease-in-out infinite' }}>
        <path d="M108 40c0-9 7-16 16-16s16 7 16 16c0 18 8 24 8 24H100s8-6 8-24z" fill="#111820" stroke={c} strokeOpacity="0.65" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M118 68a6 6 0 0 0 12 0" fill="none" stroke={c} strokeOpacity="0.65" strokeWidth="1.6" />
        <circle cx="124" cy="24" r="2.2" fill={c} style={{ animation: 'dotPulse 1.8s ease-in-out infinite' }} />
      </g>

      <style>{`
        @keyframes chime { 0% { opacity: 0.75; transform: scale(0.5); } 100% { opacity: 0; transform: scale(1.4); } }
        @keyframes swing { 0%,100% { transform: rotate(0deg); } 25% { transform: rotate(7deg); } 75% { transform: rotate(-7deg); } }
        @keyframes dotPulse { 0%,100% { opacity: 0.6; } 50% { opacity: 1; } }
      `}</style>
    </svg>
  );
}

/* ---------- 5. Search / filters — no matches ---------- */
function SearchScene() {
  const c = '#fb7185';
  return (
    <svg viewBox="0 0 220 150" width="220" height="150">
      <clipPath id="lens"><circle cx="100" cy="65" r="26" /></clipPath>
      <g clipPath="url(#lens)">
        <circle cx="100" cy="65" r="6" fill="none" stroke={c} strokeOpacity="0.6" style={{ animation: 'ping 2.2s ease-out infinite' }} />
        <circle cx="100" cy="65" r="6" fill="none" stroke={c} strokeOpacity="0.6" style={{ animation: 'ping 2.2s ease-out infinite 0.7s' }} />
        <circle cx="100" cy="65" r="6" fill="none" stroke={c} strokeOpacity="0.4" style={{ animation: 'ping 2.2s ease-out infinite 1.4s' }} />
      </g>
      <circle cx="100" cy="65" r="26" fill="#17131a" stroke={c} strokeOpacity="0.75" strokeWidth="2.5" />
      <line x1="119" y1="84" x2="142" y2="107" stroke={c} strokeOpacity="0.75" strokeWidth="4.5" strokeLinecap="round" />
      <g style={{ animation: 'shake 3s ease-in-out infinite' }}>
        <line x1="93" y1="58" x2="107" y2="72" stroke={c} strokeWidth="2.6" strokeLinecap="round" />
        <line x1="107" y1="58" x2="93" y2="72" stroke={c} strokeWidth="2.6" strokeLinecap="round" />
      </g>
      <style>{`
        @keyframes ping { 0% { r: 3; opacity: 0.85; } 100% { r: 20; opacity: 0; } }
        @keyframes shake { 0%,80%,100% { transform: rotate(0deg); } 85% { transform: rotate(-9deg); } 90% { transform: rotate(9deg); } 95% { transform: rotate(-4deg); } }
      `}</style>
    </svg>
  );
}

/* ---------- 6. Evaluator Queue — floating gold star ---------- */
function EvaluatorScene() {
  const c = '#eab308';
  return (
    <svg viewBox="0 0 220 150" width="220" height="150">
      <defs>
        <radialGradient id="starGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={c} stopOpacity="0.5" />
          <stop offset="100%" stopColor={c} stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx="110" cy="65" r="35" fill="url(#starGlow)" style={{ animation: 'glowPulse 2.5s ease-in-out infinite' }} />

      <g style={{ transformOrigin: '110px 65px', animation: 'trophyFloat 3.2s ease-in-out infinite' }}>
        <path d="M110 40 l7.5 15.2 16.8 2.4-12.2 11.9 2.9 16.7-15-7.9-15 7.9 2.9-16.7-12.2-11.9 16.8-2.4z" fill="#211d10" stroke={c} strokeWidth="2" strokeLinejoin="round" />
        <circle cx="110" cy="65" r="6" fill={c} fillOpacity="0.8" />
      </g>

      <rect x="65" y="115" width="90" height="18" rx="5" fill="#17171d" stroke="#2a2a32" />
      <text x="110" y="128" textAnchor="middle" fill={c} fontSize="10" fontWeight="700" letterSpacing="0.08em">QUEUE CLEARED ✓</text>

      <style>{`
        @keyframes glowPulse { 0%,100% { opacity: 0.5; transform: scale(1); } 50% { opacity: 0.9; transform: scale(1.15); } }
        @keyframes trophyFloat { 0%,100% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(-6px) rotate(3deg); } }
      `}</style>
    </svg>
  );
}

/* ---------- 7. Live Proctor Monitor — radar scanner ---------- */
function ProctorScene() {
  const c = '#10b981';
  return (
    <svg viewBox="0 0 220 150" width="220" height="150">
      <circle cx="110" cy="70" r="42" fill="#0d1f18" stroke={c} strokeOpacity="0.4" strokeWidth="1.5" />
      <circle cx="110" cy="70" r="28" fill="none" stroke={c} strokeOpacity="0.25" strokeWidth="1" strokeDasharray="3 3" />
      <circle cx="110" cy="70" r="14" fill="none" stroke={c} strokeOpacity="0.25" strokeWidth="1" />

      <g style={{ transformOrigin: '110px 70px', animation: 'radarSweep 3s linear infinite' }}>
        <path d="M110 70 L152 70 A42 42 0 0 0 110 28 Z" fill={c} fillOpacity="0.25" />
        <line x1="110" y1="70" x2="152" y2="70" stroke={c} strokeWidth="2" />
      </g>

      <circle cx="125" cy="55" r="2.5" fill={c} style={{ animation: 'dotPulse 1.5s ease-in-out infinite' }} />
      <circle cx="95" cy="82" r="2" fill={c} style={{ animation: 'dotPulse 2s ease-in-out infinite 0.5s' }} />

      <style>{`
        @keyframes radarSweep { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes dotPulse { 0%,100% { opacity: 0.2; } 50% { opacity: 1; } }
      `}</style>
    </svg>
  );
}

/* ---------- 8. Org Requests — institutional building ---------- */
function OrgRequestsScene() {
  const c = '#f59e0b';
  return (
    <svg viewBox="0 0 220 150" width="220" height="150">
      <polygon points="110,35 60,60 160,60" fill="#1e180d" stroke={c} strokeWidth="1.8" strokeLinejoin="round" />
      <rect x="68" y="60" width="84" height="6" fill={c} fillOpacity="0.7" />
      <rect x="74" y="66" width="8" height="34" fill="#1e180d" stroke={c} strokeOpacity="0.5" />
      <rect x="98" y="66" width="8" height="34" fill="#1e180d" stroke={c} strokeOpacity="0.5" />
      <rect x="122" y="66" width="8" height="34" fill="#1e180d" stroke={c} strokeOpacity="0.5" />
      <rect x="146" y="66" width="8" height="34" fill="#1e180d" stroke={c} strokeOpacity="0.5" />
      <rect x="64" y="100" width="104" height="8" rx="2" fill="#1e180d" stroke={c} strokeWidth="1.5" />

      <g style={{ transformOrigin: '110px 48px', animation: 'badgeBob 3s ease-in-out infinite' }}>
        <circle cx="110" cy="48" r="10" fill="#1e180d" stroke={c} strokeWidth="1.5" />
        <path d="M106 48 l3 3 l6 -6" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </g>

      <style>{`
        @keyframes badgeBob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
      `}</style>
    </svg>
  );
}

/* ---------- 9. Audit Logs — security lock ---------- */
function AuditLogsScene() {
  const c = '#6366f1';
  return (
    <svg viewBox="0 0 220 150" width="220" height="150">
      <rect x="85" y="65" width="50" height="42" rx="6" fill="#131424" stroke={c} strokeWidth="2" />
      <path d="M96 65 V50 a14 14 0 0 1 28 0 V65" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="110" cy="82" r="4" fill={c} style={{ animation: 'dotPulse 2s ease-in-out infinite' }} />
      <line x1="110" y1="86" x2="110" y2="94" stroke={c} strokeWidth="2" strokeLinecap="round" />

      <style>{`
        @keyframes dotPulse { 0%,100% { opacity: 0.5; } 50% { opacity: 1; } }
      `}</style>
    </svg>
  );
}

/* ---------- confetti burst on primary CTA ---------- */
function Confetti({ color, burstKey }: { color: string; burstKey: number }) {
  if (!burstKey) return null;
  const pieces = Array.from({ length: 16 });
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 30 }}>
      {pieces.map((_, i) => {
        const angle = (360 / pieces.length) * i;
        const dist = 60 + (i % 3) * 20;
        const colors = [color, '#ffffff', '#f5a623'];
        return (
          <span
            key={`${burstKey}-${i}`}
            style={{
              position: 'absolute',
              left: '50%',
              top: '40%',
              width: '5px',
              height: '8px',
              background: colors[i % colors.length],
              borderRadius: '1px',
              transform: `rotate(${angle}deg)`,
              animation: `confettiPop 0.9s ease-out forwards`,
              // @ts-ignore
              '--dist': `${dist}px`,
              '--ang': `${angle}deg`,
            }}
          />
        );
      })}
      <style>{`
        @keyframes confettiPop {
          0% { opacity: 1; transform: rotate(var(--ang)) translateY(0) scale(1); }
          100% { opacity: 0; transform: rotate(var(--ang)) translateY(calc(-1 * var(--dist))) scale(0.4); }
        }
      `}</style>
    </div>
  );
}

/* ---------------------------------------------------------------- */

interface VariantConfig {
  Scene: React.ComponentType;
  accent: string;
  tint: string;
  eyebrow: string;
  title: string;
  body: string;
  cta: { label: string; kind: 'primary' | 'ghost' } | null;
  confetti: boolean;
}

const VARIANTS: Record<string, VariantConfig> = {
  contest: {
    Scene: ContestScene,
    accent: '#f5a623',
    tint: '#241c0d',
    eyebrow: 'Contest management',
    title: "The podium's still empty",
    body: 'Set the rules, load your questions and open the gates — your first contest starts here.',
    cta: { label: 'Create contest', kind: 'primary' },
    confetti: true,
  },
  contests: {
    Scene: ContestScene,
    accent: '#f5a623',
    tint: '#241c0d',
    eyebrow: 'Contest management',
    title: "The podium's still empty",
    body: 'Set the rules, load your questions and open the gates — your first contest starts here.',
    cta: { label: 'Create contest', kind: 'primary' },
    confetti: true,
  },
  questionBank: {
    Scene: QuestionBankScene,
    accent: '#a78bfa',
    tint: '#211c2c',
    eyebrow: 'Question bank',
    title: 'A blank test bank',
    body: "Write or import a question once — it's ready to reuse across every contest you run.",
    cta: { label: 'Author question', kind: 'primary' },
    confetti: true,
  },
  review: {
    Scene: ReviewScene,
    accent: '#22d3a4',
    tint: '#0d211c',
    eyebrow: 'Four-eyes review',
    title: 'Nothing waiting on you',
    body: 'Submitted questions sit here until a second reviewer signs off. Four eyes, then it goes live.',
    cta: { label: 'View review guidelines', kind: 'ghost' },
    confetti: false,
  },
  notifications: {
    Scene: NotificationsScene,
    accent: '#38bdf8',
    tint: '#0d1b24',
    eyebrow: 'Notifications',
    title: "It's quiet in here",
    body: "Invitations, approvals and system alerts will chime in the moment there's news.",
    cta: null,
    confetti: false,
  },
  search: {
    Scene: SearchScene,
    accent: '#fb7185',
    tint: '#241014',
    eyebrow: 'Search results',
    title: 'No matches for that search',
    body: 'Try a different keyword, or clear your filters to see everything again.',
    cta: { label: 'Clear filters', kind: 'ghost' },
    confetti: false,
  },
  evaluator: {
    Scene: EvaluatorScene,
    accent: '#eab308',
    tint: '#24200c',
    eyebrow: 'Evaluation Queue',
    title: 'No submissions awaiting grading',
    body: 'All candidate submissions have been scored and verified. Enjoy the clear queue!',
    cta: { label: 'Refresh Queue', kind: 'ghost' },
    confetti: false,
  },
  proctor: {
    Scene: ProctorScene,
    accent: '#10b981',
    tint: '#0c2419',
    eyebrow: 'Live Proctor Monitor',
    title: 'All candidate feeds clear',
    body: 'No security violations or tab switches detected. Live monitoring is active.',
    cta: { label: 'Refresh Telemetry', kind: 'ghost' },
    confetti: false,
  },
  orgRequests: {
    Scene: OrgRequestsScene,
    accent: '#f59e0b',
    tint: '#241a0c',
    eyebrow: 'Tenant Governance',
    title: 'No pending verification dossiers',
    body: 'All organization applications have been reviewed and provisioned.',
    cta: { label: 'Refresh Queue', kind: 'ghost' },
    confetti: false,
  },
  auditLogs: {
    Scene: AuditLogsScene,
    accent: '#6366f1',
    tint: '#121429',
    eyebrow: 'Security Audit Trail',
    title: 'No audit log events recorded',
    body: 'Platform security audit logs will be streamed here in real time.',
    cta: { label: 'Refresh Audit Logs', kind: 'ghost' },
    confetti: false,
  },
};

export interface EmptyStateProps {
  variant?: keyof typeof VARIANTS;
  icon?: string;
  message?: string;
  sub?: string;
  title?: string;
  body?: string;
  eyebrow?: string;
  onAction?: () => void;
  actionLabel?: string;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  customCta?: React.ReactNode;
}

export function EmptyState({
  variant,
  icon,
  message,
  sub,
  title,
  body,
  eyebrow,
  onAction,
  actionLabel,
  secondaryActionLabel,
  onSecondaryAction,
  customCta,
}: EmptyStateProps) {
  let key = variant;
  if (!key) {
    if (icon === '✅') key = 'evaluator';
    else if (icon === '🏢') key = 'orgRequests';
    else if (icon === '👥') key = 'questionBank';
    else if (icon === '📋') key = 'auditLogs';
    else if (icon === '🕐') key = 'proctor';
    else key = 'notifications';
  }

  const cfg = VARIANTS[key] || VARIANTS.notifications;
  const { Scene } = cfg;
  const [burst, setBurst] = useState(0);

  const displayTitle = title || message || cfg.title;
  const displayBody = body || sub || cfg.body;
  const displayEyebrow = eyebrow || (variant ? cfg.eyebrow : 'SYSTEM NOTICE');

  const displayCtaLabel = actionLabel || (onAction || variant ? cfg.cta?.label : null);
  const ctaKind = cfg.cta?.kind || 'primary';

  const handleClick = () => {
    if (cfg.confetti) setBurst((b) => b + 1);
    onAction?.();
  };

  return (
    <div
      className="relative flex flex-col items-center justify-center text-center py-14 px-6 overflow-hidden rounded-2xl border"
      style={{
        backgroundColor: '#0f0f13',
        borderColor: BORDER,
        background: 'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0) 60%)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
      }}
    >
      <Glow color={cfg.accent} />
      <Confetti color={cfg.accent} burstKey={burst} />

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
      <p className="relative text-sm max-w-sm mb-7 leading-relaxed" style={{ color: TEXT_MUTED }}>
        {displayBody}
      </p>

      {customCta ? (
        <div className="relative">{customCta}</div>
      ) : displayCtaLabel ? (
        <div className="relative flex items-center gap-3">
          <button
            type="button"
            onClick={handleClick}
            className="overflow-hidden px-5 py-2.5 rounded-lg text-sm font-semibold es-btn cursor-pointer"
            style={
              ctaKind === 'primary'
                ? { backgroundColor: cfg.accent, color: '#0a0a0d' }
                : { backgroundColor: 'transparent', color: cfg.accent, border: `1px solid ${cfg.accent}55` }
            }
          >
            {displayCtaLabel}
          </button>

          {secondaryActionLabel && (
            <button
              type="button"
              onClick={onSecondaryAction}
              className="px-4 py-2.5 rounded-lg text-sm font-semibold text-zinc-400 hover:text-white border border-white/10 bg-white/5 transition cursor-pointer"
            >
              {secondaryActionLabel}
            </button>
          )}
        </div>
      ) : null}

      <style>{`
        .es-btn { transition: transform 0.15s ease, filter 0.15s ease, box-shadow 0.2s ease; }
        .es-btn:hover { filter: brightness(1.12); transform: translateY(-1px); }
        .es-btn:active { transform: scale(0.97); }
      `}</style>
    </div>
  );
}

export default EmptyState;
