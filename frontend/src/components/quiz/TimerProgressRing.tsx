import React from 'react';

interface TimerProgressRingProps {
  remainingMs: number;
  totalDurationMinutes: number;
}

export const TimerProgressRing: React.FC<TimerProgressRingProps> = ({
  remainingMs,
  totalDurationMinutes,
}) => {
  const totalMs = totalDurationMinutes * 60 * 1000;
  const progressRatio = Math.max(0, Math.min(1, remainingMs / (totalMs || 1)));

  // SVG ring metrics
  const radius = 18;
  const strokeWidth = 3.5;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - progressRatio * circumference;

  const totalSec = Math.floor(remainingMs / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  const formattedTime = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

  const isUrgent = remainingMs < 120000; // Under 2 mins
  const isCritical = remainingMs < 30000; // Under 30 secs

  const strokeColor = isCritical
    ? '#f43f5e' // Rose Red
    : isUrgent
    ? '#f59e0b' // Warm Amber
    : '#2dd4bf'; // Teal-Mint

  return (
    <div
      className={`flex items-center space-x-3 px-3.5 py-1.5 rounded-xl border transition-all ${
        isUrgent
          ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 animate-pulse'
          : 'bg-[#0f172a] border-[#1e293b] text-teal-300'
      }`}
    >
      {/* Signature Circular SVG Progress Ring */}
      <div className="relative w-8 h-8 flex items-center justify-center">
        <svg className="w-8 h-8 transform -rotate-90">
          <circle
            cx="16"
            cy="16"
            r={radius}
            stroke="#1e293b"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          <circle
            cx="16"
            cy="16"
            r={radius}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            className="transition-all duration-1000 ease-linear"
          />
        </svg>
        <span className="absolute text-[10px]">⏱</span>
      </div>

      {/* Tabular Monospace Countdown */}
      <div className="flex flex-col">
        <span className="text-[9px] uppercase tracking-widest font-bold text-slate-400">Time Left</span>
        <span className="font-mono font-bold text-sm tracking-wider text-slate-100">{formattedTime}</span>
      </div>
    </div>
  );
};
