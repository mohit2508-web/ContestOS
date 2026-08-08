import React, { useState, useEffect } from 'react';

interface DiagnosticPreflightModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProceed: () => void;
  contestTitle?: string;
}

export function DiagnosticPreflightModal({ isOpen, onClose, onProceed, contestTitle }: DiagnosticPreflightModalProps) {
  const [step, setStep] = useState(1);
  const [ping, setPing] = useState<number | null>(null);
  const [downloadSpeed, setDownloadSpeed] = useState<number | null>(null);
  const [webcamStatus, setWebcamStatus] = useState<'testing' | 'pass' | 'fail'>('testing');
  const [micStatus, setMicStatus] = useState<'testing' | 'pass' | 'fail'>('testing');
  const [virtualCamDetected, setVirtualCamDetected] = useState(false);
  const [rdpDetected, setRdpDetected] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    // Simulate pre-flight hardware diagnostics
    const timer1 = setTimeout(() => {
      setPing(Math.floor(Math.random() * 20) + 12);
      setDownloadSpeed(Math.floor(Math.random() * 40) + 35);
    }, 1000);

    const timer2 = setTimeout(() => {
      setWebcamStatus('pass');
      setMicStatus('pass');
      setVirtualCamDetected(false);
      setRdpDetected(false);
    }, 2000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const isReady = ping !== null && webcamStatus === 'pass' && !virtualCamDetected && !rdpDetected;

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 selection:bg-amber-500/20">
      <div className="bg-zinc-950 border border-white/20 rounded-3xl p-6 md:p-8 max-w-lg w-full space-y-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-teal-500 via-emerald-400 to-amber-500" />

        <div className="flex justify-between items-center border-b border-white/10 pb-4">
          <div>
            <span className="text-[10px] font-extrabold bg-teal-500/10 text-teal-400 border border-teal-500/20 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              Assessment Pre-Flight Station
            </span>
            <h3 className="text-xl font-black text-white mt-1">System Diagnostic Test</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white font-bold text-sm">✕</button>
        </div>

        {contestTitle && (
          <div className="p-3 bg-white/5 border border-white/10 rounded-xl text-xs text-gray-300">
            Target Exam: <strong className="text-white">{contestTitle}</strong>
          </div>
        )}

        {/* Checkpoint Table */}
        <div className="space-y-3 font-mono text-xs">
          <div className="p-3 bg-zinc-900 border border-white/10 rounded-xl flex items-center justify-between">
            <span className="text-gray-300 font-sans font-bold">1. Network RTT & Bandwidth</span>
            <span className="font-bold text-emerald-400">
              {ping ? `${ping} ms · ${downloadSpeed} Mbps` : 'Checking...'}
            </span>
          </div>

          <div className="p-3 bg-zinc-900 border border-white/10 rounded-xl flex items-center justify-between">
            <span className="text-gray-300 font-sans font-bold">2. Optical Camera & Mic Feeds</span>
            <span className={`font-bold ${webcamStatus === 'pass' ? 'text-emerald-400' : 'text-amber-400'}`}>
              {webcamStatus === 'pass' ? '✅ Pass (HD Stream Active)' : 'Testing Camera...'}
            </span>
          </div>

          <div className="p-3 bg-zinc-900 border border-white/10 rounded-xl flex items-center justify-between">
            <span className="text-gray-300 font-sans font-bold">3. Virtual Cam & OBS Bypass Check</span>
            <span className="font-bold text-emerald-400">
              {virtualCamDetected ? '❌ OBS Detected!' : '✅ None Detected'}
            </span>
          </div>

          <div className="p-3 bg-zinc-900 border border-white/10 rounded-xl flex items-center justify-between">
            <span className="text-gray-300 font-sans font-bold">4. Remote Desktop (RDP) Guard</span>
            <span className="font-bold text-emerald-400">
              {rdpDetected ? '❌ RDP Active!' : '✅ Clean Local Device'}
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl transition"
          >
            Cancel
          </button>
          <button
            onClick={onProceed}
            disabled={!isReady}
            className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-black font-extrabold text-xs rounded-xl transition shadow-lg shadow-emerald-500/20 disabled:opacity-40"
          >
            🚀 Launch Secure Assessment
          </button>
        </div>
      </div>
    </div>
  );
}

export default DiagnosticPreflightModal;
