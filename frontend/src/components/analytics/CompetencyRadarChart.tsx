import React, { useState } from 'react';

export interface FormatCompetencyItem {
  id: string;
  format: string;
  icon: string;
  category: string;
  avgScore: number; // 0-100
  benchmarkScore?: number; // 0-100
  status: string;
  details: {
    topSkill: string;
    weakSkill: string;
    pBiserial: number;
    description: string;
  };
}

interface CompetencyRadarChartProps {
  items: FormatCompetencyItem[];
  onSelectFormat?: (item: FormatCompetencyItem) => void;
}

export function CompetencyRadarChart({ items, onSelectFormat }: CompetencyRadarChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const size = 380;
  const center = size / 2;
  const radius = center - 50;
  const totalAxes = items.length;

  // Calculate polygon points given scores array
  const getPoints = (getScore: (item: FormatCompetencyItem) => number) => {
    return items.map((item, idx) => {
      const angle = (Math.PI * 2 * idx) / totalAxes - Math.PI / 2;
      const score = Math.min(100, Math.max(0, getScore(item)));
      const r = (score / 100) * radius;
      const x = center + r * Math.cos(angle);
      const y = center + r * Math.sin(angle);
      return { x, y, angle, score, item };
    });
  };

  const cohortPoints = getPoints(item => item.avgScore);
  const benchmarkPoints = getPoints(item => item.benchmarkScore || 70);

  const cohortPolyStr = cohortPoints.map(p => `${p.x},${p.y}`).join(' ');
  const benchmarkPolyStr = benchmarkPoints.map(p => `${p.x},${p.y}`).join(' ');

  // Radial grid levels (20%, 40%, 60%, 80%, 100%)
  const levels = [0.2, 0.4, 0.6, 0.8, 1.0];

  return (
    <div className="bg-zinc-950 border border-white/10 rounded-2xl p-6 space-y-4 relative overflow-hidden shadow-2xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div>
          <h3 className="text-base font-black text-white flex items-center gap-2">
            🕸️ 10-Format Competency Radar
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Cohort proficiency profile mapped across all 10 assessment formats vs. Industry Benchmark (70%).
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs font-bold font-mono">
          <span className="flex items-center gap-1.5 text-teal-400">
            <span className="w-2.5 h-2.5 rounded-full bg-teal-400 inline-block shadow-sm shadow-teal-400/50" />
            Cohort Average
          </span>
          <span className="flex items-center gap-1.5 text-purple-400/80">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-400/80 border border-dashed border-purple-300 inline-block" />
            Benchmark (70%)
          </span>
        </div>
      </div>

      <div className="flex flex-col md:flex-row items-center justify-center gap-8 py-2">
        {/* SVG Radar */}
        <div className="relative w-[340px] h-[340px] sm:w-[380px] sm:h-[380px] flex-shrink-0">
          <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full">
            {/* Concentric Grid Circles / Polygons */}
            {levels.map((lvl, idx) => (
              <polygon
                key={idx}
                points={items
                  .map((_, i) => {
                    const angle = (Math.PI * 2 * i) / totalAxes - Math.PI / 2;
                    const r = radius * lvl;
                    return `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`;
                  })
                  .join(' ')}
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                className="text-white/10"
              />
            ))}

            {/* Axes Lines */}
            {items.map((_, idx) => {
              const angle = (Math.PI * 2 * idx) / totalAxes - Math.PI / 2;
              const x2 = center + radius * Math.cos(angle);
              const y2 = center + radius * Math.sin(angle);
              return (
                <line
                  key={idx}
                  x1={center}
                  y1={center}
                  x2={x2}
                  y2={y2}
                  stroke="currentColor"
                  strokeWidth="1"
                  className="text-white/10"
                />
              );
            })}

            {/* Benchmark Polygon */}
            <polygon
              points={benchmarkPolyStr}
              fill="rgba(168, 85, 247, 0.1)"
              stroke="#c084fc"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />

            {/* Cohort Polygon */}
            <polygon
              points={cohortPolyStr}
              fill="rgba(45, 212, 191, 0.25)"
              stroke="#2dd4bf"
              strokeWidth="2.5"
              className="transition-all duration-500 drop-shadow-[0_0_12px_rgba(45,212,191,0.4)]"
            />

            {/* Data Point Nodes */}
            {cohortPoints.map((pt, idx) => {
              const isHovered = hoveredIdx === idx;
              return (
                <g key={idx} className="cursor-pointer" onClick={() => onSelectFormat && onSelectFormat(pt.item)}>
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={isHovered ? 7 : 4}
                    className={`transition-all duration-200 ${
                      isHovered ? 'fill-emerald-300 stroke-white stroke-2 shadow-lg' : 'fill-teal-400 stroke-zinc-950 stroke-1'
                    }`}
                    onMouseEnter={() => setHoveredIdx(idx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                  />
                </g>
              );
            })}

            {/* Axis Icon Labels */}
            {items.map((item, idx) => {
              const angle = (Math.PI * 2 * idx) / totalAxes - Math.PI / 2;
              const labelRadius = radius + 24;
              const lx = center + labelRadius * Math.cos(angle);
              const ly = center + labelRadius * Math.sin(angle);
              const isHovered = hoveredIdx === idx;

              return (
                <text
                  key={idx}
                  x={lx}
                  y={ly}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  onClick={() => onSelectFormat && onSelectFormat(item)}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  className={`text-[11px] font-bold cursor-pointer transition-all duration-200 select-none ${
                    isHovered ? 'fill-teal-300 font-black text-xs scale-110' : 'fill-gray-400 hover:fill-white'
                  }`}
                >
                  {item.icon} {item.format.split(' ')[0]}
                </text>
              );
            })}
          </svg>
        </div>

        {/* Hover / Selected Format Detail Panel */}
        <div className="flex-1 w-full bg-white/5 border border-white/10 rounded-xl p-5 space-y-4">
          {hoveredIdx !== null ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{items[hoveredIdx].icon}</span>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-teal-400">{items[hoveredIdx].category}</span>
                    <h4 className="font-bold text-white text-sm">{items[hoveredIdx].format}</h4>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 text-xs font-bold rounded bg-teal-500/20 text-teal-400 border border-teal-500/30">
                  {items[hoveredIdx].status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-black/40 p-2.5 rounded-lg space-y-0.5">
                  <span className="text-[10px] text-gray-400 uppercase font-bold">Cohort Score</span>
                  <p className="text-base font-black text-teal-400">{items[hoveredIdx].avgScore}%</p>
                </div>
                <div className="bg-black/40 p-2.5 rounded-lg space-y-0.5">
                  <span className="text-[10px] text-gray-400 uppercase font-bold">Industry Benchmark</span>
                  <p className="text-base font-black text-purple-400">{items[hoveredIdx].benchmarkScore || 70}%</p>
                </div>
              </div>

              <p className="text-xs text-gray-300 line-clamp-2">{items[hoveredIdx].details.description}</p>

              {onSelectFormat && (
                <button
                  onClick={() => onSelectFormat(items[hoveredIdx])}
                  className="w-full py-2 bg-teal-500/10 text-teal-400 hover:bg-teal-500/20 font-bold text-xs rounded-lg border border-teal-500/30 transition"
                >
                  Inspect Full Telemetry &rarr;
                </button>
              )}
            </div>
          ) : (
            <div className="py-8 text-center space-y-2 text-gray-500">
              <span className="text-3xl block">💡</span>
              <p className="text-xs font-bold">Hover over any node on the Radar Spider Web to inspect format scores vs. industry benchmark.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default CompetencyRadarChart;
