import React, { useState } from 'react';

interface TypedMathInputProps {
  onInsertMath: (latex: string) => void;
  onClose: () => void;
}

export const TypedMathInput: React.FC<TypedMathInputProps> = ({ onInsertMath, onClose }) => {
  const [latexText, setLatexText] = useState('x^2 + \\frac{1}{2}');

  const presets = [
    { label: 'x²', val: 'x^2' },
    { label: 'Fraction', val: '\\frac{a}{b}' },
    { label: 'Square Root', val: '\\sqrt{x}' },
    { label: 'Summation', val: '\\sum_{i=1}^{n}' },
    { label: 'Integral', val: '\\int f(x)dx' },
    { label: 'Matrix', val: '\\begin{pmatrix}a & b \\\\ c & d\\end{pmatrix}' },
  ];

  const handleInsert = () => {
    if (latexText.trim()) {
      onInsertMath(latexText.trim());
      onClose();
    }
  };

  return (
    <div className="bg-[#1e293b] border border-cyan-500/30 rounded-xl p-4 shadow-xl space-y-3 max-w-sm w-full">
      <div className="flex items-center justify-between border-b border-[#334155] pb-2">
        <span className="text-xs font-extrabold text-cyan-400 uppercase tracking-wider flex items-center space-x-1">
          <span>∑</span>
          <span>Typed Math Mode (LaTeX)</span>
        </span>
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-white text-xs font-bold">✕</button>
      </div>

      <input
        type="text"
        value={latexText}
        onChange={(e) => setLatexText(e.target.value)}
        placeholder="Type LaTeX math e.g. x^2 + 5"
        className="w-full bg-[#0f172a] border border-[#334155] rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-cyan-400 font-mono"
      />

      {/* Preset Math Buttons */}
      <div className="flex flex-wrap gap-1.5">
        {presets.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => setLatexText((prev) => `${prev} ${p.val}`)}
            className="px-2 py-1 bg-[#0f172a] border border-[#334155] rounded text-[11px] text-slate-300 hover:text-cyan-300 font-mono"
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-end space-x-2 pt-2 border-t border-[#334155]">
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 bg-[#0f172a] text-slate-400 rounded-lg text-xs font-bold"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleInsert}
          className="px-4 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-black font-extrabold rounded-lg text-xs transition"
        >
          Stamp Math Formula
        </button>
      </div>
    </div>
  );
};
