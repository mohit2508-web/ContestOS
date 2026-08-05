import React, { useState } from 'react';
import { ScratchpadCanvas } from './ScratchpadCanvas';
import { StrokeData } from '../../utils/vectorScratchpadEngine';

interface ScratchpadDockProps {
  attemptQuestionId: string;
  isOpen: boolean;
  onClose: () => void;
  savedStrokes?: StrokeData[];
  onSaveStrokes?: (strokes: StrokeData[]) => void;
}

export const ScratchpadDock: React.FC<ScratchpadDockProps> = (props) => {
  const [layoutMode, setLayoutMode] = useState<'dock' | 'modal'>('dock');

  if (!props.isOpen) return null;

  return (
    <div className="relative z-40">
      {/* Mode Switcher Toggle Pill Bar */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-[#1e293b] border border-cyan-500/40 rounded-full px-4 py-1.5 shadow-2xl flex items-center space-x-3 text-xs font-bold">
        <span className="text-cyan-400">✏️ Scratchpad Layout:</span>
        <button
          type="button"
          onClick={() => setLayoutMode('dock')}
          className={`px-3 py-1 rounded-full transition-all ${
            layoutMode === 'dock' ? 'bg-cyan-500 text-black' : 'text-slate-400 hover:text-white'
          }`}
        >
          Side Dock (Non-Blocking)
        </button>
        <button
          type="button"
          onClick={() => setLayoutMode('modal')}
          className={`px-3 py-1 rounded-full transition-all ${
            layoutMode === 'modal' ? 'bg-cyan-500 text-black' : 'text-slate-400 hover:text-white'
          }`}
        >
          Floating Window
        </button>
      </div>

      <ScratchpadCanvas {...props} />
    </div>
  );
};
