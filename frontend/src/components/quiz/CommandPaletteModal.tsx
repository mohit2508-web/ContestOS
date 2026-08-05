import React, { useState } from 'react';

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  questionsCount: number;
  onSelectQuestion: (index: number) => void;
  onToggleScratchpad: () => void;
  onToggleFocusMode: () => void;
  onToggleDyslexia: () => void;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  onClose,
  questionsCount,
  onSelectQuestion,
  onToggleScratchpad,
  onToggleFocusMode,
  onToggleDyslexia,
}) => {
  const [query, setQuery] = useState('');

  if (!isOpen) return null;

  const actions = [
    { id: 'act-scratchpad', label: 'Open Rough Scratchpad (Canvas)', icon: '✏️', run: onToggleScratchpad },
    { id: 'act-focus', label: 'Toggle Focus Mode (Dim non-essentials)', icon: '🎯', run: onToggleFocusMode },
    { id: 'act-dyslexia', label: 'Toggle Dyslexia High-Legibility Font', icon: 'Aa', run: onToggleDyslexia },
  ];

  // Generate question jump commands
  const questionCommands = Array.from({ length: questionsCount }, (_, i) => ({
    id: `q-${i + 1}`,
    label: `Jump to Question ${i + 1}`,
    icon: '❓',
    run: () => onSelectQuestion(i),
  }));

  const allItems = [...actions, ...questionCommands];
  const filtered = allItems.filter((item) => item.label.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-start justify-center pt-20 p-4">
      <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 space-y-2 p-3">
        {/* Spotlight Search Input */}
        <div className="flex items-center space-x-3 bg-[#1e293b] px-4 py-3 rounded-xl border border-teal-500/30">
          <span className="text-teal-400 font-bold text-sm">🔍</span>
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or jump to question... (Cmd+K)"
            className="w-full bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none font-medium"
          />
          <kbd className="px-2 py-0.5 bg-[#0f172a] text-[10px] text-slate-400 font-mono rounded border border-[#334155]">ESC</kbd>
        </div>

        {/* Results List */}
        <div className="max-h-72 overflow-y-auto space-y-1 py-1">
          {filtered.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-500">No matching commands found.</div>
          ) : (
            filtered.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  item.run();
                  onClose();
                }}
                className="flex items-center space-x-3 p-3 rounded-xl hover:bg-[#1e293b] text-slate-200 hover:text-teal-300 cursor-pointer transition-colors text-xs font-semibold"
              >
                <span className="text-base">{item.icon}</span>
                <span>{item.label}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
