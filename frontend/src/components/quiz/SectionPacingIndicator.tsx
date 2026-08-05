import React from 'react';

interface SectionPacingIndicatorProps {
  totalQuestions: number;
  totalAnswered: number;
  remainingMs: number;
  totalDurationMinutes: number;
}

export const SectionPacingIndicator: React.FC<SectionPacingIndicatorProps> = ({
  totalQuestions,
  totalAnswered,
  remainingMs,
  totalDurationMinutes,
}) => {
  if (totalQuestions === 0) return null;

  const totalMs = totalDurationMinutes * 60 * 1000;
  const elapsedMs = Math.max(1, totalMs - remainingMs);
  const timeElapsedRatio = elapsedMs / totalMs;
  const expectedAnswered = Math.round(timeElapsedRatio * totalQuestions);

  let status: 'ahead' | 'on_pace' | 'behind' = 'on_pace';
  let badgeColor = 'bg-teal-500/10 text-teal-400 border-teal-500/20';
  let label = '⚡ On Pace';

  if (totalAnswered > expectedAnswered) {
    status = 'ahead';
    badgeColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    label = '🚀 Ahead of Pace';
  } else if (totalAnswered < expectedAnswered - 1) {
    status = 'behind';
    badgeColor = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    label = '⏱ Accelerate Pace';
  }

  return (
    <div className={`flex items-center space-x-2 px-3 py-1 rounded-lg border text-xs font-bold ${badgeColor}`}>
      <span>{label}</span>
      <span className="text-[10px] opacity-75 font-mono">
        ({totalAnswered}/{totalQuestions} Qs)
      </span>
    </div>
  );
};
