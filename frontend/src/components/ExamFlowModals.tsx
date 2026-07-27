import React from 'react';

export function PreExamInstructionsModal({ onProceed }: { onProceed: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
      <div className="bg-zinc-900 border border-white/10 rounded-2xl max-w-lg w-full p-6 space-y-4">
        <h3 className="text-xl font-bold text-white">Contest Instructions</h3>
        <ul className="text-xs text-gray-300 space-y-2 list-disc pl-4">
          <li>Do not switch tabs or exit fullscreen mode. Violations will be recorded.</li>
          <li>All programming solutions must read from stdin and write to stdout.</li>
          <li>Ensure stable internet connectivity throughout the examination.</li>
        </ul>
        <button
          onClick={onProceed}
          className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-black font-extrabold rounded-xl transition text-sm cursor-pointer"
        >
          I Agree & Start Exam →
        </button>
      </div>
    </div>
  );
}

export function FinishExamFAB({ onClick, onFinish }: { onClick?: () => void; contest?: any; onFinish?: () => void }) {
  const handler = onFinish || onClick;
  return (
    <button
      onClick={handler}
      className="fixed bottom-6 right-6 px-5 py-3 bg-red-600 hover:bg-red-500 text-white font-extrabold text-xs rounded-full shadow-lg shadow-red-600/30 transition flex items-center gap-2 z-40 cursor-pointer"
    >
      <span>🏁</span> Finish Exam
    </button>
  );
}

export function ExamSummaryModal({ data, report, onConfirm, onProceed }: { data?: any; report?: any; onConfirm?: () => void; onProceed?: () => void }) {
  const handler = onProceed || onConfirm;
  const summaryData = report || data;
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
      <div className="bg-zinc-900 border border-white/10 rounded-2xl max-w-md w-full p-6 space-y-4 text-center">
        <h3 className="text-xl font-bold text-white">Submit Exam Summary</h3>
        {summaryData && (
          <div className="bg-black/50 border border-white/5 rounded-xl p-3 text-xs text-gray-300 space-y-1">
            <p>Score: <span className="font-bold text-emerald-400">{summaryData.score || 0}</span> / {summaryData.maxScore || 100}</p>
            <p>Problems Solved: <span className="font-bold text-amber-400">{summaryData.solvedCount || 0}</span> / {summaryData.totalProblems || 0}</p>
          </div>
        )}
        <p className="text-xs text-gray-400">Are you sure you want to finalize your submission? You cannot change your code after submitting.</p>
        <button
          onClick={handler}
          className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-extrabold rounded-xl transition text-sm cursor-pointer"
        >
          Confirm & Finalize →
        </button>
      </div>
    </div>
  );
}

export function FinalConfirmModal({ onFinalized, onCancel }: { contestId?: string; onFinalized?: () => void; onCancel?: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
      <div className="bg-zinc-900 border border-white/10 rounded-2xl max-w-md w-full p-6 space-y-4 text-center">
        <h3 className="text-xl font-bold text-white">Final Confirmation</h3>
        <p className="text-xs text-gray-300">Submit all answers and exit contest mode?</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 bg-white/10 hover:bg-white/15 text-white font-bold rounded-xl text-xs transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={onFinalized}
            className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-xs transition cursor-pointer"
          >
            Submit & Exit
          </button>
        </div>
      </div>
    </div>
  );
}

export function PostSubmitSummary({ report }: { contestId?: string; report?: any }) {
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center space-y-4">
      <div className="text-5xl">🎉</div>
      <h2 className="text-3xl font-black text-white">Exam Completed!</h2>
      <p className="text-gray-400 text-sm max-w-md">Your responses have been securely submitted and recorded.</p>
      {report && (
        <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 text-left space-y-2 max-w-sm w-full">
          <p className="text-xs text-gray-400">Total Score: <span className="text-emerald-400 font-bold">{report.score}</span></p>
          <p className="text-xs text-gray-400">Proctoring Status: <span className="text-emerald-400 font-bold">{report.integrity}</span></p>
        </div>
      )}
      <a href="/contests" className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs rounded-xl transition">
        Back to Contests
      </a>
    </div>
  );
}
