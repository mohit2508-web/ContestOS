import React, { useState, useEffect } from 'react';
import { Video, Code2, Radio, Sparkles, Cpu, ShieldCheck } from 'lucide-react';

interface InterviewLoaderProps {
  mode?: 'full' | 'inline' | 'skeleton';
  message?: string;
}

const MESSAGES = [
  'Initializing 1-on-1 WebRTC environment...',
  'Connecting to Monaco pair-programming engine...',
  'Fetching scheduled interview sessions...',
  'Encrypting real-time proctoring channel...',
  'Warming up sandbox execution engine...',
];

export const InterviewLoader: React.FC<InterviewLoaderProps> = ({
  mode = 'inline',
  message = 'Loading live interview portal...',
}) => {
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMsgIndex((prev) => (prev + 1) % MESSAGES.length);
    }, 2200);
    return () => clearInterval(interval);
  }, []);

  if (mode === 'skeleton') {
    return (
      <div className="space-y-4">
        {/* Animated Loading Indicator Bar */}
        <div className="flex items-center justify-between p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Radio className="w-5 h-5 animate-pulse text-cyan-400" />
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-cyan-400 animate-ping opacity-75" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white tracking-wide">{MESSAGES[msgIndex]}</span>
              </div>
              <p className="text-[10px] text-zinc-500 font-mono mt-0.5">Kryptavia OS Live Interview Engine • Encrypted Peer Protocol</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-1.5">
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className="w-1.5 h-6 rounded-full bg-cyan-500/40 animate-pulse"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        </div>

        {/* Skeleton Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="relative overflow-hidden bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-5 space-y-4 animate-pulse"
            >
              {/* Shimmer sweep line */}
              <div
                className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-cyan-500/5 to-transparent"
                style={{
                  backgroundImage: 'linear-gradient(90deg, transparent 0%, rgba(6, 182, 212, 0.08) 50%, transparent 100%)',
                }}
              />

              <div className="flex items-center justify-between">
                <div className="w-20 h-5 rounded-full bg-zinc-800" />
                <div className="w-24 h-4 rounded bg-zinc-800" />
              </div>

              <div className="w-3/4 h-6 rounded-lg bg-zinc-800" />

              <div className="space-y-2">
                <div className="w-1/2 h-4 rounded bg-zinc-800/60" />
                <div className="w-2/3 h-4 rounded bg-zinc-800/60" />
              </div>

              <div className="w-full h-10 rounded-xl bg-zinc-800/80" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (mode === 'full') {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
        {/* Glowing Background Radial */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.12)_0,transparent_60%)] pointer-events-none" />

        {/* Animated Cyber Core Icon */}
        <div className="relative mb-8">
          {/* Outer Rotating Conic Ring */}
          <div className="w-28 h-28 rounded-full border-2 border-cyan-500/20 border-t-cyan-400 border-r-amber-400 animate-spin" />
          
          {/* Inner Counter Rotating Ring */}
          <div className="absolute inset-2 w-24 h-24 rounded-full border-2 border-cyan-500/30 border-b-cyan-300 border-l-emerald-400 animate-[spin_3s_linear_infinite_reverse]" />

          {/* Center Glowing Emblem */}
          <div className="absolute inset-0 m-auto w-16 h-16 rounded-2xl bg-zinc-900 border border-cyan-500/40 shadow-xl shadow-cyan-500/20 flex items-center justify-center text-cyan-400">
            <Video className="w-8 h-8 animate-pulse text-cyan-400" />
          </div>

          <div className="absolute -bottom-2 -right-2 p-1.5 rounded-lg bg-amber-500 text-zinc-950 shadow-lg">
            <Sparkles className="w-4 h-4" />
          </div>
        </div>

        {/* Status Text */}
        <div className="max-w-md space-y-2 relative z-10">
          <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center justify-center gap-2">
            <span>Kryptavia OS</span>
            <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              1-on-1 MOCK INTERVIEW
            </span>
          </h2>

          <p className="text-sm font-medium text-cyan-400 h-6 flex items-center justify-center gap-2">
            <Cpu className="w-4 h-4 animate-spin text-cyan-400" />
            <span>{MESSAGES[msgIndex]}</span>
          </p>

          <p className="text-xs text-zinc-500">{message}</p>
        </div>

        {/* Equalizer Bars */}
        <div className="flex items-center gap-1.5 mt-8">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((bar) => (
            <span
              key={bar}
              className="w-1 bg-gradient-to-t from-cyan-500 to-amber-400 rounded-full animate-[bounce_1.4s_infinite]"
              style={{
                height: `${Math.sin(bar) * 12 + 20}px`,
                animationDelay: `${bar * 0.12}s`,
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  // Inline mode for dashboards
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 space-y-4">
      <div className="relative">
        <div className="w-16 h-16 rounded-full border-2 border-cyan-500/20 border-t-cyan-400 border-r-amber-400 animate-spin" />
        <div className="absolute inset-0 m-auto w-9 h-9 rounded-xl bg-zinc-900 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-md shadow-cyan-500/20">
          <Code2 className="w-5 h-5 animate-pulse" />
        </div>
      </div>

      <div className="text-center space-y-1">
        <p className="text-sm font-semibold text-white tracking-wide">{MESSAGES[msgIndex]}</p>
        <p className="text-xs text-zinc-500">{message}</p>
      </div>

      <div className="flex items-center gap-1">
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-cyan-400/80 animate-ping"
            style={{ animationDelay: `${i * 0.2}s` }}
          />
        ))}
      </div>
    </div>
  );
};
