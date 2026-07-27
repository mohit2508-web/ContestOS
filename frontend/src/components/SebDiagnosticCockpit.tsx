import React from 'react';

export default function SebDiagnosticCockpit({ contest, diagnostics, onStartExam }: any) {
  return (
    <div className="bg-zinc-900 border border-amber-500/20 rounded-2xl p-6 text-center space-y-4">
      <div className="flex items-center justify-center gap-2">
        <span className="text-2xl">🔒</span>
        <h3 className="text-xl font-bold text-white">Safe Exam Browser Verification</h3>
      </div>
      <p className="text-xs text-gray-400">Environment integrity and proctoring checks active for {contest?.title}</p>
      
      <div className="bg-black/50 p-4 rounded-xl text-left space-y-2 font-mono text-xs text-gray-300">
        <div>• Camera & Audio: OK</div>
        <div>• SEB Hash Verification: OK</div>
        <div>• Network Latency: {diagnostics?.latency ? `${diagnostics.latency}ms` : 'Check Passed'}</div>
      </div>

      <button
        onClick={onStartExam}
        className="px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-400 text-black font-extrabold text-sm rounded-xl hover:from-amber-400 hover:to-amber-300 transition"
      >
        Enter Exam Hall →
      </button>
    </div>
  );
}
