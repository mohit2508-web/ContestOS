import React from 'react';

interface BoardingPassProps {
  studentName: string;
  contestTitle: string;
  problemsCount: number;
  durationMins: number;
  qrCodeUrl: string;
  reportHash: string;
  onEnterSandbox: () => void;
  onEnterContest: () => void;
  isUpcoming: boolean;
  countdownString?: string;
}

export const BoardingPass: React.FC<BoardingPassProps> = ({
  studentName,
  contestTitle,
  problemsCount,
  durationMins,
  qrCodeUrl,
  reportHash,
  onEnterSandbox,
  onEnterContest,
  isUpcoming,
  countdownString
}) => {
  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col items-center">
      {/* Boarding Pass Box */}
      <div className="w-full bg-zinc-950 border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row relative">
        
        {/* Airline Background Watermark details */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-500/5 via-transparent to-transparent pointer-events-none" />

        {/* Left Section: Main Ticket Body */}
        <div className="flex-1 p-8 border-b md:border-b-0 md:border-r border-dashed border-white/10 relative">
          {/* Header Banner */}
          <div className="flex justify-between items-start mb-6">
            <div>
              <div className="text-[10px] uppercase font-bold tracking-widest text-[var(--accent-blue)]">TalentOS Air Assessment</div>
              <h2 className="text-xl font-black text-white mt-0.5">EXAM BOARDING PASS</h2>
            </div>
            <div className="text-right">
              <span className="px-2.5 py-1 bg-green-500/10 text-green-400 text-xs font-bold rounded-lg border border-green-500/20">
                GATE CLEARED
              </span>
            </div>
          </div>

          {/* Ticket Information Fields */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 mb-6">
            <div>
              <label className="block text-[10px] text-gray-500 uppercase font-semibold">PASSENGER NAME</label>
              <div className="text-sm font-bold text-white mt-1 uppercase">{studentName}</div>
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 uppercase font-semibold">ASSESSMENT CHAMBER</label>
              <div className="text-sm font-bold text-white mt-1 truncate">{contestTitle}</div>
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 uppercase font-semibold">PROBLEMS COUNT</label>
              <div className="text-sm font-bold text-white mt-1">{problemsCount} Items</div>
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 uppercase font-semibold">FLIGHT DURATION</label>
              <div className="text-sm font-bold text-white mt-1">{durationMins} Mins</div>
            </div>
            <div className="col-span-2">
              <label className="block text-[10px] text-gray-500 uppercase font-semibold">DIAGNOSTICS SIGNATURE HASH</label>
              <div className="text-[10px] font-mono text-gray-400 mt-1 break-all bg-white/5 p-1 rounded border border-white/5">{reportHash}</div>
            </div>
          </div>

          {/* Guidelines and Notes */}
          <div className="bg-white/5 border border-white/5 rounded-2xl p-4">
            <h4 className="text-xs font-bold text-white mb-2 uppercase tracking-wide">Secure Sandbox Guidelines</h4>
            <ul className="text-[11px] text-gray-400 space-y-1 list-disc pl-4">
              <li>Fullscreen is enforced. Exiting fullscreen logs a security violation.</li>
              <li>Multi-monitor setups are strictly disallowed during assessment.</li>
              <li>Keyboard bindings (PrintScreen, F12, copy/paste) are actively restricted.</li>
              <li>Ambient sounds & face presence are monitored via WebRTC capture hooks.</li>
              <li className="text-amber-400">Do not use trackpad gestures, multi-finger swipes, or virtual desktop shortcuts — these are logged and will trigger automatic submission after 3 warnings.</li>
            </ul>
          </div>
        </div>

        {/* Tear-Off Coupon Divider Line for styling */}
        <div className="hidden md:flex flex-col justify-between py-4 z-10 -mx-[8px]">
          <div className="w-4 h-4 bg-zinc-900 border-b border-r border-white/10 rounded-full rotate-45" />
          <div className="w-4 h-4 bg-zinc-900 border-t border-l border-white/10 rounded-full rotate-45" />
        </div>

        {/* Right Section: Tear-off Stub */}
        <div className="w-full md:w-64 p-8 bg-zinc-950 flex flex-col items-center justify-between text-center relative">
          <div className="w-full">
            <div className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">BOARDING GATE</div>
            <div className="text-4xl font-black text-[var(--accent-blue)]">GATE 01</div>
            <div className="text-xs text-gray-400 font-mono mt-1">SEAT: SECURE-01</div>
          </div>

          {/* QR Code */}
          <div className="my-6 bg-white p-3 rounded-2xl border border-white/10 shadow-lg flex items-center justify-center">
            {qrCodeUrl ? (
              <img src={qrCodeUrl} alt="Lobby Security QR Code" className="w-32 h-32" />
            ) : (
              <div className="w-32 h-32 bg-gray-200 animate-pulse rounded" />
            )}
          </div>

          <div className="w-full text-center">
            <div className="text-[9px] text-gray-500 uppercase font-bold tracking-wider mb-0.5">STATUS CODE</div>
            <div className="text-xs text-gray-400 font-mono">AUTH-VERIFIED-PASS</div>
          </div>
        </div>
      </div>

      {/* Countdown and Action Buttons */}
      <div className="w-full max-w-2xl mt-8 flex flex-col items-center gap-4 bg-zinc-900 border border-white/10 rounded-2xl p-6 shadow-xl text-center">
        {isUpcoming ? (
          <div>
            <div className="text-sm font-bold text-yellow-400 uppercase tracking-widest mb-1">
              GATE LOCK: WAITING ON FLIGHT BOARDING
            </div>
            <div className="text-4xl font-black text-white font-mono tracking-tight my-2">
              {countdownString || '00:00:00'}
            </div>
            <p className="text-xs text-gray-400">Assessment opens automatically when the countdown completes.</p>
          </div>
        ) : (
          <div>
            <div className="text-sm font-bold text-[var(--accent-green)] uppercase tracking-widest mb-1">
              ASSESSMENT IN PROGRESS
            </div>
            <p className="text-xs text-gray-400 mt-1">The doors are open. Prepare for entry into the secure proctored window.</p>
          </div>
        )}

        <div className="flex flex-wrap gap-4 justify-center w-full mt-2">
          <button 
            onClick={onEnterSandbox}
            className="px-6 py-2.5 bg-white/10 hover:bg-white/15 text-white font-bold rounded-xl transition flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            Pre-flight Sandbox Sandbox
          </button>
          
          <button 
            disabled={isUpcoming}
            onClick={onEnterContest}
            className="px-8 py-2.5 bg-gradient-to-r from-[var(--accent-green)] to-[var(--accent-blue)] text-black font-black rounded-xl hover:opacity-90 transition disabled:opacity-20 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(76,175,80,0.2)]"
          >
            Enter Secure Boarding Chamber
          </button>
        </div>
      </div>
    </div>
  );
};
