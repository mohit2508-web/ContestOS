/**
 * SebDiagnosticCockpit — the full-screen secure exam staging environment.
 * Only rendered when running INSIDE Safe Exam Browser (isSebBrowser === true).
 *
 * Flow:
 *  1. Warning acknowledgment modal (Phase 4A) — with lazy-loaded 3D shield
 *  2. Animated pre-flight checks (Phase 4B) — CSS 3D card flips, one step at a time
 *  3. "BEGIN EXAMINATION" reveal (Phase 4C) — after all checks pass
 */

import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { EntryFlowState, ContestOutletContext } from '../pages/ContestZonePage';
import { StaticShieldSVG } from './SebWarningShield';
import { ErrorBoundary } from './ErrorBoundary';

import SebWarningShield from './SebWarningShield';

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────
interface CockpitProps {
  contest: any;
  diagnostics: ContestOutletContext['diagnostics'];
  onStartExam: () => void;
}

type StepStatus = 'idle' | 'checking' | 'pass' | 'fail' | 'bypass';

// ─────────────────────────────────────────────────────────
// Utility: step status resolver
// ─────────────────────────────────────────────────────────
function getStepStatus(
  stepName: 'camera' | 'liveness' | 'integrity' | 'network' | 'seb',
  state: EntryFlowState,
  cameraStream: MediaStream | null,
  latency: number | null,
  errorMsg: string,
  requireSeb: boolean,
): StepStatus {
  if (state === 'idle') return 'idle';

  if (stepName === 'camera') {
    if (state === 'checking_camera_permission') return 'checking';
    if (state === 'blocked' && !cameraStream) return 'fail';
    return 'pass';
  }
  if (stepName === 'liveness') {
    if (state === 'checking_camera_permission') return 'idle';
    if (state === 'checking_face_liveness') return 'checking';
    if (state === 'blocked' && !cameraStream) return 'fail';
    return 'pass';
  }
  if (stepName === 'integrity') {
    if (['idle', 'checking_camera_permission', 'checking_face_liveness'].includes(state)) return 'idle';
    if (state === 'checking_env_integrity') return 'checking';
    return 'pass';
  }
  if (stepName === 'network') {
    if (['idle', 'checking_camera_permission', 'checking_face_liveness', 'checking_env_integrity'].includes(state)) return 'idle';
    if (state === 'network_quality_check') return 'checking';
    if (state === 'blocked' && latency === null) return 'fail';
    return 'pass';
  }
  if (stepName === 'seb') {
    if (!requireSeb) return 'bypass';
    if (state === 'seb_handshake_pending') return 'checking';
    if (state === 'entered') return 'pass';
    if (state === 'blocked' && errorMsg.includes('Safe Exam Browser')) return 'fail';
    return 'idle';
  }
  return 'idle';
}

// ─────────────────────────────────────────────────────────
// Step icons
// ─────────────────────────────────────────────────────────
const STEP_ICONS: Record<string, string> = {
  camera: '🎥',
  liveness: '👤',
  integrity: '🔍',
  network: '📡',
  seb: '🔒',
};

const STEP_LABELS: Record<string, string> = {
  camera: 'Camera & Microphone Access',
  liveness: 'Face Presence Verification',
  integrity: 'Environment Integrity Scan',
  network: 'Secure Connection Test',
  seb: 'SEB Session Handshake',
};

const STEP_SUBLABELS: Record<string, { checking: string; pass: string; fail: string }> = {
  camera: {
    checking: 'Requesting hardware access…',
    pass: 'Camera and microphone are active and streaming',
    fail: 'Permission denied — camera access is required',
  },
  liveness: {
    checking: 'Detecting face presence in frame…',
    pass: 'Face detected and liveness confirmed',
    fail: 'Could not detect face in camera frame',
  },
  integrity: {
    checking: 'Scanning for unauthorized tools and extensions…',
    pass: 'Environment integrity verified — no anomalies detected',
    fail: 'Integrity scan failed — unauthorized environment detected',
  },
  network: {
    checking: 'Measuring round-trip latency to exam server…',
    pass: 'Secure connection established with acceptable latency',
    fail: 'Network connectivity issue — cannot reach exam server',
  },
  seb: {
    checking: 'Validating Safe Exam Browser session signature…',
    pass: 'SEB session authenticated — environment locked',
    fail: 'SEB handshake failed — cannot verify exam browser',
  },
};

// ─────────────────────────────────────────────────────────
// Step card component
// ─────────────────────────────────────────────────────────
function StepCard({
  name,
  status,
  latency,
  idx,
}: {
  name: string;
  status: StepStatus;
  latency?: number | null;
  idx: number;
}) {
  const statusColors: Record<StepStatus, string> = {
    idle: 'border-white/6 bg-white/2 text-zinc-600',
    checking: 'border-amber-500/40 bg-amber-500/5 text-amber-300',
    pass: 'border-emerald-500/35 bg-emerald-500/5 text-emerald-300',
    fail: 'border-red-500/40 bg-red-500/5 text-red-300',
    bypass: 'border-blue-500/30 bg-blue-500/5 text-blue-300',
  };

  const statusIcons: Record<StepStatus, string> = {
    idle: '○',
    checking: '◌',
    pass: '✓',
    fail: '✗',
    bypass: '—',
  };

  const animClass = status !== 'idle' ? 'seb-card-flip-in' : '';

  return (
    <div
      className={`seb-step-card ${animClass} ${status === 'pass' ? 'seb-step-pass' : ''} flex items-center gap-4 p-4 rounded-xl border transition-all duration-300 ${statusColors[status]}`}
      style={{ animationDelay: `${idx * 60}ms` }}
    >
      {/* Icon */}
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 transition-all duration-300 ${
          status === 'checking'
            ? 'animate-pulse bg-amber-500/15'
            : status === 'pass'
            ? 'bg-emerald-500/15'
            : status === 'fail'
            ? 'bg-red-500/15 seb-shake'
            : 'bg-white/5'
        }`}
      >
        {STEP_ICONS[name]}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-extrabold tracking-tight ${status === 'idle' ? 'text-zinc-600' : 'text-white'}`}>
          {STEP_LABELS[name]}
        </div>
        <div className="text-[11px] font-mono mt-0.5 leading-relaxed">
          {status === 'idle' && <span className="text-zinc-600">Waiting…</span>}
          {status === 'checking' && <span className="text-amber-400">{STEP_SUBLABELS[name].checking}</span>}
          {status === 'pass' && (
            <span className="text-emerald-400">
              {STEP_SUBLABELS[name].pass}
              {name === 'network' && latency != null && ` (${latency}ms)`}
            </span>
          )}
          {status === 'fail' && <span className="text-red-400">{STEP_SUBLABELS[name].fail}</span>}
          {status === 'bypass' && <span className="text-blue-400">Not required for this contest</span>}
        </div>
      </div>

      {/* Status badge */}
      <div
        className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm transition-all ${
          status === 'checking'
            ? 'bg-amber-500/20 text-amber-400 animate-spin'
            : status === 'pass'
            ? 'bg-emerald-500/20 text-emerald-400 seb-checkmark-pop'
            : status === 'fail'
            ? 'bg-red-500/20 text-red-400'
            : 'bg-white/5 text-zinc-600'
        }`}
      >
        {status === 'checking' ? (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          statusIcons[status]
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Phase 4A — Warning Acknowledgment Screen
// ─────────────────────────────────────────────────────────
function AcknowledgmentScreen({ onProceed, contestTitle }: { onProceed: () => void; contestTitle: string }) {
  const [agreed, setAgreed] = useState(false);

  return (
    <div className="seb-cockpit-3d-scene fixed inset-0 z-[999] flex items-center justify-center bg-[hsl(0_0%_2%)] overflow-y-auto py-6">
      {/* Parallax background layers */}
      <div className="seb-parallax-layer pointer-events-none opacity-25 bg-[radial-gradient(circle_at_30%_20%,_rgba(239,68,68,0.15),_transparent_60%)]" />
      <div className="seb-parallax-layer pointer-events-none opacity-15 bg-[radial-gradient(circle_at_70%_80%,_rgba(245,158,11,0.12),_transparent_60%)]" />

      {/* Blinking REC indicator */}
      <div className="fixed top-4 right-5 flex items-center gap-1.5 z-[1000]">
        <span className="w-2 h-2 rounded-full bg-red-500 seb-rec-blink" />
        <span className="text-[10px] font-black text-red-400 tracking-[0.2em] uppercase font-mono">REC</span>
      </div>

      {/* Modal */}
      <div className="seb-warning-modal relative w-full max-w-2xl mx-4 rounded-2xl border border-red-500/30 bg-[hsl(220_12%_6%)] shadow-[0_0_80px_-15px_rgba(239,68,68,0.5)] overflow-hidden">
        {/* Top pulse bar */}
        <div className="h-0.5 bg-gradient-to-r from-red-500/0 via-red-500 to-red-500/0 seb-threat-bar-pulse" />

        {/* 3D Shield */}
        <div className="h-[180px] w-full">
          <ErrorBoundary fallback={<StaticShieldSVG threat />}>
            <Suspense fallback={<StaticShieldSVG threat />}>
              <SebWarningShield threat />
            </Suspense>
          </ErrorBoundary>
        </div>

        <div className="px-8 pb-8">
          {/* Title */}
          <div className="text-center mb-6">
            <h2 className="text-xl font-black text-white tracking-tight">
              ⚠️ SECURE EXAMINATION ENVIRONMENT ACTIVE
            </h2>
            <p className="text-zinc-400 text-sm mt-1.5">
              You are entering a strictly monitored exam session for{' '}
              <span className="text-white font-bold">{contestTitle}</span>
            </p>
          </div>

          {/* Monitoring notices */}
          <div className="grid grid-cols-2 gap-2 mb-6">
            {[
              { icon: '📷', label: 'Webcam feed recorded' },
              { icon: '🎙️', label: 'Audio levels monitored' },
              { icon: '⌨️', label: 'Keystrokes logged' },
              { icon: '🔒', label: 'Browser fully locked' },
              { icon: '📸', label: 'Periodic screenshots' },
              { icon: '🌐', label: 'Network traffic logged' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2.5 px-3 py-2.5 bg-white/3 border border-white/6 rounded-xl">
                <span className="text-base">{item.icon}</span>
                <span className="text-xs text-zinc-300 font-semibold">{item.label}</span>
              </div>
            ))}
          </div>

          {/* Cheating warning block */}
          <div className="bg-red-950/60 border border-red-500/35 rounded-xl p-5 mb-6 seb-threat-pulse-border">
            <div className="flex items-center gap-2.5 mb-3">
              <span className="text-lg">⛔</span>
              <h3 className="font-black text-red-300 text-sm uppercase tracking-wider">CHEATING NOTICE</h3>
            </div>
            <p className="text-red-200/80 text-xs leading-relaxed mb-3">
              Any attempt to cheat, bypass security controls, or use unauthorized assistance{' '}
              <strong className="text-red-300">WILL result in all of the following:</strong>
            </p>
            <ul className="space-y-1.5">
              {[
                'IMMEDIATE DISQUALIFICATION from this exam session',
                'AUTOMATIC SUSPENSION of your student account',
                'FORMAL INCIDENT REPORT to your institution and examiner',
                'PERMANENT RECORD in your academic integrity file',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-xs text-red-300/90">
                  <span className="text-red-500 font-black shrink-0 mt-0.5">▸</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Acknowledgment checkbox */}
          <label className="flex items-start gap-3 cursor-pointer group mb-6 select-none">
            <div className="relative mt-0.5">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="sr-only"
              />
              <div
                className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                  agreed ? 'bg-amber-500 border-amber-500' : 'bg-white/5 border-white/20 group-hover:border-white/40'
                }`}
              >
                {agreed && <span className="text-black text-xs font-black">✓</span>}
              </div>
            </div>
            <span className="text-xs text-zinc-300 leading-relaxed">
              I have read and understood the examination rules above. I confirm that I will not attempt to cheat or bypass any security measures. I acknowledge that my session is being fully recorded and monitored.
            </span>
          </label>

          {/* Proceed button */}
          <button
            onClick={onProceed}
            disabled={!agreed}
            className={`w-full py-4 font-black rounded-xl text-sm transition-all duration-200 flex items-center justify-center gap-2 ${
              agreed
                ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-lg shadow-amber-500/30 seb-proceed-glow'
                : 'bg-white/5 text-zinc-600 cursor-not-allowed'
            }`}
          >
            <span>🛡️</span>
            I Understand &amp; Proceed to Security Checks
          </button>
        </div>

        <div className="h-0.5 bg-gradient-to-r from-red-500/0 via-red-500/40 to-red-500/0" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Phase 4B + 4C — Diagnostic Steps + Start Exam
// ─────────────────────────────────────────────────────────
function DiagnosticStepsScreen({
  contest,
  diagnostics,
  onStartExam,
}: {
  contest: any;
  diagnostics: ContestOutletContext['diagnostics'];
  onStartExam: () => void;
}) {
  const { state, errorMsg, cameraStream, latency, startDiagnostics, resetFlow } = diagnostics;
  const videoRef = useRef<HTMLVideoElement>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  // Pipe camera stream to video element
  useEffect(() => {
    if (cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [cameraStream]);

  // Auto-start diagnostics on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      startDiagnostics();
    }, 600);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Countdown before exam start
  useEffect(() => {
    if (state !== 'entered') return;
    setCountdown(3);
  }, [state]);

  useEffect(() => {
    if (countdown === null || countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => (c !== null ? c - 1 : null)), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const steps: Array<'camera' | 'liveness' | 'integrity' | 'network' | 'seb'> = [
    'camera', 'liveness', 'integrity', 'network', 'seb'
  ];

  const stepStatuses = steps.map((s) =>
    getStepStatus(s, state, cameraStream, latency, errorMsg, !!contest?.requireSeb)
  );

  const passCount = stepStatuses.filter((s) => s === 'pass' || s === 'bypass').length;
  const progressPct = state === 'idle' ? 0 : Math.round((passCount / steps.length) * 100);
  const allPassed = state === 'entered';

  return (
    <div className="min-h-screen bg-[hsl(220_15%_4%)] flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background layers */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="seb-parallax-layer opacity-20 bg-[radial-gradient(circle_at_20%_30%,rgba(34,197,94,0.08),transparent_60%)]" />
        <div className="seb-parallax-layer opacity-15 bg-[radial-gradient(circle_at_80%_70%,rgba(245,158,11,0.07),transparent_60%)]" />
      </div>

      {/* Subtle background grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: `linear-gradient(to right, rgba(255, 255, 255, 0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255, 255, 255, 0.05) 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }}
      />

      {/* Blinking REC */}
      <div className="fixed top-4 right-5 flex items-center gap-1.5 z-50">
        <span className="w-2 h-2 rounded-full bg-red-500 seb-rec-blink" />
        <span className="text-[10px] font-black text-red-400 tracking-[0.2em] font-mono">RECORDING</span>
      </div>

      <div className="relative w-full max-w-xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-[hsl(220_12%_10%)] border border-white/8 rounded-full mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-black text-zinc-400 tracking-[0.2em] uppercase font-mono">
              SECURE ENVIRONMENT INITIALIZED
            </span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Pre-Flight Security Checks
          </h1>
          <p className="text-zinc-500 text-sm mt-1">
            Verifying your exam environment — please wait
          </p>
        </div>

        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">Security Verification</span>
            <span className="text-[10px] font-black text-zinc-400 font-mono">{progressPct}%</span>
          </div>
          <div className="h-1 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${progressPct}%`,
                background: allPassed
                  ? 'linear-gradient(90deg, #22c55e, #10b981)'
                  : state === 'blocked'
                  ? 'linear-gradient(90deg, #ef4444, #dc2626)'
                  : 'linear-gradient(90deg, #f59e0b, #fbbf24)',
              }}
            />
          </div>
        </div>

        {/* Step cards */}
        <div className="space-y-2.5 mb-8">
          {steps.map((name, idx) => (
            <StepCard
              key={name}
              name={name}
              status={stepStatuses[idx]}
              latency={name === 'network' ? latency : undefined}
              idx={idx}
            />
          ))}
        </div>

        {/* Live camera preview (shows during liveness check) */}
        {cameraStream && (
          <div className="mb-6 rounded-xl overflow-hidden border border-white/8 relative seb-card-flip-in">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-36 object-cover scale-x-[-1]"
            />
            <div className="absolute inset-0 border-2 border-emerald-500/30 rounded-xl pointer-events-none" />
            <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[9px] font-black text-emerald-400 font-mono tracking-wider">LIVE FEED ACTIVE</span>
            </div>
          </div>
        )}

        {/* Error state */}
        {state === 'blocked' && (
          <div className="bg-red-950/60 border border-red-500/30 rounded-xl p-4 mb-6 seb-card-flip-in">
            <div className="flex items-start gap-3">
              <span className="text-red-400 text-lg shrink-0 mt-0.5">⚠️</span>
              <div>
                <div className="text-sm font-extrabold text-red-300">Security Check Failed</div>
                <div className="text-xs text-red-400/80 mt-1 font-mono leading-relaxed">{errorMsg}</div>
              </div>
            </div>
            <button
              onClick={() => { resetFlow(); setTimeout(startDiagnostics, 400); }}
              className="mt-3 w-full py-2.5 bg-red-500/15 hover:bg-red-500/25 text-red-300 text-xs font-bold rounded-lg transition"
            >
              Retry Security Checks
            </button>
          </div>
        )}

        {/* BEGIN EXAMINATION — only shown after all pass */}
        {allPassed && (
          <div className="seb-card-flip-in text-center">
            <div className="mb-4">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/25 rounded-full">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-black text-emerald-400 uppercase tracking-[0.15em]">
                  All Checks Passed — Environment Secured
                </span>
              </div>
            </div>

            {countdown !== null && countdown > 0 ? (
              <div className="text-center mb-4">
                <div className="text-6xl font-black text-amber-400 tabular-nums leading-none mb-1" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {countdown}
                </div>
                <div className="text-xs text-zinc-500 font-mono">Exam starts automatically…</div>
              </div>
            ) : null}

            {(countdown === 0 || countdown === null) && (
              <button
                onClick={onStartExam}
                className="w-full py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-black font-black rounded-xl transition shadow-lg shadow-emerald-500/30 text-sm flex items-center justify-center gap-2.5 seb-proceed-glow"
              >
                <span className="text-lg">▶</span>
                BEGIN EXAMINATION
              </button>
            )}

            {countdown !== null && countdown > 0 && (
              <button
                onClick={() => setCountdown(0)}
                className="mt-3 text-xs text-zinc-600 hover:text-zinc-400 transition underline"
              >
                Skip countdown
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Main export — orchestrates the two screens
// ─────────────────────────────────────────────────────────
export default function SebDiagnosticCockpit({ contest, diagnostics, onStartExam }: CockpitProps) {
  const [acknowledged, setAcknowledged] = useState(false);

  if (!acknowledged) {
    return (
      <AcknowledgmentScreen
        contestTitle={contest.title}
        onProceed={() => setAcknowledged(true)}
      />
    );
  }

  return (
    <DiagnosticStepsScreen
      contest={contest}
      diagnostics={diagnostics}
      onStartExam={onStartExam}
    />
  );
}
