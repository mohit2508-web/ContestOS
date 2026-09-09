import { useState, useEffect, useRef, useCallback } from 'react';

const TOUR_KEY = 'kryptavia_dashboard_tour_v3';

interface TourStep {
  targetId: string;
  title: string;
  description: string;
  position: 'top' | 'bottom' | 'left' | 'right';
}

const STEPS: TourStep[] = [
  {
    targetId: 'tour-drives-section',
    title: 'Active Drives & Exam Registration',
    description:
      'All live and upcoming exam drives appear here. Click "Register 🎯" to enroll in an assessment, or "Enter Exam ⚡" when your test window is live. You can also join private drives using "🎟️ Join by Secret Code".',
    position: 'bottom',
  },
  {
    targetId: 'tour-scorecards-tab',
    title: 'View Performance & Scorecards',
    description:
      'Access your evaluation reports, rankings, sectionwise analysis, and proctoring logs anytime from this tab in the sidebar.',
    position: 'bottom',
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
    top: rect.top,
    left: rect.left,
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
  const pad = 14;
  let top = rect.top + rect.height + pad;
  let left = Math.max(16, Math.min(rect.left + rect.width / 2 - tooltipWidth / 2, window.innerWidth - tooltipWidth - 16));

  // If bottom placement overflows viewport height, flip to top position above element
  if (top + tooltipHeight > window.innerHeight - 16) {
    top = rect.top - tooltipHeight - pad;
  }

  // Strict viewport boundaries to guarantee tooltip is never clipped
  top = Math.max(16, Math.min(top, window.innerHeight - tooltipHeight - 16));
  left = Math.max(16, Math.min(left, window.innerWidth - tooltipWidth - 16));

  return { top, left };
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
    }, 250);
    localStorage.setItem(TOUR_KEY, 'completed');
  }, []);

  // Trigger for first-time visitors
  useEffect(() => {
    const seen = localStorage.getItem(TOUR_KEY);
    if (!seen) {
      const timer = setTimeout(() => {
        setActive(true);
        setVisible(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  // Keyboard navigation
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

  // Position calculation and scroll centering
  useEffect(() => {
    if (!active || step < 0) return;

    const update = () => {
      const currentStep = STEPS[step];
      if (!currentStep) return;

      const rect = getElementRect(currentStep.targetId);
      if (!rect) return;

      const pad = 10;
      const paddedRect: SpotlightRect = {
        top: rect.top - pad,
        left: rect.left - pad,
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
      };
      setSpotlightRect(paddedRect);

      const tw = tooltipRef.current?.offsetWidth || 340;
      const th = tooltipRef.current?.offsetHeight || 160;
      const pos = getTooltipPosition(paddedRect, currentStep.position, tw, th);
      setTooltipPos(pos);
    };

    // Scroll element into view smoothly on step change
    const currentStep = STEPS[step];
    if (currentStep) {
      const el = document.getElementById(currentStep.targetId);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    update();
    rafRef.current = window.requestAnimationFrame(update);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
      window.cancelAnimationFrame(rafRef.current);
    };
  }, [active, step]);

  const startTour = () => setStep(0);
  const goNext = () => (step < STEPS.length - 1 ? setStep((s) => s + 1) : closeTour());
  const goPrev = () => (step > 0 ? setStep((s) => s - 1) : null);

  if (!active) return null;

  // ─── WELCOME DIALOG (step === -1) ──────────────────────────────────────────
  if (step === -1) {
    return (
      <div
        className={`fixed inset-0 z-[9999] flex items-center justify-center p-4 transition-all duration-300 ${
          visible ? 'opacity-100 backdrop-blur-md' : 'opacity-0 backdrop-blur-none'
        }`}
        style={{ background: 'rgba(9, 9, 11, 0.8)' }}
      >
        <div
          className="relative bg-zinc-950 border border-zinc-800/80 rounded-2xl p-7 max-w-sm w-full shadow-2xl space-y-5"
          style={{
            transform: visible ? 'translateY(0) scale(1)' : 'translateY(8px) scale(0.98)',
            transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease',
          }}
        >
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-[11px] font-mono text-zinc-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Candidate Portal Guide</span>
            </div>
            <button
              onClick={closeTour}
              className="text-zinc-500 hover:text-zinc-300 text-xs transition p-1 cursor-pointer"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-bold text-white tracking-tight">
              Welcome to Kryptavia OS
            </h2>
            <p className="text-zinc-400 text-xs leading-relaxed">
              Take a quick 2-step tour to learn how to register for live assessment drives and access your performance scorecards.
            </p>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={startTour}
              className="flex-1 py-2.5 px-4 bg-white hover:bg-zinc-200 text-zinc-950 font-semibold text-xs rounded-xl transition cursor-pointer shadow-sm text-center"
            >
              Take Quick Tour
            </button>
            <button
              onClick={closeTour}
              className="py-2.5 px-4 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 font-medium text-xs rounded-xl border border-zinc-800 transition cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentStep = STEPS[step];
  const isLast = step === STEPS.length - 1;

  // ─── SPOTLIGHT & TOOLTIP CARD (steps 0, 1) ──────────────────────────────────
  return (
    <>
      {/* Dark Backdrop with Spotlight Cutout */}
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
                  rx="12"
                  fill="black"
                />
              </mask>
            </defs>
            <rect
              width="100%"
              height="100%"
              fill="rgba(9, 9, 11, 0.78)"
              mask="url(#tour-spotlight-mask)"
            />
            <rect
              x={spotlightRect.left - 1}
              y={spotlightRect.top - 1}
              width={spotlightRect.width + 2}
              height={spotlightRect.height + 2}
              rx="13"
              fill="none"
              stroke="rgba(255, 255, 255, 0.25)"
              strokeWidth="1.5"
            />
          </svg>
        )}
      </div>

      <div className="fixed inset-0 z-[9991]" style={{ pointerEvents: 'none' }} />

      {/* Viewport-guaranteed Tooltip Card */}
      {spotlightRect && (
        <div
          ref={tooltipRef}
          className="fixed z-[9999] w-80 transition-all duration-150"
          style={{
            top: tooltipPos.top,
            left: tooltipPos.left,
            opacity: visible ? 1 : 0,
          }}
        >
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 shadow-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-medium text-emerald-400">
                Step {step + 1} of {STEPS.length}
              </span>
              <button
                onClick={closeTour}
                className="text-zinc-500 hover:text-zinc-300 text-xs transition cursor-pointer"
              >
                Skip
              </button>
            </div>

            <div className="space-y-1.5">
              <h3 className="font-bold text-white text-xs">
                {currentStep.title}
              </h3>
              <p className="text-zinc-300 text-[11px] leading-relaxed">
                {currentStep.description}
              </p>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-zinc-900">
              {step > 0 ? (
                <button
                  onClick={goPrev}
                  className="px-2.5 py-1 text-zinc-400 hover:text-white text-xs font-medium transition cursor-pointer"
                >
                  Previous
                </button>
              ) : (
                <div />
              )}
              <button
                onClick={goNext}
                className="px-3.5 py-1.5 bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-bold rounded-lg transition shadow-sm cursor-pointer ml-auto"
              >
                {isLast ? 'Got it! ✓' : 'Next →'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
