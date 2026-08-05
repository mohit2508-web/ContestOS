import { useState } from 'react';
import { useNotify } from '../notifications';

interface IrtCalibrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  questionTitle: string;
  currentVersion?: string;
  initialValues?: {
    difficultyIndex?: number;
    discriminationIndex?: number;
    targetMinutes?: number;
    bloomsLevel?: string;
    targetJobRole?: string;
    cppTimeLimitMs?: number;
    javaTimeLimitMs?: number;
    pythonTimeLimitMs?: number;
    memoryLimitMb?: number;
  };
  onSave?: (calibratedData: any) => void;
}

export function IrtCalibrationModal({
  isOpen,
  onClose,
  questionTitle,
  currentVersion = 'v1.0.0',
  initialValues,
  onSave,
}: IrtCalibrationModalProps) {
  const notify = useNotify();

  const [pValue, setPValue] = useState(initialValues?.difficultyIndex ?? 0.65);
  const [rPbis, setRPbis] = useState(initialValues?.discriminationIndex ?? 0.42);
  const [targetMinutes, setTargetMinutes] = useState(initialValues?.targetMinutes ?? 15);
  const [bloomsLevel, setBloomsLevel] = useState(initialValues?.bloomsLevel ?? 'Apply');
  const [jobRole, setJobRole] = useState(initialValues?.targetJobRole ?? 'SDE-1 (Backend)');
  
  const [cppMs, setCppMs] = useState(initialValues?.cppTimeLimitMs ?? 1000);
  const [javaMs, setJavaMs] = useState(initialValues?.javaTimeLimitMs ?? 2000);
  const [pyMs, setPyMs] = useState(initialValues?.pythonTimeLimitMs ?? 3000);
  const [memMb, setMemMb] = useState(initialValues?.memoryLimitMb ?? 256);

  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      notify.toast.success(`Psychometric IRT Calibration saved for ${currentVersion}!`);
      if (onSave) {
        onSave({
          difficultyIndex: pValue,
          discriminationIndex: rPbis,
          targetMinutes,
          bloomsLevel,
          targetJobRole: jobRole,
          limits: { cppMs, javaMs, pyMs, memMb },
        });
      }
      onClose();
    }, 400);
  };

  const getPValueQuality = (val: number) => {
    if (val < 0.3) return { text: 'Very Hard (Low Pass)', color: 'text-red-400' };
    if (val < 0.6) return { text: 'Moderate Hard', color: 'text-amber-400' };
    if (val < 0.8) return { text: 'Optimal Calibration', color: 'text-emerald-400' };
    return { text: 'Easy (High Pass)', color: 'text-blue-400' };
  };

  const getRPbisQuality = (val: number) => {
    if (val >= 0.4) return { text: 'Excellent Discrimination (Top vs Bottom)', color: 'text-emerald-400' };
    if (val >= 0.3) return { text: 'Good Discrimination', color: 'text-blue-400' };
    return { text: 'Weak Discrimination', color: 'text-amber-400' };
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-zinc-950 border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl space-y-6 p-6">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                SME Science Engine
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/5 text-zinc-400 font-mono">
                {currentVersion}
              </span>
            </div>
            <h2 className="text-xl font-black text-white mt-1">
              Item Calibration & IRT Metrics
            </h2>
            <p className="text-xs text-zinc-400 truncate max-w-md">
              "{questionTitle}"
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition"
          >
            ✕
          </button>
        </div>

        {/* 1. Item Response Theory (IRT) Metrics */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
            1. Psychometric & IRT Metrics
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-black border border-white/10 rounded-xl p-4">
            {/* P-Value (Difficulty Index) */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs text-zinc-400 font-medium">Difficulty Index (P-value)</label>
                <span className="text-xs font-mono font-bold text-white">{pValue.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.05"
                max="0.95"
                step="0.01"
                value={pValue}
                onChange={(e) => setPValue(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
              <span className={`text-[10px] font-bold block mt-1 ${getPValueQuality(pValue).color}`}>
                ● {getPValueQuality(pValue).text}
              </span>
            </div>

            {/* Discrimination Index (r_pbis) */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs text-zinc-400 font-medium">Discrimination Index (r_pbis)</label>
                <span className="text-xs font-mono font-bold text-white">{rPbis.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.10"
                max="0.80"
                step="0.01"
                value={rPbis}
                onChange={(e) => setRPbis(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
              <span className={`text-[10px] font-bold block mt-1 ${getRPbisQuality(rPbis).color}`}>
                ● {getRPbisQuality(rPbis).text}
              </span>
            </div>
          </div>
        </div>

        {/* 2. Taxonomy & Target Duration */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
            2. Taxonomy & Target Job Role
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] text-zinc-400 mb-1">Bloom's Taxonomy Level</label>
              <select
                value={bloomsLevel}
                onChange={(e) => setBloomsLevel(e.target.value)}
                className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-indigo-500"
              >
                <option value="Remember">Remember (Recall)</option>
                <option value="Understand">Understand (Comprehend)</option>
                <option value="Apply">Apply (Execute Algorithm)</option>
                <option value="Analyze">Analyze (Optimize Complexity)</option>
                <option value="Evaluate">Evaluate (Architectural Choice)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-zinc-400 mb-1">Target Job Role</label>
              <select
                value={jobRole}
                onChange={(e) => setJobRole(e.target.value)}
                className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-indigo-500"
              >
                <option value="SDE-1 (Backend)">SDE-1 (Backend)</option>
                <option value="Senior Backend Engineer">Senior Backend Engineer</option>
                <option value="Data Scientist">Data Scientist</option>
                <option value="QA Automation Engineer">QA Automation Engineer</option>
                <option value="DevOps & Cloud Engineer">DevOps & Cloud Engineer</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-zinc-400 mb-1">Target Time (Mins)</label>
              <input
                type="number"
                min="1"
                max="120"
                value={targetMinutes}
                onChange={(e) => setTargetMinutes(parseInt(e.target.value) || 15)}
                className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* 3. Sandbox Language Time & Memory Limits */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
            3. Sandbox Language Execution Limits
          </h3>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-black border border-white/10 rounded-xl p-4">
            <div>
              <label className="block text-[10px] text-zinc-400 font-mono mb-1">C++ Limit (ms)</label>
              <input
                type="number"
                step="100"
                value={cppMs}
                onChange={(e) => setCppMs(parseInt(e.target.value) || 1000)}
                className="w-full bg-zinc-950 border border-white/10 rounded px-2 py-1.5 text-xs text-white font-mono focus:border-indigo-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] text-zinc-400 font-mono mb-1">Java Limit (ms)</label>
              <input
                type="number"
                step="100"
                value={javaMs}
                onChange={(e) => setJavaMs(parseInt(e.target.value) || 2000)}
                className="w-full bg-zinc-950 border border-white/10 rounded px-2 py-1.5 text-xs text-white font-mono focus:border-indigo-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] text-zinc-400 font-mono mb-1">Python 3 (ms)</label>
              <input
                type="number"
                step="100"
                value={pyMs}
                onChange={(e) => setPyMs(parseInt(e.target.value) || 3000)}
                className="w-full bg-zinc-950 border border-white/10 rounded px-2 py-1.5 text-xs text-white font-mono focus:border-indigo-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] text-zinc-400 font-mono mb-1">Memory (MB)</label>
              <input
                type="number"
                step="64"
                value={memMb}
                onChange={(e) => setMemMb(parseInt(e.target.value) || 256)}
                className="w-full bg-zinc-950 border border-white/10 rounded px-2 py-1.5 text-xs text-white font-mono focus:border-indigo-500 outline-none"
              />
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-white/10 pt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-bold text-zinc-400 hover:text-white transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition shadow-lg shadow-indigo-600/20 disabled:opacity-40 flex items-center gap-2"
          >
            {saving ? 'Saving Calibration...' : 'Save IRT Calibration →'}
          </button>
        </div>

      </div>
    </div>
  );
}
