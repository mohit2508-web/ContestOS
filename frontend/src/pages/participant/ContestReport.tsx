import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../../services/api';
import { useNotify } from '../../components/notifications';
import { useSidebar } from '../../contexts/SidebarContext';
import { useGlassShatter } from '../../components/GlassShatter';

interface ProblemDetail {
  problemId: string;
  problem: {
    id: string;
    title: string;
    description: string;
  };
}

interface Submission {
  id: string;
  problemId: string;
  language: string;
  code: string;
  status: string;
  points: number;
  submittedAt: string;
}

interface IntegrityEvent {
  id: string;
  eventType: string;
  detectedAt: string;
  detail: any;
}

interface ReportData {
  contest: {
    id: string;
    title: string;
    description?: string;
    duration: number;
    maxWarnings: number;
    startTime: string;
    endTime: string;
    problems: ProblemDetail[];
    sebQuitPassword?: string;
  };
  participant: {
    id: string;
    userId: string;
    score: number;
    solvedCount: number;
    warnings: number;
    isTerminated: boolean;
    joinedAt: string;
    status: string;
    autoSubmitted: boolean;
    autoSubmittedAt?: string;
    rank?: number;
    totalParticipants?: number;
    dispute?: {
      status: 'SUBMITTED' | 'UNDER_REVIEW' | 'ACCEPTED' | 'REJECTED';
      reason: string;
      resolution?: string;
      resolvedAt?: string;
    } | null;
  };
  submissions: Submission[];
  integrityEvents: IntegrityEvent[];
  percentile: number;
}

function detectSebBrowser(): boolean {
  return (
    navigator.userAgent.toLowerCase().includes('seb') ||
    navigator.userAgent.toLowerCase().includes('safeexambrowser') ||
    new URLSearchParams(window.location.search).get('seb') === '1'
  );
}

function DynamicRingProgress({ 
  percentage, 
  color = '#10b981', 
  bgTrack = '#27272a',
  size = 112, 
  strokeWidth = 7,
  children 
}: { 
  percentage: number; 
  color?: string; 
  bgTrack?: string;
  size?: number; 
  strokeWidth?: number;
  children: React.ReactNode;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const validPct = Math.min(100, Math.max(0, percentage));
  const strokeDashoffset = circumference - (validPct / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={bgTrack}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center text-center">
        {children}
      </div>
    </div>
  );
}

export function ContestReport() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const notify = useNotify();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ReportData | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<string>('');
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeSubmitting, setDisputeSubmitting] = useState(false);

  const sidebarContext = useSidebar();
  const setSidebarHidden = sidebarContext?.setSidebarHidden;

  const [showChoiceOverlay, setShowChoiceOverlay] = useState(() => detectSebBrowser());
  const [showExitGuidelines, setShowExitGuidelines] = useState(false);

  const overlayRef = useRef<HTMLDivElement>(null);
  const { shatter, ShatterCanvas, isShattering } = useGlassShatter({
    containerRef: overlayRef,
    onComplete: () => setShowChoiceOverlay(false),
  });

  useEffect(() => {
    if (setSidebarHidden) {
      setSidebarHidden(true);
      return () => setSidebarHidden(false);
    }
  }, [setSidebarHidden]);

  useEffect(() => {
    fetchReport();
  }, [id]);

  const fetchReport = async () => {
    try {
      setLoading(true);
      const data = await api.getMyContestReport(id!);
      setReport(data);
      if (data.contest.problems && data.contest.problems.length > 0) {
        setActiveSubTab(data.contest.problems[0].problemId);
      }
      setError(null);
    } catch (err: any) {
      console.error('Failed to load report:', err);
      setError(err.response?.data?.error || 'Failed to load report details.');
    } finally {
      setLoading(false);
    }
  };

  const handleDisputeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disputeReason.trim() || !report) return;
    try {
      setDisputeSubmitting(true);
      await api.post(`/contests/${report.contest.id}/dispute`, { reason: disputeReason });
      notify.toast.success('Appeal submitted successfully for review!');
      await fetchReport();
      setDisputeReason('');
    } catch (err: any) {
      notify.toast.error(err.response?.data?.error || 'Failed to submit dispute.');
    } finally {
      setDisputeSubmitting(false);
    }
  };

  const getEventSeverity = (type: string): { label: string; bg: string; text: string } => {
    const t = type.toLowerCase();
    if (t.includes('rdp') || t.includes('vm') || t.includes('terminated') || t.includes('kill')) {
      return { label: 'Critical', bg: 'bg-red-500/10 border-red-500/20', text: 'text-red-400' };
    }
    if (t.includes('switch') || t.includes('blur') || t.includes('screen')) {
      return { label: 'Warning', bg: 'bg-amber-500/10 border-amber-500/20', text: 'text-amber-400' };
    }
    return { label: 'Info', bg: 'bg-zinc-500/10 border-zinc-500/20', text: 'text-zinc-400' };
  };

  const downloadHTMLReport = () => {
    if (!report) return;
    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>ContestOS Scorecard - ${report.contest.title}</title>
  <style>
    @page { size: A4 portrait; margin: 6mm; }
    * { box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; background: #09090b; color: #f4f4f5; width: 100%; max-width: 780px; margin: 0 auto; padding: 15px; font-size: 11px; line-height: 1.35; }
    .cert-box { border: 2px solid #10b981; border-radius: 12px; padding: 18px; background: #121215; }
    .header { border-bottom: 1px solid #27272a; padding-bottom: 10px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center; }
    .title { font-size: 18px; font-weight: 800; color: #10b981; text-transform: uppercase; letter-spacing: 0.5px; }
    .meta { color: #a1a1aa; font-size: 11px; margin-top: 4px; }
    .status-badge { background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.3); color: #34d399; font-weight: 800; font-size: 10px; padding: 4px 10px; border-radius: 20px; text-transform: uppercase; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 14px; }
    .card { background: #18181b; border: 1px solid #27272a; border-radius: 8px; padding: 10px; text-align: center; }
    .card-val { font-size: 20px; font-weight: 900; color: #fff; margin-top: 4px; }
    .card-lbl { font-size: 9px; color: #a1a1aa; text-transform: uppercase; font-weight: 700; }
    .section-title { font-size: 12px; font-weight: 700; margin: 12px 0 6px 0; color: #34d399; text-transform: uppercase; }
    .code-container { background: #000; border: 1px solid #27272a; border-radius: 6px; padding: 10px; font-family: monospace; font-size: 10px; max-height: 380px; overflow: hidden; color: #e4e4e7; }
    .footer { border-top: 1px solid #27272a; margin-top: 14px; pt: 8px; display: flex; justify-content: space-between; color: #71717a; font-size: 9px; }
  </style>
</head>
<body>
  <div class="cert-box">
    <div class="header">
      <div>
        <div class="title">ContestOS Exam Performance Certificate</div>
        <div class="meta">Contest: <strong>${report.contest.title}</strong> | Candidate ID: <strong>${report.participant.id.slice(0, 8)}</strong> | Date: <strong>${new Date(report.participant.joinedAt).toLocaleString()}</strong></div>
      </div>
      <div class="status-badge">Verified Submitted</div>
    </div>
    <div class="grid">
      <div class="card"><div class="card-lbl">Total Score</div><div class="card-val" style="color:#10b981">${report.participant.score} / ${maxScore}</div></div>
      <div class="card"><div class="card-lbl">Questions Solved</div><div class="card-val" style="color:#60a5fa">${report.participant.solvedCount} / ${report.contest.problems.length}</div></div>
      <div class="card"><div class="card-lbl">Class Percentile</div><div class="card-val" style="color:#c084fc">${report.percentile}%</div></div>
      <div class="card"><div class="card-lbl">Proctor Flags</div><div class="card-val" style="color:#f59e0b">${report.participant.warnings} / ${report.contest.maxWarnings}</div></div>
    </div>
    <div class="section-title">Submitted Code Solution Summary</div>
    <div class="code-container">
      ${report.submissions.map(s => {
        const prob = report.contest.problems.find(p => p.problemId === s.problemId);
        const codeLines = (s.code || '').trim().split('\n').slice(0, 20).join('\n');
        return `<div style="margin-bottom:8px;"><strong>[${prob?.problem.title || s.problemId}] - ${s.language}</strong><pre style="margin:3px 0 0 0;"><code>${codeLines.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre></div>`;
      }).join('')}
    </div>
    <div class="footer">
      <span>Verified by ContestOS Exam Integrity Engine</span>
      <span>Official Scorecard Performance Certificate</span>
    </div>
  </div>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ContestOS_Scorecard_${report.contest.title.replace(/\s+/g, '_')}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    notify.toast.success('Performance Scorecard report downloaded successfully!');
  };

  const triggerPrint = () => {
    if (detectSebBrowser()) {
      downloadHTMLReport();
      return;
    }
    try {
      window.print();
    } catch {
      downloadHTMLReport();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-400" />
          <p className="text-sm text-gray-400">Loading performance scorecard...</p>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-white p-4">
        <div className="max-w-md w-full text-center space-y-4 bg-zinc-900 border border-white/10 rounded-2xl p-8">
          <svg className="w-12 h-12 text-red-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h2 className="text-xl font-bold">Access Restricted</h2>
          <p className="text-sm text-gray-400">{error || 'Unable to access your contest scorecard.'}</p>
          <button onClick={() => navigate('/contests')} className="px-5 py-2 bg-zinc-800 hover:bg-zinc-700 font-semibold rounded-xl text-sm transition cursor-pointer">
            Go Back to Contests
          </button>
        </div>
      </div>
    );
  }

  const activeProbSubmissions = report.submissions.filter(s => s.problemId === activeSubTab);
  const activeProb = report.contest.problems.find(p => p.problemId === activeSubTab);
  const maxScore = Math.max(100, report.contest.problems.length * 100);

  return (
    <div className="min-h-screen bg-zinc-950 text-white pb-16 font-sans relative">
      {/* Choice Overlay */}
      <AnimatePresence>
        {showChoiceOverlay && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/80 backdrop-blur-md">
            <div
              ref={overlayRef}
              className="relative w-full max-w-lg mx-4 rounded-3xl bg-zinc-900 border border-white/10 p-8 shadow-2xl overflow-hidden"
            >
              {!isShattering && (
                <AnimatePresence mode="wait">
                  {showExitGuidelines ? (
                    <motion.div
                      key="exit"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-6 text-center"
                    >
                      <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-2 text-3xl animate-bounce">
                        🎓
                      </div>
                      <h3 className="text-2xl font-black text-white tracking-tight">
                        Thank You for Participating!
                      </h3>
                      
                      <motion.p
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="text-zinc-300 text-sm max-w-md mx-auto italic font-medium leading-relaxed"
                      >
                        "Success is not final, failure is not fatal: it is the courage to continue that counts."
                      </motion.p>
                      
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className="p-5 bg-zinc-950/60 border border-white/5 rounded-2xl text-left space-y-3 max-w-md mx-auto"
                      >
                        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest block">Safe Exam Browser Exit Guidelines</span>
                        <ul className="text-xs text-zinc-400 space-y-2.5 list-disc pl-4 leading-relaxed">
                          <li>Click the red <strong className="text-red-400">Power/Quit button</strong> in the bottom-right corner of the Safe Exam Browser window.</li>
                          <li>Or use keyboard shortcut <kbd className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-zinc-300 font-mono">Ctrl + Q</kbd> (Windows) or <kbd className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-zinc-300 font-mono">Cmd + Q</kbd> (macOS).</li>
                          {report?.contest?.sebQuitPassword && (
                            <li className="mt-2 pt-2 border-t border-white/5">
                              SEB Quit Password: <code className="px-2 py-1 bg-red-500/10 border border-red-500/20 rounded text-red-400 font-mono text-sm select-all">{report.contest.sebQuitPassword}</code>
                            </li>
                          )}
                        </ul>
                      </motion.div>

                      <div className="flex flex-col gap-3 max-w-xs mx-auto pt-4">
                        <button
                          onClick={() => {
                            window.location.href = "seb://quit";
                            setTimeout(() => {
                              window.close();
                            }, 300);
                          }}
                          className="w-full py-3.5 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-black text-sm transition-all duration-300 active:scale-[0.98] shadow-lg shadow-red-600/10 cursor-pointer"
                        >
                          Quit Safe Exam Browser
                        </button>
                        <button
                          onClick={() => setShowExitGuidelines(false)}
                          className="w-full py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-zinc-200 font-bold text-xs transition-all duration-300 border border-white/5 cursor-pointer"
                        >
                          ← Back to Choices
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="choice"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="space-y-5 text-center"
                    >
                      <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-2 text-3xl">
                        🔒
                      </div>
                      <div>
                        <h3 className="text-2xl font-black text-white tracking-tight">Contest Completed</h3>
                        <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
                          Your answers have been securely submitted. What would you like to do next?
                        </p>
                      </div>

                      <div className="flex flex-col gap-3 max-w-xs mx-auto pt-4">
                        <button
                          onClick={() => setShowExitGuidelines(true)}
                          className="w-full py-4 rounded-2xl bg-white/5 border border-white/10 text-white font-black text-sm hover:bg-white/10 transition-all duration-300 active:scale-[0.98] cursor-pointer"
                        >
                          Exit SEB Secure Mode
                        </button>
                        
                        <button
                          onClick={(e) => shatter(e.clientX, e.clientY)}
                          className="w-full py-4 rounded-2xl bg-emerald-500 text-zinc-950 font-black text-sm hover:bg-emerald-400 transition-all duration-300 shadow-lg shadow-emerald-500/10 active:scale-[0.98] cursor-pointer"
                        >
                          Analyze Your Score
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              )}

              <ShatterCanvas />
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Print styles */}
      <style>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
          }
          .no-print {
            display: none !important;
          }
          .print-card {
            border: 1px solid #e4e4e7 !important;
            background: #fafafa !important;
            color: black !important;
          }
          .print-badge {
            border: 1px solid #ccc !important;
            color: black !important;
          }
          .code-block {
            background: #f4f4f5 !important;
            color: black !important;
            border: 1px solid #e4e4e7 !important;
          }
        }
      `}</style>

      {!showChoiceOverlay && (
        <>
          {/* Header section */}
          <div className="border-b border-white/10 bg-zinc-900/50 backdrop-blur-md sticky top-0 z-30 no-print">
            <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    if (detectSebBrowser()) {
                      setShowChoiceOverlay(true);
                      setShowExitGuidelines(true);
                    } else {
                      navigate('/contests');
                    }
                  }}
                  className="p-2 hover:bg-zinc-800 rounded-lg text-gray-400 hover:text-white transition cursor-pointer"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <div>
                  <h1 className="text-lg font-bold truncate max-w-md">{report.contest.title}</h1>
                  <p className="text-xs text-gray-400">Student Performance Report</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={triggerPrint} className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-sm font-semibold rounded-xl text-gray-300 hover:text-white transition flex items-center gap-2 cursor-pointer">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  Download PDF Report
                </button>
              </div>
            </div>
          </div>

          <div className="max-w-6xl mx-auto px-4 mt-8 space-y-6">
            {/* Banner metadata */}
            <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 print-card flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h2 className="text-2xl font-black text-white md:text-3xl tracking-tight no-print">CONTEST SCORECARD</h2>
                <h2 className="hidden print:block text-2xl font-black text-black">ContestOS Exam Performance Certificate</h2>
                <div className="flex flex-wrap items-center gap-3 mt-2 text-xs md:text-sm text-gray-400">
                  <span>Candidate ID: <strong className="text-white print:text-black">{report.participant.id.slice(0, 8)}</strong></span>
                  <span>•</span>
                  <span>Attempted: <strong className="text-white print:text-black">{new Date(report.participant.joinedAt).toLocaleString()}</strong></span>
                  <span>•</span>
                  {report.participant.autoSubmitted && (
                    <span className="text-red-400 font-bold">Auto-Submitted (Force Locked)</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                {report.participant.isTerminated ? (
                  <span className="px-3 py-1.5 bg-red-500/20 text-red-400 text-xs uppercase font-extrabold rounded-xl border border-red-500/30 print-badge">
                    Suspended / Terminated
                  </span>
                ) : report.participant.status === 'COMPLETED' ? (
                  <span className="px-3 py-1.5 bg-emerald-500/20 text-emerald-400 text-xs uppercase font-extrabold rounded-xl border border-emerald-500/30 print-badge">
                    Verified Submitted
                  </span>
                ) : (
                  <span className="px-3 py-1.5 bg-yellow-500/20 text-yellow-400 text-xs uppercase font-extrabold rounded-xl border border-yellow-500/30 print-badge">
                    In Evaluation
                  </span>
                )}
              </div>
            </div>

            {/* Score & metrics grids */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Score Circle Card */}
              <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 print-card flex flex-col items-center text-center">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Total Score</h3>
                <DynamicRingProgress
                  percentage={(report.participant.score / maxScore) * 100}
                  color="#10b981"
                >
                  <span className="text-3xl font-black text-white print:text-black">{report.participant.score}</span>
                  <span className="text-xs text-gray-500 block">/ {maxScore}</span>
                </DynamicRingProgress>
                <p className="text-xs text-gray-400 mt-4">
                  Earned {report.participant.score} of {maxScore} points.
                </p>
              </div>

              {/* Solved Card */}
              <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 print-card flex flex-col items-center text-center">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Questions Solved</h3>
                <DynamicRingProgress
                  percentage={(report.participant.solvedCount / Math.max(1, report.contest.problems.length)) * 100}
                  color="#3b82f6"
                >
                  <span className="text-3xl font-black text-white print:text-black">{report.participant.solvedCount}</span>
                  <span className="text-xs text-gray-500 block">/ {report.contest.problems.length}</span>
                </DynamicRingProgress>
                <p className="text-xs text-gray-400 mt-4">
                  Solved {report.participant.solvedCount} of {report.contest.problems.length} problems.
                </p>
              </div>

              {/* Contest Rank Card (Replaces Class Percentile) */}
              <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 print-card flex flex-col items-center text-center">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Contest Rank</h3>
                <DynamicRingProgress
                  percentage={Math.max(10, Math.round(((Math.max(1, report.participant.totalParticipants || 1) - (report.participant.rank || 1) + 1) / Math.max(1, report.participant.totalParticipants || 1)) * 100))}
                  color="#a855f7"
                >
                  <span className="text-2xl font-black text-white print:text-black">#{report.participant.rank || 1}</span>
                  <span className="text-xs text-gray-500 block">/ {report.participant.totalParticipants || 1}</span>
                </DynamicRingProgress>
                <p className="text-xs text-gray-400 mt-4">
                  Ranked #{report.participant.rank || 1} out of {report.participant.totalParticipants || 1} contestants.
                </p>
              </div>

              {/* Proctoring Flag Card */}
              <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 print-card flex flex-col items-center text-center">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Proctoring Flag count</h3>
                <DynamicRingProgress
                  percentage={report.participant.warnings === 0 ? 100 : Math.round((report.participant.warnings / Math.max(1, report.contest.maxWarnings)) * 100)}
                  color={report.participant.warnings === 0 ? '#10b981' : (report.participant.warnings >= report.contest.maxWarnings ? '#ef4444' : '#f59e0b')}
                >
                  <span className={`text-3xl font-black print:text-black ${report.participant.warnings >= report.contest.maxWarnings ? 'text-red-400' : (report.participant.warnings > 0 ? 'text-amber-400' : 'text-emerald-400')}`}>
                    {report.participant.warnings}
                  </span>
                  <span className="text-xs text-gray-500 block">/ {report.contest.maxWarnings} max</span>
                </DynamicRingProgress>
                <p className="text-xs text-gray-400 mt-4">
                  {report.participant.warnings === 0 ? '0 integrity alerts logged. Fully compliant.' : 'Integrity alerts logged in active session.'}
                </p>
              </div>
            </div>

            {/* Main core layout grid: timeline on left (or code submissions), sidebar details/disputes on right */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Submissions code viewer on left */}
              <div className="lg:col-span-2 space-y-6 flex flex-col">
                <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 print-card flex-1 flex flex-col">
                  <h3 className="text-sm font-bold text-white print:text-black uppercase tracking-wider mb-4 flex items-center gap-2">
                    <span>📁 Submitted Solution Artifacts</span>
                  </h3>

                  {/* Tab options */}
                  <div className="flex border-b border-white/10 mb-4 overflow-x-auto no-print">
                    {report.contest.problems.map(prob => (
                      <button
                        key={prob.problemId}
                        onClick={() => setActiveSubTab(prob.problemId)}
                        className={`py-2 px-4 text-xs font-semibold border-b-2 whitespace-nowrap transition cursor-pointer ${
                          activeSubTab === prob.problemId
                            ? 'border-emerald-400 text-white'
                            : 'border-transparent text-gray-400 hover:text-white'
                        }`}
                      >
                        {prob.problem.title}
                      </button>
                    ))}
                  </div>

                  {/* Code blocks display */}
                  <div className="flex-1 min-h-[300px] flex flex-col">
                    {activeProb && (
                      <div className="hidden print:block mb-3 border-b pb-2">
                        <h4 className="font-bold text-black text-sm">Problem: {activeProb.problem.title}</h4>
                      </div>
                    )}
                    {activeProbSubmissions.length > 0 ? (
                      <div className="flex-1 flex flex-col space-y-3">
                        <div className="flex items-center justify-between text-xs text-gray-400">
                          <span>Language: <strong className="text-white print:text-black">{activeProbSubmissions[0].language}</strong></span>
                          <span>Submitted: {new Date(activeProbSubmissions[0].submittedAt).toLocaleString()}</span>
                        </div>
                        <pre className="flex-1 bg-zinc-950 text-gray-300 font-mono text-xs p-4 rounded-xl border border-white/5 overflow-x-auto select-text code-block">
                          <code>{activeProbSubmissions[0].code}</code>
                        </pre>
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
                        <svg className="w-12 h-12 text-zinc-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <p className="text-xs text-gray-500">No submissions uploaded for this problem.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right sidebar: Disputes and integrity log details */}
              <div className="space-y-6">
                {/* Disputes section */}
                <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 print-card no-print">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                    <span>⚖️ Dispute Resolution Center</span>
                  </h3>

                  {!report.participant.dispute ? (
                    <form onSubmit={handleDisputeSubmit} className="space-y-4">
                      <p className="text-xs text-gray-400 leading-relaxed">
                        Not satisfied with your results, or faced technical issues? Describe your issue below to appeal for manual warning resets or score reviews.
                      </p>
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Appeal Reason / Description</label>
                        <textarea
                          value={disputeReason}
                          onChange={e => setDisputeReason(e.target.value)}
                          placeholder="Specify false-positive context, network drops, or technical issues..."
                          className="w-full h-24 bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 resize-none transition"
                          required
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={disputeSubmitting}
                        className="w-full py-2.5 bg-emerald-500 disabled:bg-zinc-800 hover:bg-emerald-400 disabled:opacity-50 text-black font-bold text-xs rounded-xl transition cursor-pointer"
                      >
                        {disputeSubmitting ? 'Submitting Appeal...' : 'Submit Dispute'}
                      </button>
                    </form>
                  ) : (
                    <div className="space-y-4">
                      <div className="p-3.5 rounded-xl border border-white/5 bg-white/[0.02]">
                        <span className="block text-[10px] text-gray-500 uppercase tracking-wider">Appeal Status</span>
                        {report.participant.dispute.status === 'SUBMITTED' && (
                          <span className="inline-block mt-1 px-2.5 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs font-bold rounded-lg border border-yellow-500/20">
                            ⏳ Pending Review
                          </span>
                        )}
                        {report.participant.dispute.status === 'UNDER_REVIEW' && (
                          <span className="inline-block mt-1 px-2.5 py-0.5 bg-purple-500/20 text-purple-400 text-xs font-bold rounded-lg border border-purple-500/20">
                            🔍 Under Active Review
                          </span>
                        )}
                        {report.participant.dispute.status === 'ACCEPTED' && (
                          <span className="inline-block mt-1 px-2.5 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs font-bold rounded-lg border border-emerald-500/20">
                            ✅ Appeal Accepted / warnings reset
                          </span>
                        )}
                        {report.participant.dispute.status === 'REJECTED' && (
                          <span className="inline-block mt-1 px-2.5 py-0.5 bg-red-500/20 text-red-400 text-xs font-bold rounded-lg border border-red-500/20">
                            ❌ Appeal Declined
                          </span>
                        )}
                      </div>

                      <div className="space-y-2">
                        <label className="block text-[10px] uppercase font-bold text-gray-400">Your Submitted Reason</label>
                        <p className="text-xs text-gray-300 bg-zinc-950 p-3 border border-white/5 rounded-xl whitespace-pre-wrap">{report.participant.dispute.reason}</p>
                      </div>

                      {report.participant.dispute.resolution && (
                        <div className="space-y-2">
                          <label className="block text-[10px] uppercase font-bold text-gray-400">Instructor Action Note</label>
                          <p className="text-xs text-emerald-400 bg-emerald-500/5 p-3 border border-emerald-500/10 rounded-xl whitespace-pre-wrap">{report.participant.dispute.resolution}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Session Proctor Log Timeline */}
                <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 print-card">
                  <h3 className="text-sm font-bold text-white print:text-black uppercase tracking-wider mb-4 flex items-center gap-2">
                    <span>🛡️ Proctor Log Timeline</span>
                  </h3>

                  {report.integrityEvents.length === 0 ? (
                    <p className="text-xs text-gray-500 text-center py-6">No integrity incidents logged. Session was fully compliant.</p>
                  ) : (
                    <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                      {report.integrityEvents.map(evt => {
                        const sev = getEventSeverity(evt.eventType);
                        return (
                          <div key={evt.id} className="p-3 border border-white/5 rounded-xl bg-zinc-950/40 print-card flex flex-col gap-1 text-xs">
                            <div className="flex items-center justify-between">
                              <span className={`px-2 py-0.5 text-[10px] uppercase font-bold rounded-md border ${sev.bg} ${sev.text}`}>
                                {sev.label}
                              </span>
                              <span className="text-[10px] text-gray-500">{new Date(evt.detectedAt).toLocaleTimeString()}</span>
                            </div>
                            <span className="font-semibold text-white print:text-black">{evt.eventType.replace(/_/g, ' ')}</span>
                            {evt.detail && (
                              <span className="text-gray-400 font-mono text-[10px] select-text">
                                {JSON.stringify(evt.detail)}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default ContestReport;
