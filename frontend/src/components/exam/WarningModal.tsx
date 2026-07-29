import React from 'react';

interface WarningModalProps {
  isOpen: boolean;
  warnings: number;
  maxWarnings: number;
  reason: string;
  isTerminated: boolean;
  onResume: () => void;
  onExit: () => void;
}

export const WarningModal: React.FC<WarningModalProps> = ({
  isOpen,
  warnings,
  maxWarnings,
  reason,
  isTerminated,
  onResume,
  onExit
}) => {
  if (!isOpen) return null;

  const isLastWarning = warnings === maxWarnings - 1;

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-[99999] select-none pointer-events-auto">
      <div className="bg-zinc-950 border border-red-500/30 rounded-2xl p-8 max-w-md w-full shadow-2xl relative overflow-hidden text-center text-white">
        {/* Glow backdrop */}
        <div className={`absolute -top-24 -left-24 w-48 h-48 rounded-full filter blur-[80px] opacity-40 ${isTerminated || isLastWarning ? 'bg-red-600' : 'bg-amber-500'}`} />
        
        {/* Icon banner */}
        <div className="relative mb-6">
          {isTerminated ? (
            <div className="w-16 h-16 bg-red-500/10 border border-red-500/30 rounded-full flex items-center justify-center mx-auto text-red-500 animate-pulse">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
          ) : (
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto border animate-pulse ${
              isLastWarning 
                ? 'bg-red-500/10 border-red-500/30 text-red-500' 
                : 'bg-amber-500/10 border-amber-500/30 text-amber-500'
            }`}>
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          )}
        </div>

        {/* Title */}
        <h2 className="text-xl font-black tracking-tight mb-2">
          {isTerminated 
            ? 'Exam Terminated' 
            : isLastWarning 
              ? 'CRITICAL WARNING' 
              : 'Security Warning Issued'}
        </h2>

        {/* Description */}
        <p className="text-xs text-zinc-400 leading-relaxed mb-6">
          {isTerminated ? (
            <span>You have exceeded the maximum warning threshold of {maxWarnings} violations. Your active drafts have been locked and submitted.</span>
          ) : isLastWarning ? (
            <span>
              Warning <strong className="text-red-500 font-extrabold">{warnings} of {maxWarnings}</strong>. 
              Leaving the exam window or switching applications is recorded. 
              <strong> One more violation will automatically submit your contest.</strong>
            </span>
          ) : (
            <span>
              Warning <strong className="text-amber-500 font-extrabold">{warnings} of {maxWarnings}</strong>. 
              Your interface focus shifted. Ensure you stay inside this window until the exam is finished.
            </span>
          )}
        </p>

        {/* Context details */}
        {reason && (
          <div className="bg-white/5 border border-white/5 rounded-xl p-3 text-left mb-6 font-mono text-[10px] text-zinc-400">
            <span className="text-zinc-500 block uppercase font-bold text-[8px] mb-1">Detected activity:</span>
            {reason}
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          {isTerminated ? (
            <button 
              onClick={onExit}
              className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-extrabold rounded-xl transition text-xs select-none"
            >
              Exit to Dashboard
            </button>
          ) : (
            <button 
              onClick={onResume}
              className={`w-full py-3 font-extrabold rounded-xl transition text-xs select-none ${
                isLastWarning 
                  ? 'bg-red-600 hover:bg-red-700 text-white' 
                  : 'bg-[var(--accent-green)] hover:opacity-90 text-black'
              }`}
            >
              I Understand - Resume Exam
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
