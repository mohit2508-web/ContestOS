import React from 'react';

interface InteractiveSliderGaugeProps {
  val: number | string;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  onChange: (val: number) => void;
}

export const InteractiveSliderGauge: React.FC<InteractiveSliderGaugeProps> = ({
  val,
  min = 0,
  max = 100,
  step = 1,
  unit = '',
  onChange,
}) => {
  const numericVal = typeof val === 'number' ? val : Number(val) || min;

  return (
    <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-[#1e293b] pb-3">
        <span className="text-xs uppercase font-extrabold text-teal-400 tracking-wider flex items-center space-x-2">
          <span>🎚️ Numerical Slider Estimation</span>
        </span>
        <span className="text-[11px] text-slate-400">Use slider or type precise value</span>
      </div>

      {/* Value Display Box */}
      <div className="flex items-center justify-between bg-[#080c14] border border-[#1e293b] p-4 rounded-xl">
        <span className="text-xs text-slate-400 font-bold uppercase">Estimated Value</span>
        <div className="flex items-center space-x-2">
          <input
            type="number"
            value={numericVal}
            min={min}
            max={max}
            step={step}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-24 bg-[#0f172a] border border-teal-500/40 rounded-lg p-2 text-right text-base font-mono font-bold text-teal-300 focus:outline-none focus:border-teal-400"
            aria-label="Typed numeric input value"
          />
          <span className="text-xs font-bold text-slate-400 font-mono">{unit}</span>
        </div>
      </div>

      {/* Interactive Slider Input */}
      <div className="space-y-2">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={numericVal}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full h-2 bg-[#1e293b] rounded-lg appearance-none cursor-pointer accent-teal-400"
          aria-valuenow={numericVal}
          aria-valuemin={min}
          aria-valuemax={max}
        />
        <div className="flex justify-between text-[10px] font-mono text-slate-500">
          <span>{min} {unit}</span>
          <span>{max} {unit}</span>
        </div>
      </div>
    </div>
  );
};
