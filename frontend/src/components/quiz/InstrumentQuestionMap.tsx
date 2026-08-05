import React from 'react';

interface InstrumentQuestionMapProps {
  questionsCount: number;
  currentIndex: number;
  totalAnswered: number;
  answers: Record<string, any>;
  questions: any[];
  onSelectIndex: (idx: number) => void;
}

export const InstrumentQuestionMap: React.FC<InstrumentQuestionMapProps> = ({
  questionsCount,
  currentIndex,
  totalAnswered,
  answers,
  questions,
  onSelectIndex,
}) => {
  return (
    <div className="flex flex-col justify-between h-full">
      <div>
        <div className="flex items-center justify-between mb-4">
          <span className="font-mono text-[11px] tracking-[1.5px] text-[#8C9099] uppercase">Question Map</span>
          <span className="font-mono text-[11px] text-[#C6A15B]">{totalAnswered}/{questionsCount}</span>
        </div>

        <div className="grid grid-cols-4 gap-2 mb-7">
          {questions.map((q, idx) => {
            const ans = answers[q.attemptQuestionId];
            const isAnswered = ans && (ans.selectedOptionIds.length > 0 || ans.numericAnswer !== '' || ans.textAnswer !== '');
            const isFlagged = ans?.flaggedForReview;
            const isCurrent = idx === currentIndex;

            return (
              <div
                key={q.attemptQuestionId}
                onClick={() => onSelectIndex(idx)}
                className={`node aspect-square flex items-center justify-center font-mono text-xs font-semibold rounded-[2px] cursor-pointer transition-all ${
                  isCurrent
                    ? 'current border-[#C6A15B] text-[#C6A15B] bg-[#C6A15B]/20 shadow-[inset_0_0_0_1px_#C6A15B]'
                    : isFlagged
                    ? 'flagged border-[#C1543A] text-[#C1543A]'
                    : isAnswered
                    ? 'answered border-[#6F9C7E] text-[#6F9C7E]'
                    : 'bg-[#1B1E23] border-[#2B2F37] text-[#8C9099] hover:border-[#3A3F49]'
                }`}
              >
                {String(idx + 1).padStart(2, '0')}
              </div>
            );
          })}
        </div>

        <div className="legend space-y-2.5 text-[11.5px] text-[#8C9099]">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-[1px] bg-[#6F9C7E]" />
            <span>Answered</span>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-[1px] bg-[#C1543A]" />
            <span>Flagged for review</span>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-[1px] bg-[#3A3F49]" />
            <span>Unanswered</span>
          </div>
        </div>

        <div className="h-[1px] bg-[#2B2F37] my-5" />
      </div>

      <div className="font-mono text-[11px] text-[#5B5F68] leading-[1.9]">
        SESSION &nbsp;<span className="text-[#ECE8E0]">00:02:04</span><br />
        AVG / ITEM &nbsp;<span className="text-[#6F9C7E]">00:24</span><br />
        TARGET &nbsp;<span className="text-[#ECE8E0]">00:36 / item</span>
      </div>
    </div>
  );
};
