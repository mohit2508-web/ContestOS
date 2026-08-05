import React, { useState } from 'react';

export const ProctorConsolePage: React.FC = () => {
  const [candidateFilter, setCandidateFilter] = useState<'ALL' | 'FLAGGED'>('ALL');
  const [candidates, setCandidates] = useState([
    { id: 'cand-1', name: 'Rohan Sharma', email: 'rohan@iitd.ac.in', status: 'ACTIVE', warnings: 1, videoFeed: true, tabSwitchCount: 2 },
    { id: 'cand-2', name: 'Priya Patel', email: 'priya@dtu.ac.in', status: 'FLAGGED', warnings: 3, videoFeed: true, tabSwitchCount: 5 },
    { id: 'cand-3', name: 'Amit Kumar', email: 'amit@nsut.ac.in', status: 'ACTIVE', warnings: 0, videoFeed: true, tabSwitchCount: 0 },
  ]);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const handleNudge = (name: string) => {
    setActionMsg(`Issued live warning nudge to candidate ${name}`);
    setTimeout(() => setActionMsg(null), 3000);
  };

  const handleEscalate = (id: string, name: string) => {
    setCandidates((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: 'ESCALATED_TO_ADMIN' } : c))
    );
    setActionMsg(`Escalated candidate ${name} to ORG_ADMIN for final disqualification decision.`);
    setTimeout(() => setActionMsg(null), 4000);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight mb-1">
            Live Exam Proctor Console<span className="text-rose-500">.</span>
          </h1>
          <p className="text-xs text-gray-400 font-medium">
            Invigilator feed for monitoring live exam telemetry, tab switches, and video feeds.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <span className="flex items-center space-x-2 text-xs font-bold text-rose-400 bg-rose-500/10 border border-rose-500/30 px-3 py-1.5 rounded-lg">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            <span>LIVE INVIGILATION ACTIVE</span>
          </span>
        </div>
      </div>

      {actionMsg && (
        <div className="p-4 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold">
          {actionMsg}
        </div>
      )}

      {/* Proctor Controls Bar */}
      <div className="flex items-center justify-between bg-[var(--bg-card)] border border-white/10 p-4 rounded-xl text-xs font-medium">
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setCandidateFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
              candidateFilter === 'ALL' ? 'bg-rose-500 text-white' : 'bg-white/5 text-gray-400 hover:text-white'
            }`}
          >
            All Candidates ({candidates.length})
          </button>
          <button
            type="button"
            onClick={() => setCandidateFilter('FLAGGED')}
            className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
              candidateFilter === 'FLAGGED' ? 'bg-amber-500 text-black' : 'bg-white/5 text-gray-400 hover:text-white'
            }`}
          >
            Flagged Violations ({candidates.filter((c) => c.warnings > 0).length})
          </button>
        </div>

        <span className="text-gray-500">Notice: Proctors can flag and nudge candidates. Disqualification requires ORG_ADMIN sign-off.</span>
      </div>

      {/* Live Video Feeds & Telemetry Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {candidates
          .filter((c) => (candidateFilter === 'FLAGGED' ? c.warnings > 0 : true))
          .map((cand) => (
            <div
              key={cand.id}
              className={`p-5 rounded-xl border flex flex-col justify-between space-y-4 ${
                cand.status === 'ESCALATED_TO_ADMIN'
                  ? 'bg-rose-500/10 border-rose-500/40'
                  : cand.warnings > 2
                  ? 'bg-amber-500/10 border-amber-500/40'
                  : 'bg-[var(--bg-card)] border-white/10'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">{cand.name}</span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      cand.status === 'ESCALATED_TO_ADMIN'
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        : cand.warnings > 0
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    }`}
                  >
                    {cand.status === 'ESCALATED_TO_ADMIN' ? 'ESCALATED TO ADMIN' : `Warnings: ${cand.warnings}/3`}
                  </span>
                </div>

                <div className="text-xs text-gray-400">{cand.email}</div>

                {/* Simulated Webcam Viewport */}
                <div className="relative h-36 bg-black/60 rounded-lg border border-white/10 flex items-center justify-center overflow-hidden">
                  <div className="text-center space-y-1">
                    <span className="text-2xl block">📹</span>
                    <span className="text-[10px] text-gray-500 font-mono">Live Video Stream 720p</span>
                  </div>
                  <span className="absolute top-2 left-2 text-[9px] font-bold px-1.5 py-0.5 bg-black/60 text-green-400 border border-green-500/30 rounded">
                    Webcam Active
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-gray-400 pt-1">
                  <div>Tab Switches: <span className="text-white font-bold">{cand.tabSwitchCount}</span></div>
                  <div>Integrity: <span className="text-emerald-400 font-bold">Passed</span></div>
                </div>
              </div>

              {/* Proctor Action Buttons */}
              <div className="pt-3 border-t border-white/10 flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => handleNudge(cand.name)}
                  className="flex-1 py-1.5 bg-white/5 hover:bg-white/10 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
                >
                  ⚠️ Issue Nudge
                </button>
                <button
                  type="button"
                  onClick={() => handleEscalate(cand.id, cand.name)}
                  className="flex-1 py-1.5 bg-rose-600/80 hover:bg-rose-600 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
                >
                  🚨 Escalate to Admin
                </button>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
};
