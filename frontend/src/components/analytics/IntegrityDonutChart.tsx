import React from 'react';

interface IntegrityDonutChartProps {
  cleanAttemptsPct: number;
  flaggedCount: number;
  totalProctorEvents: number;
  riskLevel: string;
}

export function IntegrityDonutChart({ cleanAttemptsPct, flaggedCount, totalProctorEvents, riskLevel }: IntegrityDonutChartProps) {
  const cleanPct = Math.min(100, Math.max(0, cleanAttemptsPct));
  const warningPct = Math.max(0, 100 - cleanPct);

  const radius = 60;
  const strokeWidth = 14;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (cleanPct / 100) * circumference;

  return (
    <div className="bg-zinc-950 border border-white/10 rounded-2xl p-6 space-y-4 shadow-2xl">
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div>
          <h3 className="text-base font-black text-white flex items-center gap-2">
            ⭕ Integrity Compliance Donut
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            System proctoring compliance & integrity trust rating.
          </p>
        </div>
        <span className={`px-2.5 py-1 text-xs font-black rounded-xl uppercase ${
          riskLevel.includes('Low') ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
          riskLevel.includes('Moderate') ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
        }`}>
          {riskLevel}
        </span>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-around gap-6 pt-2">
        {/* SVG Donut */}
        <div className="relative w-36 h-36 flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 150 150">
            {/* Background Ring */}
            <circle
              cx="75"
              cy="75"
              r={radius}
              stroke="rgba(239, 68, 68, 0.3)"
              strokeWidth={strokeWidth}
              fill="transparent"
            />
            {/* Progress Ring */}
            <circle
              cx="75"
              cy="75"
              r={radius}
              stroke="#10b981"
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
              className="transition-all duration-1000 ease-out"
            />
          </svg>
          <div className="absolute text-center">
            <span className="text-2xl font-black text-white font-mono">{cleanPct}%</span>
            <span className="text-[9px] uppercase font-bold text-emerald-400 block">Clean</span>
          </div>
        </div>

        {/* Breakdown Legend */}
        <div className="space-y-3 text-xs font-mono">
          <div className="flex items-center gap-3 bg-white/5 p-2.5 rounded-xl border border-white/5">
            <span className="w-3 h-3 rounded-full bg-emerald-400" />
            <div>
              <span className="text-gray-400">Unflagged Sessions:</span>
              <p className="font-bold text-white">{cleanPct}% of cohort</p>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-white/5 p-2.5 rounded-xl border border-white/5">
            <span className="w-3 h-3 rounded-full bg-red-400" />
            <div>
              <span className="text-gray-400">Proctoring Events Logged:</span>
              <p className="font-bold text-red-400">{totalProctorEvents} events ({flaggedCount} candidates)</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default IntegrityDonutChart;
