import React, { useState } from 'react';

interface ReadingGravityPassageProps {
  title?: string | null;
  content: string;
}

export const ReadingGravityPassage: React.FC<ReadingGravityPassageProps> = ({ title, content }) => {
  const paragraphs = content.split('\n\n').filter(Boolean);
  const [activeParagraphIdx, setActiveParagraphIdx] = useState(0);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const scrollRatio = target.scrollTop / (target.scrollHeight - target.clientHeight || 1);
    const calculatedIdx = Math.min(paragraphs.length - 1, Math.floor(scrollRatio * paragraphs.length));
    if (calculatedIdx !== activeParagraphIdx) {
      setActiveParagraphIdx(calculatedIdx);
    }
  };

  return (
    <div
      onScroll={handleScroll}
      className="w-full md:w-5/12 bg-[#030712] border-r border-[#1e293b] p-6 overflow-y-auto flex flex-col space-y-4"
    >
      <div className="flex items-center space-x-2 text-teal-400 text-xs uppercase font-extrabold tracking-wider">
        <span>📖 Reading Gravity</span>
        <span className="text-[10px] text-slate-500 font-normal">(Position-Aware Focus)</span>
      </div>

      <div className="bg-[#0f172a] p-5 rounded-2xl border border-[#1e293b] space-y-4">
        {paragraphs.map((para, idx) => {
          const isPassed = idx < activeParagraphIdx;
          const isCurrent = idx === activeParagraphIdx;

          return (
            <p
              key={idx}
              onClick={() => setActiveParagraphIdx(idx)}
              className={`text-sm leading-relaxed transition-opacity duration-300 cursor-pointer ${
                isCurrent
                  ? 'text-slate-100 font-medium opacity-100 border-l-2 border-teal-400 pl-3'
                  : isPassed
                  ? 'text-slate-400 opacity-60 hover:opacity-100 pl-3'
                  : 'text-slate-300 opacity-85 hover:opacity-100 pl-3'
              }`}
            >
              {para}
            </p>
          );
        })}
      </div>
    </div>
  );
};
