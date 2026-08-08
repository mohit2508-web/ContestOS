import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface ContestPlaygroundHeaderProps {
  contestId: string;
  contestTitle?: string;
  problems?: Array<{
    id: string;
    title: string;
    problemType?: string;
  }>;
  currentProblemId?: string;
  onSelectProblem?: (problemId: string) => void;
  endTime?: string;
}

export const ContestPlaygroundHeader: React.FC<ContestPlaygroundHeaderProps> = ({
  contestId,
  contestTitle = 'Contest Exam',
  problems = [],
  currentProblemId,
  onSelectProblem,
  endTime,
}) => {
  const navigate = useNavigate();

  // Timer Countdown
  const [timeLeft, setTimeLeft] = useState<string>('');

  useEffect(() => {
    if (!endTime) return;
    const update = () => {
      const diff = new Date(endTime).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft('EXPIRED');
        return;
      }
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

  return (
    <header className="h-12 bg-zinc-950 border-b border-amber-500/20 px-4 flex items-center justify-between text-xs select-none sticky top-0 z-50">
      {/* Left: Back Button + Contest Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(`/contests/${contestId}`)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-amber-500/20 border border-white/10 hover:border-amber-500/40 text-gray-300 hover:text-amber-300 rounded-xl transition cursor-pointer font-bold"
          title="Return to Contest Overview & Problems List"
        >
          <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
          <span>Back to Contest</span>
        </button>

        <div className="h-4 w-px bg-white/10" />

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded font-mono uppercase">
            CONTEST MODE
          </span>
          <span className="font-bold text-white truncate max-w-[200px] md:max-w-xs">
            {contestTitle}
          </span>
        </div>
      </div>

      {/* Middle: Problem Switcher (if problem list provided) */}
      {problems.length > 0 && onSelectProblem && (
        <div className="hidden md:flex items-center gap-1 bg-black/60 border border-white/10 rounded-xl p-1">
          {problems.map((p, idx) => {
            const isSelected = p.id === currentProblemId;
            return (
              <button
                key={p.id}
                onClick={() => onSelectProblem(p.id)}
                className={`px-3 py-1 rounded-lg font-mono font-bold text-xs transition cursor-pointer ${
                  isSelected
                    ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                P{idx + 1}
              </button>
            );
          })}
        </div>
      )}

      {/* Right: Live Timer + Security Badge */}
      <div className="flex items-center gap-3">
        {timeLeft && (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-zinc-900 border border-white/10 rounded-xl">
            <span className="text-[10px] text-gray-500 uppercase font-mono font-bold">Time:</span>
            <span className="font-mono font-black text-amber-400">{timeLeft}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black rounded-xl">
          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
          <span>PROCTORED</span>
        </div>
      </div>
    </header>
  );
};

export default ContestPlaygroundHeader;
