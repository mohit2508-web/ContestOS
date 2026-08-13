/**
 * ExamFlowModals — 5-phase exam flow for ContestZone ProblemsTab.
 *
 * Phase 1 — PreExamInstructionsModal  (rules gate, countdown button)
 * Phase 2 — FinishExamFAB             (floating action, timer ring)
 * Phase 3 — ExamSummaryModal          (stats + per-problem grid)
 * Phase 4 — FinalConfirmModal         ("FINAL SUBMIT" gate)
 * Phase 5 — PostSubmitSummary         (score reveal, 3D trophy, confetti)
 *
 * Shared internals:
 *   RotatingGlowRing  — CSS conic-gradient spinning border
 *   CircularProgress  — SVG stroke-dashoffset ring
 */
import React, {
  lazy,
  Suspense,
  useState,
  useEffect,
  useRef,
  useMemo,
} from 'react';
import { motion, useSpring, useMotionValue, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
const fireConfetti = () => {
  try {
    if (typeof window !== 'undefined' && (window as any).confetti) {
      (window as any).confetti({ particleCount: 40, spread: 60 });
    }
  } catch (_e) {}
};
import { useTilt3D } from '../hooks/useTilt3D';
import { api } from '../services/api';
import { useGlassShatter } from './GlassShatter';

const RankReveal3D = lazy(() => import('./RankReveal3D'));

/* ═══════════════════════════════════════════════════════════════════
   Shared — RotatingGlowRing
   ═══════════════════════════════════════════════════════════════════ */

function RotatingGlowRing({
  color = '#ef4444',
  static: isStatic = false,
  children,
}: {
  color?: string;
  static?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`exam-glow-ring rounded-xl ${isStatic ? '' : ''}`}
      style={{ '--glow-color': color } as React.CSSProperties}
    >
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Shared — CircularProgress (SVG ring)
   ═══════════════════════════════════════════════════════════════════ */

function CircularProgress({
  value,
  size = 48,
  stroke = 3,
  color = '#22d3ee',
  bg = 'rgba(255,255,255,0.06)',
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  bg?: string;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (value / 100) * circ;

  return (
    <svg width={size} height={size} className="absolute inset-0 -rotate-90 pointer-events-none">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={bg} strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 0.3s ease' }}
      />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Phase 1 — PreExamInstructionsModal
   ═══════════════════════════════════════════════════════════════════ */

const RULES = [
  { icon: '🖥️', title: 'Full-Screen Required', desc: 'Exit full-screen triggers warnings. Exceeding limits auto-submits.' },
  { icon: '🚫', title: 'No Tab Switching', desc: 'Every tab switch is logged and counts toward your violation threshold.' },
  { icon: '📋', title: 'No Copy-Paste', desc: 'Clipboard access is blocked or logged. External paste is flagged.' },
  { icon: '📷', title: 'Camera Always On', desc: 'Proctoring snapshots verify face presence. Missing face = violation.' },
  { icon: '🧠', title: 'AI Detection Active', desc: 'Extensions, screen-sharing, and suspicious tools are detected in real time.' },
  { icon: '⏱️', title: 'Auto-Finalize on Timeout', desc: 'Your submitted answers are saved. Drafts are auto-submitted at expiry.' },
];

function RuleCard({ rule }: { rule: { icon: string; title: string; desc: string } }) {
  const { ref: tiltRef, style: tiltStyle, onMouseMove, onMouseLeave } = useTilt3D(4);
  return (
    <motion.div
      ref={tiltRef}
      style={tiltStyle}
      variants={{
        hidden: { y: 24, opacity: 0, scale: 0.94 },
        visible: { y: 0, opacity: 1, scale: 1 },
      }}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      className="relative bg-zinc-950/60 border border-white/5 rounded-2xl p-4 flex gap-3 items-start"
    >
      <span className="text-xl shrink-0 mt-0.5">{rule.icon}</span>
      <div>
        <h4 className="text-xs font-extrabold text-white">{rule.title}</h4>
        <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">{rule.desc}</p>
      </div>
    </motion.div>
  );
}

export function PreExamInstructionsModal({ onProceed }: { onProceed: () => void }) {
  const [countdown, setCountdown] = useState(5);
  const countdownDone = countdown <= 0;

  useEffect(() => {
    if (countdownDone) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, countdownDone]);

  return (
    <motion.div
      className="fixed inset-0 z-[200] flex items-center justify-center backdrop-blur-2xl bg-black/70"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.18 }}
    >
      <motion.div
        className="relative w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto rounded-3xl bg-zinc-900/90 border border-white/10 p-8 space-y-6"
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 24 }}
      >
        {/* Header */}
        <div className="text-center space-y-2">
          <span className="text-3xl block">📋</span>
          <h2 className="text-xl font-black text-white tracking-tight">Exam Rules & Instructions</h2>
          <p className="text-xs text-gray-400">Read carefully before starting. Violations carry penalties.</p>
        </div>

        {/* Rule cards grid */}
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 gap-3"
          initial="hidden"
          animate="visible"
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.07 } } }}
        >
          {RULES.map((rule, i) => (
            <RuleCard key={i} rule={rule} />
          ))}
        </motion.div>

        {/* DontCheat block */}
        <div className="rounded-2xl overflow-hidden">
          <RotatingGlowRing color="#ef4444">
            <div className="bg-red-950/30 p-4 rounded-2xl space-y-1">
              <p className="text-xs font-extrabold text-red-400 flex items-center gap-1.5">
                ⚠️ Fair Exam Commitment
              </p>
              <p className="text-[11px] text-red-300/70 leading-relaxed">
                By proceeding you confirm you will not use external aids, AI assistants, or communication tools. Violations are permanently logged on your academic record.
              </p>
            </div>
          </RotatingGlowRing>
        </div>

        {/* Countdown button */}
        <div className="flex justify-center pt-2">
          <div className="relative inline-flex items-center justify-center">
            {!countdownDone && (
              <CircularProgress
                value={((5 - countdown) / 5) * 100}
                size={64}
                stroke={3}
                color="#a855f7"
              />
            )}
            <motion.button
              onClick={onProceed}
              disabled={!countdownDone}
              className={`relative z-10 w-14 h-14 rounded-full flex items-center justify-center font-black text-sm transition ${
                countdownDone
                  ? 'bg-violet-500 text-white cursor-pointer'
                  : 'bg-white/5 text-gray-600 cursor-not-allowed'
              }`}
              animate={countdownDone ? { scale: [1, 1.12, 1] } : {}}
              transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            >
              {countdownDone ? '▶' : countdown}
            </motion.button>
          </div>
        </div>
        {countdownDone && (
          <p className="text-center text-[10px] text-violet-400 font-bold -mt-2">Click to begin your exam</p>
        )}
      </motion.div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Phase 2 — FinishExamFAB
   ═══════════════════════════════════════════════════════════════════ */

export function FinishExamFAB({
  contest,
  onFinish,
}: {
  contest: { startTime: string; endTime: string };
  onFinish: () => void;
}) {
  const [timeLeftMs, setTimeLeftMs] = useState(0);
  const totalMs = useMemo(() => {
    if (!contest?.endTime) return 1;
    return new Date(contest.endTime).getTime() - new Date(contest.startTime).getTime() || 1;
  }, [contest]);
  const shookRef = useRef(false);
  const prefersReduced = useMemo(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  );

  useEffect(() => {
    if (!contest?.endTime) return;

    const tick = () => {
      const left = Math.max(0, new Date(contest.endTime).getTime() - Date.now());
      setTimeLeftMs(left);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [contest]);

  const pct = totalMs > 0 ? Math.max(0, Math.min(100, (timeLeftMs / totalMs) * 100)) : 0;
  const isUrgent = timeLeftMs < 600_000 && timeLeftMs > 0;
  const ringColor = isUrgent ? '#ef4444' : '#22d3ee';

  // Single spring shake at 10-min mark
  const shakeX = useMotionValue(0);
  const springShakeX = useSpring(shakeX, { stiffness: 400, damping: 10 });

  useEffect(() => {
    if (isUrgent && !shookRef.current && !prefersReduced) {
      shookRef.current = true;
      shakeX.set(-8);
    }
  }, [isUrgent, shakeX, prefersReduced]);

  const hours = Math.floor(timeLeftMs / 3600000);
  const mins = Math.floor((timeLeftMs % 3600000) / 60000);
  const secs = Math.floor((timeLeftMs % 60000) / 1000);
  const timeStr = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  return (
    <motion.div
      className="fixed bottom-36 right-6 z-[100] perspective-1200"
      style={{ x: springShakeX }}
    >
      <button
        onClick={onFinish}
        className={`
          relative flex items-center gap-3 px-5 py-3 rounded-full
          bg-zinc-900/80 backdrop-blur-xl border border-white/10
          text-white font-extrabold text-xs tracking-wide
          transition-all duration-300 cursor-pointer
          hover:scale-105
          ${isUrgent ? 'fab-red-glow' : 'fab-cyan-glow'}
        `}
      >
        <CircularProgress
          value={pct}
          size={44}
          stroke={2.5}
          color={ringColor}
          bg="rgba(255,255,255,0.06)"
        />
        <span className="ml-2 font-mono text-sm tabular-nums" style={{ color: ringColor }}>
          {timeStr}
        </span>
        <span className="ml-1 text-[10px] font-black uppercase tracking-wider text-gray-400">
          Finish
        </span>
      </button>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Phase 3 — ExamSummaryModal
   ═══════════════════════════════════════════════════════════════════ */

interface ReportProblem {
  problemId: string;
  title: string;
  points: number;
  earned: number;
  status: string;
}

interface ReportData {
  score: number;
  maxScore: number;
  warnings: number;
  solvedCount: number;
  totalProblems: number;
  problems: ReportProblem[];
  isTerminated: boolean;
  integrity: string;
}

function CountUp({ target }: { target: number }) {
  const val = useMotionValue(0);
  const springVal = useSpring(val, { stiffness: 80, damping: 20 });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    val.set(target);
    const unsub = springVal.on('change', (v) => setDisplay(Math.round(v)));
    return unsub;
  }, [target, springVal, val]);

  return <span>{display}</span>;
}

export function ExamSummaryModal({
  report,
  onProceed,
}: {
  report: ReportData | null;
  onProceed: () => void;
}) {
  if (!report) return null;

  const attempted = report.problems.filter((p) => p.earned > 0).length;
  const barColor = (p: ReportProblem) =>
    p.earned === p.points ? 'bg-emerald-500' : p.earned > 0 ? 'bg-amber-500' : 'bg-zinc-700';
  const glowColor = (p: ReportProblem) =>
    p.earned === p.points ? 'shadow-emerald-500/20' : p.earned > 0 ? 'shadow-amber-500/20' : '';

  return (
    <motion.div
      className="fixed inset-0 z-[200] flex items-center justify-center backdrop-blur-2xl bg-black/70"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto rounded-3xl bg-zinc-900/95 border border-white/10 p-6 space-y-5"
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 24 }}
      >
        <div className="text-center space-y-1">
          <h2 className="text-lg font-black text-white">Exam Summary</h2>
          <p className="text-[11px] text-gray-400">Review your performance before final submission.</p>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Score', value: report.score, suffix: `/${report.maxScore}` },
            { label: 'Solved', value: attempted, suffix: `/${report.totalProblems}` },
            { label: 'Warnings', value: report.warnings, suffix: '' },
          ].map((s, i) => (
            <div key={i} className="bg-zinc-950/60 border border-white/5 rounded-xl p-3 text-center">
              <span className="text-[9px] text-gray-500 uppercase tracking-widest font-bold block">{s.label}</span>
              <span className="text-xl font-black text-white">
                <CountUp target={s.value} />
                <span className="text-xs text-gray-500">{s.suffix}</span>
              </span>
            </div>
          ))}
        </div>

        {/* Warnings badge */}
        {report.warnings > 0 && (
          <RotatingGlowRing color="#ef4444">
            <div className="bg-red-950/30 rounded-xl p-3 flex items-center gap-2">
              <span className="text-sm">⚠️</span>
              <span className="text-xs font-extrabold text-red-400">
                {report.warnings} violation{report.warnings > 1 ? 's' : ''} recorded
              </span>
            </div>
          </RotatingGlowRing>
        )}

        {/* Per-problem grid */}
        <div className="space-y-2">
          <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Problem Breakdown</span>
          <div className="space-y-1.5">
            {report.problems.map((p, i) => (
              <motion.div
                key={p.problemId}
                layoutId={`summary-prob-${p.problemId}`}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04, type: 'spring', stiffness: 300, damping: 25 }}
                className={`flex items-center gap-3 bg-zinc-950/40 border border-white/5 rounded-xl px-3 py-2.5 shadow-lg ${glowColor(p)}`}
              >
                <div className={`w-1 h-8 rounded-full shrink-0 ${barColor(p)}`} />
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-extrabold text-white truncate block">{p.title}</span>
                  <span className="text-[10px] text-gray-400">{p.earned}/{p.points} pts</span>
                </div>
                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                  p.earned === p.points
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : p.earned > 0
                      ? 'bg-amber-500/10 text-amber-400'
                      : 'bg-zinc-800 text-zinc-500'
                }`}>
                  {p.earned === p.points ? 'Solved' : p.earned > 0 ? 'Partial' : 'Unsolved'}
                </span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Proceed button */}
        <motion.button
          onClick={onProceed}
          className="w-full py-3 rounded-2xl font-extrabold text-sm text-white bg-gradient-to-r from-violet-600 to-violet-500 hover:from-red-600 hover:to-red-500 transition-all duration-300"
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
        >
          Proceed to Final Submission →
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Phase 4 — FinalConfirmModal
   ═══════════════════════════════════════════════════════════════════ */

export function FinalConfirmModal({
  contestId,
  onFinalized,
  onCancel,
}: {
  contestId: string;
  onFinalized: () => void;
  onCancel: () => void;
}) {
  const [input, setInput] = useState('');
  const [error, setError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const shakeX = useMotionValue(0);
  const springShakeX = useSpring(shakeX, { stiffness: 500, damping: 8 });
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const { shatter, ShatterCanvas, isShattering } = useGlassShatter({
    containerRef: modalRef,
    onComplete: onCancel,
  });

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const isValid = input === 'FINAL SUBMIT';

  const handleSubmit = async () => {
    if (!isValid || submitting) return;
    setSubmitting(true);
    try {
      await api.finalizeContest(contestId);
      onFinalized();
    } catch (err) {
      console.error('Finalize failed:', err);
      setError(true);
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (val: string) => {
    setInput(val);
    setError(false);
  };

  // Shake on invalid submit attempt
  useEffect(() => {
    if (error) {
      shakeX.set(-8);
    }
  }, [error, shakeX]);

  return (
    <motion.div
      className="fixed inset-0 z-[210] flex items-center justify-center backdrop-blur-xl bg-red-950/50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        ref={modalRef}
        className="relative w-full max-w-md mx-4 rounded-3xl bg-zinc-900/95 border border-red-500/20 p-6 space-y-5"
        initial={{ scale: 0.88, opacity: 0, rotateX: -8 }}
        animate={{ scale: 1, opacity: 1, rotateX: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 15 }}
      >
        {!isShattering && (
          <>
            <div className="text-center space-y-1">
              <span className="text-3xl block">🔒</span>
              <h2 className="text-lg font-black text-white">Final Submission</h2>
              <p className="text-[11px] text-gray-400">
                This action is <span className="text-red-400 font-bold">irreversible</span>. Your exam will be finalized and scored.
              </p>
            </div>

            {/* Input field */}
            <motion.div style={{ x: springShakeX }}>
              <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block mb-1.5">
                Type <span className="text-red-400 font-extrabold">FINAL SUBMIT</span> to confirm
              </label>
              <div className="relative">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => handleChange(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                  className={`w-full px-4 py-3 bg-zinc-950/60 border rounded-xl text-sm font-mono text-white outline-none transition-all duration-300 ${
                    error
                      ? 'border-red-500 ring-2 ring-red-500/20'
                      : isValid
                        ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                        : 'border-white/10 focus:border-violet-500'
                  }`}
                  placeholder="FINAL SUBMIT"
                  autoComplete="off"
                  spellCheck={false}
                />
                {isValid && (
                  <motion.span
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-400"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                  >
                    ✓
                  </motion.span>
                )}
              </div>
            </motion.div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={(e) => shatter(e.clientX, e.clientY)}
                type="button"
                className="flex-1 py-3 rounded-2xl font-extrabold text-sm bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10 cursor-pointer transition-all duration-300"
              >
                Stay Here
              </button>

              <motion.button
                onClick={handleSubmit}
                disabled={!isValid || submitting}
                className={`flex-1 py-3 rounded-2xl font-extrabold text-sm transition-all ${
                  isValid && !submitting
                    ? 'bg-red-500 text-white cursor-pointer fab-red-glow'
                    : 'bg-white/5 text-gray-600 cursor-not-allowed'
                }`}
                whileHover={isValid && !submitting ? { scale: 1.01 } : undefined}
                whileTap={isValid && !submitting ? { scale: 0.98 } : undefined}
              >
                {submitting ? 'Submitting...' : 'Submit Final Score'}
              </motion.button>
            </div>
          </>
        )}

        <ShatterCanvas />
      </motion.div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Phase 5 — PostSubmitSummary (TalentOS Style Scorecard & Animated SEB Exit)
   ═══════════════════════════════════════════════════════════════════ */

export function PostSubmitSummary({
  contestId,
  report,
}: {
  contestId: string;
  report: ReportData | null;
}) {
  const navigate = useNavigate();
  const confettiFired = useRef(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [isSebExited, setIsSebExited] = useState(false);

  // Extract candidate name from local user state or default
  const studentUser = useMemo(() => {
    try {
      const stored = localStorage.getItem('user');
      if (stored) return JSON.parse(stored);
    } catch (_e) {}
    return { name: 'Aarav Patel', email: 'student@iitd.ac.in' };
  }, []);

  // Auto-fire confetti and offer SEB exit prompt after 4 seconds
  useEffect(() => {
    if (confettiFired.current || !report) return;
    confettiFired.current = true;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!prefersReduced) {
      setTimeout(() => fireConfetti(), 800);
      setTimeout(() => fireConfetti(), 1800);
    }

    // Auto-prompt SEB exit option after 4s
    const timer = setTimeout(() => {
      setShowExitModal(true);
    }, 4000);
    return () => clearTimeout(timer);
  }, [report]);

  const rank = report
    ? report.score >= report.maxScore * 0.9
      ? 1
      : report.score >= report.maxScore * 0.7
        ? 2
        : 3
    : 3;
  const percentile = report
    ? Math.round((report.score / (report.maxScore || 1)) * 100)
    : 0;

  if (!report) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-amber-500" />
      </div>
    );
  }

  const barColor = (p: ReportProblem) =>
    p.earned === p.points ? 'bg-emerald-500' : p.earned > 0 ? 'bg-amber-500' : 'bg-zinc-700';

  const handleExitSEB = () => {
    setIsSebExited(true);
    try {
      fireConfetti();
    } catch (_e) {}
  };

  const executeCloseWindow = () => {
    try {
      window.location.href = 'sebs://quit';
      setTimeout(() => {
        window.close();
      }, 500);
    } catch (_e) {
      window.close();
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-8 px-4 relative">
      {/* TalentOS Header Badge */}
      <motion.div
        className="text-center space-y-3"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      >
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-amber-500/20 to-purple-500/20 border border-amber-500/30 text-amber-300 text-xs font-black uppercase tracking-widest">
          <span>🏆 OFFICIAL CONTEST SCORECARD</span>
        </div>
        <h1 className="text-3xl font-black text-white tracking-tight">Assessment Completed!</h1>
        <p className="text-xs text-gray-400">Great effort! Here is your verified performance breakdown.</p>
      </motion.div>

      {/* TalentOS Glass Hero Card */}
      <motion.div
        className="relative bg-[#0b0c14] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden backdrop-blur-2xl space-y-6"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 22 }}
      >
        {/* Glow ambient background */}
        <div className="absolute -top-24 -left-24 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center relative z-10">
          {/* Score display */}
          <div className="text-center md:text-left space-y-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-gray-400 block">TOTAL SCORE EARNED</span>
            <div className="flex items-baseline justify-center md:justify-start gap-1">
              <span className="text-5xl font-black text-amber-400 font-mono tracking-tight">{report.score}</span>
              <span className="text-xl text-gray-500 font-extrabold font-mono">/{report.maxScore}</span>
            </div>
            <span className="text-xs text-emerald-400 font-bold flex items-center justify-center md:justify-start gap-1">
              <span>✓ Verified Score</span>
            </span>
          </div>

          {/* Percentile Gauge */}
          <div className="flex flex-col items-center justify-center space-y-1">
            <div className="relative w-28 h-20 flex items-center justify-center">
              <svg width="120" height="80" viewBox="0 0 120 80">
                <path
                  d="M 10 70 A 50 50 0 0 1 110 70"
                  fill="none"
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth="10"
                  strokeLinecap="round"
                />
                <motion.path
                  d="M 10 70 A 50 50 0 0 1 110 70"
                  fill="none"
                  stroke={percentile >= 80 ? '#10b981' : percentile >= 50 ? '#f59e0b' : '#ef4444'}
                  strokeWidth="10"
                  strokeLinecap="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: Math.max(0.05, percentile / 100) }}
                  transition={{ delay: 0.5, duration: 1.2, ease: 'easeOut' }}
                />
              </svg>
              <div className="absolute inset-0 top-3 flex flex-col items-center justify-center">
                <span className="text-2xl font-black text-white font-mono">{percentile}%</span>
              </div>
            </div>
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400">ACCURACY SCORE</span>
          </div>

          {/* Rank & Stats */}
          <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-4 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-400">National Rank:</span>
              <span className="font-extrabold text-amber-400"># Rank {rank}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-400">Problems Solved:</span>
              <span className="font-extrabold text-emerald-400">{report.solvedCount} / {report.totalProblems}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-400">Proctoring Status:</span>
              <span className={`font-extrabold ${report.warnings === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {report.warnings === 0 ? '✓ CLEAN' : `⚠ ${report.warnings} Warning(s)`}
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* 3D Trophy Animation */}
      <motion.div
        className="h-56 w-full"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, type: 'spring', stiffness: 120, damping: 18 }}
      >
        <Suspense
          fallback={
            <div className="flex items-center justify-center h-full">
              <span className="text-5xl animate-bounce">🏆</span>
            </div>
          }
        >
          <RankReveal3D rank={rank} />
        </Suspense>
      </motion.div>

      {/* Per-Problem Breakdown Cards */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-400 font-extrabold uppercase tracking-widest">DETAILED PROBLEM BREAKDOWN</span>
          <span className="text-xs text-amber-400 font-mono font-bold">{report.solvedCount} of {report.totalProblems} Solved</span>
        </div>

        <div className="space-y-3">
          {report.problems.map((p, i) => (
            <motion.div
              key={p.problemId}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 + i * 0.05, type: 'spring', stiffness: 300, damping: 25 }}
              className="flex items-center justify-between gap-4 bg-[#0b0c14]/80 border border-white/10 rounded-2xl px-5 py-4 hover:border-amber-500/30 transition-all shadow-lg"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-1.5 h-10 rounded-full shrink-0 ${barColor(p)}`} />
                <div className="min-w-0">
                  <h4 className="text-sm font-extrabold text-white truncate">{p.title}</h4>
                  <span className="text-xs text-gray-400 font-mono">{p.earned} / {p.points} points</span>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <span className={`text-xs font-black uppercase px-3 py-1 rounded-xl border ${
                  p.earned === p.points
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : p.earned > 0
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-500'
                }`}>
                  {p.earned === p.points ? '✓ Accepted' : p.earned > 0 ? '~ Partial' : '✕ Unattempted'}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <motion.div
        className="flex flex-col sm:flex-row gap-4 justify-center pt-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
      >
        <button
          onClick={() => setShowExitModal(true)}
          className="px-8 py-3.5 bg-gradient-to-r from-red-600 to-rose-500 hover:from-red-500 hover:to-rose-400 text-white font-black text-sm rounded-2xl shadow-xl shadow-red-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>🚪 Exit Safe Exam Browser (Finish)</span>
        </button>

        <button
          onClick={() => navigate(`/contests/${contestId}/report`)}
          className="px-8 py-3.5 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-extrabold text-sm rounded-2xl transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>📊 View Full Analysis Report →</span>
        </button>
      </motion.div>

      {/* Interactive Post-Exam Modal (Prompt to Exit SEB or Continue) */}
      <AnimatePresence>
        {showExitModal && !isSebExited && (
          <motion.div
            className="fixed inset-0 z-[300] flex items-center justify-center backdrop-blur-2xl bg-black/80 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-full max-w-lg bg-[#0d0f19] border border-amber-500/30 rounded-3xl p-6 sm:p-8 space-y-6 text-center shadow-2xl relative overflow-hidden"
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-3xl">
                🏁
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-black text-white">What would you like to do next?</h3>
                <p className="text-xs text-gray-400">
                  Your response and score have been securely saved to the server.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <button
                  onClick={handleExitSEB}
                  className="w-full py-4 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-black text-sm rounded-2xl shadow-xl shadow-red-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>🚪 Exit SEB (Finish Assessment)</span>
                </button>

                <button
                  onClick={() => {
                    setShowExitModal(false);
                    window.location.href = `/contests/${contestId}/report`;
                  }}
                  className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-sm rounded-2xl shadow-xl shadow-emerald-500/30 transition-all cursor-pointer"
                >
                  <span>📊 View Contest Scorecard & Submitted Code</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Highly Animated SEB Exit Guidance Screen */}
      <AnimatePresence>
        {isSebExited && (
          <motion.div
            className="fixed inset-0 z-[400] flex items-center justify-center backdrop-blur-3xl bg-[#07080f]/95 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-full max-w-xl bg-gradient-to-b from-[#131626] to-[#0a0b12] border border-emerald-500/40 rounded-3xl p-8 space-y-8 text-center shadow-2xl relative overflow-hidden"
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 220, damping: 20 }}
            >
              {/* Glowing ring */}
              <div className="w-24 h-24 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center mx-auto text-4xl shadow-xl shadow-emerald-500/30 animate-bounce">
                🎉
              </div>

              {/* Personalized Thank You Message */}
              <div className="space-y-3">
                <span className="px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-black uppercase tracking-widest">
                  ASSESSMENT COMPLETED SUCCESSFULLY
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  Thank You, {studentUser.name || 'Student'}!
                </h2>
                <p className="text-xs text-gray-300 max-w-md mx-auto leading-relaxed">
                  Your response for <span className="text-amber-400 font-bold">System Testing Contest</span> has been submitted and verified.
                </p>
              </div>

              {/* SEB Exit Instructions Card */}
              <div className="bg-black/50 border border-white/10 rounded-2xl p-5 space-y-4 text-left">
                <h4 className="text-xs font-extrabold text-amber-400 uppercase tracking-wider flex items-center gap-2">
                  <span>🔒 How to Exit Safe Exam Browser (SEB):</span>
                </h4>
                <div className="space-y-3 text-xs text-gray-300 font-mono">
                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                    <span className="text-gray-400">1. SEB Quit Passcode:</span>
                    <span className="font-bold text-amber-400 bg-amber-500/20 px-2.5 py-1 rounded">quit123</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                    <span className="text-gray-400">2. Keyboard Shortcut:</span>
                    <span className="font-bold text-emerald-400 bg-emerald-500/20 px-2.5 py-1 rounded">Ctrl + Q (Windows) / Cmd + Q (macOS)</span>
                  </div>
                  <div className="p-3 bg-white/5 rounded-xl border border-white/5 text-[11px] text-gray-400">
                    3. Click the red <span className="text-red-400 font-bold">Power / Exit</span> icon at the bottom-right corner of SEB taskbar.
                  </div>
                </div>
              </div>

              {/* Direct Exit Action */}
              <div className="pt-2 space-y-3">
                <button
                  onClick={executeCloseWindow}
                  className="w-full py-4 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-black text-sm rounded-2xl shadow-xl shadow-red-600/40 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>⚡ Exit SEB Window Now</span>
                </button>
                <p className="text-[11px] text-gray-500 font-medium">You may now safely close your browser window.</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Phase 6 — ProblemLockConfirmationModal ("Submit & Lock Problem" Gate)
   ═══════════════════════════════════════════════════════════════════ */

export function ProblemLockConfirmationModal({
  isOpen,
  problemTitle,
  scoreEarned,
  maxPoints,
  onConfirm,
  onCancel,
}: {
  isOpen: boolean;
  problemTitle: string;
  scoreEarned?: number;
  maxPoints?: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!isOpen) return null;

  return (
    <motion.div
      className="fixed inset-0 z-[220] flex items-center justify-center backdrop-blur-md bg-black/80 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="w-full max-w-md bg-zinc-950 border border-amber-500/30 rounded-3xl p-6 md:p-8 space-y-6 shadow-2xl relative overflow-hidden"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 via-emerald-400 to-teal-500" />

        <div className="flex justify-between items-center border-b border-white/10 pb-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">🔒</span>
            <div>
              <span className="text-[10px] font-extrabold bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                Final Problem Lock
              </span>
              <h3 className="text-lg font-black text-white mt-0.5">Submit & Lock Problem?</h3>
            </div>
          </div>
          <button onClick={onCancel} className="text-gray-400 hover:text-white font-bold text-sm">✕</button>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2">
          <p className="text-xs text-gray-300 font-medium">
            Are you sure you want to lock and submit <strong className="text-white font-extrabold">{problemTitle}</strong>?
          </p>
          {typeof scoreEarned === 'number' && typeof maxPoints === 'number' && (
            <div className="pt-2 border-t border-white/5 flex justify-between items-center text-xs font-mono">
              <span className="text-gray-400">Score Recorded:</span>
              <span className="text-emerald-400 font-extrabold text-sm">{scoreEarned} / {maxPoints} pts</span>
            </div>
          )}
        </div>

        <div className="bg-amber-950/30 border border-amber-500/30 rounded-2xl p-4 text-[11px] text-amber-300/80 leading-relaxed space-y-1">
          <p className="font-extrabold text-amber-400">⚠️ Important Notice:</p>
          <p>
            Once locked, you will <strong>NOT be able to edit, re-submit, or change</strong> your solution for this problem during this contest session.
          </p>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={onCancel}
            type="button"
            className="flex-1 py-3 rounded-2xl font-extrabold text-xs bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10 transition"
          >
            Keep Editing
          </button>
          <button
            onClick={onConfirm}
            type="button"
            className="flex-1 py-3 rounded-2xl font-extrabold text-xs text-black bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 shadow-lg shadow-amber-500/20 transition cursor-pointer"
          >
            🔒 Yes, Lock & Submit
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
