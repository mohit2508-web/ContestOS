import React from 'react';
import { TimerProgressRing } from './TimerProgressRing';
import { SectionPacingIndicator } from './SectionPacingIndicator';

interface MaterialHonestyHeaderProps {
  sectionTitle: string;
  totalQuestions: number;
  totalAnswered: number;
  remainingMs: number;
  durationMinutes: number;
  lastSavedTime: number | null;
  flaggedCount: number;
  isSpeaking: boolean;
  dyslexicFont: boolean;
  colorblindMode: boolean;
  onReadAloud: () => void;
  onToggleDyslexia: () => void;
  onToggleColorblind: () => void;
  onSubmitSection: () => void;
  submitting: boolean;
}

export const MaterialHonestyHeader: React.FC<MaterialHonestyHeaderProps> = ({
  sectionTitle,
  totalQuestions,
  totalAnswered,
  remainingMs,
  durationMinutes,
  lastSavedTime,
  flaggedCount,
  isSpeaking,
  dyslexicFont,
  colorblindMode,
  onReadAloud,
  onToggleDyslexia,
  onToggleColorblind,
  onSubmitSection,
  submitting,
}) => {
  return (
    <header className="h-16 bg-[#0f172a] border-b border-[#1e293b] px-6 flex items-center justify-between shadow-lg shrink-0 z-10">
      <div className="flex items-center space-x-4">
        <span className="text-teal-400 font-black text-lg tracking-wider">Kryptavia OS</span>
        <span className="text-slate-700">|</span>
        <h1 className="font-semibold text-slate-200 text-sm md:text-base">{sectionTitle}</h1>
        <SectionPacingIndicator
          totalQuestions={totalQuestions}
          totalAnswered={totalAnswered}
          remainingMs={remainingMs}
          totalDurationMinutes={durationMinutes}
        />
      </div>

      <div className="flex items-center space-x-4">
        {/* Material Honesty Real System Telemetry Label */}
        <div className="hidden lg:flex items-center space-x-2 text-[11px] font-bold text-slate-400 bg-[#030712] px-3 py-1 rounded-xl border border-[#1e293b]">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>Camera: Active</span>
          <span className="text-slate-700">|</span>
          <span className="text-emerald-400 font-mono">
            {lastSavedTime ? `Saved ${new Date(lastSavedTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Sync Ready'}
          </span>
        </div>

        {/* Accessibility Controls */}
        <div className="flex items-center space-x-2 bg-[#030712] px-3 py-1 rounded-xl border border-[#1e293b] text-xs">
          <button
            type="button"
            onClick={onReadAloud}
            className={`px-2 py-1 rounded font-bold transition-all ${isSpeaking ? 'bg-teal-400 text-black animate-pulse' : 'text-slate-400 hover:text-white'}`}
            title="Speech Read-Aloud"
          >
            {isSpeaking ? '🔊 Reading...' : '🔊 Read'}
          </button>
          <span className="text-slate-700">|</span>
          <button
            type="button"
            onClick={onToggleDyslexia}
            className={`px-2 py-1 rounded font-bold ${dyslexicFont ? 'bg-amber-500/20 text-amber-400' : 'text-slate-400 hover:text-white'}`}
            title="Dyslexia Font"
          >
            Aa
          </button>
          <span className="text-slate-700">|</span>
          <button
            type="button"
            onClick={onToggleColorblind}
            className={`px-2 py-1 rounded font-bold ${colorblindMode ? 'bg-purple-500/20 text-purple-400' : 'text-slate-400 hover:text-white'}`}
            title="Colorblind Mode"
          >
            👁️
          </button>
        </div>

        {/* Flagged Count */}
        <div className="flex items-center space-x-2 text-xs font-semibold bg-amber-500/10 text-amber-400 px-3 py-1.5 rounded-lg border border-amber-500/20">
          <span>⚑</span>
          <span>{flaggedCount} Flagged</span>
        </div>

        {/* Tabular Numeral Timer */}
        <div className="tabular-nums">
          <TimerProgressRing remainingMs={remainingMs} totalDurationMinutes={durationMinutes} />
        </div>

        {/* Submit Button */}
        <button
          type="button"
          onClick={onSubmitSection}
          disabled={submitting}
          className="bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs md:text-sm px-4 py-2 rounded-xl transition-all shadow-lg shadow-emerald-500/20 active:scale-95 cursor-pointer"
        >
          {submitting ? 'Submitting...' : '🔒 Submit Section'}
        </button>
      </div>
    </header>
  );
};
