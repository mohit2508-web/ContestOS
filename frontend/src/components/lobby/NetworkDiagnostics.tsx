import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';

interface NetworkDiagnosticsProps {
  contestId: string;
  onComplete: (metrics: {
    pingMs: number;
    downloadSpeedMbps: number;
    warmupTimings: Record<string, number>;
  }) => void;
  onPrev?: () => void;
}

export const NetworkDiagnostics: React.FC<NetworkDiagnosticsProps> = ({ contestId, onComplete, onPrev }) => {
  const [stage, setStage] = useState<'idle' | 'pinging' | 'bandwidth' | 'warmup' | 'done'>('idle');
  const [ping, setPing] = useState<number | null>(null);
  const [downloadSpeed, setDownloadSpeed] = useState<number | null>(null);
  const [warmupResults, setWarmupResults] = useState<Record<string, number>>({});
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  const runDiagnostics = async () => {
    setError('');
    setProgress(10);
    setStage('pinging');

    try {
      // 1. Measure API RTT (Ping)
      const pings: number[] = [];
      const baseUrl = api.client.defaults.baseURL || 'http://localhost:5000/api';
      const healthUrl = baseUrl.replace('/api', '') + '/health';
      
      for (let i = 0; i < 3; i++) {
        const start = Date.now();
        await fetch(healthUrl, { cache: 'no-store' });
        pings.push(Date.now() - start);
        setProgress(10 + (i + 1) * 15); // max 55%
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      const avgPing = Math.round(pings.reduce((a, b) => a + b, 0) / pings.length);
      setPing(avgPing);

      // 2. Measure Bandwidth
      setStage('bandwidth');
      setProgress(60);
      
      const startDownload = Date.now();
      const downloadRes = await fetch('/favicon.png', { cache: 'no-store' });
      if (!downloadRes.ok) throw new Error('Download failed');
      const blob = await downloadRes.blob();
      const endDownload = Date.now();
      
      const durationSeconds = (endDownload - startDownload) / 1000;
      const sizeBits = blob.size * 8;
      const speedMbps = Number(((sizeBits / durationSeconds) / (1024 * 1024)).toFixed(2));
      
      setDownloadSpeed(speedMbps);
      setProgress(80);

      // 3. Trigger compiler warm-ups
      setStage('warmup');
      const warmupRes = await api.client.get(`/contests/${contestId}/lobby/warmup`);
      const timings: Record<string, number> = {};
      
      if (warmupRes.data && warmupRes.data.warmupResults) {
        Object.keys(warmupRes.data.warmupResults).forEach(lang => {
          timings[lang] = warmupRes.data.warmupResults[lang].time;
        });
      }
      setWarmupResults(timings);
      
      setProgress(100);
      setStage('done');
      
      // Auto trigger complete callback
      onComplete({
        pingMs: avgPing,
        downloadSpeedMbps: speedMbps,
        warmupTimings: timings
      });
    } catch (err: any) {
      console.error('Diagnostics failed:', err);
      setError('Network validation failed. Please check your internet connection and try again.');
      setStage('idle');
      setProgress(0);
    }
  };

  useEffect(() => {
    runDiagnostics();
  }, [contestId]);

  return (
    <div className="w-full max-w-2xl mx-auto bg-zinc-900 border border-white/10 rounded-2xl p-6 shadow-xl flex flex-col">
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold tracking-tight text-white flex items-center justify-center gap-2">
          <svg className="w-6 h-6 text-[var(--accent-blue)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Infra Gate Diagnostics
        </h2>
        <p className="text-xs text-gray-400 mt-1">Verifying server communication, latency check, and compiling test environments.</p>
      </div>

      {error && (
        <div className="w-full mb-6 p-4 text-center bg-red-500/10 border border-red-500/20 rounded-xl">
          <p className="text-red-400 text-sm font-semibold">{error}</p>
          <button 
            onClick={runDiagnostics} 
            className="mt-3 px-4 py-1.5 bg-red-500 text-white font-bold rounded-lg text-xs hover:bg-red-600 transition"
          >
            Retry Check
          </button>
        </div>
      )}

      {/* Diagnostics Progress and Statuses */}
      <div className="space-y-4">
        {/* Progress Bar */}
        <div className="flex justify-between text-xs text-gray-400 font-mono mb-1">
          <span>Gate Scanner: {stage === 'pinging' ? 'Pinging host...' : stage === 'bandwidth' ? 'Testing bandwidth...' : stage === 'warmup' ? 'Warming up compilers...' : 'Finished checks'}</span>
          <span>{progress}%</span>
        </div>
        <div className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-green)] transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Latency RTT Card */}
        <div className="bg-zinc-950 border border-white/5 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${ping !== null ? (ping < 150 ? 'bg-green-500' : 'bg-yellow-500') : 'bg-zinc-700 animate-pulse'}`} />
            <div>
              <div className="text-sm font-bold text-white">API Latency RTT</div>
              <div className="text-[10px] text-gray-500">Target: &lt; 250ms</div>
            </div>
          </div>
          <div className="text-right font-mono font-bold text-white">
            {ping !== null ? `${ping} ms` : <span className="text-gray-600">Pending...</span>}
          </div>
        </div>

        {/* Download Speed Card */}
        <div className="bg-zinc-950 border border-white/5 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${downloadSpeed !== null ? (downloadSpeed > 2 ? 'bg-green-500' : 'bg-yellow-500') : 'bg-zinc-700 animate-pulse'}`} />
            <div>
              <div className="text-sm font-bold text-white">Bandwidth Downstream</div>
              <div className="text-[10px] text-gray-500">Target: &gt; 1.5 Mbps</div>
            </div>
          </div>
          <div className="text-right font-mono font-bold text-white">
            {downloadSpeed !== null ? `${downloadSpeed} Mbps` : <span className="text-gray-600">Pending...</span>}
          </div>
        </div>

        {/* Compiler Warm-up Card */}
        <div className="bg-zinc-950 border border-white/5 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${Object.keys(warmupResults).length > 0 ? 'bg-green-500' : 'bg-zinc-700 animate-pulse'}`} />
              <div>
                <div className="text-sm font-bold text-white">Judge0 Compiler Warm-up</div>
                <div className="text-[10px] text-gray-500">Running Hello-World tests in contest languages</div>
              </div>
            </div>
          </div>

          {Object.keys(warmupResults).length > 0 ? (
            <div className="grid grid-cols-2 gap-2 mt-2 font-mono text-xs pl-6">
              {Object.entries(warmupResults).map(([lang, duration]) => (
                <div key={lang} className="flex justify-between border-b border-white/5 pb-1 text-gray-300">
                  <span className="capitalize">{lang}:</span>
                  <span className="font-bold text-[var(--accent-green)]">{duration} ms</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[10px] text-gray-600 italic pl-6">Warming up execution servers...</p>
          )}
        </div>
      </div>

      <div className="w-full flex justify-between mt-6">
        <button 
          onClick={onPrev}
          className="px-4 py-2 border border-white/10 text-gray-400 font-semibold rounded-lg hover:bg-white/5 transition"
        >
          Back
        </button>
        <button 
          disabled={stage !== 'done'}
          onClick={() => onComplete({
            pingMs: ping || 50,
            downloadSpeedMbps: downloadSpeed || 5.0,
            warmupTimings: warmupResults
          })}
          className="px-5 py-2 bg-[var(--accent-green)] text-black font-extrabold rounded-lg hover:opacity-90 transition disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Continue
        </button>
      </div>
    </div>
  );
};
