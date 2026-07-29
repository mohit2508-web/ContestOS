import { useState } from "react";

export function JoinByCodeModal({ isOpen, onClose, onJoin, isJoining, error }: any) {
  const [code, setCode] = useState("");

  const handleSubmit = (e: any) => {
    e.preventDefault();
    if (code.trim().length === 8) {
      onJoin(code.toUpperCase());
    }
  };

  const handleClose = () => {
    setCode("");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/80" onClick={handleClose}>
      <div className="bg-[#111] border border-white/10 rounded-xl p-6 relative max-w-md w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-xl text-white">Join Session</h3>
          <button onClick={handleClose} className="p-1 hover:bg-white/10 rounded-lg transition-colors text-gray-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="mb-4">
          <p className="text-sm text-gray-400">Enter the 8-character session code provided by the session creator:</p>
        </div>

        <form onSubmit={handleSubmit}>
          {error && (
            <div className="mb-4 text-red-400 text-sm font-medium bg-red-500/10 border border-red-500/20 rounded p-3">
              {error}
            </div>
          )}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Session Code
            </label>
            <div className="relative">
              <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
              <input
                type="text"
                placeholder="e.g., ABC12XYZ"
                className="w-full pl-10 pr-4 py-3 bg-[#1a1a1a] border border-white/10 rounded-lg focus:outline-none focus:border-[var(--accent-green)] text-white uppercase font-mono font-bold text-center tracking-widest"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={8}
                required
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">Must be exactly 8 characters</p>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button type="button" onClick={handleClose} className="px-5 py-2.5 text-white bg-white/10 hover:bg-white/20 rounded-lg transition-colors font-medium">
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-[var(--accent-green)] text-black hover:bg-green-500 rounded-lg transition-colors font-bold disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isJoining || code.trim().length !== 8}
            >
              {isJoining ? "Joining..." : "Join Session"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
