import { useState } from 'react';

interface SebLaunchGateProps {
  contest: any;
  isJoined: boolean;
  onJoin: () => void;
  onLaunch: () => Promise<void>;
  onDownloadConfig?: () => void;
  joining?: boolean;
}

export default function SebLaunchGate({ contest, isJoined, onJoin, onLaunch, onDownloadConfig, joining }: SebLaunchGateProps) {
  const [launching, setLaunching] = useState(false);
  const [launched, setLaunched] = useState(false);
  const [hasJoined, setHasJoined] = useState(isJoined);

  const isJoinedEffective = isJoined || hasJoined;

  const handleJoinClick = async () => {
    setHasJoined(true);
    try {
      await onJoin();
    } catch {
      // handled
    }
  };

  const handleLaunch = async () => {
    setLaunching(true);
    try {
      await onLaunch();
      setLaunched(true);
    } catch {
      // error handled by parent
    } finally {
      setLaunching(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Ambient glows */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-amber-500/5 rounded-full blur-[80px]" />
        <div className="absolute bottom-0 left-1/4 w-[400px] h-[200px] bg-red-500/5 rounded-full blur-[80px]" />
      </div>

      <div className="relative w-full max-w-xl space-y-6">
        {/* Badge */}
        <div className="flex items-center justify-center">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-amber-500/10 border border-amber-500/25 rounded-full text-amber-400 text-xs font-black uppercase tracking-[0.2em]">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            Safe Exam Browser (SEB) Required
          </span>
        </div>

        {/* Card */}
        <div className="bg-zinc-950 border border-white/10 rounded-3xl overflow-hidden shadow-2xl p-8 space-y-6">
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-3xl">
              🔒
            </div>
          </div>

          <div className="text-center space-y-2">
            <h1 className="text-2xl font-black text-white tracking-tight">
              {contest?.title || 'Contest Exam'}
            </h1>
            <p className="text-xs text-gray-400 max-w-md mx-auto">
              This contest must be taken strictly inside <span className="text-white font-bold">Safe Exam Browser (SEB)</span> to ensure full exam integrity and proctoring.
            </p>
          </div>

          {/* Steps */}
          <div className="space-y-3">
            {[
              {
                step: '01',
                title: 'Install Safe Exam Browser',
                body: 'Download and install SEB on your laptop (Windows or macOS).',
                link: 'https://safeexambrowser.org/download_en.html',
                done: true,
              },
              {
                step: '02',
                title: 'Register Seat / Secret Passcode',
                body: 'Confirm candidate seat registration for this contest.',
                done: isJoinedEffective,
              },
              {
                step: '03',
                title: 'Launch SEB Exam Workspace',
                body: 'Click launch — SEB will automatically launch and enter locked proctored mode.',
                done: launched,
              },
            ].map((item) => (
              <div
                key={item.step}
                className={`flex gap-3 p-3.5 rounded-xl border ${
                  item.done ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-white/5 border-white/5'
                }`}
              >
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
                  item.done ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/10 text-gray-400'
                }`}>
                  {item.done ? '✓' : item.step}
                </div>
                <div>
                  <p className={`text-xs font-bold ${item.done ? 'text-emerald-400' : 'text-white'}`}>{item.title}</p>
                  <p className="text-[11px] text-gray-400 leading-relaxed">{item.body}</p>
                  {item.link && (
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-amber-400 font-bold hover:underline inline-block mt-1"
                    >
                      Download SEB ↗
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* CTA Actions */}
          {!isJoinedEffective ? (
            <button
              onClick={handleJoinClick}
              disabled={joining}
              className="w-full py-4 bg-gradient-to-r from-amber-500 to-amber-400 text-black font-black text-sm rounded-2xl hover:from-amber-400 hover:to-yellow-400 transition shadow-lg shadow-amber-500/20 cursor-pointer disabled:opacity-50"
            >
              {joining ? 'Registering Seat…' : 'Join Contest First →'}
            </button>
          ) : (
            <div className="space-y-3">
              <button
                onClick={handleLaunch}
                disabled={launching}
                className="w-full py-4 bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 text-black font-black text-sm rounded-2xl hover:from-amber-400 hover:to-yellow-400 transition shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {launching ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    Launching SEB Workspace…
                  </span>
                ) : (
                  <span>🚀 Launch in Safe Exam Browser (1-Click)</span>
                )}
              </button>

              {onDownloadConfig && (
                <button
                  onClick={onDownloadConfig}
                  className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  📥 Download `.seb` Config File
                </button>
              )}

              <button
                onClick={() => {
                  window.location.href = window.location.pathname + '?seb=1';
                }}
                className="w-full py-3 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                🧪 Test SEB Simulation Mode in Browser (?seb=1)
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
