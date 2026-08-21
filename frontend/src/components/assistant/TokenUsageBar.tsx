import React from 'react';

interface TokenUsageBarProps {
  tokensUsed: number;
  tokenBudget: number;
}

export const TokenUsageBar: React.FC<TokenUsageBarProps> = ({
  tokensUsed,
  tokenBudget
}) => {
  const percentage = Math.min(100, Math.round((tokensUsed / tokenBudget) * 100));

  return (
    <div className="flex items-center justify-between text-[11px] text-gray-500 font-sans px-1 py-1">
      <div className="flex items-center gap-2">
        <span>Tokens used: <strong className="text-gray-700">{tokensUsed} / {tokenBudget}</strong></span>
      </div>
      <div className="w-28 bg-gray-200 h-1.5 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${
            percentage > 90 ? 'bg-red-500' : percentage > 70 ? 'bg-amber-500' : 'bg-emerald-500'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};
