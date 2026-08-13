import React, { useEffect, useState } from 'react';

interface WarningModalProps {
  isOpen: boolean;
  warnings: number;
  maxWarnings: number;
  reason: string;
  proctorName?: string;
  isTerminated: boolean;
  onResume: () => void;
  onExit: () => void;
}

export const WarningModal: React.FC<WarningModalProps> = ({
  isOpen,
  warnings,
  maxWarnings,
  reason,
  proctorName,
  isTerminated,
  onResume,
  onExit,
}) => {
  const HOLD_SECONDS = 5;
  const [secondsLeft, setSecondsLeft] = useState(HOLD_SECONDS);
  const [isReady, setIsReady] = useState(false);
  const [evidenceId, setEvidenceId] = useState('');
  const [loggedTime, setLoggedTime] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    // Reset countdown and generate session evidence metadata when modal opens
    setSecondsLeft(HOLD_SECONDS);
    setIsReady(false);
    setLoggedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    setEvidenceId(`EV-${Math.floor(1000 + Math.random() * 9000)}`);

    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setIsReady(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen]);

  if (!isOpen) return null;

  const maxVal = Math.max(3, maxWarnings || 3);
  const isLastWarning = warnings >= maxVal - 1;
  const progressPercent = Math.min(100, Math.max(0, ((HOLD_SECONDS - secondsLeft) / HOLD_SECONDS) * 100));

  return (
    <>
      {/* Screen-Edge Danger Red Glow Inset Backdrop */}
      <div className="fixed inset-0 z-[99990] pointer-events-none transition-all duration-500">
        <div className="absolute inset-0 shadow-[inset_0_0_120px_12px_rgba(255,59,78,0.35)] animate-pulse" />
      </div>

      {/* Dimmed Modal Overlay */}
      <div className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 select-none font-sans">
        <div className="w-[420px] max-w-full bg-[#131215] border border-rose-500/40 rounded-2xl overflow-hidden shadow-[0_0_0_1px_rgba(0,0,0,0.5),0_40px_90px_-20px_rgba(0,0,0,0.85),0_0_90px_-6px_rgba(255,59,78,0.3)] animate-in fade-in zoom-in-95 duration-200 text-white">
          {/* Top Hazard Stripe Bar */}
          <div className="h-2 w-full bg-[repeating-linear-gradient(135deg,#FF3B4E_0_10px,#1a1214_10px_20px)]" />

          {/* Modal Header with Dual Radar Ping Icon */}
          <div className="flex flex-col items-center text-center p-6 pb-3">
            {/* Dual Pulsing Radar Rings around Danger Icon */}
            <div className="relative w-16 h-16 mb-4 flex items-center justify-center">
              <span className="absolute inset-0 rounded-full border-2 border-rose-500 animate-ping opacity-60" />
              <span className="absolute inset-0 rounded-full border-2 border-rose-500 animate-ping opacity-40 [animation-delay:0.5s]" />
              <div className="w-13 h-13 rounded-full bg-[#7A1420] text-[#FF3B4E] flex items-center justify-center relative z-10 shadow-[0_0_24px_-4px_rgba(255,59,78,0.7)]">
                {isTerminated ? (
                  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                ) : (
                  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" strokeWidth={2.4} strokeLinecap="round" />
                    <line x1="12" y1="17" x2="12.01" y2="17" strokeWidth={2.4} strokeLinecap="round" />
                  </svg>
                )}
              </div>
            </div>

            {/* Eyebrow & Main Title */}
            <div className="text-[10.5px] font-extrabold tracking-[0.16em] text-[#FF3B4E] uppercase mb-1">
              {isTerminated ? 'SESSION TERMINATED' : isLastWarning ? 'FINAL WARNING' : `PROCTOR WARNING ${warnings} OF ${maxVal}`}
            </div>
            <h2 className="text-xl font-bold tracking-tight text-white mb-1">
              {isTerminated ? 'Exam Disqualified' : 'Exam Integrity Violation'}
            </h2>
            <p className="text-xs text-zinc-400 font-medium">
              This exam session is under active invigilator review
            </p>
          </div>

          {/* Modal Body */}
          <div className="px-6 space-y-4">
            {/* Custom Violation Reason Text Box */}
            <div className="p-3 bg-[#191719] border border-[#2A2426] rounded-xl text-xs text-zinc-300 leading-relaxed text-center font-medium">
              {reason || 'Your proctor has flagged security violations. This event has been logged to your session record along with timestamped telemetry.'}
            </div>

            {/* Stakes Banner */}
            {!isTerminated && (
              <div className="flex items-center gap-3 bg-gradient-to-r from-rose-500/15 to-rose-500/5 border border-rose-500/30 rounded-xl p-3">
                <div className="text-rose-500 shrink-0">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <circle cx="12" cy="12" r="10" strokeWidth={2} />
                    <line x1="12" y1="8" x2="12" y2="12" strokeWidth={2} strokeLinecap="round" />
                    <line x1="12" y1="16" x2="12.01" y2="16" strokeWidth={2} strokeLinecap="round" />
                  </svg>
                </div>
                <div className="text-xs text-zinc-200 leading-snug">
                  One more flagged violation will <strong className="text-rose-400 font-bold">auto-submit your exam</strong> and refer this session for admin review.
                </div>
              </div>
            )}

            {/* Warning Count Dots Row */}
            <div className="flex justify-center gap-2 py-1">
              {Array.from({ length: maxVal }).map((_, i) => {
                const isFilled = i < warnings;
                return (
                  <div
                    key={i}
                    className={`w-6 h-1.5 rounded-full transition-all duration-300 ${
                      isFilled
                        ? 'bg-[#FF3B4E] shadow-[0_0_8px_rgba(255,59,78,0.6)]'
                        : 'bg-zinc-800 border border-white/5'
                    }`}
                  />
                );
              })}
            </div>

            {/* Session Metadata Row */}
            <div className="flex justify-center gap-4 text-[10.5px] text-zinc-500 font-mono tracking-wide">
              <span>Logged <strong className="text-zinc-300 font-medium">{loggedTime}</strong></span>
              <span>Evidence <strong className="text-zinc-300 font-medium">#{evidenceId}</strong></span>
              <span>Invigilator <strong className="text-zinc-300 font-medium">{proctorName || 'Proctor System'}</strong></span>
            </div>
          </div>

          {/* Modal Footer: 5-Second Mandatory Countdown Button */}
          <div className="p-6 pt-4">
            {isTerminated ? (
              <button
                type="button"
                onClick={onExit}
                className="w-full py-3.5 bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs rounded-xl shadow-lg transition cursor-pointer uppercase tracking-wider"
              >
                Exit to Dashboard
              </button>
            ) : (
              <button
                type="button"
                disabled={!isReady}
                onClick={() => {
                  if (isReady) onResume();
                }}
                className={`relative w-full py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider overflow-hidden transition-all duration-300 ${
                  isReady
                    ? 'bg-[#FF3B4E] hover:brightness-110 text-black font-black cursor-pointer shadow-[0_0_24px_rgba(255,59,78,0.4)]'
                    : 'bg-[#201D1F] text-zinc-500 cursor-not-allowed border border-white/10'
                }`}
              >
                {/* Countdown Fill Progress Bar */}
                <div
                  className="absolute left-0 top-0 bottom-0 bg-rose-500/20 transition-all duration-1000 ease-linear pointer-events-none"
                  style={{ width: `${progressPercent}%` }}
                />
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {isReady ? (
                    <>
                      <span>Acknowledge and Resume</span>
                      <span>→</span>
                    </>
                  ) : (
                    <span>Read notice — {secondsLeft}</span>
                  )}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
