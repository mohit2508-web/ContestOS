import React, { useState } from 'react';

export interface ScatterCandidate {
  userId?: string;
  rank: number;
  name: string;
  email: string;
  score: number;
  penalty: number; // time in seconds
  status: string;
}

interface QuadrantScatterChartProps {
  candidates: ScatterCandidate[];
  cutoffScore: number;
  onSelectQuadrant?: (quadrant: 'rockstar' | 'methodical' | 'guesser' | 'underperforming' | null) => void;
}

export function QuadrantScatterChart({ candidates, cutoffScore, onSelectQuadrant }: QuadrantScatterChartProps) {
  const [activeQuadrant, setActiveQuadrant] = useState<'rockstar' | 'methodical' | 'guesser' | 'underperforming' | null>(null);

  // Time Threshold (Midpoint assumption: e.g. 1800s / 30 mins)
  const medianTimeSeconds = 1800;

  const handleQuadrantClick = (q: 'rockstar' | 'methodical' | 'guesser' | 'underperforming') => {
    const nextQ = activeQuadrant === q ? null : q;
    setActiveQuadrant(nextQ);
    if (onSelectQuadrant) onSelectQuadrant(nextQ);
  };

  const getQuadrant = (score: number, time: number) => {
    if (score >= cutoffScore && time <= medianTimeSeconds) return 'rockstar';
    if (score >= cutoffScore && time > medianTimeSeconds) return 'methodical';
    if (score < cutoffScore && time <= medianTimeSeconds) return 'guesser';
    return 'underperforming';
  };

  const rockstars = candidates.filter(c => getQuadrant(c.score, c.penalty) === 'rockstar');
  const methodicals = candidates.filter(c => getQuadrant(c.score, c.penalty) === 'methodical');
  const guessers = candidates.filter(c => getQuadrant(c.score, c.penalty) === 'guesser');
  const underperformings = candidates.filter(c => getQuadrant(c.score, c.penalty) === 'underperforming');

  return (
    <div className="bg-zinc-950 border border-white/10 rounded-2xl p-6 space-y-4 shadow-2xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div>
          <h3 className="text-base font-black text-white flex items-center gap-2">
            🎯 Time vs. Score Quadrant Matrix
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Quadrant categorization based on Speed (30m threshold) vs. Performance ({cutoffScore} pts cutoff). Click any quadrant to filter leaderboard.
          </p>
        </div>
        {activeQuadrant && (
          <button
            onClick={() => { setActiveQuadrant(null); if (onSelectQuadrant) onSelectQuadrant(null); }}
            className="text-xs text-teal-400 font-bold bg-teal-500/10 px-3 py-1 rounded-xl border border-teal-500/20 hover:bg-teal-500/20 transition"
          >
            Clear Quadrant Filter (x)
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
        {/* Quadrant 1: Rockstars */}
        <div
          onClick={() => handleQuadrantClick('rockstar')}
          className={`p-5 rounded-2xl border transition-all cursor-pointer space-y-2 ${
            activeQuadrant === 'rockstar'
              ? 'bg-emerald-500/20 border-emerald-400 ring-2 ring-emerald-500/50 shadow-lg shadow-emerald-500/20 scale-[1.02]'
              : 'bg-white/5 border-emerald-500/30 hover:bg-emerald-500/10'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xl">🌟</span>
            <span className="px-2.5 py-0.5 text-xs font-black rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
              {rockstars.length} Candidates
            </span>
          </div>
          <h4 className="font-bold text-white text-sm">Rockstar Performers</h4>
          <p className="text-xs text-gray-400">High Score (&ge;{cutoffScore} pts) + Fast Speed (&le;30m). Highest priority interview recommendation.</p>
        </div>

        {/* Quadrant 2: Methodical */}
        <div
          onClick={() => handleQuadrantClick('methodical')}
          className={`p-5 rounded-2xl border transition-all cursor-pointer space-y-2 ${
            activeQuadrant === 'methodical'
              ? 'bg-blue-500/20 border-blue-400 ring-2 ring-blue-500/50 shadow-lg shadow-blue-500/20 scale-[1.02]'
              : 'bg-white/5 border-blue-500/30 hover:bg-blue-500/10'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xl">🐢</span>
            <span className="px-2.5 py-0.5 text-xs font-black rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/40">
              {methodicals.length} Candidates
            </span>
          </div>
          <h4 className="font-bold text-white text-sm">Methodical Engineers</h4>
          <p className="text-xs text-gray-400">High Score (&ge;{cutoffScore} pts) + Thorough Duration (&gt;30m). Reliable accuracy & detail focus.</p>
        </div>

        {/* Quadrant 3: Guessers */}
        <div
          onClick={() => handleQuadrantClick('guesser')}
          className={`p-5 rounded-2xl border transition-all cursor-pointer space-y-2 ${
            activeQuadrant === 'guesser'
              ? 'bg-amber-500/20 border-amber-400 ring-2 ring-amber-500/50 shadow-lg shadow-amber-500/20 scale-[1.02]'
              : 'bg-white/5 border-amber-500/30 hover:bg-amber-500/10'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xl">⚡</span>
            <span className="px-2.5 py-0.5 text-xs font-black rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40">
              {guessers.length} Candidates
            </span>
          </div>
          <h4 className="font-bold text-white text-sm">Speed Guessers</h4>
          <p className="text-xs text-gray-400">Low Score (&lt;{cutoffScore} pts) + Rushed Speed (&le;30m). High guesswork / rapid drop-off.</p>
        </div>

        {/* Quadrant 4: Underperforming */}
        <div
          onClick={() => handleQuadrantClick('underperforming')}
          className={`p-5 rounded-2xl border transition-all cursor-pointer space-y-2 ${
            activeQuadrant === 'underperforming'
              ? 'bg-red-500/20 border-red-400 ring-2 ring-red-500/50 shadow-lg shadow-red-500/20 scale-[1.02]'
              : 'bg-white/5 border-red-500/30 hover:bg-red-500/10'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xl">🔴</span>
            <span className="px-2.5 py-0.5 text-xs font-black rounded-full bg-red-500/20 text-red-400 border border-red-500/40">
              {underperformings.length} Candidates
            </span>
          </div>
          <h4 className="font-bold text-white text-sm">Needs Development</h4>
          <p className="text-xs text-gray-400">Low Score (&lt;{cutoffScore} pts) + Slow Speed (&gt;30m). Struggled with core skills & time constraint.</p>
        </div>
      </div>
    </div>
  );
}

export default QuadrantScatterChart;
