import React from 'react';
import { Zap, Lock, AlertTriangle, ShieldCheck } from 'lucide-react';

interface ProblemAiCreditMeterProps {
  remaining: number;
  max?: number;
  className?: string;
  compact?: boolean;
}

export const ProblemAiCreditMeter: React.FC<ProblemAiCreditMeterProps> = ({
  remaining,
  max = 2000,
  className = '',
  compact = false,
}) => {
  const percentage = Math.max(0, Math.min(100, (remaining / max) * 100));
  const isExhausted = remaining <= 0;
  const isLow = remaining > 0 && remaining < 200;
  const isMedium = remaining >= 200 && remaining < 1000;

  let badgeColorClass = 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)]';
  let progressColor = 'bg-gradient-to-r from-emerald-500 to-teal-400';
  let iconColor = 'text-emerald-400';

  if (isExhausted) {
    badgeColorClass = 'bg-rose-500/15 border-rose-500/40 text-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.2)] animate-pulse';
    progressColor = 'bg-rose-500';
    iconColor = 'text-rose-400';
  } else if (isLow) {
    badgeColorClass = 'bg-amber-500/15 border-amber-500/40 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.2)] animate-pulse';
    progressColor = 'bg-gradient-to-r from-amber-500 to-orange-400';
    iconColor = 'text-amber-400';
  } else if (isMedium) {
    badgeColorClass = 'bg-amber-500/10 border-amber-500/30 text-amber-300';
    progressColor = 'bg-gradient-to-r from-amber-400 to-yellow-400';
    iconColor = 'text-amber-400';
  }

  if (compact) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold backdrop-blur-md transition-all duration-300 ${badgeColorClass} ${className}`}
        title={`Per-Question AI Credits: ${remaining} / ${max} remaining. Once 0 is reached, AI assistance locks for this question.`}
      >
        {isExhausted ? (
          <Lock className="w-3.5 h-3.5 text-rose-400" />
        ) : (
          <Zap className={`w-3.5 h-3.5 ${iconColor}`} />
        )}
        <span>
          {isExhausted
            ? '0 AI Credits (Locked)'
            : `${remaining.toLocaleString()} / ${max.toLocaleString()} AI Credits`}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`relative group rounded-xl p-3 border backdrop-blur-xl bg-slate-900/80 transition-all duration-300 ${badgeColorClass} ${className}`}
    >
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-slate-800/80 border border-slate-700/50">
            {isExhausted ? (
              <Lock className="w-4 h-4 text-rose-400" />
            ) : isLow ? (
              <AlertTriangle className="w-4 h-4 text-amber-400 animate-bounce" />
            ) : (
              <Zap className={`w-4 h-4 ${iconColor}`} />
            )}
          </div>
          <div>
            <div className="text-xs font-medium text-slate-300 flex items-center gap-1">
              <span>Question AI Credits</span>
              <ShieldCheck className="w-3 h-3 text-cyan-400" />
            </div>
            <div className="text-sm font-bold tracking-tight">
              {isExhausted ? (
                <span className="text-rose-400">0 Credits (AI Disabled)</span>
              ) : (
                <span>
                  {remaining.toLocaleString()}{' '}
                  <span className="text-slate-400 font-normal">/ {max.toLocaleString()}</span>
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="text-right">
          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-slate-800/90 border border-slate-700 text-slate-200">
            {percentage.toFixed(0)}%
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700/50">
        <div
          className={`h-full transition-all duration-500 rounded-full ${progressColor}`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Tooltip info on hover */}
      <div className="mt-1.5 text-[11px] text-slate-400 flex items-center justify-between">
        <span>Limit: 2,000 credits / problem</span>
        {isExhausted ? (
          <span className="text-rose-400 font-semibold">🔒 AI Limit Reached</span>
        ) : (
          <span>Deducts per AI action</span>
        )}
      </div>
    </div>
  );
};
