import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import MarkdownRenderer from '../MarkdownRenderer';

interface ProblemQuickViewModalProps {
  isOpen: boolean;
  problem: any;
  points: number;
  onClose: () => void;
  onLaunch: () => void;
}

export const ProblemQuickViewModal: React.FC<ProblemQuickViewModalProps> = ({
  isOpen,
  problem,
  points,
  onClose,
  onLaunch,
}) => {
  if (!isOpen || !problem) return null;

  const probType = problem.problemType || 'code';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-zinc-950 border border-white/10 rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden relative"
        >
          {/* Header */}
          <div className="p-6 border-b border-white/10 bg-zinc-900/60 flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-black uppercase font-mono">
                  {probType}
                </span>
                <span className={`px-2.5 py-0.5 rounded text-[10px] font-black uppercase font-mono ${
                  problem.difficulty === 'Easy' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' :
                  problem.difficulty === 'Medium' ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400' :
                  'bg-rose-500/10 border border-rose-500/20 text-rose-400'
                }`}>
                  {problem.difficulty || 'Medium'}
                </span>
                <span className="px-2.5 py-0.5 rounded bg-white/5 border border-white/10 text-white text-[10px] font-black font-mono">
                  {points} Points
                </span>
              </div>
              <h2 className="text-xl font-black text-white tracking-tight">
                {problem.title}
              </h2>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Description Content */}
          <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-4 text-gray-300 text-sm leading-relaxed">
            <MarkdownRenderer content={problem.description || 'No description available for this problem.'} />
          </div>

          {/* Footer Action Bar */}
          <div className="p-4 px-6 border-t border-white/10 bg-zinc-900/60 flex items-center justify-between">
            <span className="text-xs text-gray-400">
              Ready to code? Click launch to open the interactive playground.
            </span>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 font-bold text-xs rounded-xl transition"
              >
                Close
              </button>
              <button
                onClick={() => {
                  onClose();
                  onLaunch();
                }}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-black text-xs rounded-xl transition shadow-lg shadow-amber-500/20 flex items-center gap-2"
              >
                <span>🚀 Launch Playground</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ProblemQuickViewModal;
