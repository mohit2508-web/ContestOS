import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface LiquidCardDeckProps {
  questions: any[];
  currentIndex: number;
  onSelectIndex: (idx: number) => void;
  onClose: () => void;
}

export const LiquidCardDeck: React.FC<LiquidCardDeckProps> = ({
  questions,
  currentIndex,
  onSelectIndex,
  onClose,
}) => {
  const currentQ = questions[currentIndex];

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-xl flex items-center justify-between mb-4">
        <span className="text-teal-400 font-extrabold text-sm flex items-center space-x-2">
          <span>🃏 Untimed Practice Liquid 3D Card Deck</span>
        </span>
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1 bg-[#1e293b] text-slate-300 hover:text-white rounded-xl text-xs font-bold"
        >
          ✕ Exit Practice Deck
        </button>
      </div>

      <div className="relative w-full max-w-xl h-96 flex items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ scale: 0.9, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: -30 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="w-full h-full bg-[#0f172a] border border-teal-500/30 rounded-3xl p-6 shadow-2xl flex flex-col justify-between"
          >
            <div className="space-y-4">
              <span className="text-xs font-bold text-teal-400 uppercase tracking-widest block">
                Card {currentIndex + 1} of {questions.length}
              </span>
              <h2 className="text-lg font-bold text-slate-100">{currentQ?.content}</h2>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-[#1e293b]">
              <button
                type="button"
                onClick={() => currentIndex > 0 && onSelectIndex(currentIndex - 1)}
                disabled={currentIndex === 0}
                className="px-4 py-2 bg-[#1e293b] text-slate-300 rounded-xl text-xs font-bold disabled:opacity-40"
              >
                ◄ Swipe Prev
              </button>
              <button
                type="button"
                onClick={() => currentIndex < questions.length - 1 && onSelectIndex(currentIndex + 1)}
                disabled={currentIndex === questions.length - 1}
                className="px-4 py-2 bg-teal-400 text-black font-extrabold rounded-xl text-xs shadow-lg shadow-teal-500/20 disabled:opacity-40"
              >
                Swipe Next ►
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};
