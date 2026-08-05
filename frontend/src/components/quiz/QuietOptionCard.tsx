import React from 'react';

interface QuietOptionCardProps {
  index: number;
  content: string;
  isSelected: boolean;
  isMulti: boolean;
  confidenceLevel?: 'LOW' | 'MED' | 'HIGH' | null;
  onSelect: () => void;
  onSetConfidence?: (level: 'LOW' | 'MED' | 'HIGH') => void;
}

export const QuietOptionCard: React.FC<QuietOptionCardProps> = ({
  index,
  content,
  isSelected,
  isMulti,
  confidenceLevel,
  onSelect,
  onSetConfidence,
}) => {
  return (
    <div
      className={`rounded-2xl border transition-all duration-150 p-4 space-y-3 ${
        isSelected
          ? 'bg-[#0f172a] border-teal-400 text-teal-100 shadow-[0_0_20px_rgba(45,212,191,0.12)]'
          : 'bg-[#0f172a]/60 border-[#1e293b] text-slate-300 hover:border-slate-600 hover:bg-[#0f172a]'
      }`}
    >
      <div className="flex items-center cursor-pointer" onClick={onSelect}>
        <div className="w-6 h-6 rounded-lg bg-[#030712] border border-slate-700 text-xs font-mono font-bold text-teal-400 flex items-center justify-center mr-3">
          {index + 1}
        </div>
        <div
          className={`w-5 h-5 rounded-${isMulti ? 'md' : 'full'} border flex items-center justify-center mr-4 transition-all ${
            isSelected ? 'bg-teal-400 border-teal-400 text-black font-bold' : 'border-slate-600'
          }`}
        >
          {isSelected && <span className="text-xs font-extrabold">✓</span>}
        </div>
        <span className="text-sm font-medium flex-1">{content}</span>
        {isSelected && (
          <span className="text-[11px] font-bold text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/20">
            Saved ✓
          </span>
        )}
      </div>

      {/* Confidence-Weighted Answering Micro-Selector */}
      {isSelected && onSetConfidence && (
        <div className="pt-2 border-t border-[#1e293b] flex items-center justify-between text-xs animate-fade-in">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            How sure are you?
          </span>
          <div className="flex items-center space-x-1.5">
            {(['LOW', 'MED', 'HIGH'] as const).map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => onSetConfidence(lvl)}
                className={`px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold transition-all ${
                  confidenceLevel === lvl
                    ? 'bg-teal-400 text-black shadow-sm'
                    : 'bg-[#030712] text-slate-400 border border-[#1e293b] hover:text-white'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
