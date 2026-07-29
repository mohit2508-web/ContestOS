import React from 'react';

export default function RankReveal3D({ rank = 1 }: { rank?: number }) {
  const emoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉';
  const label = rank === 1 ? 'GOLD MEDALIST' : rank === 2 ? 'SILVER MEDALIST' : 'BRONZE MEDALIST';
  const glow = rank === 1 ? 'rgba(251,191,36,0.6)' : rank === 2 ? 'rgba(203,213,225,0.6)' : 'rgba(180,83,9,0.6)';

  return (
    <div className="flex flex-col items-center justify-center w-full h-full space-y-3">
      <div
        className="w-32 h-32 rounded-full bg-gradient-to-tr from-amber-600 via-amber-400 to-yellow-200 border-4 border-amber-300 flex items-center justify-center animate-bounce shadow-2xl"
        style={{ boxShadow: `0 0 40px ${glow}` }}
      >
        <span className="text-6xl select-none">{emoji}</span>
      </div>
      <span className="text-xs font-black tracking-widest text-amber-400 font-mono uppercase">
        {label}
      </span>
    </div>
  );
}
