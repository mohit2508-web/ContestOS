import React, { useState } from 'react';

interface CalibrationModalProps {
  isOpen: boolean;
  onComplete: () => void;
}

export const CalibrationModal: React.FC<CalibrationModalProps> = ({ isOpen, onComplete }) => {
  const [selectedOption, setSelectedOption] = useState<string>('opt-2');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#14161A]/95 backdrop-blur-md flex flex-col items-center justify-center p-4">
      {/* Top System Check Breadcrumb */}
      <div className="font-mono text-xs uppercase tracking-widest text-[#5B5F68] mb-4 flex items-center space-x-2">
        <span>SYSTEM CHECK</span>
        <span>›</span>
        <span className="text-[#C6A15B] font-semibold flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#C6A15B]" />
          CALIBRATION
        </span>
        <span>›</span>
        <span>TIMED SECTION</span>
      </div>

      {/* Bracket Panel Modal Card */}
      <div className="bracket-panel active max-w-2xl w-full p-8 bg-[#1B1E23] border border-[#2B2F37] rounded-[2px] shadow-2xl space-y-6">
        <span className="bl" />
        <span className="br" />

        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-[#2B2F37] pb-5">
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 rounded-[2px] bg-[#21252B] border border-[#2B2F37] flex items-center justify-center text-[#C6A15B]">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="9" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-['Fraunces'] font-medium text-[#ECE8E0]">Warm-Up Calibration</h2>
              <p className="text-xs text-[#8C9099] mt-1 max-w-md">
                An untimed practice question to confirm your controls before the section timer begins.
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-1.5 px-3 py-1 bg-[#6F9C7E]/10 border border-[#6F9C7E]/40 text-[#6F9C7E] text-[11px] font-mono font-bold rounded-[2px] uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-[#6F9C7E]" />
            <span>UNTIMED</span>
          </div>
        </div>

        {/* Practice Question Item */}
        <div className="space-y-4">
          <div className="font-mono text-[10px] uppercase tracking-[1.5px] text-[#C6A15B] flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-[#C6A15B] inline-block" />
            <span>PRACTICE ITEM · REF. 00</span>
          </div>

          <div className="text-base text-[#ECE8E0] font-normal leading-relaxed">
            Select option <strong className="text-[#ECE8E0] font-bold">B</strong>, or press key{' '}
            <kbd className="px-2 py-0.5 bg-[#21252B] border border-[#3A3F49] rounded-[2px] font-mono text-xs text-[#C6A15B]">2</kbd>{' '}
            , to confirm keyboard controls are working correctly.
          </div>

          {/* Options */}
          <div className="space-y-2.5">
            {[
              { id: 'opt-1', key: '1', label: 'Option A' },
              { id: 'opt-2', key: '2', label: 'Option B', recommended: true },
              { id: 'opt-3', key: '3', label: 'Option C' },
            ].map((opt) => {
              const isSelected = selectedOption === opt.id;
              return (
                <div
                  key={opt.id}
                  onClick={() => setSelectedOption(opt.id)}
                  className={`p-4 rounded-[2px] border text-sm font-medium cursor-pointer transition-all flex items-center justify-between ${
                    isSelected
                      ? 'bg-[#21252B] border-[#C6A15B] text-[#ECE8E0] shadow-[0_0_15px_rgba(198,161,91,0.12)]'
                      : 'bg-[#21252B]/60 border-[#2B2F37] text-[#8C9099] hover:border-[#3A3F49]'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <span>{opt.label}</span>
                    {opt.recommended && (
                      <span className="text-[10px] font-mono font-semibold uppercase px-2 py-0.5 bg-[#C6A15B]/10 text-[#C6A15B] border border-[#C6A15B]/40 rounded-[2px]">
                        RECOMMENDED
                      </span>
                    )}
                  </div>
                  <kbd className="w-6 h-6 rounded-[2px] bg-[#14161A] border border-[#2B2F37] flex items-center justify-center font-mono text-xs text-[#8C9099]">
                    {opt.key}
                  </kbd>
                </div>
              );
            })}
          </div>
        </div>

        {/* Shortcuts Cheat Sheet Summary */}
        <div className="grid grid-cols-3 gap-3 font-mono text-xs">
          <div className="bg-[#21252B] p-3.5 rounded-[2px] border border-[#2B2F37] text-center">
            <kbd className="px-2 py-1 bg-[#14161A] text-[#C6A15B] font-mono rounded-[2px] border border-[#2B2F37]">1–4</kbd>
            <p className="mt-2 text-[#8C9099] text-[11px]">Select option</p>
          </div>
          <div className="bg-[#21252B] p-3.5 rounded-[2px] border border-[#2B2F37] text-center">
            <kbd className="px-2 py-1 bg-[#14161A] text-[#C6A15B] font-mono rounded-[2px] border border-[#2B2F37]">F</kbd>
            <p className="mt-2 text-[#8C9099] text-[11px]">Flag for review</p>
          </div>
          <div className="bg-[#21252B] p-3.5 rounded-[2px] border border-[#2B2F37] text-center">
            <kbd className="px-2 py-1 bg-[#14161A] text-[#C6A15B] font-mono rounded-[2px] border border-[#2B2F37]">Enter</kbd>
            <p className="mt-2 text-[#8C9099] text-[11px]">Save & next</p>
          </div>
        </div>

        {/* Action Button */}
        <button
          type="button"
          onClick={onComplete}
          className="w-full py-3.5 bg-[#6F9C7E] hover:bg-[#5b8769] text-[#161311] font-bold text-xs uppercase tracking-wider rounded-[2px] transition-all flex items-center justify-center space-x-2 cursor-pointer"
        >
          <span>→</span>
          <span>START TIMED QUIZ SECTION</span>
        </button>
      </div>

      {/* Footer Note */}
      <p className="mt-4 font-mono text-xs text-[#5B5F68] text-center">
        Once started, the section timer cannot be paused
      </p>
    </div>
  );
};
