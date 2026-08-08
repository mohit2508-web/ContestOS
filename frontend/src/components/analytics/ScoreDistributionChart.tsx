import React from 'react';

interface ScoreDistributionChartProps {
  cutoffScore: number;
  totalCandidates: number;
  avgScore: number;
}

export function ScoreDistributionChart({ cutoffScore, totalCandidates, avgScore }: ScoreDistributionChartProps) {
  // 5 Score brackets: 0-20, 21-40, 41-60, 61-80, 81-100
  const brackets = [
    { range: '0–20 pts', min: 0, max: 20, count: Math.max(0, Math.round(totalCandidates * 0.05)), pct: 5 },
    { range: '21–40 pts', min: 21, max: 40, count: Math.max(0, Math.round(totalCandidates * 0.15)), pct: 15 },
    { range: '41–60 pts', min: 41, max: 60, count: Math.max(0, Math.round(totalCandidates * 0.35)), pct: 35 },
    { range: '61–80 pts', min: 61, max: 80, count: Math.max(0, Math.round(totalCandidates * 0.30)), pct: 30 },
    { range: '81–100 pts', min: 81, max: 100, count: Math.max(0, Math.round(totalCandidates * 0.15)), pct: 15 },
  ];

  const maxPct = 40;

  return (
    <div className="bg-zinc-950 border border-white/10 rounded-2xl p-6 space-y-4 shadow-2xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div>
          <h3 className="text-base font-black text-white flex items-center gap-2">
            📈 Cohort Score Distribution Curve
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Gaussian candidate score spread with dynamic Cutoff ({cutoffScore} pts) qualification bands.
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs font-bold font-mono">
          <span className="flex items-center gap-1.5 text-emerald-400">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />
            Qualified (&ge;{cutoffScore})
          </span>
          <span className="flex items-center gap-1.5 text-red-400">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
            Below Threshold
          </span>
        </div>
      </div>

      <div className="space-y-4 pt-2">
        <div className="grid grid-cols-5 gap-3 items-end h-44 px-4 pt-6 border-b border-white/10 relative">
          {/* Cutoff Vertical Guideline */}
          <div
            className="absolute top-0 bottom-0 border-l-2 border-dashed border-amber-400 z-10 pointer-events-none transition-all duration-300"
            style={{ left: `${cutoffScore}%` }}
          >
            <span className="absolute -top-5 -translate-x-1/2 px-2 py-0.5 bg-amber-400 text-black text-[9px] font-black rounded shadow">
              Cutoff: {cutoffScore} pts
            </span>
          </div>

          {brackets.map((b, idx) => {
            const isQualified = b.max >= cutoffScore;
            const barHeightPct = (b.pct / maxPct) * 100;
            return (
              <div key={idx} className="flex flex-col items-center gap-2 h-full justify-end group relative">
                <span className="text-[10px] font-mono font-bold text-gray-400 group-hover:text-white transition">
                  {b.pct}% ({b.count})
                </span>
                <div
                  className={`w-full rounded-t-xl transition-all duration-500 shadow-lg ${
                    isQualified
                      ? 'bg-gradient-to-t from-emerald-600 to-teal-400 shadow-emerald-500/20'
                      : 'bg-gradient-to-t from-red-800 to-rose-600 shadow-red-500/20'
                  }`}
                  style={{ height: `${barHeightPct}%` }}
                />
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-5 gap-3 text-center text-[11px] font-mono text-gray-400">
          {brackets.map((b, idx) => (
            <span key={idx} className="font-bold">{b.range}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ScoreDistributionChart;
