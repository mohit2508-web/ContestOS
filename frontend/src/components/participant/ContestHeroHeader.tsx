import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface ContestHeroHeaderProps {
  contestTitle: string;
  scoreEarned: number;
  maxScore: number;
  solvedCount: number;
  totalProblems: number;
  endTime?: string;
  isSebBrowser?: boolean;
}

export const ContestHeroHeader: React.FC<ContestHeroHeaderProps> = ({
  contestTitle,
  scoreEarned,
  maxScore,
  solvedCount,
  totalProblems,
  endTime,
  isSebBrowser = false,
}) => {
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isLowTime, setIsLowTime] = useState<boolean>(false);

  useEffect(() => {
    if (!endTime) return;
    const update = () => {
      const diff = new Date(endTime).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft('EXPIRED');
        return;
      }
      if (diff < 10 * 60 * 1000) setIsLowTime(true);
      const hrs = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setTimeLeft(
        `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
      );
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [endTime]);

  const scorePct = maxScore > 0 ? Math.min(100, Math.round((scoreEarned / maxScore) * 100)) : 0;
  const solvedPct = totalProblems > 0 ? Math.min(100, Math.round((solvedCount / totalProblems) * 100)) : 0;

  // SVG Circle Constants
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const scoreStrokeDash = circumference - (scorePct / 100) * circumference;

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-zinc-950 via-zinc-900 to-black border border-white/10 p-6 md:p-8 shadow-2xl backdrop-blur-xl">
      {/* Ambient background glow */}
      <div className="absolute -top-32 -right-32 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        
        {/* Left: Exam Info & Live Proctor Status */}
        <div className="space-y-3 max-w-xl">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono">
              CONTEST ARENA
            </span>
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 border ${
              isSebBrowser
                ? 'bg-purple-500/10 border-purple-500/30 text-purple-300'
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
            }`}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {isSebBrowser ? '🛡️ SEB LOCKED ENVIRONMENT' : '🛡️ SECURE MODE ACTIVE'}
            </span>
          </div>

          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight leading-tight">
            {contestTitle}
          </h1>
          <p className="text-xs text-gray-400">
            Select any problem below to launch its dedicated interactive workspace. Submissions are scored and updated live.
          </p>
        </div>

        {/* Right: Circular Score Gauge & Metrics Cards */}
        <div className="flex items-center gap-4 sm:gap-6 flex-wrap sm:flex-nowrap justify-between lg:justify-end">
          
          {/* Metric 1: Solved Ratio Pill */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-3.5 shadow-inner">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-extrabold text-sm">
              🎯
            </div>
            <div>
              <span className="text-[9px] text-gray-500 uppercase tracking-widest font-mono font-bold block">Solved Ratio</span>
              <span className="text-sm font-black text-white font-mono">
                {solvedCount} / {totalProblems} <span className="text-xs font-normal text-gray-400">({solvedPct}%)</span>
              </span>
            </div>
          </div>

          {/* Metric 2: Circular SVG Score Ring */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-3 px-5 flex items-center gap-4 shadow-inner">
            <div className="relative w-16 h-16 flex items-center justify-center">
              <svg className="w-16 h-16 transform -rotate-90">
                <circle
                  cx="32"
                  cy="32"
                  r={radius}
                  stroke="currentColor"
                  strokeWidth="6"
                  className="text-zinc-800"
                  fill="transparent"
                />
                <circle
                  cx="32"
                  cy="32"
                  r={radius}
                  stroke="currentColor"
                  strokeWidth="6"
                  className="text-amber-400 transition-all duration-1000 ease-out"
                  fill="transparent"
                  strokeDasharray={circumference}
                  strokeDashoffset={scoreStrokeDash}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xs font-black text-white font-mono">{scorePct}%</span>
              </div>
            </div>
            <div>
              <span className="text-[9px] text-gray-500 uppercase tracking-widest font-mono font-bold block">Live Score</span>
              <span className="text-base font-black text-amber-400 font-mono">
                {scoreEarned} <span className="text-xs text-gray-400">/ {maxScore}</span>
              </span>
            </div>
          </div>

          {/* Metric 3: Live Timer Clock */}
          {timeLeft && (
            <div className={`px-4 py-3 rounded-2xl border flex flex-col justify-center text-right shadow-inner ${
              isLowTime
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 animate-pulse'
                : 'bg-zinc-900/80 border-white/10 text-white'
            }`}>
              <span className="text-[9px] text-gray-500 uppercase tracking-widest font-mono font-bold block">Time Left</span>
              <span className="text-sm font-black font-mono tracking-wider">{timeLeft}</span>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};

export default ContestHeroHeader;
