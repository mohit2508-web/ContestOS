/**
 * SebWarningShield — Pure CSS/SVG animated shield (no WebGL dependency).
 * Used in SebDiagnosticCockpit for environment-integrity warning screens.
 */
import React from 'react';

export function StaticShieldSVG({ threat = true }: { threat?: boolean }) {
  return (
    <div className="flex items-center justify-center w-full h-full">
      <svg
        viewBox="0 0 120 140"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-28 h-28 drop-shadow-lg"
        aria-hidden="true"
      >
        <path
          d="M60 8L14 28v38c0 28 19.6 54.2 46 60 26.4-5.8 46-32 46-60V28L60 8z"
          fill={threat ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)'}
          stroke={threat ? '#ef4444' : '#22c55e'}
          strokeWidth="2"
        />
        <text
          x="60"
          y="82"
          textAnchor="middle"
          fontSize="40"
          fill={threat ? '#ef4444' : '#22c55e'}
        >
          {threat ? '⚠' : '✓'}
        </text>
      </svg>
    </div>
  );
}

export default function SebWarningShield({ threat = true }: { threat?: boolean }) {
  const color = threat ? '#ef4444' : '#22c55e';
  const glow = threat ? 'rgba(239,68,68,0.25)' : 'rgba(34,197,94,0.25)';

  return (
    <div className="w-full h-full min-h-[220px] flex items-center justify-center" aria-hidden="true">
      <div className="relative flex items-center justify-center">
        {/* Outer pulse ring */}
        <div
          className="absolute rounded-full animate-ping"
          style={{
            width: 180,
            height: 180,
            background: `radial-gradient(circle, ${glow} 0%, transparent 70%)`,
            animationDuration: '2s',
          }}
        />

        {/* Shield SVG with slow rotate */}
        <div
          style={{
            animation: 'seb-shield-rotate 8s linear infinite',
          }}
        >
          <svg
            viewBox="0 0 120 140"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{ width: 140, height: 140, filter: `drop-shadow(0 0 16px ${color})` }}
          >
            <defs>
              <linearGradient id="shieldGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.35" />
                <stop offset="100%" stopColor={color} stopOpacity="0.08" />
              </linearGradient>
            </defs>
            <path
              d="M60 8L14 28v38c0 28 19.6 54.2 46 60 26.4-5.8 46-32 46-60V28L60 8z"
              fill="url(#shieldGrad)"
              stroke={color}
              strokeWidth="2.5"
            />
            {/* Scan line */}
            <line x1="14" y1="66" x2="106" y2="66" stroke={color} strokeWidth="0.8" strokeDasharray="4 4" opacity="0.5" />
            <text x="60" y="84" textAnchor="middle" fontSize="38" fill={color}>
              {threat ? '⚠' : '✓'}
            </text>
          </svg>
        </div>

        {/* Inner orbit ring */}
        <div
          className="absolute border rounded-full"
          style={{
            width: 160,
            height: 160,
            borderColor: `${color}40`,
            borderWidth: 1,
            borderStyle: 'dashed',
            animation: 'seb-orbit-cw 4s linear infinite',
          }}
        />
        <div
          className="absolute border rounded-full"
          style={{
            width: 200,
            height: 200,
            borderColor: '#f59e0b33',
            borderWidth: 1,
            animation: 'seb-orbit-ccw 6s linear infinite',
          }}
        />
      </div>

      <style>{`
        @keyframes seb-shield-rotate {
          0%   { transform: rotate(0deg) scale(1); }
          50%  { transform: rotate(3deg) scale(1.03); }
          100% { transform: rotate(0deg) scale(1); }
        }
        @keyframes seb-orbit-cw {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes seb-orbit-ccw {
          from { transform: rotate(0deg); }
          to   { transform: rotate(-360deg); }
        }
      `}</style>
    </div>
  );
}
