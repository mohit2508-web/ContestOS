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
          className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-black font-extrabold rounded-xl transition text-sm"
        >
          I Agree & Start Exam →
        </button>
      </div>
    </div>
  );
}

export function FinishExamFAB({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 right-6 px-5 py-3 bg-red-600 hover:bg-red-500 text-white font-extrabold text-xs rounded-full shadow-lg shadow-red-600/30 transition flex items-center gap-2 z-40"
    >
      <span>🏁</span> Finish Exam
    </button>
  );
}

export function ExamSummaryModal({ data, onConfirm }: { data: any; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
      <div className="bg-zinc-900 border border-white/10 rounded-2xl max-w-md w-full p-6 space-y-4 text-center">
        <h3 className="text-xl font-bold text-white">Submit Exam</h3>
        <p className="text-xs text-gray-400">Are you sure you want to finalize your submission? You cannot change your code after submitting.</p>
        <button
          onClick={onConfirm}
          className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-extrabold rounded-xl transition text-sm"
        >
          Confirm & Finalize →
        </button>
      </div>
    </div>
  );
}

export function FinalConfirmModal() {
  return null;
}

export function PostSubmitSummary() {
  return null;
}
