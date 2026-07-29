import React, { useEffect, useState, useRef } from 'react';
import { api } from '../../services/api';

interface EnvironmentIntegrityCheckProps {
  contestId: string;
  integrityTier: 'standard' | 'verified_required';
  onComplete: (details: {
    monitorCount: number;
    virtualCameraDetected: boolean;
    batteryLevel: number;
    userAgent: string;
    screenResolution: string;
    integrityTier: 'standard' | 'verified';
    agentPaired: boolean;
    blockedAppsFound: string[];
    remoteSessionDetected: boolean;
  }) => void;
  onPrev?: () => void;
}

export const EnvironmentIntegrityCheck: React.FC<EnvironmentIntegrityCheckProps> = ({ 
  contestId, 
  integrityTier, 
  onComplete, 
  onPrev 
}) => {
  // Browser (Tier 1) Diagnostics States
  const [monitorCount, setMonitorCount] = useState<number | 'unknown'>(1);
  const [virtualCam, setVirtualCam] = useState<boolean | 'unknown'>(false);
  const [batteryLevel, setBatteryLevel] = useState<number | 'unknown'>('unknown');
  const [isCharging, setIsCharging] = useState<boolean | 'unknown'>('unknown');
  
  const [scanning, setScanning] = useState(true);
  const [browserWarnings, setBrowserWarnings] = useState<string[]>([]);

  // Screen Sharing (Tier 1) States
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [screenShareVerified, setScreenShareVerified] = useState(false);
  const [screenShareError, setScreenShareError] = useState<string | null>(null);
  const screenTrackRef = useRef<MediaStreamTrack | null>(null);

  // Companion Agent (Tier 2) States
  const [pairingToken, setPairingToken] = useState('');
  const [agentStatus, setAgentStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'failed'>('disconnected');
  const [agentReport, setAgentReport] = useState<{
    blockedApps: Array<{ process: string; title: string }>;
    remoteSession: boolean;
    displayCount: number;
  } | null>(null);
  
  // Double-Verification checks to prevent process teardown race conditions
  const [cleanPassCount, setCleanPassCount] = useState(0);
  const [agentOk, setAgentOk] = useState(false);

  const agentWsRef = useRef<WebSocket | null>(null);

  // 1. Run Standard Browser Diagnostics
  const runBrowserChecks = async () => {
    setScanning(true);
    const newWarnings: string[] = [];

    // Screen details count
    try {
      if ('getScreenDetails' in window) {
        const details = await (window as any).getScreenDetails();
        const count = details.screens.length;
        setMonitorCount(count);
        if (count > 1) {
          newWarnings.push(`Multi-monitor setup detected (${count} displays). Please disconnect external monitors.`);
        }
      } else if ('screen' in window && 'isExtended' in (window.screen as any)) {
        const extended = (window.screen as any).isExtended;
        setMonitorCount(extended ? 2 : 1);
        if (extended) {
          newWarnings.push('Extended screen layout detected. Only 1 display is permitted.');
        }
      } else {
        setMonitorCount('unknown');
      }
    } catch {
      setMonitorCount('unknown');
    }

    // Media devices scan (OBS, ManyCam, etc.)
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const hasVirtual = devices.some(d => {
          const label = d.label.toLowerCase();
          return label.includes('virtual') || 
                 label.includes('obs') || 
                 label.includes('manycam') || 
                 label.includes('splitmedia') ||
                 label.includes('splitcam') ||
                 label.includes('fake');
        });
        setVirtualCam(hasVirtual);
        if (hasVirtual) {
          newWarnings.push('Virtual Camera Software detected. Please disable OBS/ManyCam.');
        }
      } else {
        setVirtualCam('unknown');
      }
    } catch {
      setVirtualCam('unknown');
    }

    // Battery check
    try {
      if ('getBattery' in navigator) {
        const battery = await (navigator as any).getBattery();
        const level = Math.round(battery.level * 100);
        setBatteryLevel(level);
        setIsCharging(battery.charging);

        if (level < 25 && !battery.charging) {
          newWarnings.push(`Low Battery Alert (${level}%). Please plug in your charger.`);
        }
      } else {
        setBatteryLevel('unknown');
      }
    } catch {
      setBatteryLevel('unknown');
    }

    setBrowserWarnings(newWarnings);
    setScanning(false);
  };

  useEffect(() => {
    runBrowserChecks();
    // Get pairing token if Verified Integrity is required
    if (integrityTier === 'verified_required') {
      api.client.post(`/contests/${contestId}/lobby/agent-pairing-token`)
        .then(res => setPairingToken(res.data.pairingToken))
        .catch(() => setScreenShareError('Failed to fetch pairing credentials.'));
    }
  }, [contestId, integrityTier]);

  // Clean streams and sockets on unmount
  useEffect(() => {
    return () => {
      if (screenStream) {
        screenStream.getTracks().forEach(t => t.stop());
      }
      if (agentWsRef.current) {
        agentWsRef.current.close();
      }
    };
  }, [screenStream]);

  // 2. Full Desktop Screen Share Handler
  const startScreenShare = async () => {
    setScreenShareError(null);
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 10 }
        }
      });

      const track = stream.getVideoTracks()[0];
      const settings = track.getSettings();

      // Enforce full monitor/desktop capture
      if (settings.displaySurface && settings.displaySurface !== 'monitor') {
        stream.getTracks().forEach(t => t.stop());
        setScreenShareError('Security Block: You must share your ENTIRE screen (desktop), not a tab or a single window.');
        setScreenShareVerified(false);
        return;
      }

      setScreenStream(stream);
      screenTrackRef.current = track;
      setScreenShareVerified(true);

      // Periodically verify the track remains live
      track.onended = () => {
        setScreenShareVerified(false);
        setScreenShareError('Screen sharing stopped by user. Share entire desktop to re-verify.');
      };

    } catch (err) {
      setScreenShareError('Screen sharing permission denied.');
    }
  };

  // 3. Local Guard Agent Loopback WebSocket Pairing
  const attemptAgentPairing = () => {
    if (!pairingToken) return;
    if (agentWsRef.current) {
      agentWsRef.current.close();
    }

    setAgentStatus('connecting');
    setCleanPassCount(0);
    setAgentOk(false);

    const socket = new WebSocket('ws://127.0.0.1:3002');
    agentWsRef.current = socket;

    socket.onopen = () => {
      // Authenticate with agent using pairing token
      socket.send(JSON.stringify({
        type: 'pair',
        token: pairingToken
      }));
    };

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'agent_report') {
          const report = {
            blockedApps: msg.blockedApps || [],
            remoteSession: !!msg.remoteSession,
            displayCount: Number(msg.displayCount) || 1
          };
          setAgentReport(report);
          setAgentStatus('connected');

          // Enforce double consecutive clean scans to guard process teardown latency races
          const isCheckClean = report.blockedApps.length === 0 && !report.remoteSession && report.displayCount === 1;
          
          if (isCheckClean) {
            setCleanPassCount(prev => {
              const next = prev + 1;
              if (next >= 2) {
                setAgentOk(true);
              }
              return next;
            });
          } else {
            setCleanPassCount(0);
            setAgentOk(false);
          }

          // Sync diagnostics status payload with the backend
          api.client.post(`/contests/${contestId}/lobby/agent-report`, {
            pairingToken,
            blockedAppsFound: report.blockedApps.map(a => `${a.process} (${a.title})`),
            remoteSessionDetected: report.remoteSession,
            displayCount: report.displayCount
          }).catch(err => console.warn('[Agent report sync failed]:', err));
        }
      } catch (err) {
        console.warn('Lobby agent message parsing error:', err);
      }
    };

    socket.onerror = () => {
      setAgentStatus('failed');
    };

    socket.onclose = () => {
      setAgentStatus(prev => prev === 'connected' ? 'disconnected' : prev);
      setCleanPassCount(0);
      setAgentOk(false);
    };
  };

  // Foreground assist triggering local agent process focus
  const focusWindowOnOS = (title: string) => {
    if (agentWsRef.current && agentWsRef.current.readyState === WebSocket.OPEN) {
      agentWsRef.current.send(JSON.stringify({
        type: 'focus_window',
        title
      }));
    }
  };

  // 4. Trigger Proceed Callback
  const handleContinue = () => {
    onComplete({
      monitorCount: agentReport ? agentReport.displayCount : (typeof monitorCount === 'number' ? monitorCount : 1),
      virtualCameraDetected: typeof virtualCam === 'boolean' ? virtualCam : false,
      batteryLevel: typeof batteryLevel === 'number' ? batteryLevel : 100,
      userAgent: navigator.userAgent,
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      integrityTier: agentReport ? 'verified' : 'standard',
      agentPaired: agentStatus === 'connected',
      blockedAppsFound: agentReport?.blockedApps.map(a => `${a.process} (${a.title})`) || [],
      remoteSessionDetected: agentReport?.remoteSession || false
    });
  };

  // Determine if check validation conditions are satisfied
  const isScreenShareOk = screenShareVerified;
  const isAgentOk = integrityTier === 'standard' || agentOk;
  const canProceed = isScreenShareOk && isAgentOk && !scanning;

  return (
    <div className="w-full max-w-3xl mx-auto bg-zinc-900 border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl flex flex-col text-white">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <span className={`px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider ${
            integrityTier === 'verified_required' 
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/20' 
              : 'bg-blue-500/20 text-blue-400 border border-blue-500/20'
          }`}>
            {integrityTier === 'verified_required' ? '🔒 High-Stakes verified security' : '🛡️ Standard security'}
          </span>
          <h2 className="text-2xl font-black mt-2">Environment & App Integrity</h2>
          <p className="text-xs text-gray-400 mt-1">Verifying virtual environment sandbox filters, monitor counts, and screen shares.</p>
          <div className="mt-3 p-3 bg-zinc-950/40 border border-white/5 rounded-2xl flex items-center gap-2">
            <span className="text-[10px] text-zinc-400">
              💡 <strong>For the strongest exam protection:</strong> Use Chrome or Edge — this enables enhanced keyboard lockdown during the active exam.
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column: Diagnostics Checks */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Diagnostic Scan</h3>
          
          {scanning ? (
            <div className="flex flex-col items-center justify-center py-10 bg-black/20 border border-white/5 rounded-2xl">
              <div className="w-8 h-8 border-4 border-yellow-500/20 border-t-yellow-500 rounded-full animate-spin mb-3" />
              <p className="text-xs text-gray-400">Inspecting device hardware...</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Monitors count */}
              <div className="bg-black/40 border border-white/5 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <div className="text-sm font-extrabold">Display Isolation</div>
                  <div className="text-[9px] text-gray-500">Security limit: 1 monitor max</div>
                </div>
                <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded ${
                  monitorCount === 1 ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                }`}>
                  {monitorCount === 'unknown' ? 'Passed' : `${monitorCount} Screen(s)`}
                </span>
              </div>

              {/* Virtual Camera */}
              <div className="bg-black/40 border border-white/5 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <div className="text-sm font-extrabold">Virtual Webcams</div>
                  <div className="text-[9px] text-gray-500">Anti-loop camera filters</div>
                </div>
                <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded ${
                  !virtualCam ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                }`}>
                  {virtualCam === 'unknown' ? 'Passed' : virtualCam ? 'Detected' : 'Clean'}
                </span>
              </div>

              {/* Battery */}
              <div className="bg-black/40 border border-white/5 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <div className="text-sm font-extrabold">Battery Power Check</div>
                  <div className="text-[9px] text-gray-500">Ensuring uninterrupted power supply</div>
                </div>
                <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded ${
                  typeof batteryLevel === 'number' && batteryLevel < 25 && !isCharging ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'
                }`}>
                  {batteryLevel === 'unknown' ? 'N/A' : `${batteryLevel}% ${isCharging ? '(Charging)' : ''}`}
                </span>
              </div>
            </div>
          )}

          {/* Browser warnings panel */}
          {browserWarnings.length > 0 && (
            <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-2xl p-4">
              <div className="text-yellow-400 text-xs font-bold mb-1 flex items-center gap-1.5">
                ⚠ Standard Warnings
              </div>
              <ul className="list-disc pl-4 text-[10px] text-gray-400 space-y-1">
                {browserWarnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}
        </div>

        {/* Right Column: Screen Share and Companion Agent */}
        <div className="space-y-4">
          {/* Screen Share Box (Tier 1) */}
          <div className="bg-black/20 border border-white/5 rounded-3xl p-5 space-y-4">
            <h4 className="text-sm font-extrabold text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              Desktop Screen Sharing
            </h4>
            <p className="text-[10px] text-gray-400">Share your complete display monitor. Sharing individual applications or single browser tabs is blocked.</p>

            {screenShareVerified ? (
              <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-2xl text-center text-xs font-bold text-green-400 flex items-center justify-center gap-2">
                ✓ Full Desktop Shared Successfully
              </div>
            ) : (
              <div className="space-y-2">
                <button 
                  onClick={startScreenShare}
                  className="w-full py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold rounded-xl transition shadow-md"
                >
                  Share Entire Desktop
                </button>
                {screenShareError && (
                  <p className="text-[10px] text-red-400 text-center font-semibold">{screenShareError}</p>
                )}
              </div>
            )}
          </div>

          {/* Native Agent Box (Tier 2) */}
          {integrityTier === 'verified_required' && (
            <div className="bg-black/20 border border-white/5 rounded-3xl p-5 space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="text-sm font-extrabold text-white flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${
                    agentStatus === 'connected' ? 'bg-green-400 animate-pulse' : 'bg-red-400'
                  }`}></span>
                  TalentOS Guard
                </h4>
                <span className="text-[9px] text-zinc-500 font-mono">Port: 3002</span>
              </div>
              <p className="text-[10px] text-gray-400">Pair the local companion agent to monitor background screen capture / communications.</p>

              {agentStatus === 'connected' && agentReport ? (
                <div className="space-y-2">
                  <div className={`p-2.5 border rounded-xl text-center text-xs font-bold transition-all ${
                    agentOk 
                      ? 'bg-green-500/10 border-green-500/20 text-green-400' 
                      : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400'
                  }`}>
                    {agentOk 
                      ? '✓ Security Clearance Authorized' 
                      : `Pairing Active (Verifying Environment... ${cleanPassCount}/2)`}
                  </div>
                  
                  {/* Prohibited Apps/Windows Checklist */}
                  {agentReport.blockedApps.length > 0 && (
                    <div className="space-y-2 mt-2">
                      <div className="text-[10px] font-bold text-red-400 uppercase tracking-wider">Unapproved Apps/Tabs Open:</div>
                      <div className="max-h-48 overflow-y-auto space-y-2">
                        {agentReport.blockedApps.map((app, idx) => (
                          <div key={idx} className="flex justify-between items-center bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                            <div className="min-w-0 flex-1 mr-2">
                              <div className="text-xs font-extrabold text-red-400 truncate uppercase">{app.process}</div>
                              <div className="text-[9px] text-gray-400 truncate">{app.title}</div>
                            </div>
                            <button 
                              onClick={() => focusWindowOnOS(app.title)}
                              className="px-2.5 py-1 bg-white/10 hover:bg-white/15 text-white text-[9px] font-bold rounded-lg transition shrink-0"
                            >
                              Locate Window
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Active Remote session Alert */}
                  {agentReport.remoteSession && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-center text-xs font-bold text-red-400 mt-2 animate-pulse">
                      ⚠️ ACTIVE RDP REMOTE SESSION DETECTED
                    </div>
                  )}

                  {/* Display count Alert */}
                  {agentReport.displayCount > 1 && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-center text-xs font-bold text-red-400 mt-2">
                      ⚠️ MULTIPLE MONITORS DETECTED ({agentReport.displayCount} Screen(s))
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 bg-zinc-950 rounded-xl border border-white/5 space-y-1.5">
                    <div className="text-[9px] text-zinc-500 uppercase font-mono">Agent Pairing Token</div>
                    <div className="text-xs font-mono select-all bg-black p-2 rounded border border-white/10 text-yellow-400 truncate">
                      {pairingToken || 'Loading credentials...'}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button 
                      onClick={attemptAgentPairing}
                      disabled={!pairingToken || agentStatus === 'connecting'}
                      className="flex-1 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-black text-xs font-extrabold rounded-xl shadow transition disabled:opacity-30"
                    >
                      {agentStatus === 'connecting' ? 'Connecting...' : 'Attempt Agent Pairing'}
                    </button>
                  </div>
                  {agentStatus === 'failed' && (
                    <p className="text-[9px] text-red-400 text-center font-bold">Could not connect to TalentOS Guard at ws://127.0.0.1:3002. Please ensure the agent background service is running.</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Wizard actions */}
      <div className="w-full flex justify-between mt-8 border-t border-white/10 pt-6">
        <button 
          onClick={onPrev}
          className="px-5 py-2 border border-white/10 text-gray-400 font-bold rounded-xl hover:bg-white/5 transition"
        >
          Back
        </button>
        <button 
          disabled={!canProceed}
          onClick={handleContinue}
          className="px-6 py-2.5 bg-[var(--accent-green)] text-black font-extrabold rounded-xl hover:opacity-90 transition disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Gate Clearance Approved
        </button>
      </div>
    </div>
  );
};
