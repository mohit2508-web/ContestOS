import React, { useState } from 'react';

export interface CodeBlockItem {
  id: string;
  code: string;
  isDistractor?: boolean;
}

interface InteractiveCodeOrderProps {
  blocks: CodeBlockItem[];
  orderedBlockIds: string[];
  onChangeOrder: (ids: string[]) => void;
}

export const InteractiveCodeOrder: React.FC<InteractiveCodeOrderProps> = ({
  blocks,
  orderedBlockIds,
  onChangeOrder,
}) => {
  // Initialize internal order if empty
  const currentItems = orderedBlockIds.length > 0
    ? orderedBlockIds.map((id) => blocks.find((b) => b.id === id)).filter(Boolean) as CodeBlockItem[]
    : blocks;

  const moveUp = (index: number) => {
    if (index <= 0) return;
    const newItems = [...currentItems];
    const temp = newItems[index - 1];
    newItems[index - 1] = newItems[index];
    newItems[index] = temp;
    onChangeOrder(newItems.map((item) => item.id));
  };

  const moveDown = (index: number) => {
    if (index >= currentItems.length - 1) return;
    const newItems = [...currentItems];
    const temp = newItems[index + 1];
    newItems[index + 1] = newItems[index];
    newItems[index] = temp;
    onChangeOrder(newItems.map((item) => item.id));
  };

  return (
    <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-[#1e293b] pb-3">
        <span className="text-xs uppercase font-extrabold text-teal-400 tracking-wider flex items-center space-x-2">
          <span>🧩 Code Re-Ordering</span>
        </span>
        <span className="text-[11px] text-slate-400">Use ▲ / ▼ buttons or drag to arrange logic</span>
      </div>

      <div className="space-y-2" role="list" aria-label="Re-order code blocks into correct algorithm">
        {currentItems.map((item, idx) => (
          <div
            key={item.id}
            role="listitem"
            className="flex items-center justify-between bg-[#080c14] border border-[#1e293b] hover:border-teal-500/40 p-3 rounded-xl transition-all group"
          >
            <div className="flex items-center space-x-3">
              <span className="text-xs font-mono font-bold text-slate-500 w-5">{idx + 1}.</span>
              <code className="text-xs font-mono text-teal-200">{item.code}</code>
              {item.isDistractor && (
                <span className="text-[9px] font-bold bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/20">
                  Distractor Option
                </span>
              )}
            </div>

            <div className="flex items-center space-x-1">
              <button
                type="button"
                onClick={() => moveUp(idx)}
                disabled={idx === 0}
                className="w-7 h-7 rounded-lg bg-[#1e293b] text-slate-300 hover:text-white disabled:opacity-30 text-xs font-bold flex items-center justify-center border border-[#334155]"
                aria-label={`Move line ${idx + 1} up`}
              >
                ▲
              </button>
              <button
                type="button"
                onClick={() => moveDown(idx)}
                disabled={idx === currentItems.length - 1}
                className="w-7 h-7 rounded-lg bg-[#1e293b] text-slate-300 hover:text-white disabled:opacity-30 text-xs font-bold flex items-center justify-center border border-[#334155]"
                aria-label={`Move line ${idx + 1} down`}
              >
                ▼
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
