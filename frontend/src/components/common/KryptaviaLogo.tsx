import React from 'react';

interface KryptaviaLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
  showText?: boolean;
  className?: string;
  horizontal?: boolean;
}

export function KryptaviaLogo({
  size = 'md',
  showTagline = false,
  showText = true,
  className = '',
  horizontal = true,
}: KryptaviaLogoProps) {
  const dimensions = {
    sm: { box: 28, text: 'text-base', tag: 'text-[8px]', gap: 'gap-2' },
    md: { box: 36, text: 'text-xl', tag: 'text-[9px]', gap: 'gap-2.5' },
    lg: { box: 48, text: 'text-2xl', tag: 'text-[10px]', gap: 'gap-3' },
  }[size];

  return (
    <div className={`flex ${horizontal ? 'flex-row items-center' : 'flex-col items-center'} ${dimensions.gap} ${className}`}>
      {/* Asymmetric K Brand Icon Container */}
      <div className="relative shrink-0 flex items-center justify-center">
        <svg
          width={dimensions.box}
          height={dimensions.box}
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="drop-shadow-[0_2px_10px_rgba(245,166,35,0.25)]"
        >
          {/* Rounded Dark Container Frame */}
          <rect x="8" y="8" width="84" height="84" rx="22" fill="#121217" stroke="#252530" strokeWidth="3" />
          
          {/* Internal Asymmetric K Strokes */}
          {/* Vertical Stem */}
          <line x1="36" y1="28" x2="36" y2="72" stroke="#f5a623" strokeWidth="9" strokeLinecap="round" />
          
          {/* Lower Diagonal Arm */}
          <line x1="36" y1="50" x2="68" y2="72" stroke="#f5a623" strokeWidth="9" strokeLinecap="round" />

          {/* Upper Diagonal Arm (Breaks past frame edge) */}
          <line x1="36" y1="50" x2="84" y2="18" stroke="#f5a623" strokeWidth="9" strokeLinecap="round" />

          {/* Verification Endpoint Teal Dot */}
          <circle cx="84" cy="18" r="6" fill="#14b8a6" stroke="#121217" strokeWidth="2" />
        </svg>
      </div>

      {/* Brand Typography */}
      {showText && (
        <div className="flex flex-col min-w-0">
          <div className={`font-black ${dimensions.text} text-white tracking-tight flex items-center gap-1 font-sans`}>
            <span>Kryptavia</span>
            <span className="text-amber-400 font-extrabold">OS</span>
          </div>
          {showTagline && (
            <span className={`${dimensions.tag} font-bold text-gray-500 tracking-widest uppercase mt-0.5 font-mono`}>
              PROVEN. VERIFIED. ELEVATED.
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default KryptaviaLogo;
