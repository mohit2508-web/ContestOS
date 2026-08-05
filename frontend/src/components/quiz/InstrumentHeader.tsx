import React, { useEffect, useState } from 'react';

interface InstrumentHeaderProps {
  sectionTitle: string;
  totalQuestions: number;
  totalAnswered: number;
  remainingMs: number;
  durationMinutes: number;
  flaggedCount: number;
  coords: { x: number; y: number };
  onSubmitSection: () => void;
  submitting: boolean;
}

export const InstrumentHeader: React.FC<InstrumentHeaderProps> = ({
  sectionTitle,
  totalQuestions,
  totalAnswered,
  remainingMs,
  durationMinutes,
  flaggedCount,
  coords,
  onSubmitSection,
  submitting,
}) => {
  const totalMs = durationMinutes * 60 * 1000;
  const CIRC = 100.5;
  const progressRatio = Math.max(0, Math.min(1, remainingMs / (totalMs || 1)));
  const strokeDashoffset = CIRC * (1 - progressRatio);

  const totalSec = Math.floor(remainingMs / 1000);
  const m = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const s = String(totalSec % 60).padStart(2, '0');
  const formattedTime = `${m}:${s}`;

  const isLowTime = progressRatio < 0.15;

  return (
    <header className="flex items-center justify-between px-7 py-4 border-b border-[#2B2F37] bg-gradient-to-b from-white/[0.02] to-transparent shrink-0">
      {/* Brand & Section Title */}
      <div className="flex items-baseline space-x-3">
        <span className="font-['Fraunces'] font-semibold text-xl tracking-wide text-[#C6A15B] flex items-center">
          <span className="mr-1.5 text-sm">◈</span>ContestOS
        </span>
        <span className="text-xs text-[#8C9099] font-medium">
          {sectionTitle}
        </span>
      </div>

      {/* Right Telemetry Controls */}
      <div className="flex items-center space-x-2.5">
        {/* Pacing Chip */}
        <div className="flex items-center space-x-2 px-3 py-1.5 bg-[#1B1E23] border border-[#2B2F37] rounded-[3px] text-xs text-[#8C9099] font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-[#6F9C7E] shadow-[0_0_6px_#6F9C7E]" />
          <div>
            <strong className="text-[#ECE8E0] font-semibold">On pace</strong>
            <div className="text-[10px] text-[#5B5F68] tracking-wider">
              {totalAnswered} / {totalQuestions} · 5:58 avg
            </div>
          </div>
        </div>

        {/* Flagged Chip */}
        <div className="flex items-center space-x-1.5 px-3 py-2 bg-[#1B1E23] border border-[#8A7343] rounded-[3px] text-xs text-[#C6A15B] font-mono">
          <span>◆</span>
          <span>{flaggedCount} Flagged</span>
        </div>

        {/* Real-time Cursor Coordinate Readout */}
        <div className="hidden md:flex items-center space-x-1 px-2.5 py-2 bg-[#1B1E23] border border-[#2B2F37] rounded-[3px] text-[10.5px] text-[#5B5F68] font-mono">
          <span>X</span>
          <span className="text-[#C6A15B] font-bold">{String(coords.x).padStart(4, '0')}</span>
          <span>· Y</span>
          <span className="text-[#C6A15B] font-bold">{String(coords.y).padStart(4, '0')}</span>
        </div>

        {/* SVG Circular Dial Timer */}
        <div className="flex items-center space-x-2.5 px-2.5 py-1.5 bg-[#1B1E23] border border-[#2B2F37] rounded-[3px]">
          <div className="relative w-[38px] h-[38px]">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 40 40">
              <circle className="fill-none stroke-[#3A3F49] stroke-[2]" cx="20" cy="20" r="16" />
              <circle
                className="fill-none stroke-[#C6A15B] stroke-[2] stroke-linecap-round transition-all duration-1000 ease-linear"
                style={{
                  strokeDasharray: '100.5',
                  strokeDashoffset: `${strokeDashoffset}`,
                  stroke: isLowTime ? '#C1543A' : '#C6A15B',
                  filter: isLowTime ? 'drop-shadow(0 0 4px rgba(193,84,58,0.5))' : 'drop-shadow(0 0 3px rgba(198,161,91,0.16))',
                }}
                cx="20"
                cy="20"
                r="16"
              />
            </svg>
          </div>
          <div>
            <div className="font-mono text-[13px] font-semibold text-[#ECE8E0] leading-tight">{formattedTime}</div>
            <div className="text-[9px] text-[#5B5F68] uppercase tracking-widest font-mono">Remaining</div>
          </div>
        </div>

        {/* Brass Metallic Submit Button */}
        <button
          type="button"
          onClick={onSubmitSection}
          disabled={submitting}
          className="btn-submit"
        >
          {submitting ? 'Submitting...' : 'Submit Section'}
        </button>
      </div>
    </header>
  );
};
