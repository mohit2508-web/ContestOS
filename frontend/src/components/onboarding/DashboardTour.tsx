import { useState, useEffect, useRef, useCallback } from 'react';

const TOUR_KEY = 'kryptavia_dashboard_tour_v1';

interface TourStep {
  targetId: string;
  title: string;
  description: string;
  icon: string;
  position: 'top' | 'bottom' | 'left' | 'right';
  arrowSide: 'top' | 'bottom' | 'left' | 'right';
}

const STEPS: TourStep[] = [
  {
    targetId: 'tour-drives-section',
    title: 'Your Active Assessment Drives',
    description:
      'This is where all your scheduled exam drives appear. When a drive is LIVE, click "Enter Exam" to start your assessment. You can also join a private drive using a Secret Code.',
    icon: '🎯',
    position: 'bottom',
    arrowSide: 'top',
  },
  {
    targetId: 'tour-scorecards-tab',
    title: 'View Your Scorecards',
    description:
      'Click the "Scorecards" tab here to see your completed exam reports, scores, rank, and detailed performance breakdown after every assessment.',
    icon: '📁',
    position: 'bottom',
    arrowSide: 'top',
  },
];

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function getElementRect(id: string): SpotlightRect | null {
  const el = document.getElementById(id);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  return {
    top: rect.top + window.scrollY,
    left: rect.left + window.scrollX,
    width: rect.width,
    height: rect.height,
  };
}

interface TooltipPos {
  top: number;
  left: number;
}

function getTooltipPosition(
  rect: SpotlightRect,
  position: TourStep['position'],
  tooltipWidth: number,
  tooltipHeight: number
): TooltipPos {
  const pad = 16;
  switch (position) {
    case 'bottom':
      return {
        top: rect.top + rect.height + pad,
        left: Math.max(8, Math.min(rect.left + rect.width / 2 - tooltipWidth / 2, window.innerWidth - tooltipWidth - 8)),
      };
    case 'top':
      return {
        top: rect.top - tooltipHeight - pad,
        left: Math.max(8, Math.min(rect.left + rect.width / 2 - tooltipWidth / 2, window.innerWidth - tooltipWidth - 8)),
      };
    case 'right':
      return { top: rect.top + rect.height / 2 - tooltipHeight / 2, left: rect.left + rect.width + pad };
    case 'left':
      return { top: rect.top + rect.height / 2 - tooltipHeight / 2, left: rect.left - tooltipWidth - pad };
    default:
      return { top: rect.top + rect.height + pad, left: rect.left };
  }
}

export function DashboardTour() {
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(-1); // -1 = welcome modal
  const [spotlightRect, setSpotlightRect] = useState<SpotlightRect | null>(null);
  const [tooltipPos, setTooltipPos] = useState<TooltipPos>({ top: 0, left: 0 });
  const [visible, setVisible] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  const closeTour = useCallback(() => {
    setVisible(false);
    setTimeout(() => {
      setActive(false);
      setStep(-1);
      setSpotlightRect(null);
    }, 350);
    localStorage.setItem(TOUR_KEY, 'done');
  }, []);

  // On mount — check if first visit
  useEffect(() => {
    const seen = localStorage.getItem(TOUR_KEY);
    if (!seen) {
      const timer = setTimeout(() => {
        setActive(true);
        setVisible(true);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    if (!active) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeTour();
      if (e.key === 'ArrowRight' && step >= 0 && step < STEPS.length - 1) goNext();
      if (e.key === 'ArrowLeft' && step > 0) goPrev();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [active, step]);

  // Spotlight positioning
  useEffect(() => {
    if (!active || step < 0) return;

    const update = () => {
      const currentStep = STEPS[step];
      if (!currentStep) return;

      const rect = getElementRect(currentStep.targetId);
      if (!rect) return;

      const pad = 12;
      const paddedRect: SpotlightRect = {
        top: rect.top - pad,
        left: rect.left - pad,
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
      };
      setSpotlightRect(paddedRect);

      const tw = tooltipRef.current?.offsetWidth || 360;
      const th = tooltipRef.current?.offsetHeight || 180;
      const pos = getTooltipPosition(paddedRect, currentStep.position, tw, th);
      setTooltipPos(pos);

      // Scroll target into view
      const el = document.getElementById(currentStep.targetId);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    update();
    rafRef.current = window.requestAnimationFrame(update);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('resize', update);
      window.cancelAnimationFrame(rafRef.current);
    };
  }, [active, step]);

  const startTour = () => {
    setStep(0);
  };

  const goNext = () => {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      closeTour();
    }
  };

  const goPrev = () => {
    if (step > 0) setStep((s) => s - 1);
  };

  if (!active) return null;

  // ─── WELCOME MODAL (step === -1) ───────────────────────────────────────────
  if (step === -1) {
    return (
      <div
        className={`fixed inset-0 z-[9999] flex items-center justify-center p-4 transition-opacity duration-300 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)' }}
      >
        {/* Ambient glows */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

        <div
          className="relative bg-zinc-950 border border-white/10 rounded-3xl p-8 md:p-10 max-w-md w-full shadow-2xl"
          style={{
            animation: visible ? 'tourModalIn 0.5s cubic-bezier(0.34,1.56,0.64,1) both' : undefined,
          }}
        >
          {/* Logo / Icon */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-600 via-indigo-600 to-cyan-500 flex items-center justify-center shadow-2xl shadow-purple-500/30">
                <span className="text-3xl">🚀</span>
              </div>
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-purple-600 via-indigo-600 to-cyan-500 animate-ping opacity-20" />
            </div>
          </div>

          {/* Text */}
          <div className="text-center space-y-3 mb-8">
            <h2 className="text-2xl font-black text-white tracking-tight">
              Welcome to Kryptavia OS 👋
            </h2>
            <p className="text-gray-400 text-sm leading-relaxed">
              Let us give you a quick <strong className="text-white">2-step tour</strong> of your dashboard — so you always know where to find your exams and results.
            </p>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <button
              onClick={startTour}
              className="w-full py-3.5 bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 text-white font-black text-sm rounded-2xl transition-all shadow-lg shadow-purple-500/25 cursor-pointer"
            >
              Show me around 🎯
            </button>
            <button
              onClick={closeTour}
              className="w-full py-3 text-gray-500 hover:text-gray-300 text-sm font-medium transition cursor-pointer"
            >
              Skip, I'll explore myself →
            </button>
          </div>
        </div>

        <style>{`
          @keyframes tourModalIn {
            from { opacity: 0; transform: scale(0.92) translateY(16px); }
            to   { opacity: 1; transform: scale(1) translateY(0); }
          }
        `}</style>
      </div>
    );
  }

  const currentStep = STEPS[step];
  const isLast = step === STEPS.length - 1;

  // ─── SPOTLIGHT + TOOLTIP (steps 0, 1) ──────────────────────────────────────
  return (
    <>
      {/* Dark overlay with spotlight cutout */}
      <div
        className="fixed inset-0 z-[9990] pointer-events-none transition-opacity duration-300"
        style={{ opacity: visible ? 1 : 0 }}
      >
        {spotlightRect && (
          <svg
            className="absolute inset-0 w-full h-full"
            style={{ pointerEvents: 'none' }}
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <mask id="tour-spotlight-mask">
                <rect width="100%" height="100%" fill="white" />
                <rect
                  x={spotlightRect.left}
                  y={spotlightRect.top}
                  width={spotlightRect.width}
                  height={spotlightRect.height}
                  rx="16"
                  fill="black"
                />
              </mask>
            </defs>
            <rect
              width="100%"
              height="100%"
              fill="rgba(0,0,0,0.82)"
              mask="url(#tour-spotlight-mask)"
            />
            {/* Glow ring around spotlight */}
            <rect
              x={spotlightRect.left - 2}
              y={spotlightRect.top - 2}
              width={spotlightRect.width + 4}
              height={spotlightRect.height + 4}
              rx="18"
              fill="none"
              stroke="rgba(139,92,246,0.7)"
              strokeWidth="2"
              style={{ filter: 'drop-shadow(0 0 12px rgba(139,92,246,0.5))' }}
            />
          </svg>
        )}
      </div>

      {/* Click-through blocker on overlay */}
      <div
        className="fixed inset-0 z-[9991]"
        style={{ pointerEvents: spotlightRect ? 'none' : 'auto' }}
      />

      {/* Tooltip Card */}
      {spotlightRect && (
        <div
          ref={tooltipRef}
          className="fixed z-[9999] w-80 transition-all duration-300"
          style={{
            top: tooltipPos.top,
            left: tooltipPos.left,
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(10px)',
          }}
        >
          {/* Arrow */}
          {currentStep.arrowSide === 'top' && (
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rotate-45 bg-zinc-900 border-l border-t border-white/10" />
          )}

          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-5 shadow-2xl shadow-black/50">
            {/* Step counter */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest font-mono">
                Step {step + 1} of {STEPS.length}
              </span>
              <button
                onClick={closeTour}
                className="text-gray-600 hover:text-gray-400 text-xs transition cursor-pointer"
              >
                Skip tour ✕
              </button>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-white/5 rounded-full h-1 mb-4 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-cyan-500 rounded-full transition-all duration-500"
                style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
              />
            </div>

            {/* Content */}
            <div className="space-y-2 mb-5">
              <h3 className="font-black text-white text-sm flex items-center gap-2">
                <span>{currentStep.icon}</span>
                {currentStep.title}
              </h3>
              <p className="text-gray-400 text-xs leading-relaxed">
                {currentStep.description}
              </p>
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between gap-3">
              {step > 0 ? (
                <button
                  onClick={goPrev}
                  className="px-3 py-2 bg-white/5 hover:bg-white/10 text-gray-400 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  ← Back
                </button>
              ) : (
                <div />
              )}
              <button
                onClick={goNext}
                className="px-5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-black rounded-xl transition shadow-lg shadow-purple-600/20 cursor-pointer"
              >
                {isLast ? "Got it! ✓" : "Next →"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes tourPulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
      `}</style>
    </>
  );
}
