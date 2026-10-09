import React from 'react';

interface TieEduLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
  showText?: boolean;
  className?: string;
  horizontal?: boolean;
}

export function TieEduLogo({
  size = 'md',
  showTagline = false,
  showText = true,
  className = '',
  horizontal = true,
}: TieEduLogoProps) {
  const dimensions = {
    sm: { box: 28, text: 'text-base', tag: 'text-[8px]', gap: 'gap-2' },
    md: { box: 36, text: 'text-xl', tag: 'text-[9px]', gap: 'gap-2.5' },
    lg: { box: 48, text: 'text-2xl', tag: 'text-[10px]', gap: 'gap-3' },
  }[size];

  return (
    <div className={`flex ${horizontal ? 'flex-row items-center' : 'flex-col items-center'} ${dimensions.gap} ${className}`}>
      {/* TieEdu Brand Logo Icon */}
      <div className="relative shrink-0 flex items-center justify-center">
        <img
          src="/logo.svg"
          alt="TieEdu OS"
          style={{ width: dimensions.box * 1.5, height: 'auto' }}
          className="object-contain drop-shadow-[0_2px_10px_rgba(245,166,35,0.25)]"
        />
      </div>

      {/* Brand Typography */}
      {showText && (
        <div className="flex flex-col min-w-0">
          <div className={`font-black ${dimensions.text} text-white tracking-tight flex items-center gap-1 font-sans`}>
            <span>TieEdu</span>
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

export const KryptaviaLogo = TieEduLogo;
export default TieEduLogo;
