import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ProblemLockModalProps {
  isOpen: boolean;
  problemTitle: string;
  scoreEarned: number;
  maxScore: number;
  passedTests: number;
  totalTests: number;
  onConfirmLock: () => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export const ProblemLockModal: React.FC<ProblemLockModalProps> = ({
  isOpen,
  problemTitle,
  scoreEarned,
  maxScore,
  passedTests,
  totalTests,
  onConfirmLock,
  onCancel,
  isSubmitting = false,
}) => {
  if (!isOpen) return null;

  const isFullScore = scoreEarned >= maxScore || passedTests === totalTests;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-zinc-950 border border-white/10 rounded-3xl p-6 md:p-8 max-w-md w-full space-y-6 shadow-2xl relative overflow-hidden"
        >
          {/* Ambient Glow */}
          <div className={`absolute -top-24 -right-24 w-48 h-48 rounded-full blur-3xl pointer-events-none ${
            isFullScore ? 'bg-emerald-500/20' : 'bg-amber-500/20'
          }`} />

          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl font-black shrink-0 ${
              isFullScore ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
            }`}>
              {isFullScore ? '🔒' : '⚠️'}
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-white/5 border border-white/10 text-gray-400">
                Submit & Lock Confirmation
              </span>
              <h3 className="text-lg font-black text-white mt-1 truncate max-w-[280px]">
                {problemTitle}
              </h3>
            </div>
          </div>

          {/* Test Case Score Summary Card */}
          <div className="bg-zinc-900/60 border border-white/10 rounded-2xl p-4 space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-400 font-medium">Test Cases Passed</span>
              <span className={`font-mono font-black ${isFullScore ? 'text-emerald-400' : 'text-amber-400'}`}>
                {passedTests} / {totalTests} Passed
              </span>
            </div>
            <div className="w-full bg-black/40 rounded-full h-2 overflow-hidden border border-white/5">
              <div
                className={`h-full transition-all duration-500 ${isFullScore ? 'bg-emerald-500' : 'bg-amber-500'}`}
                style={{ width: `${Math.round((passedTests / Math.max(1, totalTests)) * 100)}%` }}
              />
            </div>
            <div className="flex justify-between items-center border-t border-white/5 pt-2 text-xs">
              <span className="text-gray-400 font-medium">Score Awarded</span>
              <span className="font-mono font-extrabold text-white text-sm">
                {scoreEarned} / {maxScore} pts
              </span>
            </div>
          </div>

          {/* Lock Warning Notice */}
          <p className="text-xs text-gray-300 leading-relaxed">
            Are you sure you want to final-submit and lock this problem?
            <span className="block mt-1 font-bold text-amber-400">
              🔒 Once locked, your code for this problem will be finalized and saved to the contest leaderboard.
            </span>
          </p>

          {/* Buttons */}
          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 font-bold text-xs rounded-xl transition cursor-pointer disabled:opacity-40"
            >
              Keep Editing
            </button>

            <button
              type="button"
              onClick={onConfirmLock}
              disabled={isSubmitting}
              className={`px-5 py-2.5 font-black text-xs rounded-xl transition shadow-lg cursor-pointer flex items-center gap-2 ${
                isFullScore
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-500/20'
                  : 'bg-amber-500 hover:bg-amber-400 text-black shadow-amber-500/20'
              } disabled:opacity-40`}
            >
              {isSubmitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  <span>Locking…</span>
                </>
              ) : (
                <>
                  <span>🔒 Submit & Lock Problem</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ProblemLockModal;
