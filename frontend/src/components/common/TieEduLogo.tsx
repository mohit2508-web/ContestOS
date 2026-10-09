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
  const heightMap = {
    sm: 'h-7',
    md: 'h-9',
    lg: 'h-12',
  };

  const currentHeight = heightMap[size] || 'h-9';

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <img
        src="/logo.svg"
        alt="TieEdu OS"
        className={`${currentHeight} w-auto object-contain shrink-0`}
      />
      {showText && (
        <span className="text-amber-400 font-black tracking-wider text-xs md:text-sm uppercase bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
          OS
        </span>
      )}
    </div>
  );
}

export const KryptaviaLogo = TieEduLogo;
export default TieEduLogo;
