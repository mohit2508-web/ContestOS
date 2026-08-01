import React, { useState } from 'react';

export type ProctorActionType = 'extend_time' | 'nudge' | 'force_submit' | 'reset_warnings' | 'force_fullscreen';

interface CandidateInfo {
  id: string;
  name: string;
  email: string;
}

interface ProctorActionModalProps {
  isOpen: boolean;
  actionType: ProctorActionType | null;
  candidate: CandidateInfo | null;
  onClose: () => void;
  onSubmit: (action: ProctorActionType, userId: string, payload?: Record<string, any>) => void;
}

export function ProctorActionModal({
  isOpen,
  actionType,
  candidate,
  onClose,
  onSubmit,
}: ProctorActionModalProps) {
  const [minutes, setMinutes] = useState<number>(15);
  const [warningReason, setWarningReason] = useState<string>('Please focus strictly on your exam environment.');
  const [submitReason, setSubmitReason] = useState<string>('Manual proctor intervention.');
  const [resetReason, setResetReason] = useState<string>('Manual proctor waiver.');

  if (!isOpen || !actionType || !candidate) return null;

  const handleConfirm = () => {
    if (actionType === 'extend_time') {
      onSubmit('extend_time', candidate.id, { minutes: Number(minutes) || 15 });
    } else if (actionType === 'nudge') {
      onSubmit('nudge', candidate.id, { reason: warningReason });
    } else if (actionType === 'force_submit') {
      onSubmit('force_submit', candidate.id, { reason: submitReason });
    } else if (actionType === 'reset_warnings') {
      onSubmit('reset_warnings', candidate.id, { reason: resetReason });
    } else if (actionType === 'force_fullscreen') {
      onSubmit('force_fullscreen', candidate.id);
    }
    onClose();
  };

  const PRESET_MINUTES = [5, 10, 15, 30, 45];
  const PRESET_WARNINGS = [
    'Please focus strictly on your exam environment.',
    'Multiple tab switch or browser blur events detected.',
    'Ensure webcam is unblocked and your face is visible.',
    'Copying or pasting code is strictly prohibited.',
    'System detected prohibited application running.',
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in select-text">
      <div className="bg-zinc-950 border border-white/10 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border text-lg ${
              actionType === 'extend_time'
                ? 'bg-purple-500/15 border-purple-500/30 text-purple-400'
                : actionType === 'nudge'
                ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                : actionType === 'force_submit'
                ? 'bg-red-500/15 border-red-500/30 text-red-400'
                : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
            }`}>
              {actionType === 'extend_time' ? '⏱️' : actionType === 'nudge' ? '🚨' : actionType === 'force_submit' ? '⚠️' : '✅'}
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white tracking-tight">
                {actionType === 'extend_time' && 'Extend Exam Duration'}
                {actionType === 'nudge' && 'Issue Official Proctor Warning'}
                {actionType === 'force_submit' && 'Confirm Disqualification / Force Submit'}
                {actionType === 'reset_warnings' && 'Reset Candidate Warnings'}
                {actionType === 'force_fullscreen' && 'Enforce Fullscreen Mode'}
              </h3>
              <p className="text-xs text-gray-400 mt-0.5 font-mono">
                Target: <span className="text-white font-bold">{candidate.name}</span> ({candidate.email})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 hover:bg-white/10 rounded-lg transition"
          >
            ✕
          </button>
        </div>

        {/* Content based on Action Type */}
        {actionType === 'extend_time' && (
          <div className="space-y-4">
            <p className="text-xs text-gray-300">
              Select or enter the extra duration in minutes to add to candidate's test timer:
            </p>
            <div className="flex flex-wrap gap-2">
              {PRESET_MINUTES.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMinutes(m)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold transition border ${
                    minutes === m
                      ? 'bg-purple-500 text-white border-purple-400 shadow-md shadow-purple-500/30'
                      : 'bg-white/5 text-gray-400 hover:text-white border-white/10'
                  }`}
                >
                  +{m} min
                </button>
              ))}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Custom Duration (Minutes)</label>
              <input
                type="number"
                min="1"
                max="180"
                value={minutes}
                onChange={(e) => setMinutes(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full bg-black border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-purple-400 outline-none font-mono"
              />
            </div>
          </div>
        )}

        {actionType === 'nudge' && (
          <div className="space-y-4">
            <p className="text-xs text-gray-300">
              Select a preset warning template or write a custom warning message for the candidate:
            </p>
            <div className="space-y-2">
              {PRESET_WARNINGS.map((msg, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setWarningReason(msg)}
                  className={`w-full text-left p-2.5 rounded-xl text-xs font-sans transition border ${
                    warningReason === msg
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold'
                      : 'bg-white/5 text-gray-400 hover:text-white border-white/10'
                  }`}
                >
                  • {msg}
                </button>
              ))}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Custom Warning Message</label>
              <textarea
                value={warningReason}
                onChange={(e) => setWarningReason(e.target.value)}
                className="w-full bg-black border border-white/10 rounded-xl p-3 text-xs text-white focus:border-amber-400 outline-none h-20"
              />
            </div>
          </div>
        )}

        {actionType === 'force_submit' && (
          <div className="space-y-4">
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-300 space-y-1">
              <p className="font-bold">⚠️ Warning: Irreversible Action</p>
              <p>This will immediately force-submit candidate's attempt and lock them out of the contest arena.</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Disqualification / Force Submit Reason</label>
              <input
                type="text"
                value={submitReason}
                onChange={(e) => setSubmitReason(e.target.value)}
                className="w-full bg-black border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:border-red-400 outline-none"
              />
            </div>
          </div>
        )}

        {actionType === 'reset_warnings' && (
          <div className="space-y-4">
            <p className="text-xs text-gray-300">
              Reset warning count to 0 and restore candidate attempt status back to active:
            </p>
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Reason for Waiver</label>
              <input
                type="text"
                value={resetReason}
                onChange={(e) => setResetReason(e.target.value)}
                className="w-full bg-black border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:border-emerald-400 outline-none"
              />
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-white/10 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white text-xs font-bold rounded-xl border border-white/10 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className={`px-5 py-2.5 text-xs font-black rounded-xl transition shadow-lg cursor-pointer ${
              actionType === 'extend_time'
                ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-600/30'
                : actionType === 'nudge'
                ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-amber-500/30'
                : actionType === 'force_submit'
                ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/30'
                : 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-500/30'
            }`}
          >
            {actionType === 'extend_time' && 'Extend Duration →'}
            {actionType === 'nudge' && 'Broadcast Warning Alert 🚨'}
            {actionType === 'force_submit' && 'Confirm Force Submit ⚠️'}
            {actionType === 'reset_warnings' && 'Reset Warnings ✅'}
          </button>
        </div>
      </div>
    </div>
  );
}
